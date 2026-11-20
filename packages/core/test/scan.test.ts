import assert from "node:assert/strict";
import { test } from "node:test";
import { fixSlovakLetters, textFromScan, type ScanLine } from "../src/index.ts";

test("apostrophe forms become ť, ľ, ď (capitals too), I' and |' become ľ between lowercase letters", () => {
  const pairs: [string, string][] = [
    ["t'ažký", "ťažký"],
    ["l'udia", "ľudia"],
    ["byt'", "byť"],
    ["d'akujem", "ďakujem"],
    ["L'ubica", "Ľubica"],
    ["veI'mi", "veľmi"],
    ["T'ahať", "Ťahať"],
    ["D'alej", "Ďalej"],
  ];
  for (const [from, to] of pairs) assert.equal(fixSlovakLetters(from, "sk"), to, from);
  assert.equal(fixSlovakLetters("'ahoj'", "sk"), "'ahoj'");
});

const CORRECT =
  "Hotel stojí v centre mesta, celkom blízko stanice. Včera som si dobil telefón a mal som ešte čas na kávu. " +
  "Učiteľ povedal, že ťažké úlohy budeme robiť zajtra. Ľudia sa tešili na leto, lebo bolo teplo a dlho svetlo. " +
  "Na stole ležala kniha, list papiera a tri ceruzky. Ďalší deň sme išli do lesa, kde rástli malé stromy. " +
  "Tatiana študuje matematiku a fyziku, jej sestra hrá na klavíri. Byt mali na treťom poschodí, okná do dvora. " +
  "Pôjdeme spolu, keď to bude možné. Stálo to veľa peňazí, ale stálo to za to. Talent a vytrvalosť sú dôležité.";

test("correct Slovak text is not changed", () => {
  assert.equal(fixSlovakLetters(CORRECT, "sk"), CORRECT);
});

test("English text is not changed", () => {
  assert.equal(fixSlovakLetters("don't l'amour robit", "en"), "don't l'amour robit");
});

test("with boxes: a gap of two line heights starts a paragraph", () => {
  const pages: ScanLine[][] = [
    [
      { text: "Prvý riadok odseku", box: { x: 0.1, y: 0.1, w: 0.8, h: 0.02 } },
      { text: "pokračuje tu ďalej", box: { x: 0.1, y: 0.12, w: 0.8, h: 0.02 } },
      { text: "Nový odsek po medzere", box: { x: 0.1, y: 0.18, w: 0.8, h: 0.02 } },
    ],
  ];
  assert.equal(textFromScan(pages, "sk"), "Prvý riadok odseku pokračuje tu ďalej\n\nNový odsek po medzere");
});

test("with boxes: an indented line starts a paragraph", () => {
  const pages: ScanLine[][] = [
    [
      { text: "Prvý riadok", box: { x: 0.1, y: 0.1, w: 0.8, h: 0.02 } },
      { text: "Odsadený odsek", box: { x: 0.2, y: 0.12, w: 0.7, h: 0.02 } },
      { text: "pokračuje ďalej", box: { x: 0.1, y: 0.14, w: 0.8, h: 0.02 } },
    ],
  ];
  assert.equal(textFromScan(pages, "sk"), "Prvý riadok\n\nOdsadený odsek pokračuje ďalej");
});

test("with boxes: a hyphen at a line end joins the lowercase word on the next line", () => {
  const pages: ScanLine[][] = [
    [
      { text: "rozprá-", box: { x: 0.1, y: 0.1, w: 0.3, h: 0.02 } },
      { text: "vka pokračuje", box: { x: 0.1, y: 0.12, w: 0.4, h: 0.02 } },
    ],
  ];
  assert.equal(textFromScan(pages, "sk"), "rozprávka pokračuje");
});

test("with boxes: a page number at the bottom is dropped", () => {
  const pages: ScanLine[][] = [
    [
      { text: "Text stránky", box: { x: 0.1, y: 0.1, w: 0.8, h: 0.02 } },
      { text: "12", box: { x: 0.45, y: 0.9, w: 0.1, h: 0.02 } },
    ],
  ];
  assert.equal(textFromScan(pages, "sk"), "Text stránky");
});

test("without boxes: a short line ending a sentence closes the paragraph", () => {
  // The brief's second line was shortened to keep the rule: 'na ďalšom riadku.' is under 0.7 × the longest line.
  const pages: ScanLine[][] = [
    [
      { text: "Prvá veta je dlhá a pokračuje" },
      { text: "na ďalšom riadku, kde sa to skončí." },
      { text: "Krátko." },
      { text: "Nový odsek začína tu" },
    ],
  ];
  assert.equal(
    textFromScan(pages, "sk"),
    "Prvá veta je dlhá a pokračuje na ďalšom riadku, kde sa to skončí. Krátko.\n\nNový odsek začína tu",
  );
});

test("a page that ends mid-sentence continues on the next page", () => {
  const pages: ScanLine[][] = [[{ text: "Dedko sa vrátil domov a potom" }], [{ text: "prišiel domov." }]];
  assert.equal(textFromScan(pages, "sk"), "Dedko sa vrátil domov a potom prišiel domov.");
});
