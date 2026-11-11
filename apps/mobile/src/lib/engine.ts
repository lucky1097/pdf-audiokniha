// Supertonic 3 on the iPhone: the same engine as the web (packages/tts), run by onnxruntime-react-native.
// The model (about 380 MB) is downloaded once from Hugging Face into Application Support and stays offline.
import { MODEL_ID, toPcm16 } from "@audiokniha/core";
import { SupertonicEngine, VOICES, type Lang, type OrtLike, type SupertonicAssets, type Voice } from "@audiokniha/tts";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Directory, File, Paths } from "expo-file-system";
import { NativeModules } from "react-native";

/** False in Expo Go: it has no onnxruntime, so the voice needs the app's own build (EAS development build). */
export const voiceAvailable = !!NativeModules.Onnxruntime;
export const NO_VOICE_MESSAGE = "V Expo Go hlas nebeží, potrebuje vlastný build appky (EAS). Knižnica a čítanie PDF fungujú.";

const BASE = "https://huggingface.co/Supertone/supertonic-3/resolve/main";
const ONNX = ["duration_predictor", "text_encoder", "vector_estimator", "vocoder"] as const;
const FILES = [
  "onnx/tts.json",
  "onnx/unicode_indexer.json",
  ...VOICES.map((v) => `voice_styles/${v}.json`),
  ...ONNX.map((n) => `onnx/${n}.onnx`),
];
/** Approximate total, for the progress bar before the server reports sizes. */
export const MODEL_BYTES = 380 * 1024 * 1024;

const modelDir = new Directory(Paths.document, "models", MODEL_ID);
const fileOf = (path: string) => new File(modelDir, path.replace("/", "__"));

export function modelDownloaded(): boolean {
  return FILES.every((f) => fileOf(f).exists);
}

export interface DownloadProgress {
  bytes: number;
  total: number;
  file: number;
  files: number;
}

/** Downloads the missing model files one by one; files already on the phone are kept. */
export async function downloadModel(onProgress: (p: DownloadProgress) => void): Promise<void> {
  if (!modelDir.exists) modelDir.create({ intermediates: true, idempotent: true });
  let done = 0;
  for (const [i, path] of FILES.entries()) {
    const dest = fileOf(path);
    if (!dest.exists) {
      const part = new File(modelDir, `${dest.name}.part`);
      if (part.exists) part.delete();
      const task = File.createDownloadTask(`${BASE}/${path}`, part, {
        onProgress: ({ bytesWritten }) => onProgress({ bytes: done + bytesWritten, total: MODEL_BYTES, file: i, files: FILES.length }),
      });
      await task.downloadAsync();
      // Renamed only when complete, so an interrupted download never looks finished.
      part.move(dest);
    }
    done += dest.size ?? 0;
    onProgress({ bytes: done, total: MODEL_BYTES, file: i + 1, files: FILES.length });
  }
}

// One download for the whole app: the library's first-run button and a book that needs the voice share it.
export interface ModelDownload {
  status: "missing" | "downloading" | "done" | "error";
  progress: DownloadProgress | null;
  error: string | null;
}

let current: ModelDownload | null = null;
let running: Promise<void> | null = null;
const listeners = new Set<() => void>();
let lastNotify = 0;
let pendingNotify: ReturnType<typeof setTimeout> | null = null;

/** The current snapshot. It is a new object after every change, so React's useSyncExternalStore sees it. */
export function getModelDownload(): ModelDownload {
  current ??= { status: modelDownloaded() ? "done" : "missing", progress: null, error: null };
  return current;
}

export function subscribeModelDownload(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function notify() {
  if (pendingNotify) clearTimeout(pendingNotify);
  pendingNotify = null;
  lastNotify = Date.now();
  for (const l of listeners) l();
}

function setStatus(patch: Partial<ModelDownload>) {
  current = { ...getModelDownload(), ...patch };
  notify();
}

/** Progress arrives many times a second: listeners are told at most every 250 ms, the snapshot is always current. */
function setProgress(progress: DownloadProgress) {
  current = { ...getModelDownload(), progress };
  const wait = 250 - (Date.now() - lastNotify);
  if (wait <= 0) notify();
  else pendingNotify ??= setTimeout(notify, wait);
}

/** Starts the download, or joins the one already running. Resolves when the model is on the phone. */
export function startModelDownload(): Promise<void> {
  if (!voiceAvailable) return Promise.reject(new Error(NO_VOICE_MESSAGE));
  if (running) return running;
  if (modelDownloaded()) {
    if (getModelDownload().status !== "done") setStatus({ status: "done", progress: null, error: null });
    return Promise.resolve();
  }
  setStatus({ status: "downloading", progress: { bytes: 0, total: MODEL_BYTES, file: 0, files: FILES.length }, error: null });
  running = (async () => {
    // Keeps the screen on while 380 MB comes in; a failure to do so is not a reason to stop the download.
    await activateKeepAwakeAsync("model").catch(() => {});
    try {
      await downloadModel(setProgress);
      setStatus({ status: "done", progress: null, error: null });
    } catch (e) {
      setStatus({ status: "error", progress: null, error: e instanceof Error ? e.message : String(e) });
      throw e;
    } finally {
      deactivateKeepAwake("model");
      running = null;
    }
  })();
  return running;
}

let engine: SupertonicEngine | null = null;
let loading: Promise<SupertonicEngine> | null = null;

/** Loads the four ONNX sessions once, on the CPU. CoreML (Neural Engine) is a later experiment: its first load
    compiles every model and the flow-matching graph has dynamic shapes, so the CPU is the dependable start. */
export function loadEngine(): Promise<SupertonicEngine> {
  if (engine) return Promise.resolve(engine);
  loading ??= (async () => {
    if (!voiceAvailable) throw new Error(NO_VOICE_MESSAGE);
    // Imported here, not at the top: onnxruntime-react-native installs its native module on import,
    // which throws where the module is missing (Expo Go) and would stop the whole app from starting.
    const { InferenceSession, Tensor } = await import("onnxruntime-react-native");
    const json =async (path: string) => JSON.parse(await fileOf(path).text());
    const styles: SupertonicAssets["styles"] = {};
    for (const v of VOICES) styles[v] = await json(`voice_styles/${v}.json`);
    const assets: SupertonicAssets = {
      modelId: MODEL_ID,
      config: await json("onnx/tts.json"),
      indexer: await json("onnx/unicode_indexer.json"),
      styles,
      models: Object.fromEntries(ONNX.map((n) => [n, fileOf(`onnx/${n}.onnx`).uri])) as SupertonicAssets["models"],
    };
    const ort = { InferenceSession, Tensor } as unknown as OrtLike;
    engine = await SupertonicEngine.create(ort, assets, { executionProviders: ["cpu"], graphOptimizationLevel: "all" });
    return engine;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export async function synthesize(text: string, lang: Lang, voice: Voice, steps: number, seed: number): Promise<{ pcm: Int16Array; sampleRate: number }> {
  const e = await loadEngine();
  const audio = await e.synthesize(text, { lang, voice, steps, seed });
  return { pcm: toPcm16(audio), sampleRate: e.sampleRate };
}
