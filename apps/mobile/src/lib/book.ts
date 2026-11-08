// One open book: the generation queue and the player, in one place so they always agree on what is ready.
// Generation runs ahead of the player (the next few sentences first), then the rest of the book when the user
// asks for it. iOS keeps the app running while audio plays, so it keeps generating with the screen locked.
import { PARAGRAPH_GAP, SENTENCE_GAP, chapterSentences, wavBytes, type Project, type Sentence } from "@audiokniha/core";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { NO_VOICE_MESSAGE, downloadModel, loadEngine, modelDownloaded, synthesize, voiceAvailable, type DownloadProgress } from "./engine.ts";
import { audioFile, hasAudio, saveProject, writeAudio } from "./storage.ts";

const AHEAD = 6;
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
}

type Listener = () => void;

export class BookController {
  private state: BookState;
  private listeners = new Set<Listener>();
  private sentences = new Map<number, Sentence[]>();
  private player: AudioPlayer | null = null;
  private pumping = false;
  private disposed = false;

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
    };
    this.recount();
    if (project.generating) void this.pump();
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getState = () => this.state;

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
    const { chapter, sentence, project } = this.state;
    const here = this.sentencesOf(chapter);
    for (const s of here.slice(sentence, sentence + AHEAD)) if (!hasAudio(s.key)) return { chapter, s };
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

  private async pump() {
    if (this.pumping || this.disposed) return;
    if (!this.nextJob()) return;
    this.pumping = true;
    try {
      await this.ensureModel();
      this.set({ phase: "generating", error: null });
      if (this.state.project.generating) await activateKeepAwakeAsync("generate").catch(() => {});
      for (let job = this.nextJob(); job && !this.disposed; job = this.nextJob()) {
        const p = this.state.project;
        const t0 = Date.now();
        const { pcm, sampleRate } = await synthesize(job.s.text, p.lang, p.voice, p.steps, job.s.seed);
        writeAudio(job.s.key, wavBytes(pcm, sampleRate, job.s.paragraphEnd ? PARAGRAPH_GAP : SENTENCE_GAP));
        const ready = [...this.state.ready];
        ready[job.chapter] += 1;
        this.set({ ready, rtf: (Date.now() - t0) / 1000 / (pcm.length / sampleRate) });
        if (this.state.waiting) this.playCurrent();
      }
      if (this.state.project.generating && !this.nextJob()) this.update({ generating: false });
      this.set({ phase: "idle" });
    } catch (e) {
      this.set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    } finally {
      deactivateKeepAwake("generate");
      this.pumping = false;
    }
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
    if (chapter === this.state.chapter && s.index === this.state.sentence && this.state.playing) this.playCurrent();
  }

  // ------------------------------------------------------------------ player

  private async ensurePlayer(): Promise<AudioPlayer> {
    if (this.player) return this.player;
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" });
    const player = createAudioPlayer(null);
    player.addListener("playbackStatusUpdate", (st) => {
      if (st.didJustFinish && this.state.playing) this.advance();
    });
    this.player = player;
    return player;
  }

  private advance() {
    const { chapter, sentence, project } = this.state;
    if (sentence + 1 < this.sentencesOf(chapter).length) this.go(chapter, sentence + 1);
    else if (chapter + 1 < project.chapters.length) this.go(chapter + 1, 0);
    else this.set({ playing: false });
  }

  private go(chapter: number, sentence: number) {
    this.set({ chapter, sentence });
    this.state.project.position = { chapter, segment: sentence };
    saveProject(this.state.project);
    if (this.state.playing) this.playCurrent();
    void this.pump();
  }

  private async playCurrent() {
    const { chapter, sentence, project, rate } = this.state;
    const s = this.sentencesOf(chapter)[sentence];
    if (!s) return;
    const player = await this.ensurePlayer();
    if (!hasAudio(s.key)) {
      player.pause();
      this.set({ waiting: true });
      void this.pump();
      return;
    }
    this.set({ waiting: false });
    player.replace({ uri: audioFile(s.key).uri });
    player.setPlaybackRate(rate, "high");
    player.play();
    player.setActiveForLockScreen(true, { title: project.chapters[chapter].title || `Kapitola ${chapter + 1}`, artist: project.title });
  }

  play(chapter = this.state.chapter, sentence = this.state.sentence) {
    this.set({ playing: true, chapter, sentence });
    void this.playCurrent();
    void this.pump();
  }

  pause() {
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
    this.player?.setActiveForLockScreen(false);
    this.player?.remove();
    this.player = null;
    this.listeners.clear();
  }
}
