# Brief K: first-run welcome and a clearer library

## Goal
A non-technical first-time user (the owner's mother) opens the app and knows what to do: download the voice once,
add a PDF, listen. Approved mockup, three states of the library screen (apps/mobile/src/Library.tsx):

1. **Welcome** (voice not downloaded, not downloading, no books, `voiceAvailable`): no "Knižnica" title. Shows
   - title "Knihy nahlas, priamo v telefóne" (h1 style),
   - three numbered steps (a round accentSoft circle with the number in accentText, bold title, ink2 text):
     1. "Stiahni hlas" / "Raz, asi 380 MB, najlepšie cez Wi‑Fi."
     2. "Pridaj knihu" / "PDF alebo text knihy."
     3. "Počúvaj" / "Všetko zostáva v tvojom telefóne, nič sa nikam neposiela."
   - primary Button "Stiahnuť hlas" (full width) → `startModelDownload()` (catch the rejection; the store keeps
     the error),
   - quiet Button "Najprv pridať knihu" → the file picker (the voice then downloads on first play, as today),
   - small ink2 line (13 px) "Hlas je vytvorený umelou inteligenciou."
   - if the store status is "error": a Note tone="error" "Hlas sa nepodarilo stiahnuť: <error>" above the button,
     and the button title becomes "Skúsiť znova".
2. **Downloading** (store status "downloading", any number of books): a card under the title (welcome title is
   replaced by the normal "Knižnica" h1 in this state) with bold "Sťahujem hlas", `<Bar value={bytes/total} />`
   and "<MB> z 380 MB · nechaj appku otvorenú" (MB = Math.round(bytes/1048576); 380 = Math.round(MODEL_BYTES/1048576)).
   Adding books stays possible below it.
3. **Library** (every other case): "Knižnica" h1, then
   - if voice missing (status "missing" or "error") and books exist: a card "Hlas ešte nie je stiahnutý" /
     "Asi 380 MB, najlepšie cez Wi‑Fi. Potom funguje aj bez internetu." + secondary Button "Stiahnuť hlas"
     (plus the error Note when status is "error"). This replaces the old "Pri prvom prehrávaní…" Note.
   - the add buttons: primary "Pridať PDF" (→ pickFile, keeps `busy`) and secondary "Vložiť text", side by side,
     no card around them and no description text; the busy text stays under them.
   - with no books: above the buttons, ink2 text "Pridaj prvú knihu. PDF nájdeš v Súboroch, v e‑maile alebo
     v Stiahnutých." and no ListEmptyComponent text.
   - with books: "Moje knihy" h2 and the list as today.
- In Expo Go (`!voiceAvailable`) never show the welcome or the download card; keep the NO_VOICE_MESSAGE warn Note.
- The error Note for file errors (`error` state) and the PdfReader / paste Modal stay as they are.

Read the store with React's `useSyncExternalStore(subscribeModelDownload, getModelDownload)` (from "react").
The decision "no books" must wait for the first `listProjects()` result: add a `loaded` boolean so the welcome
does not flash for users who have books.

## Files
Read: CLAUDE.md, apps/mobile/src/Library.tsx, apps/mobile/src/lib/engine.ts (the `ModelDownload` store:
`getModelDownload`, `subscribeModelDownload`, `startModelDownload`, `MODEL_BYTES`), apps/mobile/src/ui.tsx
(Button, Bar, Note), apps/mobile/src/theme.ts (colour names).
Change only: apps/mobile/src/Library.tsx.
Keep where they are: `create`, `pickFile`, `onPdf`, `confirmDelete`, `removeBook`, the renderItem row, the
PdfReader block, the paste Modal. Remove the `modelDownloaded` import if unused.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `cd apps/mobile && npx expo export -p ios --output-dir "C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/export-k"`
   ends with a line starting `Exported:`.
3. `git diff --stat -- apps/mobile/src/Library.tsx` shows the file changed, and `git status --short apps/mobile/src`
   lists no other file changed by you (engine.ts and book.ts were changed by brief J before you).
4. `grep -c "Knihy nahlas, priamo v telefóne\|Stiahnuť hlas\|Sťahujem hlas\|Pridať PDF\|Pridaj prvú knihu" apps/mobile/src/Library.tsx`
   prints 5 or more.
