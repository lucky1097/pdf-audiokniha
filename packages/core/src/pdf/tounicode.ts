// Safari's "Save as PDF" (Apple's Quartz PDFContext) writes character maps in which every glyph that is not a
// plain character (the fi and fl ligatures, old-style figures, small caps) maps to its own code: a ligature drawn
// with code 0x68 comes out as "h", so "firms" reads "hrms" and "flow" reads "Yow". Those entries cannot be told
// apart from real letters after pdf.js has read the text, so they are rewritten first, to private-use characters
// (U+E000 + code), as an incremental update appended to the file. repairGlyphs() in glyphs.ts then works out the
// ligatures and leaves out what cannot be known.
//
// Self-contained on purpose (no imports, no Node or DOM APIs beyond DecompressionStream): the mobile app embeds
// this file's code in the WebView that runs pdf.js.

/** Private-use base for glyphs with no known character: code c of a font becomes U+E000 + c. */
export const UNKNOWN_GLYPH_BASE = 0xe000;

/** Mac OS Roman, codes 0x80-0xFF: Quartz fills the upper half of a broken map with these. */
const MAC_ROMAN_HIGH =
  "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";

/** Symbols books hardly use: self-mapped, they are a broken glyph even without a second code for them. */
const RARE = "[\\]^_`{|}~";

/** The character a broken Quartz map gives code c. */
export function selfMapped(c: number): number {
  return c < 0x80 ? c : MAC_ROMAN_HIGH.charCodeAt(c - 0x80);
}

const ascii = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);

function latin1(data: Uint8Array, from: number, to: number): string {
  let s = "";
  for (let i = from; i < Math.min(to, data.length); i += 8192) {
    s += String.fromCharCode(...data.subarray(i, Math.min(to, data.length, i + 8192)));
  }
  return s;
}

function indexOf(data: Uint8Array, pattern: Uint8Array, from = 0): number {
  const first = pattern[0];
  outer: for (let i = data.indexOf(first, from); i !== -1 && i <= data.length - pattern.length; i = data.indexOf(first, i + 1)) {
    for (let k = 1; k < pattern.length; k++) if (data[i + k] !== pattern[k]) continue outer;
    return i;
  }
  return -1;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Xref {
  offsets: Map<number, { offset: number; gen: number }>;
  trailer: string;
  startxref: number;
}

/** The classic cross-reference tables, newest first. Undefined for xref streams (PDF 1.5 object streams). */
function readXref(data: Uint8Array): Xref | undefined {
  const tail = latin1(data, Math.max(0, data.length - 1024), data.length);
  const m = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(tail);
  if (!m) return undefined;
  const startxref = Number(m[1]);
  const offsets = new Map<number, { offset: number; gen: number }>();
  let trailer = "";
  for (let at: number | undefined = startxref, guard = 0; at !== undefined && guard < 32; guard++) {
    const head = latin1(data, at, at + 4);
    if (head !== "xref") return undefined;
    const end = indexOf(data, ascii("trailer"), at);
    if (end === -1) return undefined;
    const lines = latin1(data, at + 4, end).trim().split(/\r\n|\r|\n/);
    let obj = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length === 2) obj = Number(parts[0]);
      else if (parts.length === 3) {
        if (parts[2] === "n" && !offsets.has(obj)) offsets.set(obj, { offset: Number(parts[0]), gen: Number(parts[1]) });
        obj++;
      }
    }
    const dict = latin1(data, end, end + 2048);
    const close = dict.indexOf(">>");
    const t = dict.slice(0, close + 2);
    if (!trailer) trailer = t;
    const prev = /\/Prev\s+(\d+)/.exec(t);
    at = prev ? Number(prev[1]) : undefined;
  }
  return { offsets, trailer, startxref };
}

/**
 * Rewrites a ToUnicode CMap with its broken entries pointing at U+E000 + code. Undefined when nothing is broken.
 *
 * Quartz numbers a font's glyphs from 0x21 in order of first use, so a real glyph can land on its own code by
 * chance (the "C" of a font at 0x43). A self-mapped entry counts as broken when another code of the font already
 * gives that character (the real "h" and the fi ligature both read "h"); in the upper half, where Quartz fills
 * in Mac OS Roman, when it gives a letter. Anything else is left as it was.
 */
export function rewriteCMap(cmap: string): string | undefined {
  // Only maps with one-byte codes: Quartz writes its fonts as simple TrueType fonts.
  if (!/begincodespacerange\s*<00>\s*<FF>\s*endcodespacerange/i.test(cmap)) return undefined;
  const map = new Map<number, string>();
  for (const b of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of b[1].matchAll(/<([0-9a-fA-F]{2})>\s*<([0-9a-fA-F]{2})>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (m[3].startsWith("[")) {
        const list = [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]);
        list.forEach((dst, k) => lo + k <= hi && map.set(lo + k, dst));
      } else {
        const dst = m[3].slice(1, -1);
        const base = parseInt(dst, 16);
        for (let c = lo; c <= hi; c++) map.set(c, (base + c - lo).toString(16).padStart(dst.length, "0"));
      }
    }
  }
  for (const b of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of b[1].matchAll(/<([0-9a-fA-F]{2})>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(m[1], 16), m[2]);
  }

  const uses = new Map<number, number>();
  for (const dst of map.values()) if (dst.length === 4) uses.set(parseInt(dst, 16), (uses.get(parseInt(dst, 16)) ?? 0) + 1);
  let broken = 0;
  const out: string[] = [];
  for (const [code, dst] of [...map].sort((a, b) => a[0] - b[0])) {
    const ch = dst.length === 4 ? parseInt(dst, 16) : -1;
    const self =
      ch === selfMapped(code) &&
      (code < 0x80 ? (uses.get(ch) ?? 0) > 1 || RARE.includes(String.fromCharCode(ch)) : /\p{L}/u.test(String.fromCharCode(ch)));
    if (self) broken++;
    out.push(`<${code.toString(16).padStart(2, "0")}> <${self ? (UNKNOWN_GLYPH_BASE + code).toString(16).toUpperCase() : dst}>`);
  }
  if (!broken) return undefined;

  const blocks: string[] = [];
  for (let i = 0; i < out.length; i += 100) blocks.push(`${Math.min(100, out.length - i)} beginbfchar\n${out.slice(i, i + 100).join("\n")}\nendbfchar`);
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<00> <FF>",
    "endcodespacerange",
    ...blocks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

/**
 * For PDFs written by Apple's Quartz (Safari, Preview, printing on iPhone and Mac): marks glyphs whose character
 * map points at themselves as unknown (U+E000 + code). Any other PDF, or one this cannot read safely, comes back
 * unchanged.
 */
export async function markUnknownGlyphs(data: Uint8Array): Promise<{ data: Uint8Array; fonts: number }> {
  const unchanged = { data, fonts: 0 };
  try {
    if (typeof DecompressionStream === "undefined") return unchanged;
    if (indexOf(data, ascii("Quartz PDFContext")) === -1) return unchanged;
    const xref = readXref(data);
    if (!xref || /\/Encrypt\b/.test(xref.trailer)) return unchanged;

    const refs = new Set<number>();
    const key = ascii("/ToUnicode");
    for (let i = indexOf(data, key); i !== -1; i = indexOf(data, key, i + key.length)) {
      const m = /^\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(latin1(data, i, i + 40));
      if (m) refs.add(Number(m[1]));
    }

    const objects: { num: number; gen: number; body: string }[] = [];
    for (const num of refs) {
      const at = xref.offsets.get(num);
      if (!at) continue;
      const head = latin1(data, at.offset, at.offset + 512);
      const s = /^\s*\d+\s+\d+\s+obj\s*<<([\s\S]*?)>>\s*stream(\r\n|\n|\r)/.exec(head);
      if (!s) continue;
      const dict = s[1];
      const length = /\/Length\s+(\d+)(?!\d|\s+\d+\s+R)/.exec(dict);
      if (!length) continue;
      const filter = /\/Filter\s*\/(\w+)/.exec(dict)?.[1];
      if (filter && filter !== "FlateDecode") continue;
      const start = at.offset + s.index + s[0].length;
      const raw = data.subarray(start, start + Number(length[1]));
      const text = latin1(filter ? await inflate(raw) : raw, 0, Infinity);
      const fixed = rewriteCMap(text);
      if (fixed) objects.push({ num, gen: at.gen, body: fixed });
    }
    if (!objects.length) return unchanged;

    // The incremental update: the new maps, a cross-reference section for them, and a trailer pointing back.
    let update = "\n";
    const entries: string[] = [];
    for (const o of objects) {
      entries.push(`${o.num} 1\n${String(data.length + update.length).padStart(10, "0")} ${String(o.gen).padStart(5, "0")} n\r\n`);
      update += `${o.num} ${o.gen} obj\n<< /Length ${o.body.length} >>\nstream\n${o.body}\nendstream\nendobj\n`;
    }
    const xrefAt = data.length + update.length;
    const keep = (name: string) => new RegExp(`/${name}\\s*(\\d+\\s+\\d+\\s+R|\\[[^\\]]*\\])`).exec(xref.trailer)?.[0] ?? "";
    const size = Math.max(Number(/\/Size\s+(\d+)/.exec(xref.trailer)?.[1] ?? 0), ...objects.map((o) => o.num + 1));
    update += `xref\n${entries.join("")}trailer\n<< /Size ${size} ${keep("Root")} ${keep("Info")} ${keep("ID")} /Prev ${xref.startxref} >>\nstartxref\n${xrefAt}\n%%EOF\n`;

    const out = new Uint8Array(data.length + update.length);
    out.set(data);
    out.set(ascii(update), data.length);
    return { data: out, fonts: objects.length };
  } catch {
    return unchanged;
  }
}
