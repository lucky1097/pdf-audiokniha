// The project model lives in @audiokniha/core (shared with the iPhone app); this module keeps the web's imports.
import { wavBytes } from "@audiokniha/core";

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
} from "@audiokniha/core";
export type { ProjectChapter as Chapter, ParagraphView, Project, Sentence } from "@audiokniha/core";

/** Mono 16-bit WAV with trailing silence, for the <audio> element. */
export function wavBlob(pcm: Int16Array, sampleRate: number, gapSeconds: number): Blob {
  return new Blob([wavBytes(pcm, sampleRate, gapSeconds) as BlobPart], { type: "audio/wav" });
}
