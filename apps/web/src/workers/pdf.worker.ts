// The pdf.js worker with the stream iterator for Safari installed first (imports run in order).
import "../lib/stream-iterator.ts";
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
