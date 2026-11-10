# Brief B: pronunciation dictionary on the iPhone

## Goal
The book screen of the iPhone app gets a "Výslovnosť" panel, like the web app's Dictionary tab: the user adds a
word as it is in the text and how it should be read, sees the list, and removes entries. Saving goes through
`ctl.update({ dictionary })`, which already saves the book and regenerates only the changed sentences.

## Files
Read: CLAUDE.md, apps/web/src/BookView.tsx (function `Dictionary`, the model to copy: texts, behaviour),
apps/mobile/src/BookScreen.tsx, apps/mobile/src/ui.tsx, apps/mobile/src/theme.ts,
packages/core/src/project.ts (`dictionary: Record<string, string>`), apps/mobile/src/lib/book.ts (`update`).
Change only:
- new `apps/mobile/src/Dictionary.tsx` exporting `function Dictionary({ ctl, st }: { ctl: BookController; st: BookState })`
- `apps/mobile/src/BookScreen.tsx`: the row of two buttons ("Slovenčina"/"Hlas") becomes three: add
  `Button title="Výslovnosť"` (kind "secondary", flex 1) that toggles the panel, the same way "Hlas" toggles the
  voices (`useState`). When open, render `<Dictionary ctl={ctl} st={st} />` below the row. Opening one panel
  closes the other.

## Dictionary.tsx
- Hint text (same as web): "Mená a slová, ktoré hlas číta zle, napíš tak, ako sa vyslovujú. Platí to pre celú
  knihu a znova sa pripravia len dotknuté vety."
- Two `TextInput`s with labels "V texte" (placeholder "Didolićová") and "Čítať ako" (placeholder "Didoličová"),
  `autoCapitalize="none"`, `autoCorrect={false}`, colours from `useColors()` (ink text, line border, surface
  background, ink2 placeholder), height 44, radius 10.
- Button "Pridať" (primary), disabled until both are non-blank; on press: trim both, `ctl.update({ dictionary:
  { ...st.project.dictionary, [word]: say } })`, clear the inputs.
- List of entries: "<word> → <say>" with the word bold, and a quiet Button "Odstrániť" that removes it the same way.
- Empty state: "Zatiaľ žiadne slová." in ink2.
- `st.project.dictionary` may be undefined in books saved by old versions: treat it as `{}`.
- Styles in a `StyleSheet.create` at the bottom, like the other screens. No new dependencies.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/exp-b"` ends with `Exported:`.
3. `git status --short -- apps/mobile/src` shows only the two files above.
