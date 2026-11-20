# Brief N: text from photographed pages (core)

## Goal
The iPhone app will photograph book pages and get their text from Apple's on-device text recognition (a native
module, written separately). That text arrives as lines, page by page. This brief adds the shared, platform-free
part in `packages/core`: turn those lines into clean paragraphs, and repair the Slovak letters Apple gets wrong
(ť, ľ, ď: it writes "t'", "l'", "d'" or drops the háček). Nothing here touches the app UI.

## API (new file `packages/core/src/scan.ts`, exported from `packages/core/src/index.ts`)

```ts
import type { Lang } from "./normalize/types.ts";

/** One recognised line. Box is normalised to the page (0..1, origin top-left); missing when the engine gives none. */
export interface ScanLine {
  text: string;
  box?: { x: number; y: number; w: number; h: number };
}

/** Pages of lines (in the order the engine gave them) → text with paragraphs separated by one blank line. */
export function textFromScan(pages: ScanLine[][], lang: Lang): string;

/** Slovak letter repair; returns the text unchanged for lang "en". */
export function fixSlovakLetters(text: string, lang: Lang): string;
```

`textFromScan` calls `fixSlovakLetters` on its result, so the app needs only `textFromScan`.

### textFromScan rules
1. Per page, drop empty lines (after trim). When lines have boxes, sort by `box.y` (ties by `box.x`); without
   boxes keep the given order.
2. Drop page furniture: a line that is only a page number (`/^[-–—\s]*\d{1,4}[-–—\s]*$/`) when it is the first or
   last line of the page.
3. Paragraph breaks, with boxes: a new paragraph starts when the vertical gap to the previous line's bottom is more
   than 0.8 × the page's median line height, or the line starts more than 1.5 × median height to the right of the
   page's most common left edge (an indent). Without boxes: a new paragraph starts after a line that ends with
   `.`, `!`, `?`, `…`, `“` or `"` and is shorter than 0.7 × the longest line of that page (in characters).
   A new page continues the last paragraph of the previous page unless that paragraph ended with `.`, `!`, `?`,
   `…`.
4. Joining lines inside a paragraph: if a line ends with a hyphen (`-`, `‐`, `¬`) directly after a letter and the
   next line starts with a lowercase letter, join without the hyphen and without a space ("rozprá-" + "vka" →
   "rozprávka"). Otherwise join with one space. Collapse runs of spaces.
5. Output: paragraphs joined with `"\n\n"`, no leading/trailing whitespace; then `fixSlovakLetters(out, lang)`.

### fixSlovakLetters rules (only when lang is "sk")
1. **Apostrophe forms.** Inside or at the end of a word, a `t`, `d`, `l`, `T`, `D`, `L` directly followed by an
   apostrophe (`'`, `’`, `` ` ``, `´`) becomes `ť`, `ď`, `ľ`, `Ť`, `Ď`, `Ľ` (apostrophe removed) when the
   character before the letter is a letter or the word start, and the character after the apostrophe is a
   letter, whitespace, end of text or one of `.,;:!?)“"`. Also `I'` and `|'` between two lowercase letters or
   at the end of a word after a lowercase letter become `ľ` (Apple reads ľ as capital I or a bar).
   Examples: `t'ažký`→`ťažký`, `l'udia`→`ľudia`, `byt'`→`byť`, `d'akujem`→`ďakujem`, `L'ubica`→`Ľubica`,
   `veI'mi`→`veľmi`. A quoted word `'ahoj'` must not change.
2. **Dropped háček.** For each word (`\p{L}+`) of 5 or more letters that has no ť/ľ/ď yet (short words such as
   "byt", "list", "let" are real words either way, so they are never changed): try every variant that turns one `t`
   into `ť` or one `l` into `ľ` (lowercase only; at most one change per word). Score words with the letter model
   already used by `glyphs.ts`: export its `score(word, lang)` function as `letterScore` (keep the old
   behaviour, only export it) and use it. Replace the word with the best variant only when
   `letterScore(variant) - letterScore(word) > THRESHOLD`. Choose THRESHOLD (a named constant with a comment) so
   that every test below passes; prefer leaving a word alone over a wrong change. Never special-case test words.
   If no single threshold passes both test 2 and test 3, stop and report the score differences you measured
   for each word of tests 2 and 3 that has a t or l.

## Round 2 decision (orchestrator, after the builder's measurements)
Rule 2 (dropped háček by letter score) is removed: the gains overlap (robit→robiť +1.13 but celkom→ceľkom +2.35,
Hotel→Hoteľ +0.13), so no threshold is safe. Only rule 1 (apostrophe and I'/|' forms) stays; the app's review
screen lets the user fix the rest. Remove rule 2 code, its THRESHOLD, test 2, and the `letterScore` export in
glyphs.ts (restore glyphs.ts exactly as it was). Keep test 3 (correct text unchanged) and all other tests.

## Files
Read: CLAUDE.md, packages/core/src/pdf/glyphs.ts, packages/core/src/index.ts, packages/core/src/normalize/types.ts,
packages/core/test/glyphs.test.ts (test style).
Change only: packages/core/src/scan.ts (new), packages/core/src/index.ts (exports), packages/core/src/pdf/glyphs.ts
(export `letterScore` only), packages/core/test/scan.test.ts (new).

## Tests (packages/core/test/scan.test.ts, node:test like the other suites)
1. Apostrophe forms: every example in rule 1 above, plus `'ahoj'` unchanged.
2. Dropped háček fixed: `robit`→`robiť`, `velmi`→`veľmi`, `niekolko`→`niekoľko`, `mat`→`mať` is NOT required
   (ambiguous); test only the first three.
3. No false changes: `fixSlovakLetters(CORRECT, "sk") === CORRECT` for this correct Slovak text:

   > Hotel stojí v centre mesta, celkom blízko stanice. Včera som si dobil telefón a mal som ešte čas na kávu.
   > Učiteľ povedal, že ťažké úlohy budeme robiť zajtra. Ľudia sa tešili na leto, lebo bolo teplo a dlho svetlo.
   > Na stole ležala kniha, list papiera a tri ceruzky. Ďalší deň sme išli do lesa, kde rástli malé stromy.
   > Tatiana študuje matematiku a fyziku, jej sestra hrá na klavíri. Byt mali na treťom poschodí, okná do dvora.
   > Pôjdeme spolu, keď to bude možné. Stálo to veľa peňazí, ale stálo to za to. Talent a vytrvalosť sú dôležité.

   (Write it as one string with the sentences separated by spaces.)
4. English untouched: `fixSlovakLetters("don't l'amour robit", "en")` returns the input.
5. textFromScan with boxes: two lines of one paragraph, then a third line after a gap of 2 × line height → two
   paragraphs; an indented line starts a paragraph; `"rozprá-"` + `"vka pokračuje"` joins to `"rozprávka pokračuje"`;
   a last line `"12"` is dropped.
6. textFromScan without boxes: `["Prvá veta je dlhá a pokračuje", "na ďalšom riadku.", "Krátko.", "Nový odsek začína tu"]`
   gives two paragraphs, the first ending with "Krátko.". (Adjust the example only if rule 3 says otherwise, and
   say so in the report.)
7. Page join: page 1 ends mid-sentence ("…a potom"), page 2 starts "prišiel domov." → one paragraph.

## Done when
From the repo root:
- `npm test` ends with `ℹ fail 0` and the output lists the scan tests.
- `npm run typecheck` prints nothing.
- `git status --short` shows only the four files above changed or added (plus this brief).
