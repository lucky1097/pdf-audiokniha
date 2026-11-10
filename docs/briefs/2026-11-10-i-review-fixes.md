# Brief I: fixes from the review of briefs F, G and H

## Goal
Fix four defects found in review of the uncommitted F/G/H change. Nothing else changes.

## Files
Read: CLAUDE.md, docs/briefs/2026-11-10-f-chapter-queue.md, -g-book-screen.md, -h-share-button.md,
apps/mobile/src/lib/book.ts, apps/mobile/src/ShareBook.tsx, apps/mobile/src/BookScreen.tsx.
Change only: apps/mobile/src/lib/book.ts, apps/mobile/src/ShareBook.tsx, apps/mobile/src/BookScreen.tsx.

## 1. ShareBook shares an old file (ShareBook.tsx)
The cached result is keyed by `${project.id}:${ready count}`, but after a voice/language change or "Vygenerovať znova"
the count can be the same with different audio. Key it by the audio itself: `ctl.keys().join("|")` (all sentence cache
keys of the book; they change with voice, language, text and seed). Compute it only on tap, not on render.

## 2. "Zmazať zvuk" while the pump runs (book.ts)
Today deleteAudio deletes files while pump() may be inside synthesize/writeAudio, so (a) the sentence in flight is
written after the delete and (b) the AHEAD branch of nextJob makes the next 6 sentences again.
- Add `private halted = false` and `private pumpDone: Promise<void> | null = null` (set in pump to the running promise,
  cleared in its finally).
- pump loop: after `synthesize` returns and before `writeAudio`, `if (this.halted) break;`. nextJob returns null while halted.
- deleteAudio: `this.halted = true`, pause, save generating:false / queued:[] (as now), `await this.pumpDone` (if any),
  then listProjects + deleteBookAudio + recount, then `this.halted = false` (in finally) WITHOUT starting the pump.
- Nothing else resets halted; normal use after the delete (play, seek, prepareChapter, setWholeBook) starts the pump as today.

## 3. A finished chapter can stay queued forever (book.ts)
In the constructor, after `recount()`, drop from `project.queued` every chapter with `ready[c] >= total[c]` (save
without pump if anything was dropped), before deciding whether to start the pump.

## 4. Settings row moved below the chapters (BookScreen.tsx)
The "Slovenčina / Hlas / Výslovnosť" row with its Dictionary and voices panels must sit where it was before brief G:
right after the audiobook card and before the "Kapitoly" heading. Move that block; change nothing else.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/exp-i"` ends with `Exported:`.
3. `npm test` ends with `ℹ fail 0`.
4. `grep -n "halted" apps/mobile/src/lib/book.ts` shows it in the field list, nextJob, the pump loop and deleteAudio.
5. In BookScreen.tsx the line with `title="Výslovnosť"` comes before the line with `>Kapitoly<` (`grep -n` both).
6. `grep -n "keys().join" apps/mobile/src/ShareBook.tsx` finds the new cache key.
