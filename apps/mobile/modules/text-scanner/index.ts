// Apple's document scanner and on-device text recognition (VisionKit, Live Text, Vision). Photos and text stay on
// the phone. The lines it returns go to textFromScan() in @audiokniha/core, which makes paragraphs and repairs
// the Slovak letters Apple misreads (ť, ľ, ď).
import { requireOptionalNativeModule } from "expo";
import type { ScanLine } from "@audiokniha/core";

type NativeTextScanner = {
  isSupported(): boolean;
  scanPages(): Promise<string[]>;
  recognizeText(uri: string, engine: ScanEngine): Promise<ScanLine[]>;
};

/** "livetext": the text you can select in Photos (lines only); "vision": lines with their position on the page. */
export type ScanEngine = "livetext" | "vision";

// Null in Expo Go and in app builds made before this module existed.
const native = requireOptionalNativeModule<NativeTextScanner>("TextScanner");

/** True when this build has the module and the phone can scan documents. */
export const scannerAvailable: boolean = native != null && native.isSupported();

function requireNative(): NativeTextScanner {
  if (!native) throw new Error("Text scanner is not available in this build");
  return native;
}

/** Opens the document camera. Resolves with the page photos' file URIs, in order; [] when the user cancels. */
export async function scanPages(): Promise<string[]> {
  return requireNative().scanPages();
}

/** Reads the text of one page photo. */
export async function recognizeText(uri: string, engine: ScanEngine = "livetext"): Promise<ScanLine[]> {
  return requireNative().recognizeText(uri, engine);
}
