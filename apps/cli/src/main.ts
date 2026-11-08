#!/usr/bin/env node
// audiokniha CLI.
//   normalize --lang sk                stdin text → stdout spoken text
//   synth <file.txt> --out <dir>       one text → audio.wav + segments.json (used by the chapter checks)
//   book <file.pdf> --out <dir>        PDF → chapter WAVs + book.m4b with chapter marks (needs ffmpeg)
//   bench                              speed on this machine
// common: --lang sk|en --voice F1..M5 --variant fp32|int8 --steps 8 --seed 1 --threads 4
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { NORMALIZER_VERSION, extractBook, normalize, segment, spokenText, type Lang } from "@audiokniha/core";
import { VOICES, type Voice } from "@audiokniha/tts";
import { loadEngine, type Variant } from "./engine.ts";
import { AI_NOTICE, findFfmpeg, writeM4b, type ChapterFile } from "./m4b.ts";
import { readPdf } from "./pdf.ts";
import { render } from "./render.ts";
import { encodeWav } from "./wav.ts";

const ROOT = resolve(import.meta.dirname, "../../..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    lang: { type: "string", default: "sk" },
    voice: { type: "string", default: "F4" },
    out: { type: "string" },
    variant: { type: "string", default: "fp32" },
    steps: { type: "string", default: "8" },
    seed: { type: "string", default: "1" },
    threads: { type: "string", default: "4" },
    title: { type: "string" },
    author: { type: "string" },
  },
});
const [command, input] = positionals;
const lang = values.lang as Lang;
const voice = values.voice as Voice;
if (!VOICES.includes(voice)) throw new Error(`--voice must be one of ${VOICES.join(", ")}`);
const steps = Number(values.steps);
const seed = Number(values.seed);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const progress = (label: string) => (done: number, total: number) => process.stdout.write(`\r${label} ${done}/${total}   `);

async function synth(): Promise<void> {
  if (!input || !values.out) throw new Error("usage: synth <file.txt> --out <dir>");
  const out = resolve(values.out);
  await mkdir(out, { recursive: true });
  const engine = await loadEngine(ROOT, values.variant as Variant, Number(values.threads));
  const r = await render(engine, await readFile(input, "utf8"), { lang, voice, steps, seed, cacheDir: join(out, "cache"), onProgress: progress("segments") });
  await writeFile(join(out, "normalized.txt"), spokenText(r.spans));
  await writeFile(join(out, "uncertain.json"), JSON.stringify(r.spans.filter((s) => !s.confident), null, 1));
  await writeFile(join(out, "audio.wav"), encodeWav(r.audio, engine.sampleRate));
  await writeFile(
    join(out, "segments.json"),
    JSON.stringify({ lang, voice, steps, model: engine.modelId, normalizer: NORMALIZER_VERSION, sampleRate: engine.sampleRate, compute: +r.compute.toFixed(1), audio: +r.seconds.toFixed(1), segments: r.timeline }, null, 1),
  );
  process.stdout.write(`\nRTF ${(r.compute / r.seconds).toFixed(3)} → ${join(out, "audio.wav")}\n`);
}

async function book(): Promise<void> {
  if (!input || !values.out) throw new Error("usage: book <file.pdf> --out <dir>");
  const out = resolve(values.out);
  await mkdir(out, { recursive: true });
  const pdf = await readPdf(input);
  const extracted = extractBook(pdf.pages, pdf.outline);
  if (extracted.imageOnlyPages.length) {
    console.warn(`warning: ${extracted.imageOnlyPages.length} page(s) have no text layer (scanned?): ${extracted.imageOnlyPages.slice(0, 10).join(", ")}`);
  }
  const chapters = extracted.chapters.filter((c) => c.paragraphs.length);
  if (!chapters.length) throw new Error("no text found in this PDF");
  await writeFile(join(out, "book.json"), JSON.stringify({ ...extracted, chapters }, null, 1));

  const engine = await loadEngine(ROOT, values.variant as Variant, Number(values.threads));
  const files: ChapterFile[] = [];
  let compute = 0;
  for (const [i, ch] of chapters.entries()) {
    const title = ch.title || `${lang === "sk" ? "Kapitola" : "Chapter"} ${i + 1}`;
    // The chapter title is read first, then its text.
    const text = `${title}.\n\n${ch.paragraphs.join("\n\n")}`;
    const r = await render(engine, text, { lang, voice, steps, seed, cacheDir: join(out, "cache"), onProgress: progress(`chapter ${i + 1}/${chapters.length}, sentence`) });
    const file = `chapter-${String(i + 1).padStart(3, "0")}.wav`;
    await writeFile(join(out, file), encodeWav(r.audio, engine.sampleRate));
    files.push({ title, file, seconds: r.seconds });
    compute += r.compute;
  }
  const meta = { title: values.title ?? (pdf.title || basename(input, ".pdf")), author: values.author, lang };
  const m4b = await writeM4b(out, meta, files, findFfmpeg(ROOT));
  const total = files.reduce((s, f) => s + f.seconds, 0);
  process.stdout.write(`\n${files.length} chapters, ${(total / 60).toFixed(1)} min audio, compute ${(compute / 60).toFixed(1)} min\n`);
  process.stdout.write(m4b ? `→ ${m4b}\n` : `ffmpeg not found: chapter WAVs and chapters.ffmeta are in ${out}\n`);
  process.stdout.write(`${AI_NOTICE}\n`);
}

async function bench(): Promise<void> {
  const engine = await loadEngine(ROOT, values.variant as Variant, Number(values.threads));
  const text = lang === "sk"
    ? "Keď Jana vystúpila z vlaku, mesto ešte spalo. Nad strechami visela riedka hmla a z pekárne na rohu voňal čerstvý chlieb."
    : "The rain had stopped by the time Clara reached the old lighthouse. She paused at the door, listening to the waves.";
  await engine.synthesize("Ahoj.", { lang, voice, steps });
  let audio = 0;
  const t0 = performance.now();
  for (const s of segment(text)) audio += (await engine.synthesize(s.text, { lang, voice, steps })).length / engine.sampleRate;
  const sec = (performance.now() - t0) / 1000;
  console.log(`${engine.modelId} ${lang} ${voice}: audio ${audio.toFixed(1)} s, compute ${sec.toFixed(1)} s, RTF ${(sec / audio).toFixed(3)}`);
}

if (command === "normalize") process.stdout.write(spokenText(normalize(await readStdin(), lang)));
else if (command === "synth") await synth();
else if (command === "book") await book();
else if (command === "bench") await bench();
else {
  console.error("commands: normalize | synth | book | bench");
  process.exit(1);
}
