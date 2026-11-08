// On-device storage: each book is a JSON file, each generated sentence a WAV file named by its cache key.
// Everything lives in the app's Documents folder; nothing is sent anywhere.
import type { Project } from "@audiokniha/core";
import { Directory, File, Paths } from "expo-file-system";

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

/** The WAV file of one generated sentence (cache keys contain ':', kept out of file names). */
export function audioFile(key: string): File {
  return new File(ensure(audioDir), `${key.replace(/[^a-z0-9]/gi, "_")}.wav`);
}

export function hasAudio(key: string): boolean {
  return audioFile(key).exists;
}

export function writeAudio(key: string, wav: Uint8Array): File {
  const f = audioFile(key);
  f.write(wav);
  return f;
}
