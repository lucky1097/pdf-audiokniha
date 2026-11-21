# Progress

## Now
- 2026-11-21: version 1.1.0 (build 17: photographed pages + háček repair) sent to App Review, status Waiting for Review, released automatically after approval. Store texts as in docs/app-store.md "Version 1.1". Privacy page updated for the camera.
- 2026-11-20, not committed: Slovak háček repair for scanned text (brief P): word list of 11,521 forms (119 KB) in
  packages/core/src/sk-words.ts, rule in fixSlovakLetters, apostrophe rule tightened (McDonald's, d'Italia stay),
  licences for Leipzig (CC BY 4.0) and hunspell-sk (MPL-2.0) in "O appke". 67 tests pass, iOS bundle exports.
  Commit c43c0f1 (scan feature, 1.1.0) is not pushed. Next: commit, a new TestFlight build, a test with real pages.
- 2026-11-20, not committed, not built: "Odfotiť stranu" parts 1-3 of 4. Native module apps/mobile/modules/text-scanner
  (VisionKit scanner + Live Text/Vision, Swift, not compiled: no Mac), camera permission text in app.json, core
  textFromScan/fixSlovakLetters with tests (brief N), Library: "Odfotiť stranu", review sheet "Skontroluj text"
  with "Odfotiť ďalšiu stranu" (brief O). Left: part 4 texts (O appke, version 1.1.0, App Store "Čo je nové"), then an EAS build and a test on the iPhone.
- 2026-11-15, not committed: launch films made with HyperFrames in video/launch (storylines A and C, each 16:9 and
  9:16; projects film-a, film-c, film-a-9x16, film-c-9x16; MP4s in video/launch/renders). Voice = the app's own F4,
  sound normalised to about -16 LUFS. No music yet. video/ is gitignored (local only).
- 2026-11-12, not committed: App Store release prep. App renamed "Prečítaj mi" (CFBundleDisplayName; expo.name stays "Audiokniha"; version 1.0.0); "O appke"
  screen (privacy, AI notice, OpenRAIL-M use restrictions as terms, licence texts generated on install); privacy.html
  and support.html on the site; store texts and review notes in
  docs/app-store.md. Support e-mail precitajmi.support@gmail.com. Left: screenshots, new build, App Store Connect form and "Submit for Review"
  (Lucky). Google Play later (no Android build yet; new Google accounts need 12 testers for 14 days).
- 2026-11-11 0ec0346, not tested on the iPhone: first-run screen (approved on a mockup). Welcome with three
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
