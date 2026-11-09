import assert from "node:assert/strict";
import { test } from "node:test";
import { extractBook, garbledFonts, type PdfPage } from "../src/pdf/layout.ts";

const item = (str: string, y: number, font: string, fontSize = 12) => ({ str, x: 72, y, width: str.length * 6, fontSize, font });

// A page as Safari's "Save as PDF" writes it: the heading font has a broken character map.
const pages: PdfPage[] = [
  {
    number: 1,
    width: 600,
    height: 800,
    items: [
      item(`!"#$%&'()*+($,-`, 700, "bad", 20),
      item("Special thanks to everyone who read the drafts of this book and helped it along.", 660, "body"),
      item("1", 40, "digits"),
      item("Without them the work would have taken twice as long and been half as good.", 640, "body"),
    ],
  },
];

test("a font that comes out as ASCII symbols is found; letters and page-number digits are not", () => {
  const { fonts, chars } = garbledFonts(pages);
  assert.deepEqual([...fonts], ["bad"]);
  assert.equal(chars, 15);
});

test("its text is left out of the book and counted", () => {
  const book = extractBook(pages);
  const text = book.chapters.flatMap((c) => [c.title, ...c.paragraphs]).join(" ");
  assert.ok(!text.includes("!\"#$"), text);
  assert.ok(text.includes("Special thanks"));
  assert.equal(book.removed.garbled, 15);
});

test("a font of daggers is dropped without a warning", () => {
  const daggers: PdfPage[] = [{ number: 1, width: 600, height: 800, items: [item("†", 600, "marks"), item("Plain words in a sentence.", 660, "body")] }];
  const { fonts, chars } = garbledFonts(daggers);
  assert.deepEqual([...fonts], ["marks"]);
  assert.equal(chars, 0);
});

test("items without a font are kept as before", () => {
  const plain: PdfPage[] = [{ number: 1, width: 600, height: 800, items: [{ str: "Hello there, reader.", x: 72, y: 600, width: 100, fontSize: 12 }] }];
  assert.equal(garbledFonts(plain).fonts.size, 0);
  assert.equal(extractBook(plain).removed.garbled, 0);
});
