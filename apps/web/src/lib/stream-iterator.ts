// Safari (also the iPhone WebView) cannot iterate a ReadableStream with `for await`. pdf.js does that in
// getTextContent and when it decompresses fonts and other streams; without it Safari takes a fallback path
// that loses font character maps and the outline. Adding the iterator gives Safari the same path as Chrome.
// Keep in sync with STREAM_ITERATOR in apps/mobile/src/PdfReader.tsx.
interface Iterable {
  getReader(): ReadableStreamDefaultReader<unknown>;
}

const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;

if (typeof proto[Symbol.asyncIterator] !== "function") {
  const values = function (this: Iterable, { preventCancel = false } = {}) {
    const reader = this.getReader();
    return {
      async next() {
        const r = await reader.read();
        if (r.done) reader.releaseLock();
        return r;
      },
      async return(value?: unknown) {
        if (!preventCancel) await reader.cancel(value);
        reader.releaseLock();
        return { done: true, value };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
  Object.defineProperty(proto, "values", { value: values, writable: true, configurable: true });
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
}

export {};
