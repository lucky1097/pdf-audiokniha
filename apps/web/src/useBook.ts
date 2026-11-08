import { useEffect, useRef, useState } from "react";
import { db } from "./lib/db.ts";
import { generator } from "./lib/generator.ts";
import { player } from "./lib/player.ts";
import { chapterSentences, type Project } from "./lib/project.ts";

/** The open book: loaded from IndexedDB, saved shortly after edits, shared with the generator and player. */
export function useBook(id: string | null) {
  const [book, setBook] = useState<Project | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setBook(null);
    if (id) void db.project(id).then((p) => setBook(p ?? null));
  }, [id]);

  useEffect(() => {
    generator.setProject(book);
    player.setProject(book);
    if (!book) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void db.saveProject({ ...book, updated: Date.now() }), 400);
  }, [book]);

  useEffect(() => {
    player.onPosition = (c, s) => setBook((p) => (p ? { ...p, position: { chapter: c, segment: s } } : p));
    return () => {
      player.onPosition = null;
    };
  }, []);

  const update = (f: (p: Project) => Project) => setBook((p) => (p ? f(p) : p));
  return { book, update };
}

export type UpdateBook = ReturnType<typeof useBook>["update"];

/** About 13 characters per second of speech; used for durations before audio exists. */
export const CHARS_PER_SECOND = 13;

export function chapterChars(p: Project, c: number): number {
  const ch = p.chapters[c];
  return ch.title.length + ch.paragraphs.reduce((n, t) => n + t.length, 0);
}

/** Listening position as a fraction of the whole book, by characters. */
export function bookProgress(p: Project): number {
  const total = p.chapters.reduce((n, _, c) => n + chapterChars(p, c), 0) || 1;
  let before = 0;
  for (let c = 0; c < p.position.chapter && c < p.chapters.length; c++) before += chapterChars(p, c);
  const ch = p.chapters[p.position.chapter];
  if (ch) {
    const n = chapterSentences(p, p.position.chapter).length || 1;
    before += (chapterChars(p, p.position.chapter) * p.position.segment) / n;
  }
  return Math.min(1, before / total);
}
