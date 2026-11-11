# Progress

## Now
- 2026-11-11, not committed, not tested on the iPhone: first-run screen (approved on a mockup). Welcome with three
  steps and "Stiahnuť hlas" (the 380 MB voice downloads before the first book, screen kept awake), a download card
  with progress while books can be added, a "Hlas ešte nie je stiahnutý" card for users with books, an empty library
  with "Pridať PDF" / "Vložiť text". One shared download store in engine.ts; a book joins it (briefs J, K).
- Next (agreed order): sleep timer; App Store preparation; convert old WAV books to AAC; clean chapter titles from
  Safari PDFs; later "Otvoriť v Audiokniha" from Files/Mail, EPUB, OCR, Czech, Android.

## Done (latest first)
- 2026-11-10 book screen redesign (share button, "Vytvoriť audioknihu" card, chapter tap plays, per-chapter offline);
  build 11 confirmed on the iPhone.
- 2026-11-10 1fa9a7e: AAC sentences (native module), book size and delete, pronunciation dictionary, .m4b export; orchestrator setup.
- 2026-11-10 f45b28c: removed expo-audio preload (build 8 stopped after each sentence); retry for a sentence that does not start.
- 2026-11-09 dbbd508: footnotes after paragraphs, raised markers, drop caps, ft ligature; silence while waiting, outside-pause sync, resume mid-sentence.
- 2026-11-09 ab2e678: Safari PDF glyph repair; chapter view, word highlight; App Store line on the site.
- 2026-11-08: web live on GitHub Pages; TestFlight working (RTF ~0.28 on iPhone).
- Phases 0-4 and their reports: see PLAN.md.
