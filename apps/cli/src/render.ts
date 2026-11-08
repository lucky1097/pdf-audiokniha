import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalize, segment, spokenText, type Lang, type Span } from "@audiokniha/core";
import type { TtsEngine, Voice } from "@audiokniha/tts";

const SENTENCE_GAP = 0.35;
const PARAGRAPH_GAP = 0.8;

export interface RenderOptions {
  lang: Lang;
  voice: Voice;
  steps: number;
  seed: number;
  /** Folder for per-sentence audio, keyed by everything that changes the sound. */
  cacheDir: string;
  onProgress?: (done: number, total: number) => void;
}

export interface TimelineEntry {
  i: number;
  text: string;
  start: number;
  end: number;
  seed: number;
  cached: boolean;
}

export interface Rendered {
  audio: Float32Array;
  seconds: number;
  compute: number;
  spans: Span[];
  timeline: TimelineEntry[];
}

/** Normalize → split into sentences → synthesize each (cached) → join with pauses. */
export async function render(engine: TtsEngine, text: string, o: RenderOptions): Promise<Rendered> {
  await mkdir(o.cacheDir, { recursive: true });
  const spans = normalize(text, o.lang);
  const segs = segment(spokenText(spans));
  const sr = engine.sampleRate;
  const pieces: Float32Array[] = [];
  const timeline: TimelineEntry[] = [];
  let t = 0;
  let compute = 0;
  for (const [i, s] of segs.entries()) {
    const key = createHash("sha256")
      .update(JSON.stringify({ text: s.text, lang: o.lang, voice: o.voice, steps: o.steps, seed: o.seed, model: engine.modelId }))
      .digest("hex")
      .slice(0, 24);
    const file = join(o.cacheDir, `${key}.f32`);
    const cached = existsSync(file);
    let audio: Float32Array;
    if (cached) {
      const b = await readFile(file);
      audio = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    } else {
      const t0 = performance.now();
      audio = await engine.synthesize(s.text, { lang: o.lang, voice: o.voice, steps: o.steps, seed: o.seed });
      compute += (performance.now() - t0) / 1000;
      await writeFile(file, new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength));
    }
    timeline.push({ i, text: s.text, start: +t.toFixed(3), end: +(t + audio.length / sr).toFixed(3), seed: o.seed, cached });
    const gap = new Float32Array(Math.round((s.paragraphEnd ? PARAGRAPH_GAP : SENTENCE_GAP) * sr));
    pieces.push(audio, gap);
    t += (audio.length + gap.length) / sr;
    o.onProgress?.(i + 1, segs.length);
  }
  const out = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of pieces) {
    out.set(p, k);
    k += p.length;
  }
  return { audio: out, seconds: t, compute, spans, timeline };
}
