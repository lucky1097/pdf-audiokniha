# Brief D: sentences stored as AAC, size per book, delete a book's audio

## Goal
On the iPhone, every generated sentence is stored as `.m4a` (AAC, 64 kbit/s) instead of `.wav`, about 11x smaller.
The book screen shows how much space the book's audio takes and has "Zmazať zvuk" to free it. Deleting a book also
deletes its audio (the Library already promises that in its confirm text, but today only the JSON is deleted).
Old `.wav` sentences keep playing; nothing is lost.

## Files
Read: CLAUDE.md, docs/known-issues.md (expo-audio gotchas), apps/mobile/src/lib/storage.ts, apps/mobile/src/lib/book.ts,
apps/mobile/src/BookScreen.tsx, apps/mobile/src/Library.tsx (delete flow), apps/mobile/modules/audio-encoder/index.ts
(the encoder: `aacAvailable`, `encodeAac(inUri, outUri, bitrate)`), packages/core/src/project.ts (`chapterSentences`,
`wavBytes`, gaps), node_modules/expo-file-system/build/File.d.ts and ExpoFileSystem.d.ts (File `size`, `move`, `delete`, `exists`).
Change only: apps/mobile/src/lib/storage.ts, apps/mobile/src/lib/book.ts, apps/mobile/src/BookScreen.tsx, apps/mobile/src/Library.tsx.

## storage.ts
- `audioFile(key)`: the `.m4a` file if it exists, else the `.wav` file if it exists, else the `.m4a` path (what a
  new sentence will be written to). File name stays `key` with non-alphanumerics replaced by `_`.
- `hasAudio(key)`: either file exists.
- `async writeAudio(key, wav: Uint8Array): Promise<void>`: write the WAV to `<name>.tmp.wav`; if `aacAvailable`,
  `await encodeAac(tmp.uri, m4a.uri)` then delete the temp file; if not available (old build), move the temp to
  `<name>.wav`. On encode failure: fall back to keeping the WAV (move temp to `.wav`) so the sentence is never lost.
  Delete a stale `.tmp.wav` at the start.
- `writeRawWav(key, wav)`: the old synchronous WAV write, for the 1 s silence file only.
- `audioBytes(keys: Iterable<string>): number`: total size of the existing files for those keys (both kinds).
- `deleteAudio(keys: Iterable<string>): void`: delete both kinds for each key.

## book.ts
- `pump()`: `await writeAudio(...)` (it is async now). Everything else in the generation loop stays.
- `silenceUri()` uses `writeRawWav` and keeps the `.wav` name `silence-1s`.
- New `keys(): string[]` — every sentence key of this book (all chapters).
- New `async deleteAudio()`: `pause()`, then delete the keys of this book that no other saved book uses
  (`listProjects()`, and for each other project the keys from `chapterSentences(p, c)` for all chapters;
  the same sentence in another book shares the file), then `recount()`. Turn off whole-book generation if it was on
  (`update({ generating: false })` only if it was true).
- New `audioSize(): number` — `audioBytes(this.keys())`.

## BookScreen.tsx
In the card that says how much of the book is ready, below its button(s):
- A line in ink2, 13px: "Zvuk knihy zaberá X MB." (X with one decimal under 10 MB, whole MB above; Slovak decimal
  comma: `toFixed(1).replace(".", ",")`). Recompute when `ready` changes (useMemo on the summed ready count).
- If X > 0: a quiet `Button` "Zmazať zvuk" that asks first with `Alert.alert("Zmazať zvuk knihy?", "Text a záložka
  zostanú. Zvuk sa pri počúvaní pripraví znova.", [{ text: "Zrušiť", style: "cancel" }, { text: "Zmazať",
  style: "destructive", onPress: () => void ctl.deleteAudio() }])`.

## Library.tsx
When a book is deleted, delete its audio too, with the same "no other book uses it" rule. Put the shared logic in
storage.ts or book.ts as a function both can call (e.g. `async deleteBookAudio(project, others: Project[])`), so it is
written once.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/exp-d"` ends with `Exported:`.
3. `npm test` ends with `ℹ fail 0`.
4. `grep -n "writeAudio" apps/mobile/src/lib/book.ts` shows it awaited, and `grep -n "silence-1s" apps/mobile/src/lib/book.ts` shows it using `writeRawWav`.
5. `git status --short -- apps/mobile/src` lists only the four files above (plus Dictionary.tsx from an earlier change).
