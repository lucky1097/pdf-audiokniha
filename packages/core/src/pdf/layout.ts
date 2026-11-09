// Turns positioned PDF text into chapters and paragraphs: lines from text runs, column order,
// running headers/footers and page numbers removed, footnotes and table-of-contents lines dropped,
// hyphenated line breaks joined. Pure functions; the PDF reader (pdf.js) lives in the platform layer.

/** A run of text as pdf.js reports it, in PDF units with y growing upwards. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  /** pdf.js font id; lets a font whose text comes out as symbols be dropped (see garbledFonts). */
  font?: string;
}

export interface PdfPage {
  number: number;
  width: number;
  height: number;
  items: TextItem[];
}

export interface OutlineEntry {
  title: string;
  /** 1-based page the entry points to. */
  page: number;
}

export interface Line {
  text: string;
  x: number;
  right: number;
  y: number;
  fontSize: number;
  page: number;
}

export interface Chapter {
  title: string;
  paragraphs: string[];
}

export interface Book {
  chapters: Chapter[];
  /** Pages that had (almost) no text: probably scanned images that need OCR. */
  imageOnlyPages: number[];
  removed: { headers: number; pageNumbers: number; footnotes: number; tocLines: number; garbled: number };
}

const ASCII_SYMBOL = /[!-/:-@[-`{-~]/;

/**
 * Fonts whose text came out as symbols instead of letters. Some PDF writers (Safari on iOS "Save as PDF", for
 * one) store a wrong character map for a font, so "Acknowledgments" is extracted as `!"#$%&'()*+($,-`. Such a
 * font is mostly ASCII punctuation; a real one is mostly letters (a digits-only font for page numbers has
 * neither, so it is kept). `chars` counts the dropped characters that look like such a broken map, for a
 * warning; fonts of only daggers or bullets are dropped quietly.
 */
export function garbledFonts(pages: PdfPage[]): { fonts: Set<string>; chars: number } {
  const stats = new Map<string, { chars: number; letters: number; symbols: number; ascii: number }>();
  for (const p of pages) {
    for (const it of p.items) {
      if (!it.font) continue;
      let s = stats.get(it.font);
      if (!s) stats.set(it.font, (s = { chars: 0, letters: 0, symbols: 0, ascii: 0 }));
      for (const ch of it.str) {
        if (/\s/.test(ch)) continue;
        s.chars++;
        if (/\p{L}/u.test(ch)) s.letters++;
        else if (!/\p{N}/u.test(ch)) {
          s.symbols++;
          if (ASCII_SYMBOL.test(ch)) s.ascii++;
        }
      }
    }
  }
  const fonts = new Set<string>();
  let chars = 0;
  for (const [font, s] of stats) {
    if (!s.chars || s.letters / s.chars >= 0.35 || s.symbols / s.chars <= 0.5) continue;
    fonts.add(font);
    if (s.ascii / s.symbols >= 0.6) chars += s.chars;
  }
  return { fonts, chars };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Group text runs that share a baseline into lines, left to right. */
export function buildLines(page: PdfPage): Line[] {
  const items = page.items.filter((i) => i.str.length > 0);
  const rows: TextItem[][] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    // Raised footnote markers sit ~0.4 em above the baseline of the larger text they belong to.
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= Math.max(1.5, Math.max(it.fontSize, r[0].fontSize) * 0.4));
    if (row) row.push(it);
    else rows.push([it]);
  }
  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    // Split a row where the horizontal gap is a column gutter.
    let cur: TextItem[] = [];
    const flush = () => {
      if (!cur.length) return;
      // Footnote markers are small raised digits inside a line ("slovo¹"); drop them.
      const rowSize = median(cur.map((c) => c.fontSize));
      cur = cur.filter((c) => !(c.fontSize < rowSize * 0.75 && /^[\d*†]+$/.test(c.str.trim())));
      let text = "";
      let prevEnd = -Infinity;
      for (const it of cur) {
        const gap = it.x - prevEnd;
        if (text && gap > it.fontSize * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += " ";
        text += it.str;
        prevEnd = it.x + it.width;
      }
      const fs = median(cur.filter((c) => c.str.trim()).map((c) => c.fontSize));
      const t = text.replace(/\s+/g, " ").trim();
      if (t) lines.push({ text: t, x: cur[0].x, right: prevEnd, y: cur[0].y, fontSize: fs, page: page.number });
      cur = [];
    };
    for (const it of row) {
      const last = cur[cur.length - 1];
      if (last && it.x - (last.x + last.width) > Math.max(it.fontSize * 2.5, 18)) flush();
      cur.push(it);
    }
    flush();
  }
  return orderColumns(lines, page.width);
}

/** Two-column pages: read the left column top to bottom, then the right one. */
function orderColumns(lines: Line[], pageWidth: number): Line[] {
  const mid = pageWidth / 2;
  const narrow = lines.filter((l) => l.right - l.x < pageWidth * 0.55);
  const left = narrow.filter((l) => l.right <= mid + pageWidth * 0.02);
  const right = narrow.filter((l) => l.x >= mid - pageWidth * 0.02);
  const twoCol = left.length >= 5 && right.length >= 5 && (left.length + right.length) / lines.length > 0.7;
  if (!twoCol) return lines.sort((a, b) => b.y - a.y || a.x - b.x);
  const isLeft = (l: Line) => l.right <= mid + pageWidth * 0.02;
  const isRight = (l: Line) => l.x >= mid - pageWidth * 0.02;
  const full = lines.filter((l) => !isLeft(l) && !isRight(l));
  // Full-width lines above the columns (a title) come first; ones below (a footer) last.
  const colTop = Math.max(...[...left, ...right].map((l) => l.y));
  const above = full.filter((l) => l.y > colTop).sort((a, b) => b.y - a.y);
  const below = full.filter((l) => l.y <= colTop).sort((a, b) => b.y - a.y);
  return [...above, ...lines.filter(isLeft).sort((a, b) => b.y - a.y), ...lines.filter(isRight).filter((l) => !isLeft(l)).sort((a, b) => b.y - a.y), ...below];
}

const shape = (s: string) => s.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
const PAGE_NUMBER_BARE = /^(?:[-–—]\s*)?(?:\d{1,4}|[ivxlc]{1,6})(?:\s*[-–—])?$/;
const PAGE_NUMBER_WORD = /^(?:strana|page|s\.)\s*\d{1,4}(?:\s*(?:z|of|\/)\s*\d{1,4})?$/i;
const isPageNumber = (s: string) => PAGE_NUMBER_BARE.test(s) || PAGE_NUMBER_WORD.test(s);
const TOC_LINE = /(?:\.{3,}|…{2,}|(?:\.\s){3,})\s*\d{1,4}$/;

export function extractBook(pages: PdfPage[], outline: OutlineEntry[] = []): Book {
  const garbled = garbledFonts(pages);
  const removed = { headers: 0, pageNumbers: 0, footnotes: 0, tocLines: 0, garbled: garbled.chars };
  if (garbled.fonts.size) pages = pages.map((p) => ({ ...p, items: p.items.filter((i) => !i.font || !garbled.fonts.has(i.font)) }));
  const perPage = pages.map(buildLines);
  const imageOnlyPages = pages.filter((p, i) => perPage[i].map((l) => l.text).join("").length < 20).map((p) => p.number);

  // Running headers/footers: the top or bottom 2 lines of a page whose shape repeats on many pages.
  const edgeShapes = new Map<string, number>();
  for (const ls of perPage) {
    const edges = new Set([...ls.slice(0, 2), ...ls.slice(-2)].map((l) => shape(l.text)));
    for (const s of edges) edgeShapes.set(s, (edgeShapes.get(s) ?? 0) + 1);
  }
  const repeatThreshold = Math.max(2, Math.ceil(pages.length * 0.3));
  const bodySize = median(perPage.flat().map((l) => l.fontSize));
  // "Kapitola 1" and "Kapitola 2" share a shape and sit near the top too, but they are headings, not headers.
  const headingLike = (l: Line) => l.fontSize >= bodySize * 1.25 || /^(?:kapitola|chapter|časť|part)\b/i.test(l.text);

  const kept: Line[][] = perPage.map((ls) => {
    const out: Line[] = [];
    ls.forEach((l, i) => {
      const edge = i < 2 || i >= ls.length - 2;
      if (edge && isPageNumber(l.text)) return void removed.pageNumbers++;
      if (edge && !headingLike(l) && (edgeShapes.get(shape(l.text)) ?? 0) >= repeatThreshold && pages.length >= 2) return void removed.headers++;
      if (TOC_LINE.test(l.text)) return void removed.tocLines++;
      out.push(l);
    });
    // Footnotes: a block of clearly smaller text at the bottom of the page.
    let k = out.length;
    while (k > 0 && out[k - 1].fontSize < bodySize * 0.85) k--;
    if (k < out.length && k > 0) {
      removed.footnotes += out.length - k;
      out.length = k;
    }
    return out;
  });

  const lines = kept.flat();
  const outlineByPage = new Map<number, string>();
  for (const o of outline) if (!outlineByPage.has(o.page)) outlineByPage.set(o.page, o.title);
  const isHeading = (l: Line) =>
    l.text.length < 90 &&
    (l.fontSize >= bodySize * 1.25 || /^(?:kapitola|chapter|časť|part)\b/i.test(l.text) || /^[IVXLC]{1,6}\.?$/.test(l.text));

  const chapters: Chapter[] = [];
  let chapter: Chapter = { title: "", paragraphs: [] };
  let para = "";
  let prev: Line | null = null;
  const spacing = median(
    lines.slice(1).map((l, i) => (l.page === lines[i].page ? lines[i].y - l.y : 0)).filter((d) => d > 0),
  );
  const closePara = () => {
    if (para.trim()) chapter.paragraphs.push(para.trim());
    para = "";
  };
  const startChapter = (title: string) => {
    closePara();
    if (chapter.title || chapter.paragraphs.length) chapters.push(chapter);
    chapter = { title, paragraphs: [] };
  };
  const usedOutline = new Set<number>();

  for (const l of lines) {
    const outlineTitle = outlineByPage.get(l.page);
    if (outlineTitle && !usedOutline.has(l.page)) {
      usedOutline.add(l.page);
      startChapter(outlineTitle);
      if (shape(l.text) === shape(outlineTitle)) { prev = l; continue; }
    } else if (!outline.length && isHeading(l)) {
      // Consecutive heading lines ("I." then "A SCANDAL IN BOHEMIA") form one title.
      if (prev && isHeading(prev) && prev.page === l.page && chapter.paragraphs.length === 0 && !para) chapter.title = `${chapter.title}. ${l.text}`.replace(/^\. /, "");
      else startChapter(l.text);
      prev = l;
      continue;
    }
    if (prev && para) {
      const samePage = prev.page === l.page;
      const gap = samePage ? prev.y - l.y : spacing;
      const indented = l.x - prev.x > l.fontSize * 0.8 && samePage;
      const prevShort = prev.right - prev.x < (l.right - l.x) * 0.75 && /[.!?:“”"]$/.test(prev.text);
      if (gap > spacing * 1.45 || indented || prevShort || (samePage && prev.x - l.x > l.fontSize * 3)) closePara();
    }
    if (para && /\p{L}-$/u.test(para) && /^\p{Ll}/u.test(l.text)) para = para.slice(0, -1) + l.text;
    else para = para ? `${para} ${l.text}` : l.text;
    prev = l;
  }
  closePara();
  if (chapter.title || chapter.paragraphs.length) chapters.push(chapter);
  return { chapters, imageOnlyPages, removed };
}
