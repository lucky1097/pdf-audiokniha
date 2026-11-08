// The pdf.js worker with the stream iterator for Safari installed first (imports run in order).
import { nativeStreamIterator } from "../lib/stream-iterator.ts";
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";

// pdf.js reports font and parsing problems on the worker's console, which a phone cannot show. They are
// passed to the page for the diagnostics log; pdf.js ignores messages that are not its own.
const send = (message: string) => (self as unknown as Worker).postMessage({ __diag: message });
for (const level of ["log", "warn", "error"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    original(...args);
    send(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  };
}
send(`worker: stream iterator ${nativeStreamIterator ? "native" : "polyfill"}`);
