// Prints what extractBook() makes of a fixture next to the expected chapters.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extractBook, buildLines } from "@audiokniha/core";
import { readPdf } from "../src/pdf.ts";

const name = process.argv[2];
const file = fileURLToPath(new URL(`./fixtures/${name}.pdf`, import.meta.url));
const { pages, outline } = await readPdf(file);
if (process.argv[3] === "lines") {
  for (const p of pages) for (const l of buildLines(p)) console.log(`p${l.page} y=${l.y.toFixed(0)} x=${l.x.toFixed(0)}-${l.right.toFixed(0)} fs=${l.fontSize.toFixed(1)} | ${l.text}`);
}
const book = extractBook(pages, outline);
console.log(JSON.stringify({ removed: book.removed, imageOnly: book.imageOnlyPages, outline }, null, 0));
for (const c of book.chapters) {
  console.log(`## ${c.title}`);
  for (const p of c.paragraphs) console.log(`  - ${p}`);
}
const truth = JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
console.log("EXPECTED:", truth.chapters.map((c: { title: string; paragraphs: string[] }) => `${c.title} (${c.paragraphs.length})`).join(", "));
