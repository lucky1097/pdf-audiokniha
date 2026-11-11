# Known issues and gotchas

## Open
- The voice sometimes repeats or inserts words (~1 per 20 min of audio). Fix per sentence: "Vygenerovať znova" (seed+1).
- Safari-saved PDFs lose digits and small caps (e.g. "at 6:22", "BBC"); the original PDF is complete.
- The highlighted word is an estimate from letter counts and pauses, not real timing.
- Books generated before 2026-11-10 keep their .wav sentences (large) until "Zmazať zvuk"; there is no conversion pass.
- The .m4b export reads the whole joined file into JS memory (about 3x its size at the peak).
- A sentence whose generation always fails stops the queue at that sentence on every retry (no skip).
- The web app on iPhone Safari crashes loading the fp32 model; the iPhone app is the supported way.

## Gotchas
- expo-file-system's DownloadTask.downloadAsync rejects on a non-2xx HTTP status (FileSystemDownloadTask.swift), so a
  server error page is never moved into the model folder.
- The model download store snapshot is made once from modelDownloaded(); if a later feature deletes model files, it
  must reset the store too.
- BookController.estimate() checks one file per sentence: call it in a useMemo keyed on the ready count, never per render or per row.
- A cached export must be keyed by the sentence keys (ctl.keys()), not by counts: voice, language and seed change the audio.
- Agents in .claude/agents load only in a session whose working folder is this repo. From another folder, give a
  general-purpose subagent (model haiku) the agent file to read as its instructions.
- `tsc file.ts` on the command line needs `--ignoreConfig` here (TS 7 refuses to ignore the root tsconfig.json silently).
- The local Expo module cannot be compiled on Windows; the first EAS build is its first compile.
- expo-audio 58 iOS: JS pause() deactivates the audio session. Lock screen, AirPods, calls and route changes pause
  natively without telling JS; book.ts follows playbackStatusUpdate. Never use preload() + replace().
- onnxruntime-react-native 1.24 needs apps/mobile/scripts/patch-onnxruntime.mjs (RN 0.88 has no RCTCxxBridge).
- onnxruntime-web 1.30 webgpu loads ort-wasm-simd-threaded.asyncify.*; /ort/ files need COEP in dev.
- Cloudflare Pages is out: 25 MiB file limit < the 25.5 MiB asyncify wasm.
- git push to github.com uses ..\hitsnlicks\tools\bin\gh.exe as credential helper; workflow files need `gh auth login -s workflow`.
- Slovak Windows locale writes decimal commas; use InvariantCulture / explicit formatting in tools.
- Test books: Downloads\commanding-heights.pdf (original) and the Safari copy
  `C:\Users\Lucky\.claude\uploads\1b565ed8-cf1c-43de-9756-b5df75b8969b\9cea6b33-The_Commanding_Heights.pdf`.
  This book sets footnotes right after paragraphs, markers raised 0.41-0.45 em, and has drop caps.
