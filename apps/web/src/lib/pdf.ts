import { extractBook, type Book, type OutlineEntry, type PdfPage } from "@audiokniha/core";
// The legacy build: the default one assumes the newest browser features (Map.getOrInsertComputed,
// Math.sumPrecise…) that Safari on the iPhone does not have yet; legacy ships polyfills for them.
import { GlobalWorkerOptions, getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { diag } from "./diag.ts";
import { nativeStreamIterator } from "./stream-iterator.ts";

/** Our own worker entry: the pdf.js worker with the Safari stream iterator installed first. pdf.js keeps
    a worker given as a port alive between documents, so it is created once. */
function ensureWorker() {
  if (GlobalWorkerOptions.workerPort) return;
  const worker = new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (e: MessageEvent<{ __diag?: string }>) => {
    if (typeof e.data?.__diag === "string") diag(`pdf.js ${e.data.__diag}`);
  });
  worker.addEventListener("error", (e) => diag(`pdf.js worker error: ${e.message}`));
  GlobalWorkerOptions.workerPort = worker;
}

type TextItem = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>["items"][number];

/** page.getTextContent() reads its stream with `for await`, which Safari's ReadableStream does not support
    ("undefined is not a function (near '...e of t...')"); reading the stream by hand works everywhere. */
async function textItems(page: PDFPageProxy): Promise<TextItem[]> {
  const reader = page.streamTextContent().getReader();
  const items: TextItem[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return items;
    items.push(...(value as { items: TextItem[] }).items);
  }
}

export interface ImportedPdf {
  title: string;
  author: string;
  pageCount: number;
  book: Book;
}

/** Read a PDF file into chapters with the same layout rules as the CLI. */
export async function importPdf(file: File, onPage?: (n: number, total: number) => void): Promise<ImportedPdf> {
  diag(`pdf: ${file.name}, ${Math.round(file.size / 1024)} KB, stream iterator on page ${nativeStreamIterator ? "native" : "polyfill"}`);
  ensureWorker();
  // Warnings on: they go to the diagnostics log (font and outline problems show up there).
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 1 });
  const doc = await task.promise;
  try {
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const items = [];
      for (const it of await textItems(page)) {
        if (!("str" in it)) continue;
        const [a, b, , d, e, f] = it.transform as number[];
        items.push({ str: it.str, x: e, y: f, width: it.width, fontSize: Math.hypot(a, b) || Math.abs(d) });
      }
      pages.push({ number: n, width: page.view[2] - page.view[0], height: page.view[3] - page.view[1], items });
      page.cleanup();
      onPage?.(n, doc.numPages);
    }
    const outline: OutlineEntry[] = [];
    const nodes = (await doc.getOutline().catch((e: unknown) => (diag(`pdf: outline failed: ${String(e)}`), null))) ?? [];
    let skipped = "";
    for (const node of nodes) {
      try {
        const dest = typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
        if (dest?.[0]) outline.push({ title: node.title, page: (await doc.getPageIndex(dest[0])) + 1 });
        else skipped ||= `"${node.title}": no destination (${JSON.stringify(node.dest)?.slice(0, 60)})`;
      } catch (e) {
        // An outline entry that points nowhere is skipped.
        skipped ||= `"${node.title}": ${String(e)}`;
      }
    }
    const meta = (await doc.getMetadata().catch(() => null))?.info as { Title?: string; Author?: string } | undefined;
    const book = extractBook(pages, outline);
    const sample = pages.find((p) => p.items.some((i) => i.str.trim().length > 3))?.items.map((i) => i.str).join(" ").slice(0, 120) ?? "";
    diag(`pdf: ${doc.numPages} pages, outline ${outline.length} of ${nodes.length}${skipped ? `, first skipped ${skipped}` : ""}`);
    diag(`pdf: chapters ${book.chapters.length}: ${book.chapters.slice(0, 4).map((c) => c.title).join(" | ").slice(0, 160)}`);
    diag(`pdf: text sample: ${sample}`);
    return {
      title: meta?.Title?.trim() || file.name.replace(/\.pdf$/i, ""),
      author: meta?.Author?.trim() ?? "",
      pageCount: doc.numPages,
      book,
    };
  } finally {
    await task.destroy();
  }
}
