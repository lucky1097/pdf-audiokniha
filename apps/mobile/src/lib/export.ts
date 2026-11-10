// Whole book → one .m4b on the phone: every sentence's audio is joined (native AAC), then chapter marks and tags
// are added in core. The file is written to the cache folder; the share sheet hands it to the user.
import { AI_NOTICE, withChapters, type ChapterMark, type Mp4Tags } from "@audiokniha/core";
import { File, Paths } from "expo-file-system";
import { joinAac } from "../../modules/audio-encoder/index.ts";
import type { BookController } from "./book.ts";
import { audioFile, hasAudio } from "./storage.ts";

export interface ExportResult {
  uri: string;
  seconds: number;
  bytes: number;
  chapters: number;
}

/** A file name from the book title: no characters a file system refuses, at most 80 long. */
function fileName(title: string): string {
  const name = title.replace(/[\/\\:*?"<>|]/g, "-").trim().slice(0, 80);
  return name || "audiokniha";
}

export async function exportBook(
  ctl: BookController,
  onProgress: (done: number, total: number) => void,
): Promise<ExportResult> {
  const p = ctl.getState().project;

  // Inputs in book order; a chapter starts at the input of its first sentence.
  const inputs: string[] = [];
  const starts: { first: number; title: string }[] = [];
  let missing = 0;
  p.chapters.forEach((ch, c) => {
    const sentences = ctl.sentencesOf(c);
    if (!sentences.length) return;
    starts.push({ first: inputs.length, title: ch.title || `Kapitola ${c + 1}` });
    for (const s of sentences) {
      if (!hasAudio(s.key)) missing++;
      inputs.push(audioFile(s.key).uri);
    }
  });
  if (missing > 0) throw new Error(`Ešte treba pripraviť ${missing} viet.`);
  if (!inputs.length) throw new Error("Kniha nemá žiadne vety.");

  // Temporary joined file; removed on every path, the .m4b is what is kept.
  const joined = new File(Paths.cache, "export.m4a");
  try {
    if (joined.exists) joined.delete();
    const seconds = await joinAac(inputs, joined.uri, 64000, onProgress);

    // Chapter start = total duration of the sentences before it.
    const at = (i: number) => seconds.slice(0, i).reduce((a, b) => a + b, 0);
    const marks: ChapterMark[] = starts.map(({ first, title }) => ({ title, start: at(first) }));
    const tags: Mp4Tags = { title: p.title, artist: p.author, album: p.title, genre: "Audiobook", comment: AI_NOTICE };
    const present = Object.fromEntries(Object.entries(tags).filter(([, v]) => v)) as Mp4Tags;

    const bytes = withChapters(await joined.bytes(), marks, present);
    const out = new File(Paths.cache, `${fileName(p.title)}.m4b`);
    if (out.exists) out.delete();
    out.write(bytes);

    return { uri: out.uri, seconds: at(inputs.length), bytes: bytes.length, chapters: marks.length };
  } finally {
    if (joined.exists) joined.delete();
  }
}
