import { extractBook, type Book, type OutlineEntry, type PdfPage } from "@audiokniha/core";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;

export interface ImportedPdf {
  title: string;
  author: string;
  pageCount: number;
  book: Book;
}

/** Read a PDF file into chapters with the same layout rules as the CLI. */
export async function importPdf(file: File, onPage?: (n: number, total: number) => void): Promise<ImportedPdf> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = [];
      for (const it of content.items) {
        if (!("str" in it)) continue;
        const [a, b, , d, e, f] = it.transform as number[];
        items.push({ str: it.str, x: e, y: f, width: it.width, fontSize: Math.hypot(a, b) || Math.abs(d) });
      }
      pages.push({ number: n, width: page.view[2] - page.view[0], height: page.view[3] - page.view[1], items });
      page.cleanup();
      onPage?.(n, doc.numPages);
    }
    const outline: OutlineEntry[] = [];
    for (const node of (await doc.getOutline()) ?? []) {
      try {
        const dest = typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
        if (dest?.[0]) outline.push({ title: node.title, page: (await doc.getPageIndex(dest[0])) + 1 });
      } catch {
        // An outline entry that points nowhere is skipped.
      }
    }
    const meta = (await doc.getMetadata().catch(() => null))?.info as { Title?: string; Author?: string } | undefined;
    return {
      title: meta?.Title?.trim() || file.name.replace(/\.pdf$/i, ""),
      author: meta?.Author?.trim() ?? "",
      pageCount: doc.numPages,
      book: extractBook(pages, outline),
    };
  } finally {
    await task.destroy();
  }
}
