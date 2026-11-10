# Brief C: MP4 chapter marks in core, for any box order

## Goal
`withChapters` (adds a Nero `chpl` chapter list to an MP4/M4B) moves from the web app into `packages/core`, so the
iPhone app can use it too, and it gains support for files where `moov` comes before `mdat` (Apple's AAC writer may
write them that way). Today it throws "moov is not the last box".

## Files
Read: CLAUDE.md, apps/web/src/lib/export.ts (current `withChapters`), packages/core/src/index.ts,
packages/core/test/words.test.ts (test style).
Change only:
- new `packages/core/src/mp4.ts`: `export function withChapters(file: Uint8Array, chapters: { title: string; start: number }[]): Uint8Array<ArrayBuffer>`
- `packages/core/src/index.ts`: export `withChapters`.
- `apps/web/src/lib/export.ts`: delete its own `withChapters`, import it from `@audiokniha/core`.
- new `packages/core/test/mp4.test.ts`.

## Behaviour
- Same output as today when moov is the last top-level box (keep the chpl layout byte for byte: size, "chpl",
  version 1/flags 0, 4 reserved bytes, count byte, then per chapter 8-byte start in 100 ns units, 1-byte title
  length, UTF-8 title cut to 255 bytes; at most 255 chapters).
- When moov is NOT the last box: insert the same udta/chpl into moov, and because every byte after moov moves by
  `insert.length`, add `insert.length` to every chunk offset that points after the insertion point: all entries of
  every `stco` (32-bit) and `co64` (64-bit) box found inside moov → trak → mdia → minf → stbl (walk the box tree;
  containers to descend: moov, trak, mdia, minf, stbl, edts, udta are not needed). If a 32-bit stco entry would
  overflow, throw.
- Box sizes of moov (and udta if it already existed) grow by `insert.length`, as today. Size 1 (64-bit largesize)
  and size 0 (to end of file) top-level boxes: handle size 0 as "to the end"; throw a clear Error on largesize
  for moov itself.

## Tests (node:test, build tiny MP4s by hand with a helper `box(type, ...payloads)`)
1. moov last: ftyp, mdat(8 bytes of data), moov(trak/mdia/minf/stbl/stco with one offset pointing into mdat) →
   output has moov/udta/chpl with 2 chapters; parse it back and check count, starts (0 and 12.5 s) and titles
   (one with "č" to check UTF-8); stco offset unchanged.
2. moov first: ftyp, moov(... stco with offset of the mdat data), mdat → stco offset grows by the inserted size and
   still points at the same data bytes in the output (read them and compare); moov size updated.
3. existing udta inside moov: chpl goes into it, udta and moov sizes both grow.
4. co64 variant of test 2.

## Done when
1. `npm test` from the repo root ends with `ℹ fail 0` and the new tests are listed.
2. `npm run typecheck` prints nothing.
3. `npm run build:site -w @audiokniha/web` exits 0.
