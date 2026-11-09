import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { OutlineEntry, PdfPage } from "@audiokniha/core";

/** Read a PDF into positioned text runs (pdf.js) plus its outline, for core's extractBook(). */
export async function readPdf(path: string): Promise<{ pages: PdfPage[]; outline: OutlineEntry[]; title: string }> {
  const data = new Uint8Array(await readFile(path));
  const task = getDocument({ data, useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const view = page.view;
    const content = await page.getTextContent();
    const items = [];
    for (const it of content.items) {
      if (!("str" in it)) continue;
      const [a, b, , d, e, f] = it.transform as number[];
      items.push({ str: it.str, x: e, y: f, width: it.width, fontSize: Math.hypot(a, b) || Math.abs(d), font: it.fontName });
    }
    pages.push({ number: n, width: view[2] - view[0], height: view[3] - view[1], items });
  }
  const outline: OutlineEntry[] = [];
  const walk = async (nodes: Awaited<ReturnType<typeof doc.getOutline>> | null) => {
    for (const node of nodes ?? []) {
      try {
        const dest = typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
        if (dest?.[0]) outline.push({ title: node.title, page: (await doc.getPageIndex(dest[0])) + 1 });
      } catch {
        // Outline entries pointing nowhere are skipped.
      }
      // Only top-level entries become chapters; sections inside chapters stay in the text.
    }
  };
  await walk(await doc.getOutline());
  const meta = await doc.getMetadata().catch(() => null);
  const title = (meta?.info as { Title?: string } | undefined)?.Title ?? "";
  await task.destroy();
  return { pages, outline, title };
}
