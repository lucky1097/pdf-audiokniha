# Brief F: prepare single chapters offline, and a time estimate

## Goal
The book controller can prepare one chapter at a time for offline listening (the user taps a download icon on a
chapter), remembers those requests across app restarts, can cancel one, and estimates how long the remaining
preparation takes, so the book screen can say "ešte asi 50 min". The whole-book preparation ("Vytvoriť audioknihu")
keeps working as today through `setWholeBook`.

## Files
Read: CLAUDE.md, docs/known-issues.md, apps/mobile/src/lib/book.ts (generation: `nextJob`, `pump`, `setWholeBook`,
`update`, `deleteAudio`), packages/core/src/project.ts (`Project`).
Change only: packages/core/src/project.ts (one optional field), apps/mobile/src/lib/book.ts.
Do not touch the player part of book.ts (everything under "// ---- player"), except nothing: it must stay as it is.

## project.ts
Add to `Project`: `/** Chapters the user asked to prepare for offline listening (mobile), in the order asked. */ queued?: number[];`
No other change (old books have no field: treat as []).

## book.ts
- `prepareChapter(c: number)`: if not already queued and the chapter is not fully ready, append to `queued`, save
  through `update({ queued })` (it starts the pump).
- `cancelChapter(c: number)`: remove from `queued`, save without starting the pump (same pattern as deleteAudio:
  build the project, `saveProject`, `this.set({ project })`).
- `isQueued(c: number): boolean`.
- `nextJob()` order: (1) up to AHEAD sentences from the listening position, as today; (2) the chapters in `queued`, in
  order, first missing sentence; (3) if `generating`, the whole book as today; else null.
- In `pump()`: after each sentence, if the chapter of the job is in `queued` and now fully ready
  (`ready[c] >= total[c]`), remove it from `queued` (save without pump, you are inside the pump). Keep the screen awake
  (`activateKeepAwakeAsync("generate")`) when `generating` is on OR `queued` is not empty. At the end, the existing
  `generating:false` reset stays.
- `deleteAudio()`: also clear `queued` (in the same save that turns generating off).
- Time estimate. Add to BookState `secondsPerChar: number | null`: a running average of generation time per character
  of sentence text, updated after every sentence in pump (exponential average, weight 0.2 for the new value; first
  value taken as is). Add `estimate(chapters: number[] | "all"): number | null` → seconds: the sum of `text.length` of
  the sentences without audio in those chapters, times `secondsPerChar`; null until the first sentence was generated
  in this session. Pure arithmetic, no file reads beyond `hasAudio`.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `npm run typecheck` prints no errors and `npm test` ends with `ℹ fail 0`.
3. `git diff --stat -- packages apps/mobile/src/lib` lists only packages/core/src/project.ts and apps/mobile/src/lib/book.ts (another worker edits ui.tsx and ShareBook.tsx at the same time).
4. `git diff apps/mobile/src/lib/book.ts` shows no change below the line `// ------------------------------------------------------------------ player`
   except inside `deleteAudio` (which sits there).
