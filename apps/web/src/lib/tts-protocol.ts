import type { Lang, Voice } from "@audiokniha/tts";

export type WorkerRequest =
  | { type: "init"; modelBase: string; preferGpu: boolean }
  | { type: "synth"; id: string; text: string; lang: Lang; voice: Voice; steps: number; seed: number };

export type WorkerResponse =
  | { type: "progress"; file: string; fileIndex: number; files: number; bytes: number; fileBytes: number; fileTotal: number }
  | { type: "ready"; backend: "webgpu" | "wasm"; sampleRate: number; modelId: string }
  | { type: "audio"; id: string; pcm: Int16Array; ms: number }
  | { type: "error"; id?: string; message: string }
  /** A step of loading, for the diagnostics log (the last one written tells where a crash happened). */
  | { type: "log"; message: string };
