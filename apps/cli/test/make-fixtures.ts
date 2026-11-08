// Generates test PDFs with known content (and the expected chapters as JSON) for the PDF extraction tests.
// Run: node apps/cli/test/make-fixtures.ts
import fontkit from "@pdf-lib/fontkit";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const DIR = new URL("./fixtures/", import.meta.url);

interface Truth {
  chapters: { title: string; paragraphs: string[] }[];
  imageOnlyPages?: number[];
}

async function fonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(await readFile(new URL("fonts/NotoSerif-Regular.ttf", DIR)), { subset: true });
  const bold = await doc.embedFont(await readFile(new URL("fonts/NotoSerif-Bold.ttf", DIR)), { subset: true });
  return { reg, bold };
}

/** Greedy line breaking; long words that would leave a big gap are hyphenated, like real typesetting. */
function wrap(text: string, font: PDFFont, size: number, width: number, firstIndent = 0): string[] {
  const lines: string[] = [];
  let line = "";
  let avail = width - firstIndent;
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= avail;
  for (const word of text.split(" ")) {
    const cand = line ? `${line} ${word}` : word;
    if (fits(cand)) {
      line = cand;
      continue;
    }
    const letters = word.replace(/[^\p{L}]/gu, "");
    if (letters.length >= 8 && /^[\p{L}]+[,.;]?$/u.test(word)) {
      for (let k = word.length - 4; k >= 4; k--) {
        const head = `${line ? line + " " : ""}${word.slice(0, k)}-`;
        if (fits(head)) {
          lines.push(head);
          line = word.slice(k);
          avail = width;
          break;
        }
      }
      if (lines.length && lines[lines.length - 1].endsWith("-") && line === word.slice(-line.length)) continue;
    }
    lines.push(line);
    line = word;
    avail = width;
  }
  if (line) lines.push(line);
  return lines;
}

interface BookStyle {
  size: [number, number];
  margin: number;
  body: number;
  leading: number;
  header?: string;
}

/** Lays out chapters on pages with headers, page numbers and an optional footnote. */
async function book(name: string, truth: Truth, style: BookStyle, footnote?: { chapter: number; paragraph: number; text: string }) {
  const doc = await PDFDocument.create();
  doc.setTitle(name);
  const { reg, bold } = await fonts(doc);
  const [W, H] = style.size;
  const width = W - 2 * style.margin;
  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;
  let pendingFootnote: string | null = null;
  const newPage = () => {
    if (page && pendingFootnote) drawFootnote();
    page = doc.addPage(style.size);
    pageNo++;
    y = H - style.margin;
    if (style.header) page.drawText(style.header, { x: style.margin, y: H - style.margin + 18, size: 8.5, font: reg, color: rgb(0.3, 0.3, 0.3) });
    const num = String(pageNo);
    page.drawText(num, { x: W / 2 - reg.widthOfTextAtSize(num, 9) / 2, y: style.margin - 28, size: 9, font: reg });
  };
  const drawFootnote = () => {
    page.drawText(pendingFootnote!, { x: style.margin, y: style.margin - 6, size: 7.5, font: reg });
    pendingFootnote = null;
  };
  truth.chapters.forEach((ch, ci) => {
    newPage();
    y -= 30;
    page.drawText(ch.title, { x: style.margin, y, size: style.body * 1.7, font: bold });
    y -= style.leading * 2.2;
    ch.paragraphs.forEach((p, pi) => {
      const lines = wrap(p, reg, style.body, width, 16);
      lines.forEach((l, li) => {
        if (y < style.margin + 20) newPage();
        const x = style.margin + (li === 0 ? 16 : 0);
        page.drawText(l, { x, y, size: style.body, font: reg });
        if (footnote && footnote.chapter === ci && footnote.paragraph === pi && li === lines.length - 1) {
          page.drawText("1", { x: x + reg.widthOfTextAtSize(l, style.body) + 1, y: y + 4, size: style.body * 0.6, font: reg });
          pendingFootnote = `1 ${footnote.text}`;
        }
        y -= style.leading;
      });
      y -= style.leading * 0.4;
    });
  });
  if (pendingFootnote) drawFootnote();
  await writeFile(new URL(`${name}.pdf`, DIR), await doc.save());
  await writeFile(new URL(`${name}.json`, DIR), JSON.stringify(truth, null, 1));
}

async function twoColumns(name: string, title: string, paragraphs: string[]) {
  const doc = await PDFDocument.create();
  const { reg, bold } = await fonts(doc);
  const [W, H] = [612, 792];
  const margin = 54;
  const gutter = 24;
  const colW = (W - 2 * margin - gutter) / 2;
  const size = 10;
  const leading = 13;
  let page = doc.addPage([W, H]);
  let col = 0;
  let pageNo = 1;
  page.drawText(title, { x: margin, y: H - margin - 10, size: 20, font: bold });
  let top = H - margin - 50;
  let y = top;
  const footer = () => page.drawText(String(pageNo), { x: W / 2, y: 30, size: 9, font: reg });
  footer();
  for (const p of paragraphs) {
    for (const [li, l] of wrap(p, reg, size, colW, 12).entries()) {
      if (y < margin) {
        if (col === 0) col = 1;
        else {
          page = doc.addPage([W, H]);
          pageNo++;
          footer();
          col = 0;
          top = H - margin;
        }
        y = top;
      }
      page.drawText(l, { x: margin + col * (colW + gutter) + (li === 0 ? 12 : 0), y, size, font: reg });
      y -= leading;
    }
    y -= 5;
  }
  await writeFile(new URL(`${name}.pdf`, DIR), await doc.save());
  await writeFile(new URL(`${name}.json`, DIR), JSON.stringify({ chapters: [{ title, paragraphs }] }, null, 1));
}

async function withToc(name: string, truth: Truth) {
  const doc = await PDFDocument.create();
  const { reg, bold } = await fonts(doc);
  const toc = doc.addPage([420, 595]);
  toc.drawText("Contents", { x: 50, y: 520, size: 18, font: bold });
  truth.chapters.forEach((c, i) => toc.drawText(`${c.title} .................... ${i + 2}`, { x: 50, y: 480 - i * 20, size: 11, font: reg }));
  for (const c of truth.chapters) {
    const p = doc.addPage([420, 595]);
    p.drawText(c.title, { x: 50, y: 520, size: 18, font: bold });
    let y = 480;
    for (const para of c.paragraphs) {
      for (const [li, l] of wrap(para, reg, 11, 320, 16).entries()) {
        p.drawText(l, { x: 50 + (li === 0 ? 16 : 0), y, size: 11, font: reg });
        y -= 15;
      }
      y -= 6;
    }
  }
  await writeFile(new URL(`${name}.pdf`, DIR), await doc.save());
  await writeFile(new URL(`${name}.json`, DIR), JSON.stringify(truth, null, 1));
}

async function scanned(name: string) {
  const doc = await PDFDocument.create();
  const p = doc.addPage([420, 595]);
  for (let i = 0; i < 30; i++) p.drawRectangle({ x: 50, y: 520 - i * 15, width: 280 + (i % 3) * 10, height: 8, color: rgb(0.2, 0.2, 0.2) });
  await writeFile(new URL(`${name}.pdf`, DIR), await doc.save());
  await writeFile(new URL(`${name}.json`, DIR), JSON.stringify({ chapters: [], imageOnlyPages: [1] }, null, 1));
}

const SK: Truth = {
  chapters: [
    {
      title: "Kapitola 1",
      paragraphs: [
        "Keď Jana vystúpila z vlaku, mesto ešte spalo. Nad strechami visela riedka hmla a z pekárne na rohu voňal čerstvý chlieb. Zastala pri starej lipe, kde sa kedysi stretávala s otcom, a chvíľu len počúvala, ako sa ulica pomaly prebúdza.",
        "Na námestí stál stánok s novinami, ktorý si pamätala ešte z detstva. Predavač bol iný, mladší a nevrlý, no noviny voňali rovnako ako vtedy. Kúpila si jedny, hoci vedela, že ich nebude čítať, a strčila si ich pod pazuchu.",
        "„Hľadáte niekoho?“ ozval sa za ňou hlas. Otočila sa a uvidela starého pána s palicou, ktorý si ju zvedavo prezeral spoza okuliarov. „Hľadám dom, kde kedysi býval môj otec,“ odpovedala. Starý pán prikývol, akoby presne vedel, o ktorý dom ide.",
        "Kráčali spolu dolu ulicou, okolo zatvorenej lekárne a malého obchodu s textilom, ktorého výklad bol od jari zakrytý papierom. Starý pán rozprával o povodni z roku tisícdeväťstoosemdesiatšesť, o tom, ako voda siahala až po okná, a o susedoch, ktorí sa navzájom zachraňovali.",
      ],
    },
    {
      title: "Kapitola 2",
      paragraphs: [
        "Dom stál na konci ulice, obrastený divým viničom. Okenice boli zatvorené a na bránke visela hrdzavá reťaz. Jana sa jej dotkla a pocítila zvláštne teplo, akoby kov ešte pamätal dotyk niekoho iného.",
        "Večer sedela v malej kaviarni pri stanici a písala do zošita všetko, čo si zapamätala. Mená susedov, farbu okeníc, vôňu chleba aj hlas starého pána. Vedela, že ak to nezapíše hneď, spomienky sa rozplynú ako ranná hmla nad strechami.",
      ],
    },
  ],
};

const EN_ARTICLE = [
  "Lighthouses once marked every dangerous stretch of the northern coast. Their keepers lived in isolation for months, trimming wicks, polishing lenses and recording the weather in heavy logbooks that now fill the shelves of regional archives.",
  "The introduction of electric lamps changed the work completely. A single technician could now maintain several towers, visiting each one only when an alarm reported a fault. Within two decades most keepers' cottages stood empty or were sold as holiday homes.",
  "Historians who study the logbooks describe a remarkably consistent routine. Entries begin with the barometric pressure and the direction of the wind, continue with a note on visibility, and end with a short remark about ships that passed during the night.",
  "Some keepers added personal observations: the arrival of migrating birds, the death of a neighbour, a storm that shattered the lantern glass. These marginal notes have become a valuable source for researchers interested in everyday life on remote islands.",
  "Today several towers have been restored as museums. Visitors climb the narrow stairs, look out over the water and read reproductions of the old logbooks, written in a careful hand by people who rarely saw another face for weeks at a time.",
  "Preservation remains expensive. Salt air corrodes metal fittings, wind loosens the stonework, and the specialised glass of the old lenses can no longer be manufactured. Local volunteers raise money every summer to keep the most important buildings standing.",
];

const EN_TOC: Truth = {
  chapters: [
    { title: "Chapter One", paragraphs: ["The rain had stopped by the time Clara reached the old lighthouse. She paused at the door, listening to the waves breaking somewhere below."] },
    { title: "Chapter Two", paragraphs: ["Inside, the air smelled of salt, dust and old paper. A logbook lay open on the table, its last entry written more than forty years ago."] },
  ],
};

await mkdir(DIR, { recursive: true });
await book("sk_novel", SK, { size: [420, 595], margin: 55, body: 11, leading: 15, header: "Návrat do mesta — testovacia kniha" }, {
  chapter: 0,
  paragraph: 1,
  text: "Stánok zbúrali o niekoľko rokov neskôr.",
});
await twoColumns("en_two_columns", "Keepers of the Light", EN_ARTICLE);
await withToc("en_toc", EN_TOC);
await scanned("scanned");
console.log("fixtures written");
