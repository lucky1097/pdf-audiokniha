// Whole book → one .m4b: AAC (Opus if the browser has no AAC encoder) via WebCodecs + mediabunny,
// then a Nero "chpl" chapter list is added to moov/udta, which audiobook players and ffmpeg read.
import { AudioSample, AudioSampleSource, BufferTarget, Mp4OutputFormat, Output, canEncodeAudio } from "mediabunny";
import { AI_NOTICE, withChapters } from "@audiokniha/core";
import { db } from "./db.ts";
import { PARAGRAPH_GAP, SENTENCE_GAP, chapterSentences, type Project } from "./project.ts";

// BookView imports AI_NOTICE from here; it now lives in core, shared with the mobile app's tags.
export { AI_NOTICE };

export interface ExportResult {
  blob: Blob;
  codec: "aac" | "opus";
  seconds: number;
  chapters: { title: string; start: number }[];
}

export async function missingSentences(p: Project, done: Set<string>): Promise<number> {
  let n = 0;
  p.chapters.forEach((_, c) => chapterSentences(p, c).forEach((s) => done.has(s.key) || n++));
  return n;
}

export async function exportBook(p: Project, onProgress: (done: number, total: number) => void): Promise<ExportResult> {
  const codec = (await canEncodeAudio("aac", { numberOfChannels: 1, sampleRate: 44100, bitrate: 64000 })) ? "aac" : "opus";
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target: new BufferTarget() });
  const source = new AudioSampleSource({ codec, bitrate: 64000 });
  output.addAudioTrack(source, { languageCode: p.lang === "sk" ? "slk" : "eng" });
  output.setMetadataTags({ title: p.title, album: p.title, artist: p.author, genre: "Audiobook", comment: AI_NOTICE });
  await output.start();

  const total = p.chapters.reduce((n, _, c) => n + chapterSentences(p, c).length, 0);
  const chapters: ExportResult["chapters"] = [];
  let t = 0;
  let done = 0;
  for (const [c, ch] of p.chapters.entries()) {
    chapters.push({ title: ch.title || `${c + 1}`, start: t });
    for (const s of chapterSentences(p, c)) {
      const a = await db.audio(s.key);
      if (!a) throw new Error(`Chýba zvuk vety: „${s.text.slice(0, 60)}…“. Najprv vygeneruj celú knihu.`);
      const gap = Math.round((s.paragraphEnd ? PARAGRAPH_GAP : SENTENCE_GAP) * a.sampleRate);
      const data = new Float32Array(a.pcm.length + gap);
      for (let i = 0; i < a.pcm.length; i++) data[i] = a.pcm[i] / 32768;
      await source.add(new AudioSample({ data, format: "f32", numberOfChannels: 1, sampleRate: a.sampleRate, timestamp: t }));
      t += data.length / a.sampleRate;
      onProgress(++done, total);
    }
  }
  source.close();
  await output.finalize();
  const buf = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([withChapters(new Uint8Array(buf), chapters)], { type: "audio/mp4" }), codec, seconds: t, chapters };
}
