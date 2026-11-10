// On-device storage: each book is a JSON file, each generated sentence a WAV file named by its cache key.
// Everything lives in the app's Documents folder; nothing is sent anywhere.
import { chapterSentences, type Project } from "@audiokniha/core";
import { Directory, File, Paths } from "expo-file-system";
import { aacAvailable, encodeAac } from "../../modules/audio-encoder/index.ts";

const booksDir = new Directory(Paths.document, "books");
const audioDir = new Directory(Paths.document, "audio");

function ensure(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export async function listProjects(): Promise<Project[]> {
  const out: Project[] = [];
  for (const entry of ensure(booksDir).list()) {
    if (!(entry instanceof File) || !entry.name.endsWith(".json")) continue;
    try {
      out.push(JSON.parse(await entry.text()) as Project);
    } catch {
      // A half-written file is skipped; the next save rewrites it.
    }
  }
  return out.sort((a, b) => b.updated - a.updated);
}

export async function getProject(id: string): Promise<Project | null> {
  const f = new File(ensure(booksDir), `${id}.json`);
  return f.exists ? (JSON.parse(await f.text()) as Project) : null;
}

export function saveProject(p: Project): void {
  const f = new File(ensure(booksDir), `${p.id}.json`);
  f.write(JSON.stringify({ ...p, updated: Date.now() }));
}

export function deleteProject(id: string): void {
  const f = new File(ensure(booksDir), `${id}.json`);
  if (f.exists) f.delete();
}

// Each generated sentence is an AAC .m4a (new), or a .wav from before AAC storage. Cache keys contain ':',
// so the file name is the key with everything but letters and digits replaced by '_'.
const fileBase = (key: string) => key.replace(/[^a-z0-9]/gi, "_");
const m4aFile = (key: string) => new File(ensure(audioDir), `${fileBase(key)}.m4a`);
const wavFile = (key: string) => new File(ensure(audioDir), `${fileBase(key)}.wav`);
const tmpWavFile = (key: string) => new File(ensure(audioDir), `${fileBase(key)}.tmp.wav`);
// Encoded here first and moved to the .m4a name only when complete, so playback never sees a half-written file.
// The name still ends in .m4a: AVAudioFile picks the container from the extension.
const tmpM4aFile = (key: string) => new File(ensure(audioDir), `${fileBase(key)}.tmp.m4a`);

/** The file that plays a sentence: the .m4a, else the old .wav, else the .m4a path a new sentence is written to. */
export function audioFile(key: string): File {
  const m4a = m4aFile(key);
  if (m4a.exists) return m4a;
  const wav = wavFile(key);
  return wav.exists ? wav : m4a;
}

export function hasAudio(key: string): boolean {
  return m4aFile(key).exists || wavFile(key).exists;
}

/** Stores one sentence as AAC. Without the encoder (old build) or if encoding fails, the WAV is kept. */
export async function writeAudio(key: string, wav: Uint8Array): Promise<void> {
  const tmp = tmpWavFile(key);
  if (tmp.exists) tmp.delete();
  tmp.writeSync(wav);
  const m4a = m4aFile(key);
  if (aacAvailable) {
    const tmpM4a = tmpM4aFile(key);
    if (tmpM4a.exists) tmpM4a.delete();
    try {
      await encodeAac(tmp.uri, tmpM4a.uri);
      if (m4a.exists) m4a.delete();
      tmpM4a.moveSync(m4a);
      tmp.delete();
      if (wavFile(key).exists) wavFile(key).delete();
      return;
    } catch {
      // Never lose a sentence to a failed encode: the WAV stays.
      if (tmpM4a.exists) tmpM4a.delete();
    }
  }
  const keep = wavFile(key);
  if (keep.exists) keep.delete();
  tmp.moveSync(keep);
}

/** Writes a WAV under its own name, for the 1 s silence file that is not a sentence. */
export function writeRawWav(key: string, wav: Uint8Array): void {
  wavFile(key).writeSync(wav);
}

/** Bytes on disk for these sentences, both formats. */
export function audioBytes(keys: Iterable<string>): number {
  let n = 0;
  for (const key of new Set(keys)) {
    for (const f of [m4aFile(key), wavFile(key)]) if (f.exists) n += f.size;
  }
  return n;
}

export function deleteAudio(keys: Iterable<string>): void {
  for (const key of keys) {
    for (const f of [m4aFile(key), wavFile(key)]) if (f.exists) f.delete();
  }
}

/** Every sentence key of a book (all chapters). */
export function bookKeys(p: Project): string[] {
  return p.chapters.flatMap((_, c) => chapterSentences(p, c).map((s) => s.key));
}

/** Deletes the audio of a book, except the sentences that another saved book also uses (same text and seed). */
export function deleteBookAudio(p: Project, others: Project[]): void {
  const shared = new Set<string>();
  for (const o of others) if (o.id !== p.id) for (const k of bookKeys(o)) shared.add(k);
  deleteAudio(bookKeys(p).filter((k) => !shared.has(k)));
}
