import { EN_RULES } from "./en.ts";
import { run, spokenText } from "./runner.ts";
import { SK_RULES } from "./sk.ts";
import type { Lang, Rule, Span } from "./types.ts";

export type { Lang, Span, SpanKind } from "./types.ts";
export { spokenText } from "./runner.ts";

/** Bump when normalization output changes, so cached audio is regenerated. */
export const NORMALIZER_VERSION = 4;

export interface NormalizeOptions {
  /** User pronunciation dictionary: whole-word, case-sensitive replacements applied before the built-in rules. */
  dictionary?: Record<string, string>;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function dictionaryRule(dict: Record<string, string>): Rule | null {
  const keys = Object.keys(dict).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!keys.length) return null;
  return {
    name: "dictionary",
    re: new RegExp(`(?:${keys.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "uy"),
    apply: (m) => ({ spoken: dict[m[0]], kind: "dictionary" }),
  };
}

export function normalize(text: string, lang: Lang, options: NormalizeOptions = {}): Span[] {
  const rules = lang === "sk" ? SK_RULES : EN_RULES;
  const dict = options.dictionary ? dictionaryRule(options.dictionary) : null;
  // Collapse layout whitespace but keep paragraph breaks.
  const clean = text.replace(/[ \t  ]*\n[ \t  ]*/g, "\n").replace(/[ \t]+/g, " ");
  return run(clean, dict ? [dict, ...rules] : rules);
}

export function normalizeToText(text: string, lang: Lang, options: NormalizeOptions = {}): string {
  return spokenText(normalize(text, lang, options));
}
