// Runs Supertonic 3 off the main thread. Downloads the model once into Cache Storage,
// prefers WebGPU and falls back to multi-threaded WASM.
import * as ort from "onnxruntime-web/webgpu";
import { SupertonicEngine, VOICES, type OrtLike, type SupertonicAssets, type SynthesisOptions } from "@audiokniha/tts";
import type { WorkerRequest, WorkerResponse } from "../lib/tts-protocol.ts";

const CACHE = "supertonic-3-v1";
const FILES = [
  "onnx/tts.json",
  "onnx/unicode_indexer.json",
  ...VOICES.map((v) => `voice_styles/${v}.json`),
  "onnx/duration_predictor.onnx",
  "onnx/text_encoder.onnx",
  "onnx/vocoder.onnx",
  "onnx/vector_estimator.onnx",
];

const post = (m: WorkerResponse, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

ort.env.wasm.wasmPaths = new URL("/ort/", self.location.origin).href;
const threadsParam = new URL(self.location.href).searchParams.get("threads");
ort.env.wasm.numThreads = threadsParam ? Number(threadsParam) : self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;

async function download(base: string): Promise<Map<string, ArrayBuffer>> {
  const cache = await caches.open(CACHE);
  const out = new Map<string, ArrayBuffer>();
  // Sizes are only known as files arrive; report bytes so the UI can show progress.
  let loaded = 0;
  for (const [i, file] of FILES.entries()) {
    const url = `${base}/${file}`;
    let res = await cache.match(url);
    if (!res) {
      const net = await fetch(url, { mode: "cors" });
      if (!net.ok || !net.body) throw new Error(`${file}: HTTP ${net.status}`);
      const total = Number(net.headers.get("content-length")) || 0;
      const reader = net.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        post({ type: "progress", file, fileIndex: i, files: FILES.length, bytes: loaded + got, fileBytes: got, fileTotal: total });
      }
      const blob = new Blob(chunks as BlobPart[]);
      await cache.put(url, new Response(blob, { headers: { "Content-Type": "application/octet-stream" } }));
      res = new Response(blob);
    }
    const buf = await res.arrayBuffer();
    loaded += buf.byteLength;
    out.set(file, buf);
    post({ type: "progress", file, fileIndex: i + 1, files: FILES.length, bytes: loaded, fileBytes: buf.byteLength, fileTotal: buf.byteLength });
  }
  return out;
}

let engine: SupertonicEngine | null = null;
let backend: "webgpu" | "wasm" = "wasm";

async function init(base: string, preferGpu: boolean): Promise<void> {
  const files = await download(base);
  const json = (f: string) => JSON.parse(new TextDecoder().decode(files.get(f)!));
  const styles: SupertonicAssets["styles"] = {};
  for (const v of VOICES) styles[v] = json(`voice_styles/${v}.json`);
  const assets: SupertonicAssets = {
    modelId: "supertonic-3-fp32",
    config: json("onnx/tts.json"),
    indexer: json("onnx/unicode_indexer.json"),
    styles,
    models: {
      duration_predictor: new Uint8Array(files.get("onnx/duration_predictor.onnx")!),
      text_encoder: new Uint8Array(files.get("onnx/text_encoder.onnx")!),
      vector_estimator: new Uint8Array(files.get("onnx/vector_estimator.onnx")!),
      vocoder: new Uint8Array(files.get("onnx/vocoder.onnx")!),
    },
  };
  const o = ort as unknown as OrtLike;
  if (preferGpu && "gpu" in navigator) {
    try {
      engine = await SupertonicEngine.create(o, assets, { executionProviders: ["webgpu"], graphOptimizationLevel: "all" });
      await engine.synthesize("Ahoj.", { lang: "sk", voice: "F1", steps: 2 });
      backend = "webgpu";
      return;
    } catch (e) {
      console.warn("WebGPU failed, using WASM", e);
    }
  }
  engine = await SupertonicEngine.create(o, assets, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  backend = "wasm";
}

// One job at a time; the main thread queues them.
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      await init(m.modelBase, m.preferGpu);
      post({ type: "ready", backend, sampleRate: engine!.sampleRate, modelId: engine!.modelId });
    } else if (m.type === "synth") {
      if (!engine) throw new Error("model not loaded");
      const t0 = performance.now();
      const opts: SynthesisOptions = { lang: m.lang, voice: m.voice, steps: m.steps, seed: m.seed };
      const audio = await engine.synthesize(m.text, opts);
      const pcm = new Int16Array(audio.length);
      for (let i = 0; i < audio.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(audio[i] * 32767)));
      post({ type: "audio", id: m.id, pcm, ms: performance.now() - t0 }, [pcm.buffer]);
    }
  } catch (err) {
    post({ type: "error", id: "id" in m ? m.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
