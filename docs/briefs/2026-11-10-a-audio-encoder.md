# Brief A: native AAC encoder module for the iPhone app

## Goal
A local Expo module `AudioEncoder` in `apps/mobile/modules/audio-encoder/` that encodes on iOS with Apple's AAC
encoder (AVAudioFile), so the app can store sentences as .m4a (~11x smaller than WAV) and join them into one
audiobook file. It must work while the app is in the background (no WebView, no main-thread work).

## Files
Read: CLAUDE.md, docs/known-issues.md, apps/mobile/app.json, apps/mobile/src/lib/storage.ts (how file URIs look),
node_modules/expo-modules-core/ios (only if you need an API detail).
Create (and change nothing else):
- `apps/mobile/modules/audio-encoder/expo-module.config.json`
  `{ "platforms": ["apple"], "apple": { "modules": ["AudioEncoderModule"] } }`
- `apps/mobile/modules/audio-encoder/ios/AudioEncoder.podspec` — name 'AudioEncoder', version '1.0.0',
  platforms ios 17.0, `static_framework = true`, `dependency 'ExpoModulesCore'`, `source_files = "**/*.{h,m,swift}"`,
  source `{ git: '' }`, license 'MIT', author 'pdf-audiokniha', homepage 'https://github.com/lucky1097/pdf-audiokniha'.
- `apps/mobile/modules/audio-encoder/ios/AudioEncoderModule.swift`
- `apps/mobile/modules/audio-encoder/index.ts`

## Swift API (exact)
```swift
import AVFoundation
import ExpoModulesCore

public class AudioEncoderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioEncoder")
    Events("onJoinProgress")            // payload: ["done": Int, "total": Int]
    AsyncFunction("encodeAac") { (input: URL, output: URL, bitrate: Int) throws in ... }
    AsyncFunction("joinAac") { (inputs: [URL], output: URL, bitrate: Int) throws -> [Double] in ... } // seconds of each input
  }
}
```
- encodeAac: open `input` (any format AVAudioFile reads: WAV, m4a) for reading; delete `output` if it exists;
  open `output` for writing with settings `[AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: <input
  processingFormat.sampleRate>, AVNumberOfChannelsKey: <input channel count>, AVEncoderBitRateKey: bitrate]`,
  `commonFormat: .pcmFormatFloat32, interleaved: false`. Copy in buffers of 32768 frames until `framePosition >=
  length` or a read returns 0 frames. The output URL ends in `.m4a` (AVAudioFile picks the container from it).
- joinAac: same output settings, taken from the first input; every input must have the same sample rate and
  channel count, else throw an error that names the file. Copy all inputs in order into one output. After each
  input send `onJoinProgress` with done/total (send at most ~100 events in total: skip some when inputs > 100).
  Return the duration in seconds of each input, in order (frames written for it / sample rate).
- Both: the output AVAudioFile must be released (the file finalised) before the function returns. Deployment
  target is iOS 17, where `AVAudioFile.close()` does not exist: create and use the writer inside a `do { }` scope
  or a helper function so it is deallocated before returning. On any error delete the partial output, then rethrow.
- Comments in English, short, saying why.

## index.ts
```ts
import { requireOptionalNativeModule, type EventSubscription } from "expo";
```
Export:
- `aacAvailable: boolean` — false when the native module is missing (Expo Go, or an app build made before this module).
- `encodeAac(inputUri: string, outputUri: string, bitrate = 64000): Promise<void>`
- `joinAac(inputUris: string[], outputUri: string, bitrate = 64000, onProgress?: (done: number, total: number) => void): Promise<number[]>`
  (subscribe to "onJoinProgress" for the call, remove the subscription in `finally`).
Both throw a clear Error("AAC encoder is not available in this build") when the module is missing.
URIs are `file://` URIs as expo-file-system `File.uri` returns them.

## Done when
1. `cd apps/mobile && npx expo-modules-autolinking resolve -p apple` (if `apple` is rejected, `-p ios`) prints a
   module whose path ends in `modules/audio-encoder` with `AudioEncoderModule` listed.
2. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing (add the module's index.ts to the check by
   importing nothing new: if tsconfig does not include `modules/`, also run
   `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck apps/mobile/modules/audio-encoder/index.ts`
   and it prints nothing).
3. The Swift file matches the API above exactly (names, argument labels, event name). It cannot be compiled on
   Windows; say so in the report.
