export { normalize, normalizeToText, spokenText, NORMALIZER_VERSION } from "./normalize/index.ts";
export type { Lang, Span, SpanKind, NormalizeOptions } from "./normalize/index.ts";
export { segment } from "./segment.ts";
export { detectLang } from "./detect-lang.ts";
export type { Segment, SegmentOptions } from "./segment.ts";
export { buildLines, extractBook } from "./pdf/layout.ts";
export type { Book, Chapter, Line, OutlineEntry, PdfPage, TextItem } from "./pdf/layout.ts";
export {
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
