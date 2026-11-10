import assert from "node:assert/strict";
import { test } from "node:test";
import { AI_NOTICE, withChapters } from "../src/mp4.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

function cat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
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
  view(b).setUint32(0, n);
  return b;
};
const u64 = (n: bigint) => {
  const b = new Uint8Array(8);
  view(b).setBigUint64(0, n);
  return b;
};

// A box with a 32-bit size header: size, type, payloads.
function box(type: string, ...payloads: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = cat(...payloads);
  return cat(u32(8 + body.length), enc.encode(type), body);
}

const stco = (offset: number) => box("stco", u32(0), u32(1), u32(offset));
const co64 = (offset: number) => box("co64", u32(0), u32(1), u64(BigInt(offset)));

// moov > trak > mdia > minf > stbl > chunk offset box, plus optional extra boxes directly in moov.
function moovWith(offsetBox: Uint8Array, ...extra: Uint8Array[]) {
  return box("moov", box("mvhd", new Uint8Array(100)), box("trak", box("mdia", box("minf", box("stbl", offsetBox)))), ...extra);
}

// Finds the first child of buf with the given type between start and end. Returns the box start and end.
function child(buf: Uint8Array, type: string, start = 0, end = buf.length): { pos: number; end: number } {
  const v = view(buf);
  for (let p = start; p < end; ) {
    const size = v.getUint32(p);
    if (dec.decode(buf.subarray(p + 4, p + 8)) === type) return { pos: p, end: p + size };
    p += size;
  }
  throw new Error(`no ${type} box`);
}

// Walks down a path of box types from the top of the file, e.g. ["moov", "trak", ...].
function find(buf: Uint8Array, types: string[]) {
  let start = 0;
  let end = buf.length;
  let hit = { pos: 0, end: 0 };
  for (const t of types) {
    hit = child(buf, t, start, end);
    start = hit.pos + 8;
    end = hit.end;
  }
  return hit;
}

// Reads the chapters back from moov/udta/chpl.
function readChapters(file: Uint8Array) {
  const moov = child(file, "moov");
  const udta = child(file, "udta", moov.pos + 8, moov.end);
  const chpl = child(file, "chpl", udta.pos + 8, udta.end);
  const v = view(file);
  const count = v.getUint8(chpl.pos + 16);
  const chapters: { start: number; title: string }[] = [];
  let o = chpl.pos + 17;
  for (let i = 0; i < count; i++) {
    const start = Number(v.getBigUint64(o)) / 1e7;
    const len = v.getUint8(o + 8);
    chapters.push({ start, title: dec.decode(file.subarray(o + 9, o + 9 + len)) });
    o += 9 + len;
  }
  return chapters;
}

const ftyp = box("ftyp", enc.encode("M4A "), u32(0));
const audio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const chapters = [
  { title: "Úvod", start: 0 },
  { title: "Kapitola č. 2", start: 12.5 },
];

test("moov after mdat: chapters go into udta, offsets stay", () => {
  const dataAt = ftyp.length + 8; // mdat payload starts after its 8-byte header
  const file = cat(ftyp, box("mdat", audio), moovWith(stco(dataAt)));
  const out = withChapters(file, chapters);

  assert.deepEqual(readChapters(out), [
    { start: 0, title: "Úvod" },
    { start: 12.5, title: "Kapitola č. 2" },
  ]);
  const s = find(out, ["moov", "trak", "mdia", "minf", "stbl", "stco"]);
  assert.equal(view(out).getUint32(s.pos + 16), dataAt);
});

test("moov before mdat: chunk offsets move with the data", () => {
  const moovLen = moovWith(stco(0)).length;
  const dataAt = ftyp.length + moovLen + 8;
  const file = cat(ftyp, moovWith(stco(dataAt)), box("mdat", audio));
  const out = withChapters(file, chapters);
  const grown = out.length - file.length;
  assert.ok(grown > 0);

  const s = find(out, ["moov", "trak", "mdia", "minf", "stbl", "stco"]);
  const offset = view(out).getUint32(s.pos + 16);
  assert.equal(offset, dataAt + grown);
  assert.deepEqual(out.subarray(offset, offset + audio.length), audio);
  assert.equal(view(out).getUint32(child(out, "moov").pos), moovLen + grown);
  assert.deepEqual(readChapters(out), [
    { start: 0, title: "Úvod" },
    { start: 12.5, title: "Kapitola č. 2" },
  ]);
});

test("existing udta in moov: chpl goes inside it, udta and moov both grow", () => {
  const dataAt = ftyp.length + 8;
  const oldUdta = box("udta", box("name", enc.encode("Kniha")));
  const moov = moovWith(stco(dataAt), oldUdta);
  const file = cat(ftyp, box("mdat", audio), moov);
  const out = withChapters(file, chapters);
  const grown = out.length - file.length;

  const m = child(out, "moov");
  assert.equal(view(out).getUint32(m.pos), moov.length + grown);
  const u = child(out, "udta", m.pos + 8, m.end);
  assert.equal(u.end - u.pos, oldUdta.length + grown);
  assert.deepEqual(readChapters(out), [
    { start: 0, title: "Úvod" },
    { start: 12.5, title: "Kapitola č. 2" },
  ]);
  assert.ok(dec.decode(out).includes("Kniha"), "the existing udta content is kept");
});

test("co64 offsets move with the data when moov is first", () => {
  const moovLen = moovWith(co64(0)).length;
  const dataAt = ftyp.length + moovLen + 8;
  const file = cat(ftyp, moovWith(co64(dataAt)), box("mdat", audio));
  const out = withChapters(file, chapters);
  const grown = out.length - file.length;

  const s = find(out, ["moov", "trak", "mdia", "minf", "stbl", "co64"]);
  const offset = view(out).getBigUint64(s.pos + 16);
  assert.equal(offset, BigInt(dataAt + grown));
  const at = Number(offset);
  assert.deepEqual(out.subarray(at, at + audio.length), audio);
});

// Reads moov/udta/meta/ilst back as { key: value }; keys are the 4 type chars (© is U+00A9).
function readTags(file: Uint8Array) {
  const moov = child(file, "moov");
  const udta = child(file, "udta", moov.pos + 8, moov.end);
  const meta = child(file, "meta", udta.pos + 8, udta.end);
  const hdlr = child(file, "hdlr", meta.pos + 12, meta.end); // meta is a full box: 4 more header bytes
  assert.equal(dec.decode(file.subarray(hdlr.pos + 16, hdlr.pos + 20)), "mdir");
  const ilst = child(file, "ilst", meta.pos + 12, meta.end);
  const v = view(file);
  const tags: Record<string, string> = {};
  for (let p = ilst.pos + 8; p < ilst.end; ) {
    const size = v.getUint32(p);
    const key = String.fromCharCode(...file.subarray(p + 4, p + 8));
    const data = p + 8;
    assert.equal(dec.decode(file.subarray(data + 4, data + 8)), "data");
    assert.equal(v.getUint32(data + 8), 1); // UTF-8
    tags[key] = dec.decode(file.subarray(data + 16, data + v.getUint32(data)));
    p += size;
  }
  return tags;
}

test("tags: moov last, meta/hdlr/ilst read back, chpl still correct", () => {
  const dataAt = ftyp.length + 8;
  const file = cat(ftyp, box("mdat", audio), moovWith(stco(dataAt)));
  const out = withChapters(file, chapters, {
    title: "Kniha č. 1",
    artist: "Autor",
    comment: AI_NOTICE,
    genre: "Audiobook",
  });

  assert.deepEqual(readTags(out), {
    "©nam": "Kniha č. 1",
    "©ART": "Autor",
    "©cmt": AI_NOTICE,
    "©gen": "Audiobook",
  });
  assert.deepEqual(readChapters(out), [
    { start: 0, title: "Úvod" },
    { start: 12.5, title: "Kapitola č. 2" },
  ]);
});

test("tags: moov before mdat, chunk offsets still point at the audio", () => {
  const moovLen = moovWith(stco(0)).length;
  const dataAt = ftyp.length + moovLen + 8;
  const file = cat(ftyp, moovWith(stco(dataAt)), box("mdat", audio));
  const out = withChapters(file, chapters, { title: "Kniha č. 1", comment: AI_NOTICE });
  const grown = out.length - file.length;

  const s = find(out, ["moov", "trak", "mdia", "minf", "stbl", "stco"]);
  const offset = view(out).getUint32(s.pos + 16);
  assert.equal(offset, dataAt + grown);
  assert.deepEqual(out.subarray(offset, offset + audio.length), audio);
  assert.equal(readTags(out)["©nam"], "Kniha č. 1");
});

test("tags: empty title writes no ©nam box", () => {
  const dataAt = ftyp.length + 8;
  const file = cat(ftyp, box("mdat", audio), moovWith(stco(dataAt)));
  const out = withChapters(file, chapters, { title: "", artist: "Autor" });
  const tags = readTags(out);
  assert.equal("©nam" in tags, false);
  assert.deepEqual(tags, { "©ART": "Autor" });
});
