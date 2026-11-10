import AVFoundation
import ExpoModulesCore

public class AudioEncoderModule: Module {
  // Frames per read and write: keeps memory flat even for hours of audio.
  private static let chunkFrames: AVAudioFrameCount = 32768

  public func definition() -> ModuleDefinition {
    Name("AudioEncoder")
    Events("onJoinProgress")  // payload: ["done": Int, "total": Int]

    AsyncFunction("encodeAac") { (input: URL, output: URL, bitrate: Int) throws in
      _ = try AudioEncoderModule.encodeFiles(inputs: [input], output: output, bitrate: bitrate, onFileDone: nil)
    }

    AsyncFunction("joinAac") { (inputs: [URL], output: URL, bitrate: Int) throws -> [Double] in
      let total = inputs.count
      // About 100 progress events at most, so a book of many sentences does not flood the bridge.
      let step = max(1, total / 100)
      return try AudioEncoderModule.encodeFiles(inputs: inputs, output: output, bitrate: bitrate) { done in
        if done % step == 0 || done == total {
          self.sendEvent("onJoinProgress", ["done": done, "total": total])
        }
      }
    }
  }

  /// Writes all inputs, in order, into one AAC file. Returns the duration in seconds of each input.
  private static func encodeFiles(inputs: [URL], output: URL, bitrate: Int,
                                  onFileDone: ((Int) -> Void)?) throws -> [Double] {
    guard !inputs.isEmpty else {
      throw Exception(name: "EncoderError", description: "No input files")
    }
    try? FileManager.default.removeItem(at: output)
    do {
      return try writeAll(inputs: inputs, output: output, bitrate: bitrate, onFileDone: onFileDone)
    } catch {
      // A failed encode never leaves a broken .m4a behind.
      try? FileManager.default.removeItem(at: output)
      throw error
    }
  }

  /// The writer is a local of this function, so the file is finalised when it returns.
  /// AVAudioFile.close() does not exist on iOS 17, so do not rely on an explicit close.
  private static func writeAll(inputs: [URL], output: URL, bitrate: Int,
                               onFileDone: ((Int) -> Void)?) throws -> [Double] {
    let format = try AVAudioFile(forReading: inputs[0]).processingFormat
    let writer = try AVAudioFile(
      forWriting: output,
      settings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: format.sampleRate,
        AVNumberOfChannelsKey: format.channelCount,
        AVEncoderBitRateKey: bitrate,
      ],
      commonFormat: .pcmFormatFloat32,
      interleaved: false
    )

    var seconds: [Double] = []
    for (index, url) in inputs.enumerated() {
      let reader = try AVAudioFile(forReading: url)
      // AAC cannot change rate or channel count mid-file, so mismatched inputs are refused.
      guard reader.processingFormat.sampleRate == format.sampleRate,
            reader.processingFormat.channelCount == format.channelCount else {
        throw Exception(
          name: "EncoderError",
          description: "\(url.lastPathComponent) has a different sample rate or channel count than \(inputs[0].lastPathComponent)"
        )
      }
      let frames = try copy(reader, to: writer)
      seconds.append(Double(frames) / format.sampleRate)
      onFileDone?(index + 1)
    }
    return seconds
  }

  /// Copies every frame of `reader` into `writer`. Returns the number of frames copied.
  private static func copy(_ reader: AVAudioFile, to writer: AVAudioFile) throws -> AVAudioFramePosition {
    guard let buffer = AVAudioPCMBuffer(pcmFormat: reader.processingFormat, frameCapacity: chunkFrames) else {
      throw Exception(name: "EncoderError", description: "Cannot allocate an audio buffer")
    }
    var copied: AVAudioFramePosition = 0
    while reader.framePosition < reader.length {
      try reader.read(into: buffer, frameCount: chunkFrames)
      if buffer.frameLength == 0 { break }
      try writer.write(from: buffer)
      copied += AVAudioFramePosition(buffer.frameLength)
    }
    return copied
  }
}
