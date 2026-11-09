// Which word of a sentence the voice is on. The voice model gives no word timings, so each word gets a share of
// the sentence's speaking time from its letters, plus the pause it is followed by (a comma, a full stop). Good to
// a word or so; meant for a soft highlight, not for cutting audio.

export interface WordSpan {
  /** Character offsets of the word in the sentence. */
  start: number;
  end: number;
  /** Share of the speaking time where it starts and ends, 0 to 1. */
  from: number;
  to: number;
}

/** Each word costs a little on its own (its onset) besides its letters. */
const WORD = 1.5;
const PAUSE: [RegExp, number][] = [
  [/[.!?…]["”’»)]*$/, 6],
  [/[,;:]["”’»)]*$/, 4],
  [/[—–]$/, 3],
];

export function wordSpans(text: string): WordSpan[] {
  const words = [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, word: m[0] }));
  const weights = words.map(({ word }, i) => {
    let w = WORD + (word.match(/[\p{L}\p{N}]/gu) ?? []).length;
    // The pause after the last word is the silence at the end of the sentence, not speech.
    if (i < words.length - 1) for (const [re, p] of PAUSE) if (re.test(word)) w += p;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return words.map(({ start, end }, i) => {
    const from = at / total;
    at += weights[i];
    return { start, end, from, to: at / total };
  });
}

/** Index of the word being spoken at `fraction` (0 to 1) of the speaking time; -1 before it starts. */
export function wordAt(spans: WordSpan[], fraction: number): number {
  if (!spans.length || fraction <= 0) return -1;
  if (fraction >= 1) return spans.length - 1;
  let lo = 0;
  let hi = spans.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (spans[mid].from <= fraction) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
