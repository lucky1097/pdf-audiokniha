export { normalize, normalizeToText, spokenText, NORMALIZER_VERSION } from "./normalize/index.ts";
export type { Lang, Span, SpanKind, NormalizeOptions } from "./normalize/index.ts";
export { segment } from "./segment.ts";
export { wordAt, wordSpans } from "./words.ts";
export type { WordSpan } from "./words.ts";
export { detectLang } from "./detect-lang.ts";
export type { Segment, SegmentOptions } from "./segment.ts";
export { buildLines, extractBook, garbledFonts } from "./pdf/layout.ts";
export { markUnknownGlyphs } from "./pdf/tounicode.ts";
export { repairGlyphs } from "./pdf/glyphs.ts";
export type { Book, Chapter, Line, OutlineEntry, PdfPage, TextItem } from "./pdf/layout.ts";
export {
  GARBLED_NOTE,
  MODEL_ID,
  PARAGRAPH_GAP,
  SENTENCE_GAP,
  chapterSentences,
  chapterView,
  chaptersFromText,
  newId,
  newProject,
  toPcm16,
  wavBytes,
} from "./project.ts";
// The project's chapter is exported as ProjectChapter: Chapter is the PDF layout's.
export type { Chapter as ProjectChapter, ParagraphView, Project, Sentence, Voice } from "./project.ts";
