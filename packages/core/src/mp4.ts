// Nero "chpl" chapter list for MP4/M4B files. The box goes into moov/udta, which audiobook players and ffmpeg read.
// moov may come before or after mdat: if the chapter box makes moov longer, every chunk offset that points past
// the insertion point moves by the same amount, so the audio still lines up.

export interface ChapterMark {
  title: string;
  start: number;
}

export interface Mp4Tags {
  title?: string;
  artist?: string;
  album?: string;
  comment?: string;
  genre?: string;
}

/** Required by the Supertonic 3 licence (OpenRAIL-M): generated content must be labelled. */
export const AI_NOTICE = "Hlas generovaný umelou inteligenciou (Supertonic 3, licencia OpenRAIL-M). / AI-generated voice.";

const enc = new TextEncoder();

interface Box {
  pos: number;
  end: number;
  type: string;
  headerLen: number;
  largesize: boolean;
}

// Only these boxes are descended into when looking for chunk offsets (stco/co64).
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

const typeAt = (view: DataView, o: number) =>
  String.fromCharCode(view.getUint8(o + 4), view.getUint8(o + 5), view.getUint8(o + 6), view.getUint8(o + 7));

function readBox(view: DataView, pos: number, limit: number): Box {
  if (pos + 8 > limit) throw new Error(`box header at ${pos} runs past its parent`);
  const size32 = view.getUint32(pos);
  const type = typeAt(view, pos);
  let headerLen = 8;
  let size = size32;
  if (size32 === 1) {
    headerLen = 16;
    size = Number(view.getBigUint64(pos + 8));
  } else if (size32 === 0) {
    size = limit - pos; // size 0 means "to the end of the parent"
  }
  if (size < headerLen || pos + size > limit) throw new Error(`bad size for "${type}" box at ${pos}`);
  return { pos, end: pos + size, type, headerLen, largesize: size32 === 1 };
}

function boxesIn(view: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  for (let p = start; p < end; ) {
    const b = readBox(view, p, end);
    out.push(b);
    p = b.end;
  }
  return out;
}

/** Adds delta to every chunk offset (stco 32-bit, co64 64-bit) that is at or after insertAt. */
function shiftChunkOffsets(view: DataView, start: number, end: number, insertAt: number, delta: number) {
  for (const b of boxesIn(view, start, end)) {
    if (CONTAINERS.has(b.type)) {
      shiftChunkOffsets(view, b.pos + b.headerLen, b.end, insertAt, delta);
    } else if (b.type === "stco" || b.type === "co64") {
      const wide = b.type === "co64";
      const entry = wide ? 8 : 4;
      const n = view.getUint32(b.pos + 12);
      if (b.pos + 16 + n * entry > b.end) throw new Error(`${b.type} entry count runs past its box`);
      for (let i = 0; i < n; i++) {
        const at = b.pos + 16 + i * entry;
        if (wide) {
          const v = view.getBigUint64(at);
          if (v >= BigInt(insertAt)) view.setBigUint64(at, v + BigInt(delta));
        } else {
          const v = view.getUint32(at);
          if (v >= insertAt) {
            if (v + delta > 0xffffffff) throw new Error("chunk offset overflows a 32-bit stco after adding chapters");
            view.setUint32(at, v + delta);
          }
        }
      }
    }
  }
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};

// Box with a 32-bit size. The type is read one char per byte, so "©" (U+00A9) is the single byte 0xA9 that iTunes
// tags use, not its UTF-8 form.
function box(type: string, ...payload: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = concat(payload);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  return out;
}

/** iTunes-style meta box (hdlr + ilst) with one item per non-empty tag. */
function tagsBox(tags: Mp4Tags): Uint8Array<ArrayBuffer> {
  const items: [string, string | undefined][] = [
    ["©nam", tags.title],
    ["©ART", tags.artist],
    ["©alb", tags.album],
    ["©cmt", tags.comment],
    ["©gen", tags.genre],
  ];
  const ilst = box(
    "ilst",
    ...items
      .filter(([, value]) => value)
      .map(([type, value]) => box(type, box("data", u32(1), u32(0), enc.encode(value!)))), // 1 = UTF-8, locale 0
  );
  const hdlr = box("hdlr", u32(0), u32(0), enc.encode("mdir"), enc.encode("appl"), new Uint8Array(8), new Uint8Array(1));
  return box("meta", u32(0), hdlr, ilst);
}

/**
 * Returns a copy of the file with a Nero chpl chapter list added to moov/udta. With tags, an iTunes meta box
 * (title, artist, ...) goes into the same udta, so one insertion covers both.
 */
export function withChapters(file: Uint8Array, chapters: ChapterMark[], tags?: Mp4Tags): Uint8Array<ArrayBuffer> {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const moov = boxesIn(view, 0, file.length).find((b) => b.type === "moov");
  if (!moov) throw new Error("no moov box");
  if (moov.largesize) throw new Error("moov with a 64-bit size is not supported");

  const list = chapters.slice(0, 255).map((c) => ({ start: c.start, title: enc.encode(c.title).slice(0, 255) }));
  const chplSize = 8 + 4 + 4 + 1 + list.reduce((n, c) => n + 8 + 1 + c.title.length, 0);
  const chpl = new Uint8Array(chplSize);
  const cv = new DataView(chpl.buffer);
  cv.setUint32(0, chplSize);
  chpl.set(enc.encode("chpl"), 4);
  cv.setUint32(8, 0x01000000); // version 1, flags 0
  cv.setUint32(12, 0);
  cv.setUint8(16, list.length);
  let o = 17;
  for (const c of list) {
    cv.setBigUint64(o, BigInt(Math.round(c.start * 1e7))); // 100 ns units
    cv.setUint8(o + 8, c.title.length);
    chpl.set(c.title, o + 9);
    o += 9 + c.title.length;
  }

  const moovKids = boxesIn(view, moov.pos + moov.headerLen, moov.end);
  const udta = moovKids.filter((b) => b.type === "udta").at(-1);
  if (udta?.largesize) throw new Error("udta with a 64-bit size is not supported");
  if (tags && udta && boxesIn(view, udta.pos + udta.headerLen, udta.end).some((b) => b.type === "meta")) {
    throw new Error("file already has tags");
  }
  const payload = concat([chpl, tags ? tagsBox(tags) : new Uint8Array(0)]);
  let insertAt: number;
  let insert: Uint8Array;
  if (udta) {
    insertAt = udta.end;
    insert = payload;
  } else {
    insertAt = moov.end;
    insert = box("udta", payload);
  }

  // Patch offsets in a copy: the walk above only reads structure, so the copy's layout is still the original.
  const src = file.slice();
  shiftChunkOffsets(new DataView(src.buffer), moov.pos + moov.headerLen, moov.end, insertAt, insert.length);

  const out = new Uint8Array(file.length + insert.length);
  out.set(src.subarray(0, insertAt));
  out.set(insert, insertAt);
  out.set(src.subarray(insertAt), insertAt + insert.length);
  const ov = new DataView(out.buffer);
  ov.setUint32(moov.pos, moov.end - moov.pos + insert.length);
  if (udta) ov.setUint32(udta.pos, udta.end - udta.pos + insert.length);
  return out;
}
