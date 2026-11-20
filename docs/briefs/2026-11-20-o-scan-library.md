# Brief O: "Odfotiť stranu" in the library (mobile UI)

## Goal
The user photographs book pages with Apple's document scanner, checks the recognised text and makes a book of it.
The native module (`apps/mobile/modules/text-scanner/index.ts`: `scannerAvailable`, `scanPages()`,
`recognizeText(uri)`) and the core function `textFromScan(pages, lang)` already exist. This brief only wires them
into `apps/mobile/src/Library.tsx`. UI text is Slovak, exactly as written here.

## Changes in Library.tsx

1. **Imports.** `textFromScan` from "@audiokniha/core" (add it to the existing import), and
   `import { recognizeText, scanPages, scannerAvailable } from "../modules/text-scanner/index.ts";`
   (same style as the audio-encoder import in ShareBook.tsx).

2. **Text sheet state.** Replace `const [paste, setPaste] = useState<string | null>(null)` with
   `const [sheet, setSheet] = useState<{ mode: "paste" | "scan"; text: string } | null>(null)`.
   Every former use of `paste`/`setPaste` moves to `sheet`: "Vložiť text" opens `{ mode: "paste", text: "" }`.

3. **Buttons in the library (non-welcome state).**
   - When `scannerAvailable`: row 1 = primary "Pridať PDF" (as today) and secondary "Odfotiť stranu"
     (`onPress={() => void scan()}`, `disabled={!!busy}`), both `flex: 1`; under the row a quiet Button
     "Vložiť text" (`alignSelf: "center"`, disabled while busy).
   - When not `scannerAvailable` (Expo Go, old builds): exactly today's row ("Pridať PDF" + "Vložiť text").
   - The text "Pridaj prvú knihu. PDF nájdeš v Súboroch, v e‑maile alebo v Stiahnutých." becomes, only when
     `scannerAvailable`: "Pridaj prvú knihu: PDF zo Súborov alebo e‑mailu, alebo odfoť stranu knihy."
   - Welcome state: step 2 text becomes "PDF, text alebo odfotená strana knihy." when `scannerAvailable`
     (else unchanged). Nothing else in the welcome changes.

4. **`async function scan(append = false)`** (next to `pickFile`):
   - `setError(null)`; `const uris = await scanPages()` inside try; if `uris.length === 0` return (user cancelled).
   - For each uri, in order: `setBusy(\`Čítam text, strana ${i + 1} z ${uris.length}…\`)`,
     `pages.push(await recognizeText(uri))`, then delete the photo: `try { new File(uri).delete(); } catch {}`.
   - `const raw = pages.flat().map((l) => l.text).join(" ")`; `const text = textFromScan(pages, detectLang(raw))`.
   - If `!text.trim()`: `setError("Na fotke som nenašiel text. Skús ju odfotiť ostrejšie a pri lepšom svetle.")`.
   - Else if `append` and a sheet is open: set the sheet text to `previous.trimEnd() + "\n\n" + text`
     (use the functional form of setSheet). Else `setSheet({ mode: "scan", text })`.
   - catch: `setError(\`Skener sa nepodarilo otvoriť: ${message}\`)` (message as in pickFile).
   - finally: `setBusy(null)`.

5. **The sheet (the existing Modal), by mode.**
   - Title: "Vložiť text" (paste) / "Skontroluj text" (scan).
   - In scan mode only, under the title row: ink2 text 15 px, lineHeight 21:
     "Text je z fotky. Oprav, čo skener prečítal zle, a potom vytvor knihu."
   - TextInput: `autoFocus` only in paste mode; the placeholder stays as is.
   - In scan mode only, above "Vytvoriť knihu": secondary Button "Odfotiť ďalšiu stranu"
     (`onPress={() => void scan(true)}`, `busy={!!busy}`), and when `busy` an ink2 line with the busy text.
     Note: the Modal is open while the scanner presents; if `scanPages()` cannot present from under the open
     Modal on the device that is the module's concern, not this brief's.
   - "Vytvoriť knihu": paste mode as today (title "Vložený text"); scan mode uses `scanTitle(text)`.
   - "Zrušiť" closes the sheet in both modes.

6. **`function scanTitle(text: string): string`** (module level, below `Step`): the first non-empty line of the
   text, trimmed; if longer than 40 characters, cut at the last space before 40 and add "…"; if empty,
   "Odfotené strany".

## Files
Read: CLAUDE.md, apps/mobile/src/Library.tsx, apps/mobile/src/ui.tsx, apps/mobile/modules/text-scanner/index.ts,
packages/core/src/scan.ts, apps/mobile/src/ShareBook.tsx (import style).
Change only: apps/mobile/src/Library.tsx.

## Done when
From the repo root:
- `npx tsc --noEmit -p apps/mobile` prints nothing.
- `cd apps/mobile && npx expo export -p ios --output-dir C:/Users/Lucky/AppData/Local/Temp/claude/cf434df3e0317d1a/1b565ed8-cf1c-43de-9756-b5df75b8969b/scratchpad/ios-export`
  ends with a line starting `Exported:`.
- `npm test` still ends with `ℹ fail 0`.
- `git diff --stat` lists apps/mobile/src/Library.tsx as the only file this brief changed.
