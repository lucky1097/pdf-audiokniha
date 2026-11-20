import ExpoModulesCore
import UIKit
import Vision
import VisionKit

// Photographs book pages and reads their text, all on the phone: the VisionKit document camera finds the page
// edges and flattens the page; Live Text (ImageAnalyzer) or Vision (VNRecognizeTextRequest) reads it.
// Nothing is sent anywhere. Page photos go to the cache folder and the app deletes them after reading.
public class TextScannerModule: Module {
  // The scanner's delegate must live until the user finishes or cancels.
  private var scanDelegate: ScanDelegate?

  public func definition() -> ModuleDefinition {
    Name("TextScanner")

    Function("isSupported") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    // Resolves with file URIs of the page photos, in order; an empty list when the user cancels.
    AsyncFunction("scanPages") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else {
        promise.reject("ScannerUnavailable", "This device cannot scan documents")
        return
      }
      guard self.scanDelegate == nil else {
        promise.reject("ScannerBusy", "The scanner is already open")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("NoViewController", "Nothing to show the scanner from")
        return
      }
      let scanner = VNDocumentCameraViewController()
      let delegate = ScanDelegate { [weak self, weak scanner] result in
        scanner?.dismiss(animated: true)
        self?.scanDelegate = nil
        switch result {
        case .success(let uris): promise.resolve(uris)
        case .failure(let error): promise.reject(error)
        }
      }
      self.scanDelegate = delegate
      scanner.delegate = delegate
      presenter.present(scanner, animated: true)
    }.runOnQueue(.main)

    // Lines of text on one page photo. engine "livetext" uses Live Text (the text you can select in Photos) and
    // gives lines without positions; "vision" gives each line with its box (0..1, origin top-left).
    AsyncFunction("recognizeText") { (uri: URL, engine: String, promise: Promise) in
      guard let image = UIImage(contentsOfFile: uri.path) else {
        promise.reject("ImageUnreadable", "Could not open the page photo")
        return
      }
      if engine == "livetext" && ImageAnalyzer.isSupported {
        Task { @MainActor in
          do {
            let analysis = try await ImageAnalyzer().analyze(image, configuration: ImageAnalyzer.Configuration([.text]))
            let lines = analysis.transcript
              .components(separatedBy: .newlines)
              .map { ["text": $0] as [String: Any] }
            promise.resolve(lines)
          } catch {
            promise.reject(error)
          }
        }
        return
      }
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try TextScannerModule.visionLines(image))
        } catch {
          promise.reject(error)
        }
      }
    }
  }

  private static func visionLines(_ image: UIImage) throws -> [[String: Any]] {
    guard let cgImage = image.cgImage else {
      throw Exception(name: "ImageUnreadable", description: "The page photo has no bitmap")
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    // Slovak is not in Vision's list; detection keeps the háčky and čiarky it can read instead of forcing English.
    request.automaticallyDetectsLanguage = true
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: cgOrientation(image.imageOrientation))
    try handler.perform([request])
    return (request.results ?? []).compactMap { observation in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      let b = observation.boundingBox  // normalised, origin bottom-left
      return [
        "text": text,
        "box": ["x": Double(b.minX), "y": Double(1 - b.maxY), "w": Double(b.width), "h": Double(b.height)],
      ]
    }
  }

  private static func cgOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}

private class ScanDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  private let done: (Result<[String], Error>) -> Void

  init(done: @escaping (Result<[String], Error>) -> Void) {
    self.done = done
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                    didFinishWith scan: VNDocumentCameraScan) {
    // Page images are large; write them off the main thread, then finish on it.
    let pages = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
    DispatchQueue.global(qos: .userInitiated).async {
      let dir = FileManager.default.temporaryDirectory
      let stamp = UUID().uuidString
      var uris: [String] = []
      for (i, page) in pages.enumerated() {
        guard let data = page.jpegData(compressionQuality: 0.85) else { continue }
        let url = dir.appendingPathComponent("scan-\(stamp)-\(i + 1).jpg")
        do {
          try data.write(to: url)
          uris.append(url.absoluteString)
        } catch {
          DispatchQueue.main.async { self.done(.failure(error)) }
          return
        }
      }
      DispatchQueue.main.async { self.done(.success(uris)) }
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    done(.success([]))
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    done(.failure(error))
  }
}
