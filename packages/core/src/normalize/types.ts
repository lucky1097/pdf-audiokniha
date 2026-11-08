export type Lang = "sk" | "en";

export type SpanKind =
  | "text"
  | "number"
  | "decimal"
  | "ordinal"
  | "date"
  | "time"
  | "currency"
  | "percent"
  | "temperature"
  | "unit"
  | "range"
  | "roman"
  | "abbreviation"
  | "symbol"
  | "dictionary";

/** One piece of the source text and how it will be read aloud. */
export interface Span {
  original: string;
  spoken: string;
  kind: SpanKind;
  /** False when the normalizer had to guess (grammatical case, gender, ambiguous abbreviation). */
  confident: boolean;
}

export interface Context {
  text: string;
  /** Start of the match in `text`. */
  start: number;
  /** End of the match in `text`. */
  end: number;
}

export type RuleResult = { spoken: string; kind: SpanKind; confident?: boolean } | null;

export interface Rule {
  name: string;
  /** Must be a sticky (`y`) unicode (`u`) regex; it is tried at every word start. */
  re: RegExp;
  apply(m: RegExpExecArray, ctx: Context): RuleResult;
}
