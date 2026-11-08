import type { Context, Rule, Span } from "./types.ts";

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Word before `index`, lowercased, skipping spaces and opening quotes/brackets. */
export function prevWord(text: string, index: number): string {
  const m = /([\p{L}\p{N}]+)[\s„“"'(\[]*$/u.exec(text.slice(Math.max(0, index - 40), index));
  return m ? m[1].toLowerCase() : "";
}

/** Next `count` words after `index`, lowercased. */
export function nextWords(text: string, index: number, count = 1): string[] {
  const words = text.slice(index, index + 80).match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, count).map((w) => w.toLowerCase());
}

/**
 * Scan `text` left to right. At every position where a word can start, try the rules in order;
 * the first rule that matches and returns a result becomes a span. Everything else is plain text.
 */
export function run(text: string, rules: Rule[]): Span[] {
  const spans: Span[] = [];
  let plain = "";
  let i = 0;
  const flush = () => {
    if (plain) spans.push({ original: plain, spoken: plain, kind: "text", confident: true });
    plain = "";
  };
  while (i < text.length) {
    const atWordStart = i === 0 || !WORD_CHAR.test(text[i - 1]);
    let matched = false;
    if (atWordStart) {
      for (const rule of rules) {
        rule.re.lastIndex = i;
        const m = rule.re.exec(text);
        if (!m || m[0].length === 0) continue;
        const end = i + m[0].length;
        const ctx: Context = { text, start: i, end };
        const r = rule.apply(m, ctx);
        if (!r) continue;
        flush();
        spans.push({ original: m[0], spoken: r.spoken, kind: r.kind, confident: r.confident ?? true });
        i = end;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += text[i];
      i++;
    }
  }
  flush();
  return spans;
}

export function spokenText(spans: Span[]): string {
  return spans.map((s) => s.spoken).join("");
}
