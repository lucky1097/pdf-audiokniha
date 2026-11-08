import { useEffect, useState } from "react";
import { BookView } from "./BookView.tsx";
import { ChapterEditor } from "./ChapterEditor.tsx";
import { Library } from "./Library.tsx";
import { MiniPlayer, PlayerPanel } from "./Player.tsx";
import { persistStorage } from "./lib/db.ts";
import { IconLibrary, IconPlus, IconShield } from "./ui/icons.tsx";
import { useBook } from "./useBook.ts";

type View = { kind: "library" } | { kind: "book" } | { kind: "chapter"; chapter: number };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function App() {
  const [openId, setOpenId] = useState<string | null>(() => read("open-book"));
  const [view, setView] = useState<View>(() => (read("open-book") ? { kind: "book" } : { kind: "library" }));
  const [sheet, setSheet] = useState(false);
  const { book, update } = useBook(openId);

  useEffect(() => void persistStorage(), []);
  useEffect(() => {
    try {
      if (openId) localStorage.setItem("open-book", openId);
      else localStorage.removeItem("open-book");
    } catch {
      // Private mode: the app works, it just forgets the open book.
    }
  }, [openId]);

  const open = (id: string) => {
    setOpenId(id);
    setView({ kind: "book" });
  };
  const toLibrary = () => setView({ kind: "library" });
  // Listening stays reachable from every screen, the library included.
  const showPlayer = !!book;

  return (
    <div className={`shell${showPlayer ? " with-player" : ""}`}>
      <aside className="sidebar">
        <div className="brand">Audiokniha</div>
        <nav aria-label="Hlavná navigácia">
          <button className={`nav-item${view.kind === "library" ? " active" : ""}`} onClick={toLibrary} aria-current={view.kind === "library" ? "page" : undefined}>
            <IconLibrary size={20} /> <span className="nav-label">Knižnica</span>
          </button>
          {book && (
            <button className={`nav-item nav-book${view.kind !== "library" ? " active" : ""}`} onClick={() => setView({ kind: "book" })} aria-current={view.kind !== "library" ? "page" : undefined}>
              <span className="nav-dot" aria-hidden="true" /> <span className="truncate">{book.title}</span>
            </button>
          )}
          <button className="nav-item" onClick={() => { toLibrary(); requestAnimationFrame(() => document.getElementById("file-input")?.click()); }}>
            <IconPlus size={20} /> <span className="nav-label">Pridať knihu</span>
          </button>
        </nav>
        <p className="privacy"><IconShield size={18} /> Hlas vzniká v tomto zariadení. Text ani zvuk sa nikam neposielajú.</p>
      </aside>

      <main className="main" id="main">
        {view.kind === "library" || !book ? (
          <Library onOpen={open} openId={openId} onDeleted={(id) => id === openId && setOpenId(null)} />
        ) : view.kind === "chapter" ? (
          <ChapterEditor book={book} update={update} chapter={view.chapter} onBack={() => setView({ kind: "book" })} onChapter={(c) => setView({ kind: "chapter", chapter: c })} />
        ) : (
          <BookView book={book} update={update} onOpenChapter={(c) => setView({ kind: "chapter", chapter: c })} />
        )}
      </main>

      {showPlayer && book && (
        <>
          <aside className="player-panel" aria-label="Prehrávač"><PlayerPanel book={book} /></aside>
          <MiniPlayer book={book} onExpand={() => setSheet(true)} />
          {sheet && (
            <div className="sheet" role="dialog" aria-modal="true" aria-label="Prehrávač">
              <PlayerPanel book={book} onClose={() => setSheet(false)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
