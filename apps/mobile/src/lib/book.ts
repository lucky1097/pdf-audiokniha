// One open book: the generation queue and the player, in one place so they always agree on what is ready.
// Generation runs ahead of the player (the next few sentences first), then the rest of the book when the user
// asks for it. iOS keeps the app running while audio plays, so it keeps generating with the screen locked.
import { PARAGRAPH_GAP, SENTENCE_GAP, chapterSentences, wavBytes, type Project, type Sentence } from "@audiokniha/core";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { NO_VOICE_MESSAGE, downloadModel, loadEngine, modelDownloaded, synthesize, voiceAvailable, type DownloadProgress } from "./engine.ts";
import { audioBytes, audioFile, deleteBookAudio, hasAudio, listProjects, saveProject, writeAudio, writeRawWav } from "./storage.ts";

const AHEAD = 6;
/** Before anything was generated: about 0.28 real-time factor at ~14 characters of speech a second (measured on iPhone). */
const DEFAULT_SECONDS_PER_CHAR = 0.02;
export const RATES = [1, 1.25, 1.5, 2, 0.75] as const;

export type Phase = "idle" | "downloading" | "loading" | "generating" | "error";

export interface BookState {
  project: Project;
  chapter: number;
  sentence: number;
  playing: boolean;
  /** The player waits for the current sentence to be generated. */
  waiting: boolean;
  rate: number;
  phase: Phase;
  download: DownloadProgress | null;
  error: string | null;
  /** Ready sentences per chapter. */
  ready: number[];
  total: number[];
  /** Real-time factor of the last sentence (generation time / audio time). */
  rtf: number | null;
  /** Running average of generation seconds per character of sentence text; drives estimate(). */
  secondsPerChar: number;
}

type Listener = () => void;

/** Where the player is inside the sentence being played. Its own subscription: it changes ten times a second. */
export interface Progress {
  /** The sentence's cache key, so a status from the previous sentence is never taken for this one. */
  key: string;
  time: number;
  duration: number;
}

export class BookController {
  private state: BookState;
  private listeners = new Set<Listener>();
  private sentences = new Map<number, Sentence[]>();
  private player: AudioPlayer | null = null;
  private playerReady: Promise<AudioPlayer> | null = null;
  /** The loaded sentence has been heard playing (so a stop after this is a pause, not the load). */
  private started = false;
  /** Silence loops while the player waits for the voice, so iOS keeps the app (and the generation) running. */
  private silent = false;
  /** Play/pause reports from the player right after our own command are its echo, not the user's. */
  private quietUntil = 0;
  private lastStatusAt = 0;
  /** When the current sentence was loaded, to notice one that never starts. */
  private loadedAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private pumping = false;
  private disposed = false;
  private progress: Progress = { key: "", time: 0, duration: 0 };
  private progressListeners = new Set<Listener>();
  /** A sentence was measured this session, so the next measurement is averaged in rather than replacing the default. */
  private measured = false;
  private sentencesSinceSave = 0;
  /** Set by deleteAudio(): the pump writes nothing more and starts nothing new until the files are gone. */
  private halted = false;
  /** The running pump, so deleteAudio() can wait for the sentence in flight before it deletes files. */
  private pumpDone: Promise<void> | null = null;

  constructor(project: Project) {
    const { chapter, segment } = project.position;
    this.state = {
      project,
      chapter: Math.min(chapter, project.chapters.length - 1),
      sentence: segment,
      playing: false,
      waiting: false,
      rate: 1,
      phase: "idle",
      download: null,
      error: null,
      ready: [],
      total: [],
      rtf: null,
      secondsPerChar: project.secondsPerChar ?? DEFAULT_SECONDS_PER_CHAR,
    };
    this.recount();
    // A queued chapter that is already complete leaves the queue (its audio may have been made before the queue ended).
    const queued = project.queued ?? [];
    const open = queued.filter((c) => this.state.ready[c] < this.state.total[c]);
    if (open.length !== queued.length) this.saveWithout({ queued: open });
    if (this.state.project.generating || open.length) void this.pump();
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getState = () => this.state;

  subscribeProgress = (l: Listener) => {
    this.progressListeners.add(l);
    return () => void this.progressListeners.delete(l);
  };
  getProgress = () => this.progress;

  private setProgress(p: Progress) {
    this.progress = p;
    for (const l of this.progressListeners) l();
  }

  private set(patch: Partial<BookState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  sentencesOf(chapter: number): Sentence[] {
    let s = this.sentences.get(chapter);
    if (!s) this.sentences.set(chapter, (s = chapterSentences(this.state.project, chapter)));
    return s;
  }

  private recount() {
    const ready: number[] = [];
    const total: number[] = [];
    this.state.project.chapters.forEach((_, c) => {
      const s = this.sentencesOf(c);
      total.push(s.length);
      ready.push(s.filter((x) => hasAudio(x.key)).length);
    });
    this.set({ ready, total });
  }

  /** Saves a changed project; sentence lists are rebuilt (voice, language or a seed changed). */
  update(patch: Partial<Project>) {
    const project = { ...this.state.project, ...patch, updated: Date.now() };
    saveProject(project);
    this.sentences.clear();
    this.set({ project });
    this.recount();
    void this.pump();
  }

  // ------------------------------------------------------------------ generation

  private nextJob(): { chapter: number; s: Sentence } | null {
    if (this.halted) return null;
    const { chapter, sentence, project } = this.state;
    const here = this.sentencesOf(chapter);
    for (const s of here.slice(sentence, sentence + AHEAD)) if (!hasAudio(s.key)) return { chapter, s };
    // Chapters the user asked for one by one, in the order asked.
    for (const c of project.queued ?? []) for (const s of this.sentencesOf(c)) if (!hasAudio(s.key)) return { chapter: c, s };
    if (!project.generating) return null;
    // The whole book: from the current chapter to the end, then from the start.
    const order = [...project.chapters.keys()].map((i) => (chapter + i) % project.chapters.length);
    for (const c of order) for (const s of this.sentencesOf(c)) if (!hasAudio(s.key)) return { chapter: c, s };
    return null;
  }

  private async ensureModel() {
    // Without the native runtime (Expo Go) the 380 MB model would be downloaded for nothing.
    if (!voiceAvailable) throw new Error(NO_VOICE_MESSAGE);
    if (!modelDownloaded()) {
      this.set({ phase: "downloading", download: { bytes: 0, total: 1, file: 0, files: 1 } });
      await downloadModel((download) => this.set({ download }));
      this.set({ download: null });
    }
    this.set({ phase: "loading" });
    await loadEngine();
  }

  private pump() {
    if (this.pumping || this.disposed) return;
    if (!this.nextJob()) return;
    this.pumping = true;
    this.pumpDone = this.run();
  }

  private async run() {
    try {
      await this.ensureModel();
      this.set({ phase: "generating", error: null });
      let awake = false;
      for (let job = this.nextJob(); job && !this.disposed; job = this.nextJob()) {
        const p = this.state.project;
        // Checked per sentence: "Vytvoriť audioknihu" may be pressed while the pump already runs for the next sentences.
        if (!awake && (p.generating || p.queued?.length)) {
          awake = true;
          await activateKeepAwakeAsync("generate").catch(() => {});
        }
        const t0 = Date.now();
        const { pcm, sampleRate } = await synthesize(job.s.text, p.lang, p.voice, p.steps, job.s.seed);
        // Deleted while this sentence was being made: its audio is dropped, not written after the delete.
        if (this.halted) break;
        await writeAudio(job.s.key, wavBytes(pcm, sampleRate, job.s.paragraphEnd ? PARAGRAPH_GAP : SENTENCE_GAP));
        const seconds = (Date.now() - t0) / 1000;
        const ready = [...this.state.ready];
        ready[job.chapter] += 1;
        const perChar = seconds / Math.max(1, job.s.text.length);
        const secondsPerChar = this.measured ? 0.8 * this.state.secondsPerChar + 0.2 * perChar : perChar;
        this.measured = true;
        this.set({ ready, rtf: seconds / (pcm.length / sampleRate), secondsPerChar });
        if (this.state.waiting) void this.playCurrent();
        // A queued chapter that is now complete leaves the queue.
        const queue = this.state.project.queued ?? [];
        if (queue.includes(job.chapter) && ready[job.chapter] >= this.state.total[job.chapter]) {
          this.saveWithout({ queued: queue.filter((c) => c !== job.chapter) });
        }
        if (++this.sentencesSinceSave >= 20) this.persistRate();
      }
      if (this.state.project.generating && !this.nextJob()) this.update({ generating: false });
      this.set({ phase: "idle" });
    } catch (e) {
      this.set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    } finally {
      if (this.sentencesSinceSave) this.persistRate();
      deactivateKeepAwake("generate");
      this.pumping = false;
      this.pumpDone = null;
    }
  }

  /** Saves a change without starting the queue (update() would). */
  private saveWithout(patch: Partial<Project>) {
    const project = { ...this.state.project, ...patch, updated: Date.now() };
    saveProject(project);
    this.set({ project });
  }

  /** The measured speed is kept for the next session; saved every 20 sentences and when the pump ends. */
  private persistRate() {
    this.sentencesSinceSave = 0;
    this.saveWithout({ secondsPerChar: this.state.secondsPerChar });
  }

  /** Retries after an error (a failed download resumes with the files already saved). */
  retry() {
    this.set({ phase: "idle", error: null });
    void this.pump();
  }

  setWholeBook(on: boolean) {
    this.update({ generating: on });
  }

  /** "Generate again": a new seed gives a new reading of the same sentence. */
  regenerate(chapter: number, s: Sentence) {
    this.update({ seeds: { ...this.state.project.seeds, [s.base]: s.seed + 1 } });
    if (chapter === this.state.chapter && s.index === this.state.sentence && this.state.playing) void this.playCurrent();
  }

  /** Asks for one chapter to be prepared for offline listening. */
  prepareChapter(c: number) {
    const queued = this.state.project.queued ?? [];
    if (queued.includes(c) || this.state.ready[c] >= this.state.total[c]) return;
    this.update({ queued: [...queued, c] });
  }

  cancelChapter(c: number) {
    this.saveWithout({ queued: (this.state.project.queued ?? []).filter((x) => x !== c) });
  }

  isQueued(c: number): boolean {
    return (this.state.project.queued ?? []).includes(c);
  }

  /** Seconds to generate the sentences without audio in these chapters, at the measured speed. */
  estimate(chapters: number[] | "all"): number {
    const list = chapters === "all" ? this.state.project.chapters.map((_, i) => i) : chapters;
    let chars = 0;
    for (const c of list) for (const s of this.sentencesOf(c)) if (!hasAudio(s.key)) chars += s.text.length;
    return chars * this.state.secondsPerChar;
  }

  // ------------------------------------------------------------------ player

  private ensurePlayer(): Promise<AudioPlayer> {
    // One player, even when two calls ask for it before the first one has it ready.
    this.playerReady ??= (async () => {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" });
      // Ten updates a second: enough to follow the voice word by word in the read-along view.
      const player = createAudioPlayer(null, { updateInterval: 100 });
      player.addListener("playbackStatusUpdate", (st) => this.onStatus(st));
      this.player = player;
      this.watchdog = setInterval(() => this.checkStuck(), 1000);
      return player;
    })();
    return this.playerReady;
  }

  private onStatus(st: AudioStatus) {
    this.lastStatusAt = Date.now();
    if (this.progress.key && st.isLoaded && st.duration > 0 && (st.currentTime !== this.progress.time || st.duration !== this.progress.duration)) {
      this.setProgress({ key: this.progress.key, time: st.currentTime, duration: st.duration });
    }
    if (st.didJustFinish) {
      if (this.state.playing && !this.silent) this.advance();
      return;
    }
    if (Date.now() < this.quietUntil) return;
    if (st.playing) {
      this.started = true;
      // Play from the lock screen, Control Center or headphones goes to the player directly.
      if (!this.state.playing) this.set({ playing: true });
    } else if (this.started && this.state.playing && st.duration > 0 && st.currentTime < st.duration - 0.6) {
      // (Every sentence ends with at least 0.35 s of silence, so a stop this far from the end is not its end.)
      // Stopped by someone else: a call, Siri, headphones taken out, pause on the lock screen. Show it as paused,
      // so the play button works at once instead of the screen showing a player that plays nothing.
      this.set({ playing: false, waiting: false });
    }
  }

  /** Safety nets, checked every second while playing. */
  private checkStuck() {
    const p = this.player;
    if (!p || !this.state.playing || this.state.waiting || this.silent || p.playing) return;
    // A sentence that was loaded but never started: load it again.
    if (!this.started) {
      if (Date.now() - this.loadedAt > 3000) void this.playCurrent();
      return;
    }
    // A sentence that played to its end, but the end was never reported: go on.
    const { key, time, duration } = this.progress;
    if (key && duration > 0 && time >= duration - 0.6 && Date.now() - this.lastStatusAt > 1500) this.advance();
  }

  private silenceUri(): string {
    if (!audioFile("silence-1s").exists) writeRawWav("silence-1s", wavBytes(new Int16Array(0), 22050, 1));
    return audioFile("silence-1s").uri;
  }

  /** Every sentence key of this book, all chapters. */
  keys(): string[] {
    return this.state.project.chapters.flatMap((_, c) => this.sentencesOf(c).map((s) => s.key));
  }

  /** Bytes this book's audio takes on disk. */
  audioSize(): number {
    return audioBytes(this.keys());
  }

  /** Frees the audio; the text and the bookmark stay. Sentences another saved book shares are kept. */
  async deleteAudio(): Promise<void> {
    this.pause();
    this.halted = true;
    try {
      // Off before the files go, without starting the queue (update() would): it would make the sentences ahead again.
      if (this.state.project.generating || this.state.project.queued?.length) this.saveWithout({ generating: false, queued: [] });
      // Wait for the queue to stop: halted makes it drop the sentence in flight, so nothing is written after the delete.
      await this.pumpDone;
      const others = await listProjects();
      deleteBookAudio(this.state.project, others);
      this.recount();
    } finally {
      this.halted = false;
    }
  }

  private advance() {
    const { chapter, sentence, project } = this.state;
    if (sentence + 1 < this.sentencesOf(chapter).length) this.go(chapter, sentence + 1);
    else if (chapter + 1 < project.chapters.length) this.go(chapter + 1, 0);
    else this.set({ playing: false });
  }

  /** Moves the listening position; keeps playing if it was. */
  seek(chapter: number, sentence = 0) {
    if (chapter === this.state.chapter && sentence === this.state.sentence) return;
    this.go(chapter, sentence);
  }

  private go(chapter: number, sentence: number) {
    this.set({ chapter, sentence });
    this.state.project.position = { chapter, segment: sentence };
    saveProject(this.state.project);
    if (this.state.playing) void this.playCurrent();
    void this.pump();
  }

  private async playCurrent() {
    const player = await this.ensurePlayer();
    // Read the position after the wait: it may have moved meanwhile.
    const { chapter, sentence, project, rate, playing } = this.state;
    const s = this.sentencesOf(chapter)[sentence];
    if (!s || !playing || this.disposed) return;
    this.started = false;
    this.loadedAt = Date.now();
    this.quietUntil = Date.now() + 500;
    player.setActiveForLockScreen(true, { title: project.chapters[chapter].title || `Kapitola ${chapter + 1}`, artist: project.title });
    if (!hasAudio(s.key)) {
      // Not a pause: a paused app loses its audio session, and iOS then stops it in the background, generation
      // included, until the app is opened again. Silence keeps both going until the sentence is ready.
      this.set({ waiting: true });
      if (!this.silent) {
        this.silent = true;
        this.setProgress({ key: "", time: 0, duration: 0 });
        player.loop = true;
        player.replace({ uri: this.silenceUri() });
      }
      player.play();
      void this.pump();
      return;
    }
    this.silent = false;
    this.set({ waiting: false });
    this.setProgress({ key: s.key, time: 0, duration: 0 });
    player.loop = false;
    // Never with expo-audio's preload(): iOS will not put an item another AVPlayer had into this player's queue,
    // so the preloaded sentence silently never plays (build 8 stopped after every sentence).
    player.replace({ uri: audioFile(s.key).uri });
    player.setPlaybackRate(rate, "high");
    player.play();
  }

  play(chapter = this.state.chapter, sentence = this.state.sentence) {
    const resume = chapter === this.state.chapter && sentence === this.state.sentence && this.canResume();
    this.set({ playing: true, chapter, sentence });
    if (resume && this.player) {
      // Paused in the middle of a sentence: go on from there instead of starting the sentence again.
      this.quietUntil = Date.now() + 500;
      this.player.play();
    } else void this.playCurrent();
    void this.pump();
  }

  private canResume(): boolean {
    const s = this.sentencesOf(this.state.chapter)[this.state.sentence];
    const { key, time, duration } = this.progress;
    return !!s && !this.silent && key === s.key && duration > 0 && time < duration - 0.25;
  }

  pause() {
    this.quietUntil = Date.now() + 500;
    this.player?.pause();
    this.set({ playing: false, waiting: false });
  }

  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  next() {
    this.advance();
  }

  previous() {
    const { chapter, sentence } = this.state;
    if (sentence > 0) this.go(chapter, sentence - 1);
    else if (chapter > 0) this.go(chapter - 1, 0);
  }

  cycleRate() {
    const rate = RATES[(RATES.indexOf(this.state.rate as (typeof RATES)[number]) + 1) % RATES.length];
    this.player?.setPlaybackRate(rate, "high");
    this.set({ rate });
  }

  dispose() {
    this.disposed = true;
    if (this.watchdog) clearInterval(this.watchdog);
    this.player?.setActiveForLockScreen(false);
    this.player?.remove();
    this.player = null;
    this.listeners.clear();
    this.progressListeners.clear();
  }
}
