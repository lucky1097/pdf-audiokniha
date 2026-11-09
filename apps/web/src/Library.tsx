import { detectLang } from "@audiokniha/core";
import { useEffect, useState } from "react";
import { db } from "./lib/db.ts";
import { clearDiag, diagLines, onDiag } from "./lib/diag.ts";
import { importPdf } from "./lib/pdf.ts";
import { chaptersFromText, newProject, type Project } from "./lib/project.ts";
import { Cover } from "./ui/Cover.tsx";
import { IconTrash, IconUpload, Spinner } from "./ui/icons.tsx";
import { bookProgress } from "./useBook.ts";

async function hasGpu(): Promise<boolean> {
  try {
    return !!(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter());
  } catch {
    return false;
  }
}

export function Library({ onOpen, openId, onDeleted }: { onOpen: (id: string) => void; openId: string | null; onDeleted: (id: string) => void }) {
  const [books, setBooks] = useState<Project[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const reload = () => void db.projects().then(setBooks);
  useEffect(reload, [openId]);

  async function create(title: string, chapters: { title: string; paragraphs: string[] }[], extra: Partial<Project> = {}) {
    if (!chapters.length) throw new Error("V súbore sa nenašiel žiadny text.");
    const sample = chapters.slice(0, 3).flatMap((c) => c.paragraphs).join(" ");
    const p = { ...newProject(title, detectLang(sample), chapters, await hasGpu()), ...extra };
    await db.saveProject(p);
    onOpen(p.id);
  }

  async function onFile(file: File) {
    setError(null);
    try {
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
        setBusy("Čítam PDF…");
        const pdf = await importPdf(file, (n, total) => setBusy(`Čítam PDF, strana ${n} z ${total}`));
        const chapters = pdf.book.chapters.filter((c) => c.paragraphs.length);
        if (!chapters.length && pdf.book.imageOnlyPages.length) {
          throw new Error("Toto PDF obsahuje len naskenované strany bez textu. Skeny zatiaľ čítať nevieme, skús PDF s textom.");
        }
        await create(pdf.title, chapters.map((c, i) => ({ title: c.title || `Kapitola ${i + 1}`, paragraphs: c.paragraphs })), {
          author: pdf.author || undefined,
          source: { file: file.name, pages: pdf.pageCount, imageOnlyPages: pdf.book.imageOnlyPages, garbledChars: pdf.book.removed.garbled },
        });
      } else {
        const text = await file.text();
        await create(file.name.replace(/\.[^.]+$/, ""), chaptersFromText(text, detectLang(text)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Project) {
    if (confirmDelete !== p.id) return setConfirmDelete(p.id);
    await db.deleteProject(p.id);
    setConfirmDelete(null);
    onDeleted(p.id);
    reload();
  }

  return (
    <div className="page">
      <h1 className="page-title">Knižnica</h1>

      <section
        className={`import${dragging ? " dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void onFile(f); }}
        aria-labelledby="import-title"
      >
        <div className="import-icon"><IconUpload size={28} /></div>
        <div className="import-text">
          <h2 id="import-title">Pridať knihu</h2>
          <p>Vyber PDF alebo textový súbor, prípadne ho sem pretiahni. Hlas ho prečíta po slovensky alebo po anglicky.</p>
        </div>
        <div className="import-actions">
          <label className="btn btn-primary">
            Vybrať súbor
            <input id="file-input" type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
          </label>
          <button className="btn btn-quiet" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>Vložiť text</button>
        </div>
        {busy && <p className="import-status" role="status"><Spinner /> {busy}</p>}
        {error && <p className="import-error" role="alert">{error}</p>}
        {pasteOpen && (
          <div className="paste">
            <label htmlFor="paste-text">Text knihy</label>
            <textarea id="paste-text" rows={7} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Odseky oddeľ prázdnym riadkom. Riadok „Kapitola …“ začne novú kapitolu." />
            <button className="btn btn-primary" disabled={!paste.trim()} onClick={() => void create("Vložený text", chaptersFromText(paste, detectLang(paste))).catch((e) => setError(String(e.message ?? e)))}>
              Vytvoriť knihu
            </button>
          </div>
        )}
      </section>

      {books && books.length > 0 && (
        <section aria-labelledby="books-title">
          <h2 id="books-title" className="section-title">Moje knihy</h2>
          <ul className="shelf">
            {books.map((b) => {
              const progress = bookProgress(b);
              return (
                <li key={b.id} className="book-card">
                  <button className="book-open" onClick={() => onOpen(b.id)}>
                    <Cover title={b.title} author={b.author} />
                    <span className="book-name">{b.title}</span>
                    <span className="book-meta">
                      {b.chapters.length} {b.chapters.length === 1 ? "kapitola" : b.chapters.length < 5 ? "kapitoly" : "kapitol"} · {b.lang === "sk" ? "slovensky" : "anglicky"}
                    </span>
                    <span className="bar" aria-label={`Vypočuté ${Math.round(progress * 100)} %`}><span style={{ width: `${progress * 100}%` }} /></span>
                  </button>
                  <button className={`btn-delete${confirmDelete === b.id ? " confirm" : ""}`} onClick={() => void remove(b)} aria-label={confirmDelete === b.id ? `Naozaj zmazať ${b.title}` : `Zmazať ${b.title}`} onBlur={() => setConfirmDelete(null)}>
                    <IconTrash size={18} />{confirmDelete === b.id && <span>Naozaj zmazať?</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {books && books.length === 0 && <p className="empty">Zatiaľ tu nie je žiadna kniha. Začni pridaním PDF.</p>}
      <About />
    </div>
  );
}

const BUILT = new Date(__BUILD_TIME__).toLocaleString("sk-SK", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Which build is running, and the diagnostics log (kept across a crash) for problems on a phone. */
function About() {
  const [lines, setLines] = useState(diagLines);
  useEffect(() => onDiag(setLines), []);
  return (
    <footer className="about">
      <p>Verzia {__APP_VERSION__} · zostavená {BUILT}</p>
      <details>
        <summary>Diagnostika ({lines.length})</summary>
        {lines.length > 0 ? <pre>{lines.join("\n")}</pre> : <p>Zatiaľ prázdna.</p>}
        {lines.length > 0 && <button className="btn btn-quiet" onClick={clearDiag}>Vymazať</button>}
      </details>
    </footer>
  );
}
