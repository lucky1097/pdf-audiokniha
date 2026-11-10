# Brief G: book screen, simple enough for a first-time user

## Goal
The book screen (iPhone) becomes one clear path, approved by the user on a mockup:
1. a share button next to the title (ShareBook, from brief H);
2. the "Počúvaš" card, unchanged;
3. one big orange "Vytvoriť audioknihu" card that prepares the whole book, shows progress with a time estimate and
   "Pozastaviť", and says when it is done;
4. the chapter list: tapping a chapter starts playing it at once (it then flows on into the next chapters, as the
   player already does); each row has a small icon on the right to prepare only that chapter offline;
5. "Úložisko" at the very end: size and "Zmazať zvuk".
The old "Pripraviť celú knihu" secondary button and the "Audiokniha" card (Export.tsx) go away. Persona: the user's
mother, who has never seen the app. Every label must say what happens.

## Files
Read: CLAUDE.md, apps/mobile/src/BookScreen.tsx, apps/mobile/src/ShareBook.tsx, apps/mobile/src/ui.tsx (Button, Bar,
Note, ShareIcon), apps/mobile/src/theme.ts, apps/mobile/src/lib/book.ts (`setWholeBook`, `prepareChapter`,
`cancelChapter`, `isQueued`, `estimate`, `play(chapter, sentence)`, `deleteAudio`, `audioSize`, state `ready`,
`total`, `project.generating`, `project.queued`, `phase`), apps/mobile/src/Export.tsx (to delete).
Change only: apps/mobile/src/BookScreen.tsx; delete apps/mobile/src/Export.tsx; you may add a new file
apps/mobile/src/ChapterRow.tsx if the row gets long.

## Layout, top to bottom (keep everything else on the screen as it is: back link, Status, notes, language/voice/
dictionary row, ReadAlong, PlayerBar)
1. Header row: cover, title + voice line (as today), and `<ShareBook ctl={ctl} st={st} />` on the right, vertically centred.
2. "Počúvaš" card: unchanged.
3. Audiobook card (`c.surface`, radius 16, padding 16, gap 12). Let `left = sum(total) - sum(ready)`,
   `mins = Math.round(ctl.estimate("all") / 60)`, computed in a `useMemo` keyed on the summed ready count and
   `st.secondsPerChar` only (estimate() checks a file per sentence; never call it on every render, nor per chapter row); format time as "X min" under 60, else "X h Y min" (Y omitted if 0).
   - Not started (`left > 0 && !p.generating`): primary Button "Vytvoriť audioknihu" (full width) →
     `ctl.setWholeBook(true)`; below it ink2 14px: "Pripravíme celú knihu naraz, potom ju počúvaš aj bez internetu.
     Trvá to asi {time}, nechaj telefón na nabíjačke." If `ready > 0`, start the text with "Hotové {pct} %. ".
   - Running (`left > 0 && p.generating`): title "Vytváram audioknihu" (16px, 600), `Bar` of ready/total, ink2 14px
     "{pct} % · ešte asi {time}. Počúvať môžeš aj teraz.", secondary Button "Pozastaviť" → `ctl.setWholeBook(false)`.
     While `st.phase` is "downloading" or "loading" the existing Status card above explains it; keep this card as is.
   - Done (`left === 0`): a row with a green check (use `c.ok`, a "✓" Text 20px is fine) and two lines:
     "Audiokniha je hotová" (16px, 600) and ink2 14px "Počúvaš ju aj bez internetu. Poslať alebo uložiť ju môžeš
     tlačidlom vedľa názvu."
4. Chapters: heading "Kapitoly", hint "Ťukni na kapitolu a začne hrať od začiatku." Rows as today (number, title,
   "Tu si · veta a z b" for the current one, current row tinted), but:
   - Row tap: `ctl.play(i, 0)` when it is not the current chapter; on the current chapter `ctl.toggle()` if paused, nothing
     if playing. Do not open the read-along view any more (the "Zobraziť text" button and the player do that).
   - Right side, instead of the status text, a 44x44 Pressable with a small status:
     ready → "✓" in `c.ok` (no action, `accessibilityLabel="Kapitola je pripravená"`);
     queued and not ready → "{pct} %" in accentText 13px, tap → `ctl.cancelChapter(i)`,
       `accessibilityLabel="Zastaviť prípravu kapitoly"`;
     neither → a down-arrow "↓" 20px in ink2 inside a hairline circle, tap → `ctl.prepareChapter(i)`,
       `accessibilityLabel="Pripraviť kapitolu na počúvanie bez internetu"`.
     While the whole book is being created, chapters that are not ready show their pct the same way (tap does nothing).
5. "Úložisko" at the end of the ScrollView (after the chapters): h2-sized 17px heading "Úložisko", ink2 14px
   "Zvuk knihy zaberá X MB." and the existing quiet "Zmazať zvuk" button with its Alert (move it from the ready card,
   keep its logic and texts). The ready card's old text, Bar and buttons are gone (replaced by section 3).
- Remove the `Export` import and its render.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/exp-g"` ends with `Exported:`.
3. `grep -rn "Export.tsx\|from \"./Export" apps/mobile/src` prints nothing and apps/mobile/src/Export.tsx does not exist.
4. `grep -n "Pripraviť celú knihu" apps/mobile/src/BookScreen.tsx` prints nothing; `grep -n "Vytvoriť audioknihu\|Úložisko\|ShareBook" apps/mobile/src/BookScreen.tsx` finds all three.
5. `npm test` ends with `ℹ fail 0`.
