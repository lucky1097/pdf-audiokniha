// Whole book → one .m4b: AAC (Opus if the browser has no AAC encoder) via WebCodecs + mediabunny,
// then a Nero "chpl" chapter list is added to moov/udta, which audiobook players and ffmpeg read.
import { AudioSample, AudioSampleSource, BufferTarget, Mp4OutputFormat, Output, canEncodeAudio } from "mediabunny";
import { db } from "./db.ts";
import { PARAGRAPH_GAP, SENTENCE_GAP, chapterSentences, type Project } from "./project.ts";

/** Required by the Supertonic 3 licence (OpenRAIL-M): generated content must be labelled. */
export const AI_NOTICE = "Hlas generovaný umelou inteligenciou (Supertonic 3, licencia OpenRAIL-M). / AI-generated voice.";

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

/** Insert a Nero chpl box into moov/udta. Only valid when moov is the last top-level box (fastStart: false). */
export function withChapters(file: Uint8Array, chapters: { title: string; start: number }[]): Uint8Array<ArrayBuffer> {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const type = (o: number) => String.fromCharCode(file[o + 4], file[o + 5], file[o + 6], file[o + 7]);
  let moov = -1;
  for (let o = 0; o < file.length; ) {
    const size = view.getUint32(o);
    if (type(o) === "moov") moov = o;
    if (size < 8) break;
    if (type(o) === "moov" && o + size !== file.length) throw new Error("moov is not the last box");
    o += size;
  }
  if (moov < 0) throw new Error("no moov box");

  const enc = new TextEncoder();
  const list = chapters.slice(0, 255).map((c) => ({ start: c.start, title: enc.encode(c.title).slice(0, 255) }));
  const chplSize = 8 + 4 + 4 + 1 + list.reduce((n, c) => n + 8 + 1 + c.title.length, 0);
  const chpl = new Uint8Array(chplSize);
  const cv = new DataView(chpl.buffer);
  cv.setUint32(0, chplSize);
  chpl.set(enc.encode("chpl"), 4);
  cv.setUint32(8, 0x01000000); // version 1, flags 0
  cv.setUint32(12, 0);
  cv.setUint8(16, list.length);
  let o = 17;
  for (const c of list) {
    cv.setBigUint64(o, BigInt(Math.round(c.start * 1e7))); // 100 ns units
    cv.setUint8(o + 8, c.title.length);
    chpl.set(c.title, o + 9);
    o += 9 + c.title.length;
  }

  // Find udta directly inside moov.
  const moovSize = view.getUint32(moov);
  let udta = -1;
  for (let p = moov + 8; p < moov + moovSize; ) {
    const s = view.getUint32(p);
    if (type(p) === "udta") udta = p;
    if (s < 8) break;
    p += s;
  }
  let insertAt: number;
  let insert: Uint8Array;
  if (udta >= 0) {
    insertAt = udta + view.getUint32(udta);
    insert = chpl;
  } else {
    insertAt = moov + moovSize;
    insert = new Uint8Array(8 + chpl.length);
    new DataView(insert.buffer).setUint32(0, insert.length);
    insert.set(enc.encode("udta"), 4);
    insert.set(chpl, 8);
  }
  const out = new Uint8Array(file.length + insert.length);
  out.set(file.subarray(0, insertAt));
  out.set(insert, insertAt);
  out.set(file.subarray(insertAt), insertAt + insert.length);
  const ov = new DataView(out.buffer);
  ov.setUint32(moov, moovSize + insert.length);
  if (udta >= 0) ov.setUint32(udta, view.getUint32(udta) + insert.length);
  return out;
}
