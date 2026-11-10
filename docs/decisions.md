# Decisions

Newest first. Each: date, decision, why.

- 2026-11-10 Book screen: "Vytvoriť audioknihu" means prepare the whole book (the user's words); sharing is a separate
  button next to the title. Tapping a chapter plays it and flows on into the next. Per-chapter offline preparation
  is a queue (project.queued) between the sentences ahead and the whole book.
- 2026-11-10 Time estimates use generation seconds per character, measured and saved per book (default 0.02 s).
- 2026-11-10 No icon library: the share icon is drawn with Views (ui.tsx ShareIcon).
- 2026-11-10 AAC on the iPhone is encoded natively (local Expo module, AVAudioFile), not in the WebView: WKWebView JS is
  suspended with the screen locked while generation keeps running, and some Safari 26.x builds write a wrong AAC
  decoder config into MP4.
- 2026-11-10 Chapter marks and iTunes tags are added in core (packages/core/src/mp4.ts) for both apps; it handles moov
  before or after mdat by shifting stco/co64 offsets.
- 2026-11-10 New sentences are encoded to <key>.tmp.m4a and moved into place, so the player never loads a half-written file.
- 2026-11-10 Briefs live in docs/briefs/; workers are Haiku subagents (.claude/agents/builder.md, reviewer.md).
- 2026-11-10 Each sentence is loaded by the player on its own; no expo-audio preload(). It broke playback after the first sentence.
- 2026-11-09 While waiting for a sentence the player loops 1 s of silence instead of pausing: a JS pause ends the
  iOS audio session and iOS then suspends the app (and the generation) in the background.
- 2026-11-09 Footnotes are small-text blocks anywhere on the page when the page has a marker or the block starts
  with its number; small text without either (captions, quotes) stays.
- 2026-11-09 Safari (Quartz) PDFs: broken glyphs are marked U+E000+code by an incremental PDF update; ligatures are
  restored with letter-trigram statistics; old-style digits and small caps cannot be recovered and are dropped.
- 2026-11-09 The glyph fix is bundled with rolldown (a vite dependency) for the mobile WebView; TypeScript 7 has no transpile API.
- 2026-11-08 iPhone: native Expo app, not Safari: the fp32 model crashes a Safari tab.
- 2026-11-08 Mobile voice: onnxruntime-react-native 1.24 running the same SupertonicEngine as the web; PDF via pdf.js in a hidden WebView.
- 2026-11-07 Voice: Supertonic 3 for SK and EN (no GPL, fast, OpenRAIL-M with AI labelling). Kokoro/Piper out.
- 2026-11-07 Everything on the device, no cloud GPU; MIT code; web + iOS via Expo/EAS (no Mac).
