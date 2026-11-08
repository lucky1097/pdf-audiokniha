import type { Lang, Voice } from "@audiokniha/tts";
import type { WorkerRequest, WorkerResponse } from "./tts-protocol.ts";

export interface ModelState {
  status: "idle" | "loading" | "ready" | "error";
  /** Bytes read so far (download or cache). The full model is about 380 MB. */
  bytes: number;
  backend?: "webgpu" | "wasm";
  sampleRate?: number;
  modelId?: string;
  error?: string;
}

export const MODEL_BYTES = 382_000_000;

type Listener = (s: ModelState) => void;

/** Thin RPC over the TTS worker. One synthesis runs at a time inside the worker. */
export class TtsClient {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (pcm: Int16Array) => void; reject: (e: Error) => void }>();
  private listeners = new Set<Listener>();
  private ready: Promise<void> | null = null;
  state: ModelState = { status: "idle", bytes: 0 };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(s: Partial<ModelState>) {
    this.state = { ...this.state, ...s };
    for (const l of this.listeners) l(this.state);
  }

  load(): Promise<void> {
    if (this.ready) return this.ready;
    this.set({ status: "loading", bytes: 0, error: undefined });
    this.worker = new Worker(new URL("../workers/tts.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise((resolve, reject) => {
      this.worker!.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data;
        if (m.type === "progress") this.set({ bytes: m.bytes });
        else if (m.type === "ready") {
          this.set({ status: "ready", backend: m.backend, sampleRate: m.sampleRate, modelId: m.modelId });
          resolve();
        } else if (m.type === "audio") {
          this.pending.get(m.id)?.resolve(m.pcm);
          this.pending.delete(m.id);
        } else if (m.type === "error") {
          if (m.id && this.pending.has(m.id)) {
            this.pending.get(m.id)!.reject(new Error(m.message));
            this.pending.delete(m.id);
          } else {
            this.set({ status: "error", error: m.message });
            this.ready = null;
            reject(new Error(m.message));
          }
        }
      };
      this.post({ type: "init", modelBase: __MODEL_BASE__, preferGpu: true });
    });
    return this.ready;
  }

  private post(m: WorkerRequest) {
    this.worker!.postMessage(m);
  }

  async synthesize(id: string, text: string, lang: Lang, voice: Voice, steps: number, seed: number): Promise<Int16Array> {
    await this.load();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ type: "synth", id, text, lang, voice, steps, seed });
    });
  }
}

export const tts = new TtsClient();
