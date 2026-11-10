# Progress

## Now
- 2026-11-10, not committed, not tested on the iPhone (needs a new TestFlight build; the native module is compiled there for the first time):
  - Sentences stored as AAC .m4a through a local Expo module (apps/mobile/modules/audio-encoder, AVAudioFile); old .wav files still play.
  - Book screen: "Zvuk knihy zaberá X MB", "Zmazať zvuk"; deleting a book now deletes its audio.
  - Pronunciation dictionary panel ("Výslovnosť").
  - "Audiokniha" card: whole book → .m4b with chapters, title and AI notice, then the iOS share sheet.
- Next: device test of all four; then sleep timer and App Store preparation (name, privacy URL, licences + AI notice screen, screenshots).

## Done (latest first)
- 2026-11-10 f45b28c: removed expo-audio preload (build 8 stopped after each sentence); retry for a sentence that does not start.
- 2026-11-09 dbbd508: footnotes after paragraphs, raised markers, drop caps, ft ligature; silence while waiting, outside-pause sync, resume mid-sentence.
- 2026-11-09 ab2e678: Safari PDF glyph repair; chapter view, word highlight; App Store line on the site.
- 2026-11-08: web live on GitHub Pages; TestFlight working (RTF ~0.28 on iPhone).
- Phases 0-4 and their reports: see PLAN.md.
