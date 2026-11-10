# Brief H: "Poslať alebo uložiť" share button

## Goal
A round share button (the iOS share symbol: a square open at the top with an arrow pointing up out of it) that sits
next to the book title. When the whole book is ready, tapping it builds the .m4b (existing `exportBook`) and opens the
iOS share sheet; while it builds, a small sheet shows progress and the AI notice. When the book is not ready, it asks
whether to create the audiobook first. This replaces the "Audiokniha" card (Export.tsx), which a later brief removes.

## Files
Read: CLAUDE.md, apps/mobile/src/Export.tsx (current export UI: the logic to reuse), apps/mobile/src/lib/export.ts
(`exportBook`), apps/mobile/modules/audio-encoder/index.ts (`aacAvailable`), apps/mobile/src/ui.tsx, apps/mobile/src/theme.ts,
apps/mobile/src/lib/book.ts (`BookController`, `BookState`, `setWholeBook`), packages/core/src/mp4.ts (`AI_NOTICE`).
Change only:
- `apps/mobile/src/ui.tsx`: add `export function ShareIcon({ size = 20, color }: { size?: number; color: string })`
  drawn with plain Views (no new dependency, no SVG): an upward arrow (a 2px vertical stem and a chevron made of two
  2px bars rotated ±45°) whose stem goes down into a box with 2px left, right and bottom borders, rounded bottom corners,
  open at the top (the top edge has a gap where the arrow comes out). It must read as the iOS share symbol at 20px.
- new `apps/mobile/src/ShareBook.tsx`: `export function ShareBook({ ctl, st }: { ctl: BookController; st: BookState })`.

## ShareBook
- A 44x44 round Pressable, 0.5px... use `StyleSheet.hairlineWidth` border in `c.line`, the ShareIcon in `c.ink`,
  `accessibilityRole="button"`, `accessibilityLabel="Poslať alebo uložiť audioknihu"`.
- Not all sentences ready (sum of st.ready < sum of st.total): `Alert.alert("Audiokniha ešte nie je hotová", "Najprv ju
  vytvor, potom ju môžeš poslať alebo uložiť.", [{ text: "Zrušiť", style: "cancel" }, { text: "Vytvoriť audioknihu",
  onPress: () => ctl.setWholeBook(true) }])`. If whole-book preparation is already on, the message is
  "Audiokniha sa ešte vytvára. Keď bude hotová, môžeš ju poslať alebo uložiť." with only "OK".
- `!aacAvailable`: Alert "Na posielanie treba novšiu verziu appky." with "OK".
- Ready: open a React Native `Modal` (transparent, animationType "fade", a centered card on a dim background, colours
  from useColors) with: title "Pripravujem súbor…", a `Bar` with the progress from `exportBook`'s onProgress, and the
  line "Hlas je vytvorený umelou inteligenciou. Ak nahrávku zverejníš, uveď to." in ink2 13px. When `exportBook`
  resolves: close the modal and call `Share.share({ url: r.uri, title: st.project.title })`. Keep the last result in
  state for this book (same project id and same ready count): a second tap shares it again at once without rebuilding.
  On error: close the modal and `Alert.alert("Súbor sa nepodarilo pripraviť", <message>)`.
- No other file changes: the button is placed on the screen by a later brief.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/exp-h"` ends with `Exported:`.
3. `git status --short -- apps/mobile/src` shows only ui.tsx modified and ShareBook.tsx new (book.ts may also show:
   another worker edits it at the same time).
