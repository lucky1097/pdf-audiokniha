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

// Dev serves the files at /ort/; a build puts them in ort/ beside assets/, so the app also works under a sub-path (the promo site's app/).
ort.env.wasm.wasmPaths = import.meta.env.DEV ? new URL("/ort/", self.location.origin).href : new URL(/* @vite-ignore */ "../ort/", import.meta.url).href;
const threadsParam = new URL(self.location.href).searchParams.get("threads");
ort.env.wasm.numThreads = threadsParam ? Number(threadsParam) : self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;

/** Downloads the missing files straight into Cache Storage. The body streams through a byte counter into
    the cache, so a file is never held in memory: on an iPhone, Safari closes a tab that holds the 400 MB
    model several times over ("a problem repeatedly occurred"). */
async function download(base: string, cache: Cache): Promise<void> {
  let loaded = 0;
  for (const [i, file] of FILES.entries()) {
    const url = `${base}/${file}`;
    const cached = await cache.match(url);
    let size = Number(cached?.headers.get("x-size")) || 0;
    if (!cached) {
      const net = await fetch(url, { mode: "cors" });
      if (!net.ok || !net.body) throw new Error(`${file}: HTTP ${net.status}`);
      const total = Number(net.headers.get("content-length")) || 0;
      let got = 0;
      let last = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) {
          got += chunk.byteLength;
          // A progress message per network chunk floods the main thread; a few per megabyte is plenty.
          if (got - last > 256 * 1024) {
            last = got;
            post({ type: "progress", file, fileIndex: i, files: FILES.length, bytes: loaded + got, fileBytes: got, fileTotal: total });
          }
          ctl.enqueue(chunk);
        },
      });
      // cache.put stores the entry only once the whole body has arrived, so a broken download leaves nothing.
      // The size header is known up front only from the server; the check below catches a short body.
      const headers = { "Content-Type": "application/octet-stream", "x-size": String(total) };
      await cache.put(url, new Response(net.body.pipeThrough(counter), { headers }));
      if (total && got !== total) {
        await cache.delete(url);
        throw new Error(`${file}: download incomplete (${got} of ${total} B)`);
      }
      size = got;
    }
    loaded += size;
    post({ type: "progress", file, fileIndex: i + 1, files: FILES.length, bytes: loaded, fileBytes: size, fileTotal: size });
  }
}

let engine: SupertonicEngine | null = null;
let backend: "webgpu" | "wasm" = "wasm";

async function init(base: string, preferGpu: boolean): Promise<void> {
  const cache = await caches.open(CACHE);
  await download(base, cache);
  const read = async (f: string) => {
    const res = await cache.match(`${base}/${f}`);
    if (!res) throw new Error(`${f}: missing from the cache`);
    return new Uint8Array(await res.arrayBuffer());
  };
  const json = async (f: string) => JSON.parse(new TextDecoder().decode(await read(f)));
  const styles: SupertonicAssets["styles"] = {};
  for (const v of VOICES) styles[v] = await json(`voice_styles/${v}.json`);
  const assets: SupertonicAssets = {
    modelId: "supertonic-3-fp32",
    config: await json("onnx/tts.json"),
    indexer: await json("onnx/unicode_indexer.json"),
    styles,
    // Loaded one at a time as each session is created, then dropped (the runtime keeps its own copy).
    models: {
      duration_predictor: () => read("onnx/duration_predictor.onnx"),
      text_encoder: () => read("onnx/text_encoder.onnx"),
      vector_estimator: () => read("onnx/vector_estimator.onnx"),
      vocoder: () => read("onnx/vocoder.onnx"),
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
      // Free the GPU sessions before loading the model again for WASM.
      await engine?.release();
      engine = null;
    }
  }
  // No memory arena: the arena keeps the largest working buffers allocated forever, which a phone cannot spare.
  engine = await SupertonicEngine.create(o, assets, { executionProviders: ["wasm"], graphOptimizationLevel: "all", enableCpuMemArena: false });
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
