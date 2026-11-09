// Works out the glyphs markUnknownGlyphs() (tounicode.ts) marked as unknown, font by font. Most are ligatures:
// one glyph of a font always stands for the same letters, so every word it occurs in is evidence. "{68}rms",
// "quali{68}ed" and "{68}nance" all read best with fi; "work{59}ows" and "cash {59}ow" with fl. Glyphs that do
// not sit next to letters (old-style figures, small-cap abbreviations) cannot be worked out from the text:
// the words with them are left out, so the voice skips them instead of reading nonsense.
import type { Lang } from "../normalize/types.ts";
import { detectLang } from "../detect-lang.ts";
import { LETTER_STATS } from "./letter-stats.ts";
import type { PdfPage } from "./layout.ts";
import { UNKNOWN_GLYPH_BASE, selfMapped } from "./tounicode.ts";

const LIGATURES = ["fi", "fl", "ff", "ffi", "ffl"];
const UNKNOWN = /[-]/;
const UNKNOWN_ALL = /[-]/g;

const stats = new Map<Lang, { tri: Map<string, number>; pre: Map<string, number> }>();
function model(lang: Lang) {
  let m = stats.get(lang);
  if (!m) {
    const tri = new Map<string, number>();
    const pre = new Map<string, number>();
    for (const e of LETTER_STATS[lang].split(",")) {
      const chars = [...e];
      const t = chars.slice(0, 3).join("");
      const n = parseInt(chars.slice(3).join(""), 36);
      tri.set(t, n);
      pre.set(chars.slice(0, 2).join(""), (pre.get(chars.slice(0, 2).join("")) ?? 0) + n);
    }
    stats.set(lang, (m = { tri, pre }));
  }
  return m;
}

/** Log-likelihood of a word under the letter model (^ and $ mark its edges). */
function score(word: string, lang: Lang): number {
  const { tri, pre } = model(lang);
  const chars = [..."^^", ...word.toLowerCase(), "$"];
  let sum = 0;
  for (let i = 2; i < chars.length; i++) {
    const ctx = chars[i - 2] === "^" && chars[i - 1] === "^" ? null : chars[i - 2] + chars[i - 1];
    if (!ctx) continue;
    const n = tri.get(ctx + chars[i]) ?? 0;
    sum += Math.log((n + 0.5) / ((pre.get(ctx) ?? 0) + 20));
  }
  return sum;
}

const isLower = (ch: string | undefined) => !!ch && /\p{Ll}/u.test(ch);

export interface GlyphRepair {
  pages: PdfPage[];
  /** Characters restored (mostly ligatures). */
  fixed: number;
  /** Characters left out with the words that held glyphs no one can read. */
  dropped: number;
}

/** Replaces unknown glyphs with what they most likely stood for; leaves out words with ones that cannot be known. */
export function repairGlyphs(pages: PdfPage[], lang?: Lang): GlyphRepair {
  const key = (font: string | undefined, ch: string) => `${font ?? ""}\u0000${ch}`;
  // For each font and glyph: the words it occurs in, and how often a lowercase letter touches it.
  const seen = new Map<string, { words: string[]; total: number; byLetter: number; afterLower: boolean }>();
  let any = false;
  for (const p of pages) {
    for (const it of p.items) {
      if (!UNKNOWN.test(it.str)) continue;
      any = true;
      const chars = [...it.str];
      chars.forEach((ch, i) => {
        if (!UNKNOWN.test(ch)) return;
        const k = key(it.font, ch);
        const s = seen.get(k) ?? { words: [], total: 0, byLetter: 0, afterLower: false };
        s.total++;
        if (isLower(chars[i - 1]) || isLower(chars[i + 1])) s.byLetter++;
        if (isLower(chars[i - 1])) s.afterLower = true;
        seen.set(k, s);
      });
      for (const w of it.str.match(/[\p{L}-]+/gu) ?? []) {
        for (const ch of new Set(w.match(UNKNOWN_ALL) ?? [])) {
          const s = seen.get(key(it.font, ch));
          if (s && s.words.length < 60) s.words.push(w);
        }
      }
    }
  }
  if (!any) return { pages, fixed: 0, dropped: 0 };

  const language =
    lang ?? detectLang(pages.flatMap((p) => p.items.map((i) => i.str)).join(" ").slice(0, 20000));
  const choice = new Map<string, string | null>();
  for (const [k, s] of seen) {
    const ch = k.slice(k.indexOf("\u0000") + 1);
    if (s.byLetter / s.total < 0.5) {
      choice.set(k, null);
      continue;
    }
    const own = String.fromCharCode(selfMapped(ch.charCodeAt(0) - UNKNOWN_GLYPH_BASE));
    const candidates = [...LIGATURES];
    // The character the glyph claimed, when it is a letter that fits: Quartz can put a real letter on its own code.
    if (/\p{L}/u.test(own) && !(s.afterLower && own !== own.toLowerCase())) candidates.push(own);
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const c of candidates) {
      let total = 0;
      for (const w of s.words) {
        // Only the stretch of the word without other unknown glyphs counts.
        const part = w.replaceAll(ch, "\u0001").split(UNKNOWN).find((x) => x.includes("\u0001")) ?? "";
        total += score(part.replaceAll("\u0001", c), language);
      }
      if (total > bestScore) {
        bestScore = total;
        best = c;
      }
    }
    choice.set(k, best);
  }

  let fixed = 0;
  let dropped = 0;
  const out = pages.map((p) => ({
    ...p,
    items: p.items.map((it) => {
      if (!UNKNOWN.test(it.str)) return it;
      // Known glyphs first, so a word is only left out for the glyphs nobody can read.
      let str = it.str.replace(UNKNOWN_ALL, (ch) => {
        const c = choice.get(key(it.font, ch));
        if (c == null) return ch;
        fixed++;
        return c;
      });
      if (UNKNOWN.test(str)) {
        str = str.replace(/(\S*[-]\S*)/g, (word: string) => {
          const tail = /[.,;:!?]+$/.exec(word)?.[0] ?? "";
          dropped += word.length - tail.length;
          return tail;
        });
        str = str.replace(/\s+([.,;:!?)])/g, "$1").replace(/ {2,}/g, " ");
      }
      return { ...it, str };
    }),
  }));
  return { pages: out, fixed, dropped };
}
