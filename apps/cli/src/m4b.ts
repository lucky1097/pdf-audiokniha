import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Required by the Supertonic 3 licence (OpenRAIL-M, attachment A): published machine-generated
 * content must say so. Written into every export.
 */
export const AI_NOTICE = "Hlas generovaný umelou inteligenciou (Supertonic 3, licencia OpenRAIL-M). / AI-generated voice.";

export interface ChapterFile {
  title: string;
  file: string;
  seconds: number;
}

export interface BookMeta {
  title: string;
  author?: string;
  lang: string;
}

const esc = (s: string) => s.replace(/[=;#\\\n]/g, (c) => (c === "\n" ? " " : `\\${c}`));

/** ffmpeg FFMETADATA1 with book tags and one chapter per file. */
export function ffmetadata(book: BookMeta, chapters: ChapterFile[]): string {
  const lines = [";FFMETADATA1", `title=${esc(book.title)}`, `album=${esc(book.title)}`, "genre=Audiobook", `comment=${esc(AI_NOTICE)}`, `language=${book.lang}`];
  if (book.author) lines.push(`artist=${esc(book.author)}`);
  let t = 0;
  for (const c of chapters) {
    const start = Math.round(t * 1000);
    t += c.seconds;
    lines.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${start}`, `END=${Math.round(t * 1000)}`, `title=${esc(c.title)}`);
  }
  return lines.join("\n") + "\n";
}

/** ffmpeg from FFMPEG, the repo's tools/ffmpeg folder, or PATH; null when none is found. */
export function findFfmpeg(root: string): string | null {
  const candidates = [process.env.FFMPEG, join(root, "tools", "ffmpeg", "ffmpeg.exe"), join(root, "tools", "ffmpeg", "ffmpeg")].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(c)) return c;
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
  return probe.status === 0 ? probe.stdout.split(/\r?\n/)[0].trim() : null;
}

/**
 * Writes chapters.ffmeta and concat.txt next to the chapter WAVs and, when ffmpeg is available, encodes
 * one M4B (AAC, mono) with chapter marks. Returns the M4B path, or null when ffmpeg is missing.
 */
export async function writeM4b(outDir: string, book: BookMeta, chapters: ChapterFile[], ffmpeg: string | null, bitrate = "64k"): Promise<string | null> {
  const meta = join(outDir, "chapters.ffmeta");
  const list = join(outDir, "concat.txt");
  await writeFile(meta, ffmetadata(book, chapters));
  await writeFile(list, chapters.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  if (!ffmpeg) return null;
  const target = join(outDir, "book.m4b");
  const r = spawnSync(
    ffmpeg,
    ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", meta,
      "-map", "0:a", "-map_metadata", "1", "-map_chapters", "1", "-metadata:s:a:0", `language=${book.lang === "sk" ? "slk" : "eng"}`, "-c:a", "aac", "-b:a", bitrate, "-ac", "1", "-movflags", "+faststart", target],
    { cwd: outDir, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr || r.error}`);
  return target;
}
