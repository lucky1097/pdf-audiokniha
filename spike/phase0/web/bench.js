// Phase 0 browser benchmark for Supertonic 3 on onnxruntime-web (WebGPU or WASM).
// Inference follows the MIT-licensed Supertonic web example, rewritten on flat typed arrays.
import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.min.mjs";

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
ort.env.wasm.numThreads = self.crossOriginIsolated ? navigator.hardwareConcurrency : 1;

const SETS = {
  fp32: { dir: "../models/supertonic3-fp32", suffix: ".onnx" },
  int8: { dir: "../models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11", suffix: ".int8.onnx" },
};
const STYLE_DIR = "../models/supertonic3-fp32/voice_styles";
const TEXTS = {
  sk: "Keď Jana vystúpila z vlaku, mesto ešte spalo. Nad strechami visela riedka hmla a z pekárne na rohu voňal čerstvý chlieb. Zastala pri starej lipe, kde sa kedysi stretávala s otcom, a chvíľu len počúvala, ako sa ulica pomaly prebúdza.",
  en: "The rain had stopped by the time Clara reached the old lighthouse. She paused at the door, listening to the waves breaking somewhere below, and for a moment she wondered whether coming back had been a mistake.",
};

const logEl = document.getElementById("log");
const log = (s) => { logEl.textContent += "\n" + s; console.log(s); };

function preprocess(text, lang) {
  text = text.normalize("NFKD");
  const rep = { "–": "-", "—": "-", "“": '"', "”": '"', "„": '"', "‘": "'", "’": "'", "‚": "'" };
  for (const [k, v] of Object.entries(rep)) text = text.replaceAll(k, v);
  text = text.replace(/\s+/g, " ").trim();
  if (!/[.!?;:,'")\]}…]$/.test(text)) text += ".";
  return `<${lang}>${text}</${lang}>`;
}

function splitSentences(text, maxLen = 300) {
  const parts = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if (cur && cur.length + p.length + 1 > maxLen) { chunks.push(cur); cur = p; } else cur = cur ? cur + " " + p : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function randn(n) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(1e-4, Math.random()), u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    a[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < n) a[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return a;
}

async function loadStyle(name) {
  const j = await (await fetch(`${STYLE_DIR}/${name}.json`)).json();
  const t = (o) => new ort.Tensor("float32", Float32Array.from(o.data.flat(Infinity)), o.dims);
  return { ttl: t(j.style_ttl), dp: t(j.style_dp) };
}

class Supertonic {
  static async load(setName, ep) {
    const set = SETS[setName];
    const cfg = await (await fetch(`${set.dir}/tts.json`)).json();
    const indexer = await (await fetch(`../models/supertonic3-fp32/unicode_indexer.json`)).json();
    const opts = { executionProviders: [ep], graphOptimizationLevel: "all" };
    const s = new Supertonic();
    s.cfg = cfg; s.indexer = indexer; s.sr = cfg.ae.sample_rate;
    for (const name of ["duration_predictor", "text_encoder", "vector_estimator", "vocoder"]) {
      s[name] = await ort.InferenceSession.create(`${set.dir}/${name}${set.suffix}`, opts);
    }
    return s;
  }

  async infer(text, lang, style, steps, speed = 1.0) {
    const t = preprocess(text, lang);
    const L = t.length;
    const ids = new BigInt64Array(L);
    for (let j = 0; j < L; j++) {
      const cp = t.codePointAt(j);
      ids[j] = BigInt(cp < this.indexer.length ? this.indexer[cp] : -1);
    }
    const textIds = new ort.Tensor("int64", ids, [1, L]);
    const textMask = new ort.Tensor("float32", new Float32Array(L).fill(1), [1, 1, L]);

    const dp = await this.duration_predictor.run({ text_ids: textIds, style_dp: style.dp, text_mask: textMask });
    const dur = dp.duration.data[0] / speed;
    const enc = await this.text_encoder.run({ text_ids: textIds, style_ttl: style.ttl, text_mask: textMask });

    const chunk = this.cfg.ae.base_chunk_size * this.cfg.ttl.chunk_compress_factor;
    const latLen = Math.ceil(Math.floor(dur * this.sr) / chunk);
    const latDim = this.cfg.ttl.latent_dim * this.cfg.ttl.chunk_compress_factor;
    let xt = new ort.Tensor("float32", randn(latDim * latLen), [1, latDim, latLen]);
    const latMask = new ort.Tensor("float32", new Float32Array(latLen).fill(1), [1, 1, latLen]);
    const total = new ort.Tensor("float32", new Float32Array([steps]), [1]);
    for (let step = 0; step < steps; step++) {
      const out = await this.vector_estimator.run({
        noisy_latent: xt, text_emb: enc.text_emb, style_ttl: style.ttl, latent_mask: latMask,
        text_mask: textMask, current_step: new ort.Tensor("float32", new Float32Array([step]), [1]), total_step: total,
      });
      xt = out.denoised_latent;
    }
    const voc = await this.vocoder.run({ latent: xt });
    const wav = voc.wav_tts.data;
    return wav.subarray(0, Math.min(wav.length, Math.floor(dur * this.sr)));
  }

  async speak(text, lang, style, steps) {
    const parts = [];
    for (const c of splitSentences(text)) parts.push(await this.infer(c, lang, style, steps));
    const gap = Math.floor(0.3 * this.sr);
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0) + gap * (parts.length - 1));
    let o = 0;
    parts.forEach((p, i) => { out.set(p, o); o += p.length + (i < parts.length - 1 ? gap : 0); });
    return out;
  }
}

function wavBlob(samples, sr) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return new Blob([buf], { type: "audio/wav" });
}

async function run() {
  const ep = document.getElementById("ep").value;
  const setName = document.getElementById("set").value;
  const steps = Number(document.getElementById("steps").value);
  logEl.textContent = `backend=${ep} model=${setName} steps=${steps} crossOriginIsolated=${self.crossOriginIsolated} threads=${ort.env.wasm.numThreads} webgpu=${!!navigator.gpu}`;
  const result = { ep, setName, steps, runs: [] };
  try {
    let t0 = performance.now();
    const tts = await Supertonic.load(setName, ep);
    result.loadMs = Math.round(performance.now() - t0);
    log(`načítanie modelov: ${result.loadMs} ms`);
    const style = await loadStyle("F1");
    t0 = performance.now();
    await tts.infer("Ahoj.", "sk", style, steps);
    result.warmupMs = Math.round(performance.now() - t0);
    log(`zahriatie: ${result.warmupMs} ms`);
    for (const [lang, text] of Object.entries(TEXTS)) {
      t0 = performance.now();
      const wav = await tts.speak(text, lang, style, steps);
      const ms = performance.now() - t0;
      const sec = wav.length / tts.sr;
      const r = { lang, audioSec: +sec.toFixed(2), computeSec: +(ms / 1000).toFixed(2), rtf: +(ms / 1000 / sec).toFixed(3) };
      result.runs.push(r);
      log(`${lang}: zvuk ${r.audioSec} s, výpočet ${r.computeSec} s, RTF ${r.rtf}`);
      const blob = wavBlob(wav, tts.sr);
      await fetch(`/upload/web_${ep}_${setName}_${lang}.wav`, { method: "PUT", body: blob }).catch(() => {});
      const a = document.createElement("audio");
      a.controls = true; a.src = URL.createObjectURL(blob);
      const p = document.createElement("p"); p.textContent = `${ep} ${setName} ${lang} `; p.append(a);
      document.getElementById("out").append(p);
    }
  } catch (e) {
    result.error = String(e && e.message || e);
    log("CHYBA: " + result.error);
  }
  window.__bench = window.__bench || [];
  window.__bench.push(result);
}

document.getElementById("run").addEventListener("click", run);
