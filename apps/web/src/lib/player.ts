// Plays a book sentence by sentence through one <audio> element (keeps pitch at any speed).
// A sentence that is not generated yet is generated first; generation runs ahead of playback.
import { db } from "./db.ts";
import { generator } from "./generator.ts";
import { PARAGRAPH_GAP, SENTENCE_GAP, chapterSentences, wavBlob, type Project } from "./project.ts";

export interface PlayerState {
  chapter: number;
  sentence: number;
  playing: boolean;
  /** Waiting for the current sentence to be generated. */
  waiting: boolean;
  speed: number;
}

type Listener = (s: PlayerState) => void;

class Player {
  private audio = new Audio();
  private project: Project | null = null;
  private token = 0;
  private url: string | null = null;
  private endWaiter: (() => void) | null = null;
  private listeners = new Set<Listener>();
  onPosition: ((chapter: number, sentence: number) => void) | null = null;
  state: PlayerState = { chapter: 0, sentence: 0, playing: false, waiting: false, speed: 1 };

  constructor() {
    this.audio.preservesPitch = true;
    this.audio.addEventListener("ended", () => this.endWaiter?.());
    // Media keys and the lock screen pause the element directly; let the UI know.
    this.audio.addEventListener("play", () => this.set({}));
    this.audio.addEventListener("pause", () => this.set({}));
    const ms = navigator.mediaSession;
    if (ms) {
      ms.setActionHandler("play", () => this.toggle());
      ms.setActionHandler("pause", () => this.toggle());
      ms.setActionHandler("nexttrack", () => this.skip(1));
      ms.setActionHandler("previoustrack", () => this.skip(-1));
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(s: Partial<PlayerState>) {
    this.state = { ...this.state, ...s };
    for (const l of this.listeners) l(this.state);
  }

  setProject(p: Project | null): void {
    if (p?.id !== this.project?.id) {
      this.stop();
      if (p) this.set({ chapter: p.position.chapter, sentence: p.position.segment });
    }
    this.project = p;
  }

  setSpeed(speed: number): void {
    this.audio.playbackRate = speed;
    this.set({ speed });
  }

  stop(): void {
    this.token++;
    this.audio.pause();
    this.endWaiter?.();
    this.set({ playing: false, waiting: false });
  }

  toggle(): void {
    if (this.state.playing) {
      if (this.audio.paused) void this.audio.play();
      else this.audio.pause();
      this.set({});
      return;
    }
    void this.playFrom(this.state.chapter, this.state.sentence);
  }

  get paused(): boolean {
    return !this.state.playing || this.audio.paused;
  }

  skip(delta: number): void {
    void this.playFrom(this.state.chapter, Math.max(0, this.state.sentence + delta));
  }

  async playFrom(chapter: number, sentence: number): Promise<void> {
    const p = this.project;
    if (!p) return;
    this.stop();
    const token = ++this.token;
    this.set({ playing: true });
    let c = chapter;
    let i = sentence;
    while (token === this.token) {
      const all = chapterSentences(p, c);
      if (i >= all.length) {
        if (++c >= p.chapters.length) break;
        i = 0;
        continue;
      }
      const s = all[i];
      this.set({ chapter: c, sentence: i, waiting: !generator.state.done.has(s.key) });
      this.onPosition?.(c, i);
      generator.setFocus(c, i);
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: p.chapters[c].title || p.title, album: p.title, artist: p.author ?? "" });
      await generator.ensure(c, s);
      if (token !== this.token) return;
      const a = await db.audio(s.key);
      if (!a || token !== this.token) return;
      this.set({ waiting: false });
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(wavBlob(a.pcm, a.sampleRate, s.paragraphEnd ? PARAGRAPH_GAP : SENTENCE_GAP));
      this.audio.src = this.url;
      this.audio.playbackRate = this.state.speed;
      const ended = new Promise<void>((r) => (this.endWaiter = r));
      try {
        await this.audio.play();
      } catch {
        // Autoplay blocked or interrupted: stop cleanly; the next click resumes here.
        this.set({ playing: false });
        return;
      }
      await ended;
      this.endWaiter = null;
      i++;
    }
    if (token === this.token) this.set({ playing: false });
  }
}

export const player = new Player();
