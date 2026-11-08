// Splits normalized (spoken) text into the units the voice model reads one at a time.
// Phase 0b: one sentence per call removed repeats; very short clips were unreliable, so they are merged.

export interface Segment {
  text: string;
  /** Index of the paragraph this segment belongs to. */
  paragraph: number;
  /** True for the last segment of a paragraph (the player adds a longer pause after it). */
  paragraphEnd: boolean;
}

export interface SegmentOptions {
  /** Sentences with fewer words are joined to a neighbour in the same paragraph. */
  minWords?: number;
  /** Longer sentences are split at punctuation, then at spaces. */
  maxChars?: number;
}

const SENTENCE_END = /(?<=[.!?…])(?:[“”"'»)\]]*)\s+(?=[„“"'«(\[]?[\p{Lu}\p{N}])/u;

function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let rest = paragraph.trim();
  while (rest) {
    const m = SENTENCE_END.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    out.push(rest.slice(0, m.index + m[0].length).trim());
    rest = rest.slice(m.index + m[0].length).trim();
  }
  return out;
}

const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

function splitLong(s: string, maxChars: number): string[] {
  if (s.length <= maxChars) return [s];
  const window = s.slice(0, maxChars);
  const minCut = Math.floor(maxChars * 0.3);
  let cut = -1;
  for (const re of [/[;:–—](?=\s)/g, /,(?=\s)/g, /\s/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(window))) if (m.index >= minCut) cut = m.index + (m[0].trim() ? 1 : 0);
    if (cut > 0) break;
  }
  if (cut <= 0) cut = maxChars;
  return [s.slice(0, cut).trim(), ...splitLong(s.slice(cut).trim(), maxChars)];
}

export function segment(text: string, options: SegmentOptions = {}): Segment[] {
  const minWords = options.minWords ?? 4;
  // Phase 1: the one repeat in ~500 chapter sentences came from a 190-character sentence; everything
  // up to ~150 characters read cleanly, so long sentences are split at commas from 160 on.
  const maxChars = options.maxChars ?? 160;
  const segments: Segment[] = [];
  const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  paragraphs.forEach((p, pi) => {
    const sentences = splitSentences(p);
    const merged: string[] = [];
    for (const s of sentences) {
      const prev = merged[merged.length - 1];
      if (prev !== undefined && wordCount(prev) < minWords) merged[merged.length - 1] = `${prev} ${s}`;
      else merged.push(s);
    }
    if (merged.length > 1 && wordCount(merged[merged.length - 1]) < minWords) {
      const last = merged.pop()!;
      merged[merged.length - 1] += ` ${last}`;
    }
    const pieces = merged.flatMap((s) => splitLong(s, maxChars));
    pieces.forEach((t, i) => segments.push({ text: t, paragraph: pi, paragraphEnd: i === pieces.length - 1 }));
  });
  return segments;
}
