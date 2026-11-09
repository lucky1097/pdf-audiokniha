// Reads a PDF the same way as the web: pdf.js (embedded, works offline) runs in a hidden WebView and returns
// the text of every page with its position and size; packages/core then finds the chapters.
import { extractBook, type Book, type OutlineEntry, type PdfPage } from "@audiokniha/core";
import { useEffect, useRef, type ComponentType, type Ref } from "react";
import { View } from "react-native";
import { WebView as RNWebView } from "react-native-webview";
import { PDFJS_LIB, PDFJS_WORKER } from "./generated/pdfjs.ts";

// react-native-webview 14's platform typings resolve to `never` props against React Native 0.88's types;
// the props used here are typed by hand (the runtime component is unchanged).
interface WebViewHandle {
  injectJavaScript(js: string): void;
}
type WebViewMessageEvent = { nativeEvent: { data: string } };
const WebView = RNWebView as unknown as ComponentType<{
  ref?: Ref<WebViewHandle>;
  originWhitelist: string[];
  source: { html: string; baseUrl: string };
  injectedJavaScriptBeforeContentLoaded: string;
  onLoadEnd: () => void;
  onMessage: (e: WebViewMessageEvent) => void;
  javaScriptEnabled?: boolean;
}>;

export interface PdfResult {
  title: string;
  author: string;
  pageCount: number;
  book: Book;
}

// WebKit cannot iterate a ReadableStream with for-await. pdf.js does that when it decompresses fonts and
// other streams, and its fallback loses font character maps and the outline, so the iterator is added
// to the page and to the pdf.js worker. Same code as apps/web/src/lib/stream-iterator.ts.
const STREAM_ITERATOR = `
(function () {
  var proto = ReadableStream.prototype;
  if (typeof proto[Symbol.asyncIterator] === "function") return;
  var values = function (opts) {
    var preventCancel = !!(opts && opts.preventCancel);
    var reader = this.getReader();
    var it = {
      next: function () { return reader.read().then(function (r) { if (r.done) reader.releaseLock(); return r; }); },
      return: function (value) {
        var done = function () { reader.releaseLock(); return { done: true, value: value }; };
        return preventCancel ? Promise.resolve(done()) : reader.cancel(value).then(done);
      },
    };
    it[Symbol.asyncIterator] = function () { return it; };
    return it;
  };
  Object.defineProperty(proto, "values", { value: values, writable: true, configurable: true });
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
})();
`;

// Runs inside the WebView. Kept as plain JS (no TypeScript) since it is sent as text.
const READER = `
${STREAM_ITERATOR}
window.__read = async function (b64) {
  const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  try {
    const blobUrl = (src) => URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const pdfjs = await import(blobUrl(window.__PDFJS_LIB));
    pdfjs.GlobalWorkerOptions.workerSrc = blobUrl(window.__STREAM_ITERATOR + window.__PDFJS_WORKER);
    const bin = atob(b64);
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const task = pdfjs.getDocument({ data, verbosity: 0 });
    const doc = await task.promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      // Not page.getTextContent(): it reads a ReadableStream with for-await, which WebKit does not support.
      const reader = page.streamTextContent().getReader();
      const raw = [];
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        raw.push(...r.value.items);
      }
      const items = [];
      for (const it of raw) {
        if (!("str" in it)) continue;
        const [a, b, , d, e, f] = it.transform;
        items.push({ str: it.str, x: e, y: f, width: it.width, fontSize: Math.hypot(a, b) || Math.abs(d), font: it.fontName });
      }
      pages.push({ number: n, width: page.view[2] - page.view[0], height: page.view[3] - page.view[1], items });
      page.cleanup();
      post({ type: "page", n, total: doc.numPages });
    }
    const outline = [];
    for (const node of (await doc.getOutline()) || []) {
      try {
        const dest = typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
        if (dest && dest[0]) outline.push({ title: node.title, page: (await doc.getPageIndex(dest[0])) + 1 });
      } catch (e) {}
    }
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta && meta.info) || {};
    post({ type: "done", pages, outline, title: (info.Title || "").trim(), author: (info.Author || "").trim(), pageCount: doc.numPages });
    await task.destroy();
  } catch (e) {
    post({ type: "error", message: String((e && e.message) || e) });
  }
};
true;
`;

const SETUP = `window.__PDFJS_LIB = ${JSON.stringify(PDFJS_LIB)};\nwindow.__PDFJS_WORKER = ${JSON.stringify(PDFJS_WORKER)};\nwindow.__STREAM_ITERATOR = ${JSON.stringify(STREAM_ITERATOR)};\n${READER}`;

interface Props {
  /** The PDF as base64; a new value starts a new read. */
  base64: string;
  fileName: string;
  onPage: (n: number, total: number) => void;
  onDone: (r: PdfResult) => void;
  onError: (message: string) => void;
}

export function PdfReader({ base64, fileName, onPage, onDone, onError }: Props) {
  const web = useRef<WebViewHandle>(null);
  const loaded = useRef(false);

  const start = () => web.current?.injectJavaScript(`window.__read(${JSON.stringify(base64)}); true;`);

  useEffect(() => {
    if (loaded.current) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64]);

  function onMessage(e: WebViewMessageEvent) {
    const m = JSON.parse(e.nativeEvent.data) as
      | { type: "page"; n: number; total: number }
      | { type: "done"; pages: PdfPage[]; outline: OutlineEntry[]; title: string; author: string; pageCount: number }
      | { type: "error"; message: string };
    if (m.type === "page") onPage(m.n, m.total);
    else if (m.type === "error") onError(m.message);
    else {
      try {
        onDone({ title: m.title || fileName.replace(/\.pdf$/i, ""), author: m.author, pageCount: m.pageCount, book: extractBook(m.pages, m.outline) });
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  return (
    <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
      <WebView
        ref={web}
        originWhitelist={["*"]}
        // A real origin: module imports from blob: URLs are refused on an opaque (about:blank) page.
        source={{ html: "<!doctype html><meta charset='utf-8'><body></body>", baseUrl: "https://reader.audiokniha.local/" }}
        injectedJavaScriptBeforeContentLoaded={SETUP}
        onLoadEnd={() => {
          loaded.current = true;
          start();
        }}
        onMessage={onMessage}
        javaScriptEnabled
      />
    </View>
  );
}
