# Brief E2: export the whole book as .m4b on the iPhone and share it

## Goal
When every sentence of a book is ready, the book screen offers "Vytvoriť audioknihu": the app joins all sentence
files into one AAC file on the phone (native `joinAac`), adds chapter marks and tags (core `withChapters` with tags:
title, author, AI notice), saves `<title>.m4b`, and opens the iOS share sheet, so the user can save it to Files, send
it, or open it in Apple Books. Same purpose and texts as the web app's Export tab.

## Files
Read: CLAUDE.md, apps/web/src/BookView.tsx (function `Export`: texts and behaviour to copy),
apps/mobile/modules/audio-encoder/index.ts (`aacAvailable`, `joinAac(uris, outUri, bitrate, onProgress)` → seconds of each input),
packages/core/src/mp4.ts and index.ts (`withChapters(file, chapters, tags)`, `AI_NOTICE`), apps/mobile/src/lib/book.ts
(`sentencesOf(chapter)`, state `ready`/`total`), apps/mobile/src/lib/storage.ts (`audioFile(key)`), apps/mobile/src/BookScreen.tsx,
apps/mobile/src/ui.tsx, node_modules/expo-file-system/build/File.d.ts (`bytes()`, `write()`, `delete()`, `size`, `Paths.cache`).
Change only:
- new `apps/mobile/src/lib/export.ts`: `exportBook(ctl: BookController, onProgress: (done: number, total: number) => void): Promise<{ uri: string; seconds: number; bytes: number; chapters: number }>`
- new `apps/mobile/src/Export.tsx`: `Export({ ctl, st })`
- `apps/mobile/src/BookScreen.tsx`: render `<Export ctl={ctl} st={st} />` right after the card that shows how much is ready.

## lib/export.ts
1. Inputs: for each chapter c in order, for each sentence of `ctl.sentencesOf(c)`, `audioFile(s.key).uri`
   (it may be .m4a or an old .wav; joinAac reads both). If any sentence has no audio, throw
   Error("Ešte treba pripraviť N viet.").
2. `const seconds = await joinAac(uris, Paths.cache + "/export.m4a" as a File uri, 64000, onProgress)`.
3. Chapter starts: the running sum of `seconds` at each chapter's first sentence; titles
   `project.chapters[c].title || \`Kapitola ${c + 1}\``. Skip chapters with no sentences.
4. Read the joined file's bytes, `withChapters(bytes, chapters, { title: p.title, artist: p.author, album: p.title,
   genre: "Audiobook", comment: AI_NOTICE })` (leave out empty values), write the result to
   `Paths.cache/<file name>.m4b`, where the file name is the title with `/\\:*?"<>|` replaced by "-", trimmed, at most
   80 characters, or "audiokniha" if empty. Delete the temporary export.m4a (also on error, in `finally`).
   Delete an older .m4b of the same name first.
5. Return the .m4b uri, total seconds, file size, chapter count.

## Export.tsx
- A card like the others (`c.surface`, radius 16, padding 16, gap 12) with heading "Audiokniha" (h2 style of the screen).
- Hint (from web): "Celá kniha ako jeden súbor .m4b s kapitolami. Otvoria ho appky na audioknihy aj prehrávače hudby."
- If not all ready (`sum(st.ready) < sum(st.total)`): Note text "Ešte treba pripraviť N viet. Spusti „Pripraviť celú
  knihu“ hore." and the button disabled.
- AI notice line in ink2, 13px: `${AI_NOTICE} Táto informácia sa zapíše do súboru. Ak nahrávku zverejníš, uveď to aj ty.`
- If `!aacAvailable`: Note "Export potrebuje novšiu verziu appky." and no button.
- Button "Vytvoriť audioknihu" (primary, `busy` while running). While running: "Ukladám zvuk, X %" (from onProgress),
  then "Pripravujem súbor…" between join and share.
- On success: a line "<h> h <m> min · <N> kapitol · <MB> MB" (MB with one decimal, decimal comma) and the share sheet
  opens at once with React Native's `Share.share({ url: uri, title: p.title })`; a secondary Button "Zdieľať znova"
  opens it again. Keep the result in component state.
- On error: Note tone "error" "Export sa nepodaril: <message>".
- No new dependencies (React Native's `Share` shares a file URL on iOS).

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/exp-e2"` ends with `Exported:`.
3. `npm test` ends with `ℹ fail 0`.
4. `git status --short -- apps/mobile/src` shows the new files lib/export.ts and Export.tsx, plus BookScreen.tsx
   (other modified files there are from earlier accepted briefs).
