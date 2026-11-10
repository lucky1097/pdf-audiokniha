// Apple AAC encoding through AVAudioFile. The native side runs off the main thread and keeps
// working while the app is in the background, so long books can be encoded and joined on the phone.
import { requireOptionalNativeModule, type EventSubscription } from "expo";

type NativeAudioEncoder = {
  encodeAac(input: string, output: string, bitrate: number): Promise<void>;
  joinAac(inputs: string[], output: string, bitrate: number): Promise<number[]>;
  addListener(
    event: "onJoinProgress",
    listener: (e: { done: number; total: number }) => void,
  ): EventSubscription;
};

// Null in Expo Go and in app builds made before this module existed.
const native = requireOptionalNativeModule<NativeAudioEncoder>("AudioEncoder");

export const aacAvailable: boolean = native != null;

function requireNative(): NativeAudioEncoder {
  if (!native) throw new Error("AAC encoder is not available in this build");
  return native;
}

/** Encodes one audio file (WAV or m4a) to AAC. `outputUri` should end in `.m4a`. */
export async function encodeAac(inputUri: string, outputUri: string, bitrate = 64000): Promise<void> {
  await requireNative().encodeAac(inputUri, outputUri, bitrate);
}

/** Joins AAC/WAV inputs, in order, into one .m4a. Resolves with the duration in seconds of each input. */
export async function joinAac(
  inputUris: string[],
  outputUri: string,
  bitrate = 64000,
  onProgress?: (done: number, total: number) => void,
): Promise<number[]> {
  const mod = requireNative();
  const sub = mod.addListener("onJoinProgress", (e) => onProgress?.(e.done, e.total));
  try {
    return await mod.joinAac(inputUris, outputUri, bitrate);
  } finally {
    sub.remove();
  }
}
