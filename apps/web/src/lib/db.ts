// IndexedDB: projects (books) and generated audio. Audio is keyed by everything that changes the
// sound (see project.ts), so edits only invalidate the sentences they touch.
import type { Project } from "./project.ts";

export interface StoredAudio {
  key: string;
  pcm: Int16Array;
  sampleRate: number;
}

const DB = "audiokniha";
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("projects", { keyPath: "id" });
      r.result.createObjectStore("audio", { keyPath: "key" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function store(name: "projects" | "audio", mode: IDBTransactionMode = "readonly") {
  return (await open()).transaction(name, mode).objectStore(name);
}

export const db = {
  async projects(): Promise<Project[]> {
    const all = (await req((await store("projects")).getAll())) as Project[];
    return all.sort((a, b) => b.updated - a.updated);
  },
  async project(id: string): Promise<Project | undefined> {
    return req((await store("projects")).get(id)) as Promise<Project | undefined>;
  },
  async saveProject(p: Project): Promise<void> {
    await req((await store("projects", "readwrite")).put(p));
  },
  async deleteProject(id: string): Promise<void> {
    await req((await store("projects", "readwrite")).delete(id));
  },
  async audio(key: string): Promise<StoredAudio | undefined> {
    return req((await store("audio")).get(key)) as Promise<StoredAudio | undefined>;
  },
  async saveAudio(a: StoredAudio): Promise<void> {
    await req((await store("audio", "readwrite")).put(a));
  },
  async audioKeys(): Promise<Set<string>> {
    return new Set((await req((await store("audio")).getAllKeys())) as string[]);
  },
};

/** Ask the browser not to evict our data under storage pressure. */
export async function persistStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
