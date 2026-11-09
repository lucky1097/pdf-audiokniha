import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractBook, type PdfPage } from "../src/pdf/layout.ts";
import { repairGlyphs } from "../src/pdf/glyphs.ts";
import { markUnknownGlyphs, rewriteCMap } from "../src/pdf/tounicode.ts";

const U = (code: number) => String.fromCharCode(0xe000 + code);

const cmap = (entries: string) =>
  `/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n1 begincodespacerange\n<00><FF>\nendcodespacerange\n${entries}\nendcmap\nend end`;

test("self-mapped codes that repeat a real letter, rare symbols and Mac Roman letters are marked", () => {
  // 0x29 is the real "h"; 0x68 claims "h" too (it is the fi ligature). 0x43 is a real "C" that happens to sit
  // on its own code: nothing else gives "C", so it stays. 0x5b claims "[", 0x8a "ä".
  const out = rewriteCMap(cmap("4 beginbfrange\n<29><29><0068>\n<43><43><0043>\n<5b><5b><005b>\n<68><68><0068>\nendbfrange\n1 beginbfchar\n<8a><00e4>\nendbfchar"));
  assert.ok(out);
  assert.match(out, /<29> <0068>/);
  assert.match(out, /<43> <0043>/);
  assert.match(out, /<5b> <E05B>/);
  assert.match(out, /<68> <E068>/);
  assert.match(out, /<8a> <E08A>/);
});

test("a map with nothing self-mapped is left alone", () => {
  assert.equal(rewriteCMap(cmap("2 beginbfrange\n<21><21><0052>\n<22><23><0061>\nendbfrange")), undefined);
});

/** A one-page PDF as Quartz would write it: Helvetica with a ToUnicode map where code 0x62 is the real "a"
    and 0x61 claims "a" for itself. The page shows "ab". */
function quartzPdf(): Uint8Array {
  const map = deflateSync(Buffer.from(cmap("2 beginbfchar\n<61><0061>\n<62><0061>\nendbfchar"), "latin1"));
  const content = "BT /F1 24 Tf 72 700 Td (ab) Tj ET";
  const parts: (string | Buffer)[] = ["%PDF-1.3\n"];
  const offsets: number[] = [];
  const size = () => parts.reduce((n, p) => n + Buffer.byteLength(p as string, "latin1"), 0);
  const obj = (n: number, ...body: (string | Buffer)[]) => {
    offsets[n] = size();
    parts.push(`${n} 0 obj\n`, ...body, "\nendobj\n");
  };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>");
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 6 0 R >>");
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Length ${map.length} /Filter /FlateDecode >>\nstream\n`, map, "\nendstream");
  obj(7, "<< /Producer (macOS Version 15.0 \\(Build 24A335\\) Quartz PDFContext) >>");
  const xref = size();
  parts.push("xref\n0 8\n0000000000 65535 f\r\n", ...offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n\r\n`));
  parts.push(`trailer\n<< /Size 8 /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Uint8Array(Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : p))));
}

async function text(data: Uint8Array): Promise<string> {
  const task = getDocument({ data, verbosity: 0 });
  const content = await (await (await task.promise).getPage(1)).getTextContent();
  await task.destroy();
  return content.items.map((i) => ("str" in i ? i.str : "")).join("");
}

test("a Quartz PDF gets its broken map replaced in an update pdf.js reads", async () => {
  const before = quartzPdf();
  assert.equal(await text(before.slice()), "aa");
  const { data, fonts } = await markUnknownGlyphs(before);
  assert.equal(fonts, 1);
  assert.equal(await text(data), `${U(0x61)}a`);
});

test("other PDFs come back unchanged", async () => {
  const pdf = quartzPdf();
  const other = new TextDecoder("latin1").decode(pdf).replace("Quartz PDFContext", "Some Other Writer");
  const bytes = Uint8Array.from(other, (c) => c.charCodeAt(0));
  const { data, fonts } = await markUnknownGlyphs(bytes);
  assert.equal(fonts, 0);
  assert.equal(data, bytes);
});

const page = (lines: string[], font = "body"): PdfPage[] => [
  { number: 1, width: 600, height: 800, items: lines.map((str, i) => ({ str, x: 72, y: 700 - i * 14, width: str.length * 6, fontSize: 11, font })) },
];

test("ligatures are worked out from the words they occur in", () => {
  const fi = U(0x68);
  const fl = U(0x59);
  const ffi = U(0x6b);
  const { pages, fixed, dropped } = repairGlyphs(
    page([`model-producing ${fi}rms and ${fi}nancial work${fl}ows`, `cash ${fl}ow from the back o${ffi}ce, quali${fi}ed`, `the o${ffi}cial ${fi}gures, in${fl}ation`]),
    "en",
  );
  assert.deepEqual(
    pages[0].items.map((i) => i.str),
    ["model-producing firms and financial workflows", "cash flow from the back office, qualified", "the official figures, inflation"],
  );
  assert.equal(fixed, 9);
  assert.equal(dropped, 0);
});

test("glyphs away from letters (old-style figures) take their word out, and are counted", () => {
  const [four, zero, one] = [U(0x63), U(0x64), U(0x65)];
  const { pages, dropped } = repairGlyphs(page([`subject to the American ${four}${zero}${one}(k) class.`, `around ${one}${zero}${zero}B. In ${zero}${one}, it`]), "en");
  assert.deepEqual(pages[0].items.map((i) => i.str), ["subject to the American class.", "around. In, it"]);
  assert.equal(dropped, 6 + 4 + 2);
});

test("extractBook restores ligatures and reports what it left out", () => {
  const fi = U(0x68);
  const book = extractBook(page([`Economic activity is organized around ${fi}rms, their shape evolving ${U(0x63)}${U(0x64)} times.`]));
  assert.equal(book.chapters[0].paragraphs[0], "Economic activity is organized around firms, their shape evolving times.");
  assert.equal(book.removed.garbled, 2);
});
