// Text from photographed pages. The iPhone's on-device text recognition gives lines per page; this turns them into
// paragraphs and repairs the apostrophe forms Apple writes for ť, ľ, ď (t', d', l', I').
import type { Lang } from "./normalize/types.ts";
import { SK_HACEK_WORDS } from "./sk-words.ts";

/** One recognised line. Box is normalised to the page (0..1, origin top-left); missing when the engine gives none. */
export interface ScanLine {
  text: string;
  box?: { x: number; y: number; w: number; h: number };
}

type Box = NonNullable<ScanLine["box"]>;
type Line = { text: string; box?: Box };

const PAGE_NUMBER = /^[-–—\s]*\d{1,4}[-–—\s]*$/;
const SENTENCE_END = /[.!?…“"]$/;
const PARAGRAPH_END = /[.!?…]$/;
const HYPHEN_END = /\p{L}[-‐¬]$/u;
const LOWER_START = /^\p{Ll}/u;

const APOSTROPHE = "['’`´]";
const APOSTROPHE_LETTER: Record<string, string> = { t: "ť", d: "ď", l: "ľ", T: "Ť", D: "Ď", L: "Ľ" };
const PLAIN_LETTER: Record<string, string> = { ť: "t", ľ: "l", ď: "d" };
// Apple reads ľ as a capital I or a bar, so these two only count between lowercase letters or at a word end.
const APOSTROPHE_I = new RegExp(`(?<=\\p{Ll})[I|]${APOSTROPHE}(?=\\p{Ll}|\\s|$|[.,;:!?)“"])`, "gu");
// The letter after the apostrophe is lowercase (d'Italia stays), and "s" alone is an English possessive (McDonald's).
const APOSTROPHE_TDL = new RegExp(
  `(?<!\\p{N})([tdlTDL])${APOSTROPHE}(?!s(?!\\p{L}))(?=\\p{Ll}|\\s|$|[.,;:!?)“"])`,
  "gu",
);

/** Pages of lines (in the order the engine gave them) → text with paragraphs separated by one blank line. */
export function textFromScan(pages: ScanLine[][], lang: Lang): string {
  const paras: string[] = [];
  let last = ""; // text of the last line appended, for the hyphen join across lines and pages
  for (const page of pages) {
    const lines = pageLines(page);
    if (lines.length === 0) continue;
    const boxed = lines.every((l) => l.box);
    const longest = Math.max(...lines.map((l) => l.text.length));
    const h = boxed ? median(lines.map((l) => l.box!.h)) : 0;
    const left = boxed ? commonLeft(lines.map((l) => l.box!.x)) : 0;
    let prev: Line | undefined;
    for (const line of lines) {
      let newPara: boolean;
      if (!prev) {
        // A new page continues the last paragraph unless that one ended a sentence.
        newPara = paras.length === 0 || PARAGRAPH_END.test(paras[paras.length - 1]);
      } else if (boxed) {
        const gap = line.box!.y - (prev.box!.y + prev.box!.h);
        newPara = gap > 0.8 * h || line.box!.x - left > 1.5 * h;
      } else {
        // No geometry: a short line that ends a sentence is the end of a paragraph.
        newPara = SENTENCE_END.test(prev.text) && prev.text.length < 0.7 * longest;
      }
      if (newPara || paras.length === 0) paras.push(line.text);
      else paras[paras.length - 1] = joinLine(paras[paras.length - 1], last, line.text);
      last = line.text;
      prev = line;
    }
  }
  const out = paras.map((p) => p.trim()).filter(Boolean).join("\n\n");
  return fixSlovakLetters(out, lang);
}

/** Slovak letter repair: apostrophe forms become ť, ľ, ď; returns the text unchanged for lang "en". */
export function fixSlovakLetters(text: string, lang: Lang): string {
  if (lang !== "sk") return text;
  return fixDroppedHacek(
    text.replace(APOSTROPHE_TDL, (_, c: string) => APOSTROPHE_LETTER[c]).replace(APOSTROPHE_I, "ľ"),
  );
}

// A guess from letter patterns changed correct words (Brief N round 2), so the repair is a word list instead:
// SK_HACEK_WORDS, built by tools/build-sk-words.mjs. Plain real words (byt, celkom, hotel) are left out when the
// list is built, so they never change here.
let hacekForms: Map<string, string> | undefined;

/** Plain spelling (ť→t, ľ→l, ď→d) → the háček form from the list. Built on first use. */
function hacekFormsByPlain(): Map<string, string> {
  if (!hacekForms) {
    hacekForms = new Map();
    for (const form of SK_HACEK_WORDS.split(" ")) {
      const key = plainOf(form);
      if (!hacekForms.has(key)) hacekForms.set(key, form);
    }
  }
  return hacekForms;
}

function plainOf(word: string): string {
  return word.replace(/[ťľď]/g, (c) => PLAIN_LETTER[c]);
}

/** Replaces a word whose háček was dropped with the listed form, in the word's case. */
function fixDroppedHacek(text: string): string {
  const forms = hacekFormsByPlain();
  return text.replace(/\p{L}+/gu, (word) => {
    // A word that already has ť, ľ or ď is right as it is.
    if (/[ťľďŤĽĎ]/.test(word)) return word;
    const lower = word.toLowerCase();
    const form = forms.get(plainOf(lower));
    if (!form || form === lower) return word;
    if (word.length > 1 && word === word.toUpperCase()) return form.toUpperCase();
    if (/^\p{Lu}/u.test(word)) return form[0].toUpperCase() + form.slice(1);
    return form;
  });
}

/** Non-empty lines of one page, in reading order, without a page number at the top or bottom. */
function pageLines(page: ScanLine[]): Line[] {
  let lines: Line[] = page
    .map((l) => ({ text: l.text.replace(/\s+/g, " ").trim(), box: l.box }))
    .filter((l) => l.text !== "");
  if (lines.length && lines.every((l) => l.box)) {
    lines.sort((a, b) => a.box!.y - b.box!.y || a.box!.x - b.box!.x);
  }
  if (lines.length && PAGE_NUMBER.test(lines[0].text)) lines = lines.slice(1);
  if (lines.length && PAGE_NUMBER.test(lines[lines.length - 1].text)) lines = lines.slice(0, -1);
  return lines;
}

/** Appends a line to the paragraph; a hyphen at a line end joins the next lowercase word without a space. */
function joinLine(paragraph: string, previousLine: string, next: string): string {
  if (HYPHEN_END.test(previousLine) && LOWER_START.test(next)) return paragraph.slice(0, -1) + next;
  return paragraph + " " + next;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The page's most common left edge; OCR jitter is grouped at 0.01 of the page width. */
function commonLeft(xs: number[]): number {
  const counts = new Map<number, number>();
  for (const x of xs) {
    const k = Math.round(x * 100) / 100;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = 0;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN || (n === bestN && k < best)) {
      best = k;
      bestN = n;
    }
  }
  return best;
}
