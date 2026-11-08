import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { extractBook } from "@audiokniha/core";
import { readPdf } from "../src/pdf.ts";

const fixture = (n: string) => new URL(`./fixtures/${n}`, import.meta.url);
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

for (const name of ["sk_novel", "en_two_columns", "en_toc", "scanned"]) {
  test(`extracts ${name}`, async () => {
    const truth = JSON.parse(await readFile(fixture(`${name}.json`), "utf8"));
    const { pages, outline } = await readPdf(fixture(`${name}.pdf`).pathname.replace(/^\/(\w:)/, "$1"));
    const book = extractBook(pages, outline);
    if (truth.imageOnlyPages) assert.deepEqual(book.imageOnlyPages, truth.imageOnlyPages);
    const got = book.chapters.filter((c) => c.paragraphs.length).map((c) => ({ title: squash(c.title), paragraphs: c.paragraphs.map(squash) }));
    assert.deepEqual(got, truth.chapters.map((c: { title: string; paragraphs: string[] }) => ({ title: c.title, paragraphs: c.paragraphs.map(squash) })));
  });
}
