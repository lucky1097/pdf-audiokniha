import { useMemo, useState } from "react";
import { useStore } from "./hooks.ts";
import { generator } from "./lib/generator.ts";
import { player } from "./lib/player.ts";
import { chapterView, type ParagraphView, type Project, type Sentence } from "./lib/project.ts";
import { IconBack, IconChevronRight, IconPlay, IconRedo, IconText, Spinner } from "./ui/icons.tsx";
import type { UpdateBook } from "./useBook.ts";

export function ChapterEditor({ book, update, chapter, onBack, onChapter }: { book: Project; update: UpdateBook; chapter: number; onBack: () => void; onChapter: (c: number) => void }) {
  const [showSource, setShowSource] = useState(false);
  const views = useMemo(() => chapterView(book, chapter), [book, chapter]);
  const ch = book.chapters[chapter];

  const save = (paragraph: number, text: string) =>
    update((p) => ({
      ...p,
      chapters: p.chapters.map((c, ci) =>
        ci !== chapter ? c : paragraph < 0 ? { ...c, title: text.trim().replace(/\.$/, "") } : { ...c, paragraphs: c.paragraphs.map((t, pi) => (pi === paragraph ? text.trim() : t)).filter(Boolean) },
      ),
    }));

  return (
    <div className="page editor-page">
      <div className="editor-top">
        <button className="btn btn-quiet" onClick={onBack}><IconBack size={18} /> Kapitoly</button>
        <span className="editor-pos">Kapitola {chapter + 1} z {book.chapters.length}</span>
        <div className="row">
          <button className="btn btn-quiet" disabled={chapter === 0} onClick={() => onChapter(chapter - 1)} aria-label="Predchádzajúca kapitola"><IconBack size={18} /></button>
          <button className="btn btn-quiet" disabled={chapter >= book.chapters.length - 1} onClick={() => onChapter(chapter + 1)} aria-label="Ďalšia kapitola"><IconChevronRight size={18} /></button>
        </div>
      </div>

      <h1 className="page-title">{ch.title || `Kapitola ${chapter + 1}`}</h1>
      <div className="editor-help">
        <p>Takto hlas kapitolu prečíta. Čísla a skratky sú už prepísané na slová. Ak niečo znie zle, vetu vygeneruj znova alebo uprav text odseku.</p>
        <label className="switch">
          <input type="checkbox" checked={showSource} onChange={(e) => setShowSource(e.target.checked)} />
          <span aria-hidden="true" /> Ukázať, čo sa prepísalo
        </label>
      </div>

      <div className="paragraphs">
        {views.map((v) => (
          <Paragraph key={`${chapter}:${v.paragraph}`} book={book} chapter={chapter} view={v} showSource={showSource} onSave={(t) => save(v.paragraph, t)} title={v.paragraph < 0 ? ch.title : undefined} update={update} />
        ))}
      </div>
    </div>
  );
}

function Paragraph({ book, chapter, view, showSource, onSave, title, update }: { book: Project; chapter: number; view: ParagraphView; showSource: boolean; onSave: (t: string) => void; title?: string; update: UpdateBook }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const gen = useStore(generator);
  const play = useStore(player);
  const source = title ?? view.original;
  const uncertain = view.spans.filter((s) => !s.confident).length;

  const regenerate = (s: Sentence) => update((p) => ({ ...p, seeds: { ...p.seeds, [s.base]: s.seed + 1 } }));

  if (editing) {
    return (
      <div className={`para editing${view.paragraph < 0 ? " para-title" : ""}`}>
        <label className="sr-only" htmlFor={`edit-${chapter}-${view.paragraph}`}>{view.paragraph < 0 ? "Názov kapitoly" : "Text odseku"}</label>
        <textarea id={`edit-${chapter}-${view.paragraph}`} autoFocus value={draft} rows={Math.max(2, Math.ceil(draft.length / 80))} onChange={(e) => setDraft(e.target.value)} />
        <div className="row">
          <button className="btn btn-primary" onClick={() => { onSave(draft); setEditing(false); }}>Uložiť</button>
          <button className="btn btn-quiet" onClick={() => setEditing(false)}>Zrušiť</button>
          <span className="hint">Znova sa pripravia len zmenené vety.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`para${view.paragraph < 0 ? " para-title" : ""}`}>
      {showSource ? (
        <p className="source">
          {view.spans.map((s, i) =>
            s.kind === "text" ? <span key={i}>{s.spoken}</span> : (
              <mark key={i} className={s.confident ? "" : "unsure"} title={`V texte: ${s.original}`}>
                {s.spoken}
                <span className="sr-only"> (v texte: {s.original}{s.confident ? "" : ", odhad"})</span>
              </mark>
            ),
          )}
        </p>
      ) : (
        <ul className="sentences">
          {view.sentences.map((s) => {
            const ready = gen.done.has(s.key);
            const working = gen.current === s.key;
            const now = play.playing && play.chapter === chapter && play.sentence === s.index;
            return (
              <li key={s.key} className={`sentence${now ? " now" : ""}${ready ? " ready" : ""}`}>
                <button className="sentence-play" onClick={() => void player.playFrom(chapter, s.index)} aria-label={`Prehrať od vety: ${s.text.slice(0, 40)}`} aria-current={now ? "true" : undefined}>
                  <span className="sentence-dot" aria-hidden="true">{working ? <Spinner size={14} /> : <IconPlay size={14} />}</span>
                  <span className="sentence-text">{s.text}</span>
                </button>
                {ready && (
                  <button className="icon-btn sentence-redo" onClick={() => regenerate(s)} aria-label="Vygenerovať túto vetu znova" title="Vygenerovať znova">
                    <IconRedo size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="para-foot">
        {uncertain > 0 && <span className="tag tag-warn">{uncertain === 1 ? "1 odhad na kontrolu" : `${uncertain} odhady na kontrolu`}</span>}
        <button className="btn btn-quiet btn-small" onClick={() => { setDraft(source); setEditing(true); }}>
          <IconText size={16} /> {view.paragraph < 0 ? "Upraviť názov" : "Upraviť text"}
        </button>
      </div>
    </div>
  );
}
