# PDF → audiokniha

A free, open-source app (MIT) that turns a PDF into an audiobook in Slovak or English. The voice (Supertonic 3,
OpenRAIL-M) runs on the user's own device; nothing is sent to a server. Two apps share one core:
- Web: https://lucky1097.github.io/pdf-audiokniha/ (app at /app/), deployed by GitHub Pages on every push to main.
- iPhone: Expo/EAS app, distributed through TestFlight; App Store release is the current goal.
The full plan and phase history is in PLAN.md (Slovak). UI text is Slovak; code and comments are English.

## How this project is worked on: orchestrator and workers

- The main session is the orchestrator. It plans, writes briefs, and checks results. It does not do bulk work
  (writing a feature, mass edits, long investigations) itself when a worker can do it.
- Workers are subagents on Haiku: `builder` (.claude/agents/builder.md) writes code to a brief;
  `reviewer` (.claude/agents/reviewer.md) reads a diff against a brief and lists what fails it.
- Every brief states: the goal, the files to read (and the only files it may change), and a "Done when:" check that
  can be run or seen (a command and its expected output, or a file/line that must exist).
- Before accepting a worker's output, the orchestrator runs the brief's check itself. If it fails, the work goes
  back to the worker with the failure output. A worker's report is never passed on to the user unchecked.
- Sessions for this project run with the working folder `C:\Users\Lucky\Documents\pdf-audiokniha`, so the
  agents in .claude/agents and the reflect skill load.
- Start of every session: read CLAUDE.md, docs/progress.md, docs/decisions.md, docs/known-issues.md.
- End of every session: update docs/progress.md, add new decisions and gotchas, then run the `reflect` skill and
  propose skill/CLAUDE.md edits with evidence from the session. The user approves them before they are applied.

## Rules

- Commit and push only when the user asks. Never skip hooks. End commit messages with the Co-Authored-By line.
- The user runs logins (eas, gh, Apple) and EAS builds themselves; never type passwords or tokens.
- Do not edit node_modules by hand. Native library fixes go in apps/mobile/scripts/patch-*.mjs (run on postinstall).
- Nothing on iPhone can be tested from this PC. Mobile changes are checked by typecheck + iOS Metro bundle; say
  plainly that the device test is the user's (new TestFlight build: `eas.cmd build -p ios --profile production --auto-submit` in apps\mobile).
- PDF layout changes must be checked on both test books (see docs/known-issues.md) and get a case in
  packages/core/test/layout.test.ts.
- No GPL code in the iOS build. Generated audio is labelled as AI (OpenRAIL-M requires it).

## Checks

| What | Command (from the repo root) | Passes when |
|---|---|---|
| Tests | `npm test` | `ℹ fail 0` |
| Types (core, web, cli) | `npm run typecheck` | no output |
| Types (mobile) | `npx tsc --noEmit -p apps/mobile` | no output |
| iOS bundle | `cd apps/mobile && npx expo export -p ios --output-dir <scratch dir>` | ends with `Exported:` |
| Web build | `npm run build:site -w @audiokniha/web` | exits 0 |
| Deploy | after a push: `gh run list -L 1` (gh is at ..\hitsnlicks\tools\bin\gh.exe) | `success` |

## Folder map

- `packages/core/` shared logic, no platform code
  - `src/pdf/` layout.ts (lines, columns, footnotes, drop caps, chapters), tounicode.ts + glyphs.ts (Safari PDF repair), letter-stats.ts (generated)
  - `src/normalize/` numbers, abbreviations → spoken text (sk, en); `segment.ts` sentences; `words.ts` word timing estimate
  - `src/project.ts` book model: chapters, sentences, cache keys, seeds, WAV writing, gaps
  - `test/` node:test suites
- `packages/tts/` SupertonicEngine (ONNX), same on web and mobile
- `apps/web/` Vite + React web app (`src/workers/` voice in a worker, `src/lib/` pdf, storage, export)
- `apps/site/` promo page (static HTML); the web app is built into `apps/site/app` (gitignored)
- `apps/mobile/` Expo app
  - `src/lib/book.ts` generation queue + player (expo-audio); `engine.ts` model download + voice; `storage.ts` files
  - `src/ReadAlong.tsx`, `BookScreen.tsx`, `Library.tsx`, `PlayerBar.tsx`, `PdfReader.tsx` (pdf.js in a hidden WebView)
  - `scripts/` postinstall: onnxruntime patch, pdf.js + glyph-fix embed (`src/generated/`)
- `apps/cli/` Node CLI: `book <pdf> --out <dir>` → chapter WAVs + .m4b (needs tools/ffmpeg)
- `spike/` phase 0-2 experiments and reports; `spike/phase0/models` holds the voice model (gitignored)
- `tools/` build-letter-stats.mjs; ffmpeg/ (gitignored, user-installed)
- `.github/workflows/pages.yml` test + build + deploy
- `PLAN.md` plan and status · `DESIGN.md`, `PRODUCT.md`, `.impeccable/` design system
- `docs/` progress.md, decisions.md, known-issues.md
