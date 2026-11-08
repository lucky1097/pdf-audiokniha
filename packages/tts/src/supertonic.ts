// Supertonic 3 inference. The flow follows the MIT-licensed Supertonic web example
// (supertone-inc/supertonic, web/helper.js); the model weights are BigScience OpenRAIL-M.
// The engine only needs an onnxruntime module (onnxruntime-node or onnxruntime-web) and
// already-loaded assets, so the same code runs in the CLI, the browser and a worker.

export type Lang = "sk" | "en";

/** The voices shipped with Supertonic 3. sherpa-onnx speaker ids 0–9 map to F1–F5, M1–M5. */
export const VOICES = ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"] as const;
export type Voice = (typeof VOICES)[number];

export interface SynthesisOptions {
  lang: Lang;
  voice: Voice;
  /** Flow-matching steps. 8 is the default; 16 measured slightly fewer misreads in phase 0. */
  steps?: number;
  /** >1 speaks faster. */
  speed?: number;
  /** Seeds the initial noise. The same inputs and seed give the same audio; a retry uses a new seed. */
  seed?: number;
}

/** The contract every platform engine implements (web worker, CLI, iOS native module). */
export interface TtsEngine {
  readonly modelId: string;
  readonly sampleRate: number;
  synthesize(text: string, options: SynthesisOptions): Promise<Float32Array>;
}

interface Tensor {
  data: ArrayLike<number> | Float32Array;
  dims: readonly number[];
}
interface Session {
  run(feeds: Record<string, unknown>): Promise<Record<string, Tensor>>;
  release?(): Promise<void>;
}
export interface OrtLike {
  Tensor: new (type: string, data: Float32Array | BigInt64Array, dims: number[]) => unknown;
  InferenceSession: { create(model: string | Uint8Array, options?: unknown): Promise<Session> };
}

interface StyleJson {
  style_ttl: { dims: number[]; data: unknown };
  style_dp: { dims: number[]; data: unknown };
}

export interface SupertonicAssets {
  modelId: string;
  config: {
    ae: { sample_rate: number; base_chunk_size: number };
    ttl: { chunk_compress_factor: number; latent_dim: number };
  };
  indexer: number[];
  styles: Partial<Record<Voice, StyleJson>>;
  /** A path, the bytes, or a loader called just before that model's session is created, so a phone never
      holds more than one model file in memory at a time (the four together are about 400 MB). */
  models: Record<ModelName, ModelSource>;
}

type ModelName = "duration_predictor" | "text_encoder" | "vector_estimator" | "vocoder";
export type ModelSource = string | Uint8Array | (() => Promise<string | Uint8Array>);

/** Text clean-up the model was trained with (from the official example). */
export function preprocess(text: string, lang: Lang): string {
  text = text.normalize("NFKD");
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu, "");
  const replacements: Record<string, string> = {
    "–": "-", "‑": "-", "—": "-", _: " ", "“": '"', "”": '"', "„": '"', "‘": "'", "’": "'", "‚": "'",
    "´": "'", "`": "'", "[": " ", "]": " ", "|": " ", "/": " ", "#": " ", "→": " ", "←": " ", "«": '"', "»": '"',
  };
  for (const [k, v] of Object.entries(replacements)) text = text.replaceAll(k, v);
  text = text.replace(/[♥☆♡©\\]/g, "");
  text = text.replace(/ ([,.!?;:'])/g, "$1");
  text = text.replace(/"{2,}/g, '"').replace(/'{2,}/g, "'");
  text = text.replace(/\s+/g, " ").trim();
  if (!/[.!?;:,'")\]}…]$/.test(text)) text += ".";
  return `<${lang}>${text}</${lang}>`;
}

/** mulberry32: small, fast, good enough for Gaussian noise. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(n: number, seed: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(1e-7, r());
    const u2 = r();
    const m = Math.sqrt(-2 * Math.log(u1));
    out[i] = m * Math.cos(2 * Math.PI * u2);
    if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

const flat = (d: unknown): number[] => (Array.isArray(d) ? (d as unknown[]).flat(Infinity as 1) as number[] : []);

export class SupertonicEngine implements TtsEngine {
  readonly modelId: string;
  readonly sampleRate: number;
  private styleCache = new Map<Voice, { ttl: unknown; dp: unknown }>();
  private ort: OrtLike;
  /** Everything but the model bytes, which the runtime has copied into its own memory by now. */
  private assets: Omit<SupertonicAssets, "models">;
  private sessions: Record<ModelName, Session>;

  private constructor(ort: OrtLike, assets: Omit<SupertonicAssets, "models">, sessions: Record<ModelName, Session>) {
    this.ort = ort;
    this.assets = assets;
    this.sessions = sessions;
    this.modelId = assets.modelId;
    this.sampleRate = assets.config.ae.sample_rate;
  }

  /** Creates the four sessions one by one. If one fails, those already created are released. */
  static async create(ort: OrtLike, assets: SupertonicAssets, sessionOptions: unknown = {}): Promise<SupertonicEngine> {
    const { models, ...rest } = assets;
    const sessions: Partial<Record<ModelName, Session>> = {};
    try {
      for (const name of ["duration_predictor", "text_encoder", "vector_estimator", "vocoder"] as const) {
        const src = models[name];
        sessions[name] = await ort.InferenceSession.create(typeof src === "function" ? await src() : src, sessionOptions);
      }
    } catch (e) {
      await Promise.all(Object.values(sessions).map((s) => s.release?.().catch(() => {})));
      throw e;
    }
    return new SupertonicEngine(ort, rest, sessions as Record<ModelName, Session>);
  }

  /** Frees the sessions' memory (weights on the GPU or in WASM); the engine cannot be used afterwards. */
  async release(): Promise<void> {
    await Promise.all(Object.values(this.sessions).map((s) => s.release?.().catch(() => {})));
  }

  private style(voice: Voice) {
    let s = this.styleCache.get(voice);
    if (!s) {
      const j = this.assets.styles[voice];
      if (!j) throw new Error(`voice style ${voice} not loaded`);
      s = {
        ttl: new this.ort.Tensor("float32", Float32Array.from(flat(j.style_ttl.data)), j.style_ttl.dims),
        dp: new this.ort.Tensor("float32", Float32Array.from(flat(j.style_dp.data)), j.style_dp.dims),
      };
      this.styleCache.set(voice, s);
    }
    return s;
  }

  async synthesize(text: string, o: SynthesisOptions): Promise<Float32Array> {
    const steps = o.steps ?? 8;
    const speed = o.speed ?? 1;
    const seed = o.seed ?? 1;
    const T = this.ort.Tensor;
    const style = this.style(o.voice);
    const t = preprocess(text, o.lang);
    const ids = new BigInt64Array(t.length);
    for (let j = 0; j < t.length; j++) {
      const cp = t.codePointAt(j)!;
      ids[j] = BigInt(cp < this.assets.indexer.length ? this.assets.indexer[cp] : -1);
    }
    const textIds = new T("int64", ids, [1, t.length]);
    const textMask = new T("float32", new Float32Array(t.length).fill(1), [1, 1, t.length]);

    const dp = await this.sessions.duration_predictor.run({ text_ids: textIds, style_dp: style.dp, text_mask: textMask });
    const duration = Number(dp.duration.data[0]) / speed;
    const enc = await this.sessions.text_encoder.run({ text_ids: textIds, style_ttl: style.ttl, text_mask: textMask });

    const { ae, ttl } = this.assets.config;
    const chunk = ae.base_chunk_size * ttl.chunk_compress_factor;
    const wavLen = Math.floor(duration * this.sampleRate);
    const latLen = Math.max(1, Math.ceil(wavLen / chunk));
    const latDim = ttl.latent_dim * ttl.chunk_compress_factor;
    let xt: unknown = new T("float32", gaussian(latDim * latLen, seed), [1, latDim, latLen]);
    const latMask = new T("float32", new Float32Array(latLen).fill(1), [1, 1, latLen]);
    const total = new T("float32", new Float32Array([steps]), [1]);
    for (let step = 0; step < steps; step++) {
      const out = await this.sessions.vector_estimator.run({
        noisy_latent: xt,
        text_emb: enc.text_emb,
        style_ttl: style.ttl,
        latent_mask: latMask,
        text_mask: textMask,
        current_step: new T("float32", new Float32Array([step]), [1]),
        total_step: total,
      });
      xt = out.denoised_latent;
    }
    const voc = await this.sessions.vocoder.run({ latent: xt });
    const wav = voc.wav_tts.data as Float32Array;
    return Float32Array.from(wav.subarray(0, Math.min(wav.length, wavLen)));
  }
}
