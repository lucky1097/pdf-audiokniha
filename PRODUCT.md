# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(An iOS app via Expo/React Native is planned in phase 5 and will get its own platform record then. This record covers the web app in `apps/web`.)

## Users

- **Everyday listeners:** people who want to hear a book or PDF that has no audio version, for example while commuting, driving or doing sport. This includes the person who builds the app.
- **Students:** they listen to study materials, lecture notes and specialist texts.
- **People who find reading hard:** low vision, dyslexia and similar, for whom listening is easier than reading.

Most will use Slovak, some English.

## Product Purpose

The app turns any PDF (or plain text) into an audiobook that sounds like a person reading. Before listening, the user can fix the text: numbers, abbreviations, names, a sentence that came out badly. Success means dropping in a PDF and listening a few minutes later, without setting anything up.

## Positioning

- **Free and open source.** The code is MIT.
- **The voice runs on the user's own device.** It is generated in the browser (WebGPU, or WASM without a GPU) and later on iPhone. No server and no account are involved, so nothing about the book leaves the device.
- **Slovak is a first-class language.** That covers number and date reading with grammatical case, and abbreviations. Most free TTS tools skip this.

## Operating Context

The workflow:
1. Import a PDF or text.
2. Check the chapters.
3. Generate (it runs in the background and resumes after a reload).
4. Listen in the app, with speed control and the position remembered.
5. Optionally export an `.m4b` with chapters.

Generating a whole book takes a while. On a GPU it is about 5 minutes per hour of audio, and on CPU it can be slower than real time, so progress and "listen while it generates" matter.

## Capabilities and Constraints

- **Voice:** Supertonic 3 (OpenRAIL-M). There are 10 voices: F1–F5 and M1–M5. F4 is the default, because it was the most stable in tests.
- **Languages:** Slovak and English.
- **First run:** the model is about 380 MB, downloaded once and cached.
- **The editor works per sentence:**
  - play from any sentence,
  - "generate again" for one sentence, which fixes the rare repeated word,
  - a "how it will be read" preview that highlights normalized numbers and uncertain guesses,
  - a pronunciation dictionary.
- **Quality setting:** 8 or 16 steps. 16 is slower but makes fewer mistakes.
- **Licence obligation:** generated audio must be labelled as AI-generated when published. The app says so and writes it into exports.
- **Scanned PDFs** (image-only pages) are detected but not yet read, because OCR is not built yet.
- **Undecided:** the product name (working title "Audiokniha"), hosting, and how stored audio will be compressed.

## Brand Commitments

- The visual approach is **the category standard, executed at full craft.** The user chose it over distinctive directions on 2026-11-08, so the app looks and behaves like a well-made audiobook app.
- The quality bar is **Audible** and **BookPlayer** (the open-source iOS audiobook player).
- It must not borrow the visual identity of the author's other project (Hits & Licks, black noir).

## Evidence on Hand

- **What exists:** real measurements and listening samples from the phase 0–1 reports (`spike/phase0/REPORT.md`, `spike/phase1/REPORT.md`) and test PDFs in `apps/cli/test/fixtures`.
- **What does not:** users, testimonials, ratings or download numbers. Do not invent any.

## Product Principles

1. **Drop a PDF, press play.** Every setting has a good default and lives out of the way.
2. **Nothing leaves the device**, and the app says so plainly where it matters.
3. **The text is fixable.** When the voice misreads something, the fix is one click away, at the sentence where it happened.
4. **Listening comes first.** Playback and progress stay reachable from every screen, on a phone too.
5. **Be honest about time and space:** how long generation takes, how much storage a book uses, and that the voice is AI.

## Accessibility & Inclusion

Some users have low vision or dyslexia. Required:

- large readable text and generous tap targets,
- full keyboard and screen-reader support for the player and editor,
- WCAG 2.2 AA contrast in light and dark,
- respect for reduced motion.
