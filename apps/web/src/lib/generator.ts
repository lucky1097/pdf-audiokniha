// Background generation. Work is ordered from the place the user is listening to or looking at,
// so playback can start before the whole book is done. Finished sentences live in IndexedDB,
// so stopping, editing or reloading only loses the sentence in progress.
import { db } from "./db.ts";
import { chapterSentences, type Project, type Sentence } from "./project.ts";
import { tts } from "./tts-client.ts";

export type Scope = { kind: "idle" } | { kind: "book" } | { kind: "chapter"; chapter: number };

export interface GeneratorState {
  scope: Scope;
  running: boolean;
  /** Sentences left in the current scope. */
  queued: number;
  current: string | null;
  /** Seconds of compute per second of audio, averaged over recent sentences. */
  rtf: number | null;
  error: string | null;
  done: Set<string>;
}

interface Job {
  chapter: number;
  s: Sentence;
}

type Listener = (s: GeneratorState) => void;

class Generator {
  private project: Project | null = null;
  private queue: Job[] = [];
  private focus = { chapter: 0, sentence: 0 };
  private waiters = new Map<string, (() => void)[]>();
  private listeners = new Set<Listener>();
  private loop: Promise<void> | null = null;
  private recent: number[] = [];
  state: GeneratorState = { scope: { kind: "idle" }, running: false, queued: 0, current: null, rtf: null, error: null, done: new Set() };

  async init(): Promise<void> {
    this.set({ done: await db.audioKeys() });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(s: Partial<GeneratorState>) {
    this.state = { ...this.state, ...s };
    for (const l of this.listeners) l(this.state);
  }

  /** Call whenever the project changes (edits, voice, dictionary): the queue is rebuilt from the new text. */
  setProject(p: Project | null): void {
    const switched = p?.id !== this.project?.id;
    this.project = p;
    if (switched) this.set({ scope: p?.generating ? { kind: "book" } : { kind: "idle" }, error: null });
    this.rebuild();
  }

  start(scope: Scope): void {
    this.set({ scope, error: null });
    this.rebuild();
  }

  stop(): void {
    this.set({ scope: { kind: "idle" } });
    this.rebuild();
  }

  /** Listening or editing here: generate from this point first. */
  setFocus(chapter: number, sentence: number): void {
    this.focus = { chapter, sentence };
    this.rebuild();
  }

  /** Generate one sentence now (used by the player and by "generate again"). */
  async ensure(chapter: number, s: Sentence): Promise<void> {
    if (this.state.done.has(s.key)) return;
    this.queue = [{ chapter, s }, ...this.queue.filter((j) => j.s.key !== s.key)];
    this.kick();
    await new Promise<void>((resolve) => {
      const list = this.waiters.get(s.key) ?? [];
      list.push(resolve);
      this.waiters.set(s.key, list);
    });
  }

  private rebuild(): void {
    const p = this.project;
    const scope = this.state.scope;
    if (!p || scope.kind === "idle") {
      this.queue = this.queue.filter((j) => this.waiters.has(j.s.key));
      this.set({ queued: 0 });
      return;
    }
    const chapters = scope.kind === "book" ? p.chapters.map((_, i) => i) : [scope.chapter];
    const fc = chapters.includes(this.focus.chapter) ? this.focus.chapter : chapters[0];
    const order = [...chapters.filter((c) => c >= fc), ...chapters.filter((c) => c < fc)];
    const jobs: Job[] = [];
    for (const c of order) {
      const all = chapterSentences(p, c);
      const from = c === fc ? Math.min(this.focus.sentence, all.length) : 0;
      for (const s of [...all.slice(from), ...all.slice(0, from)]) if (!this.state.done.has(s.key)) jobs.push({ chapter: c, s });
    }
    const urgent = this.queue.filter((j) => this.waiters.has(j.s.key));
    this.queue = [...urgent, ...jobs.filter((j) => !urgent.some((u) => u.s.key === j.s.key))];
    this.set({ queued: jobs.length });
    if (!jobs.length) this.finishScope();
    this.kick();
  }

  private finishScope(): void {
    if (this.project?.generating) {
      this.project.generating = false;
      void db.saveProject(this.project);
    }
    this.set({ scope: { kind: "idle" } });
  }

  private kick(): void {
    this.loop ??= this.run().finally(() => {
      this.loop = null;
      if (this.queue.length) this.kick();
    });
  }

  private async run(): Promise<void> {
    while (this.queue.length) {
      const job = this.queue.shift()!;
      const p = this.project;
      if (!p) break;
      if (this.state.done.has(job.s.key)) {
        this.resolve(job.s.key);
        continue;
      }
      this.set({ running: true, current: job.s.key });
      try {
        const t0 = performance.now();
        const pcm = await tts.synthesize(job.s.key, job.s.text, p.lang, p.voice, p.steps, job.s.seed);
        const sr = tts.state.sampleRate ?? 44100;
        await db.saveAudio({ key: job.s.key, pcm, sampleRate: sr });
        this.recent = [...this.recent.slice(-19), (performance.now() - t0) / 1000 / (pcm.length / sr)];
        const done = new Set(this.state.done).add(job.s.key);
        this.set({ done, rtf: this.recent.reduce((a, b) => a + b, 0) / this.recent.length, queued: Math.max(0, this.state.queued - 1) });
        this.resolve(job.s.key);
      } catch (e) {
        this.set({ error: e instanceof Error ? e.message : String(e), scope: { kind: "idle" } });
        this.queue = [];
        break;
      }
    }
    this.set({ running: false, current: null });
    if (this.state.scope.kind !== "idle" && this.state.queued === 0) this.finishScope();
  }

  private resolve(key: string): void {
    for (const r of this.waiters.get(key) ?? []) r();
    this.waiters.delete(key);
  }
}

export const generator = new Generator();
