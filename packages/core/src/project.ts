// The book project shared by the web app and the iPhone app: chapters, how each is cut into sentences,
// and the audio cache key of every sentence. Same input, same keys and seeds on every platform.
import { normalize, spokenText, type Lang, type Span } from "./normalize/index.ts";
import { segment } from "./segment.ts";

/** Supertonic 3 voices: F1–F5, M1–M5 (kept here as a type so core stays free of the engine). */
export type Voice = "F1" | "F2" | "F3" | "F4" | "F5" | "M1" | "M2" | "M3" | "M4" | "M5";

export interface Chapter {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface Project {
  id: string;
  title: string;
  author?: string;
  lang: Lang;
  voice: Voice;
  /** Flow-matching steps; 16 with WebGPU, 8 on CPU (phase 1: fewer repeats at 16). */
  steps: number;
  chapters: Chapter[];
  /** User pronunciation dictionary: word → how to say it. */
  dictionary: Record<string, string>;
  /** Seed overrides per sentence (base key → seed). "Generate again" bumps the seed. */
  seeds: Record<string, number>;
  position: { chapter: number; segment: number };
  /** True while the user wants the whole book generated; generation resumes after a reload. */
  generating: boolean;
  /** garbledChars: characters left out because their font's character map in the PDF is broken. */
  source?: { file: string; pages: number; imageOnlyPages: number[]; garbledChars?: number };
  created: number;
  updated: number;
}

/** Shown on a book whose PDF had fonts with a broken character map (Book.removed.garbled). */
export const GARBLED_NOTE =
  "Toto PDF má časť písmen uloženú poškodene (stáva sa to pri PDF uloženom cez Safari). Ligatúry ako fi a fl appka opravila. Čísla a skratky v ozdobnom písme sa obnoviť nedajú, preto ich kniha vynecháva. Pôvodné PDF to zvyčajne nemá.";

export const MODEL_ID = "supertonic-3-fp32";
export const SENTENCE_GAP = 0.35;
export const PARAGRAPH_GAP = 0.8;

export interface Sentence {
  /** Index within the chapter. */
  index: number;
  /** Paragraph index within the chapter; -1 is the chapter title. */
  paragraph: number;
  paragraphEnd: boolean;
  /** What the voice reads (normalized). */
  text: string;
  base: string;
  seed: number;
  /** Audio cache key: base + seed. */
  key: string;
}

export interface ParagraphView {
  paragraph: number;
  original: string;
  spans: Span[];
  sentences: Sentence[];
}

/** cyrb53: fast sync string hash, enough for cache keys. */
function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** A chapter split the way it will be read: title first, then each paragraph normalized and cut into sentences. */
export function chapterView(p: Project, chapterIndex: number): ParagraphView[] {
  const ch = p.chapters[chapterIndex];
  const parts = [{ paragraph: -1, text: ch.title ? `${ch.title}.` : "" }, ...ch.paragraphs.map((t, i) => ({ paragraph: i, text: t }))];
  const views: ParagraphView[] = [];
  let index = 0;
  for (const part of parts) {
    if (!part.text.trim()) continue;
    const spans = normalize(part.text, p.lang, { dictionary: p.dictionary });
    const sentences = segment(spokenText(spans)).map((s) => {
      // The key holds the spoken text itself, so a normalizer change only invalidates sentences it alters.
      const base = hash(JSON.stringify([s.text, p.lang, p.voice, p.steps, MODEL_ID]));
      const seed = p.seeds[base] ?? 1;
      return { index: index++, paragraph: part.paragraph, paragraphEnd: s.paragraphEnd, text: s.text, base, seed, key: `${base}:${seed}` };
    });
    views.push({ paragraph: part.paragraph, original: part.text, spans, sentences });
  }
  return views;
}

export const chapterSentences = (p: Project, c: number): Sentence[] => chapterView(p, c).flatMap((v) => v.sentences);

/** A random id; uses crypto.randomUUID where the platform has it (browsers), else Math.random (Hermes). */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function newProject(title: string, lang: Lang, chapters: { title: string; paragraphs: string[] }[], gpu: boolean): Project {
  const now = Date.now();
  return {
    id: newId(),
    title,
    lang,
    voice: "F4",
    steps: gpu ? 16 : 8,
    chapters: chapters.map((c) => ({ id: newId(), title: c.title, paragraphs: c.paragraphs })),
    dictionary: {},
    seeds: {},
    position: { chapter: 0, segment: 0 },
    generating: false,
    created: now,
    updated: now,
  };
}

/** Plain text → chapters: blank lines separate paragraphs, "Kapitola …"/"Chapter …" lines start chapters. */
export function chaptersFromText(text: string, lang: Lang): { title: string; paragraphs: string[] }[] {
  const paras = text.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const chapters: { title: string; paragraphs: string[] }[] = [];
  for (const p of paras) {
    if (/^(kapitola|chapter|časť|part)\b.{0,60}$/i.test(p) || /^[IVXLC]{1,6}\.?$/.test(p)) chapters.push({ title: p, paragraphs: [] });
    else {
      if (!chapters.length) chapters.push({ title: lang === "sk" ? "Kapitola 1" : "Chapter 1", paragraphs: [] });
      chapters[chapters.length - 1].paragraphs.push(p);
    }
  }
  return chapters.filter((c) => c.paragraphs.length);
}

/** Float samples (-1..1) → 16-bit PCM. */
export function toPcm16(audio: Float32Array): Int16Array {
  const pcm = new Int16Array(audio.length);
  for (let i = 0; i < audio.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(audio[i] * 32767)));
  return pcm;
}

/** Mono 16-bit WAV file bytes with trailing silence. */
export function wavBytes(pcm: Int16Array, sampleRate: number, gapSeconds: number): Uint8Array {
  const gap = Math.round(gapSeconds * sampleRate);
  const n = pcm.length + gap;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
  new Int16Array(buf, 44, pcm.length).set(pcm);
  return new Uint8Array(buf);
}
