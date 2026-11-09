// Layout cases from a real book (The Commanding Heights): positions as pdf.js reports them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLines, extractBook, type PdfPage, type TextItem } from "../src/pdf/layout.ts";

const it = (str: string, x: number, y: number, fontSize = 10.6): TextItem => ({ str, x, y, width: str.length * fontSize * 0.45, fontSize });
const page = (number: number, items: TextItem[]): PdfPage => ({ number, width: 432, height: 648, items });
const text = (pages: PdfPage[]) => extractBook(pages).chapters.flatMap((c) => c.paragraphs).join("\n\n");

test("a footnote marker raised by 0.45 em stays in its line and is left out", () => {
  const lines = buildLines(page(1, [it("awaiting the word to launch.", 45, 201), it("86", 110, 205.5, 5.9)]));
  assert.deepEqual(
    lines.map((l) => [l.text, l.y, l.noteMark]),
    [["awaiting the word to launch.", 201, true]],
  );
});

test("a word split across pages is joined even when a footnote marker sits at the page break", () => {
  const body = (s: string) => `${s} `.repeat(6).trim();
  const out = text([
    page(1, [it(body("Still raining, a certain tension in the air."), 45, 400), it("from the sequestered American ma-", 45, 385)]),
    // Safari's copy: the marker of "Indonesia.¹" is raised by 0.41 em, past the old 0.4 em limit.
    page(2, [it("chine intelligence conglomerates. The breakdown of order, aid to Indonesia.", 45, 600, 13.3), it("1", 420, 605.4, 7.4), it(body("The riots are getting worse."), 45, 581, 13.3)]),
  ]);
  assert.match(out, /American machine intelligence/);
  assert.doesNotMatch(out, /\b1\b/);
});

test("footnotes set right after the paragraph are left out, the text around them stays", () => {
  const out = text([
    page(1, [
      it("the weather and summon a deluge. The bomb dropped on Hiroshima had the", 45, 247.5),
      it("85", 195, 251.3, 5.9),
      it("explosive force of about fifteen thousand tons of TNT. Today, the family", 45, 231.8),
      it("atomics consist of 3,700 world-eaters sequestered in silent, lonely silos", 45, 216.8),
      it("word to launch.", 45, 201),
      it("86", 110, 205.5, 5.9),
      it("85 U.S. Department of Defense, “DOD Succeeds in Intercepting Satellite,” news", 56, 187.5, 7.8),
      it("release no. 0139-08, February 20, 2008.", 56, 177, 7.8),
      it("86 F. G. Gosling, The Manhattan Project (Washington, DC: Department of Energy, 1999).", 56, 139.5, 7.8),
      it("The sovereign can see into the innermost hearts of men because most men", 61, 99),
      it("surrender privacy for protection, becoming thralls bewildered by it all.", 45, 83.3),
    ]),
  ]);
  assert.doesNotMatch(out, /Department|Gosling|0139/);
  assert.match(out, /lonely silos word to launch\.\n\nThe sovereign can see/);
});

test("a numbered small block counts as a footnote even on a page without markers", () => {
  const out = text([page(1, [it("A paragraph of plain body text that runs across the line.", 45, 400), it("3 Leopold Aschenbrenner, Situational Awareness, June 2024.", 56, 380, 7.8), it("The text goes on after the note in the same way as before.", 45, 360)])]);
  assert.doesNotMatch(out, /Aschenbrenner/);
  assert.match(out, /The text goes on/);
});

test("a drop cap goes back to the start of its word, and the lines beside it stay one paragraph", () => {
  const out = text([
    page(1, [
      it("collect a toll that rises with inflation.", 68, 358.5),
      it("T", 45, 299.3, 44.5),
      it("he powers of a modern state are terrible and glorious to behold. By", 79, 324),
      it("any measure, the sovereign today is capable of calling upon cataclysms,", 79, 309),
      it("press of a button or a phrase whispered over a secure line, which in days", 79, 293.3),
      it("before would have required ritual sacrifice and incantation. It can send", 45, 278.3),
    ]),
  ]);
  assert.equal(
    out,
    "collect a toll that rises with inflation.\n\nThe powers of a modern state are terrible and glorious to behold. By any measure, the sovereign today is capable of calling upon cataclysms, press of a button or a phrase whispered over a secure line, which in days before would have required ritual sacrifice and incantation. It can send",
  );
});

test("a drop cap whose word lost its rest (Safari) is left out instead of making a wrong word", () => {
  const out = text([
    page(1, [
      it("R", 42.7, 627.9, 55.8),
      // Safari dropped "avi wakes up at 5:56 AM" (small caps, old-style figures); a space is left where it was.
      it(" at to light tapping on the window. It is the rainy season, and his", 88.2, 658.9, 13.3),
      it("upper-middle-class apartment in Bellandur, which usually has such expansive views of Ban-", 88.2, 640.1, 13.3),
      it("galore, is cloaked in fog. His wife is still asleep next to him, and he is careful not to wake her", 88.2, 621.3, 13.3),
      it("as he dresses. He clutches his buzzing phone.", 42.7, 602.5, 13.3),
    ]),
  ]);
  assert.equal(
    out,
    "at to light tapping on the window. It is the rainy season, and his upper-middle-class apartment in Bellandur, which usually has such expansive views of Bangalore, is cloaked in fog. His wife is still asleep next to him, and he is careful not to wake her as he dresses. He clutches his buzzing phone.",
  );
});

test("a large ampersand between two authors does not pull their names into the e-mail line", () => {
  const lines = buildLines(
    page(1, [it("Will Manidis", 103, 234, 14), it("will@example.com", 112, 218.3, 8.7), it("&", 207, 222, 25.9), it("Joe Roberts", 234, 234, 14), it("joe@example.com", 233, 218.3, 8.7)]),
  );
  const texts = lines.map((l) => l.text);
  assert.ok(texts.includes("will@example.com & joe@example.com"), texts.join(" | "));
  assert.ok(texts.every((t) => !(t.includes("@") && /Manidis|Roberts/.test(t))), texts.join(" | "));
});
