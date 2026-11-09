import { VOICES, type Voice } from "@audiokniha/tts";
import { useEffect, useMemo, useState } from "react";
import { PlayButton } from "./Player.tsx";
import { formatDuration, useStore } from "./hooks.ts";
import { AI_NOTICE, exportBook } from "./lib/export.ts";
import { generator } from "./lib/generator.ts";
import { player } from "./lib/player.ts";
import { GARBLED_NOTE, chapterSentences, wavBlob, type Project } from "./lib/project.ts";
import { MODEL_BYTES, tts } from "./lib/tts-client.ts";
import { Cover } from "./ui/Cover.tsx";
import { IconCheck, IconChevronRight, IconDownload, IconSpeaker, IconStop, IconText, Spinner } from "./ui/icons.tsx";
import { CHARS_PER_SECOND, chapterChars, type UpdateBook } from "./useBook.ts";

type Tab = "chapters" | "voice" | "dictionary" | "export";
const TABS: [Tab, string][] = [["chapters", "Kapitoly"], ["voice", "Hlas"], ["dictionary", "Výslovnosť"], ["export", "Export"]];

const VOICE_NAMES: Record<Voice, string> = {
  F1: "Ženský hlas 1", F2: "Ženský hlas 2", F3: "Ženský hlas 3", F4: "Ženský hlas 4", F5: "Ženský hlas 5",
  M1: "Mužský hlas 1", M2: "Mužský hlas 2", M3: "Mužský hlas 3", M4: "Mužský hlas 4", M5: "Mužský hlas 5",
};

export function useChapterProgress(book: Project) {
  const gen = useStore(generator);
  return useMemo(
    () =>
      book.chapters.map((_, c) => {
        const all = chapterSentences(book, c);
        return { done: all.filter((s) => gen.done.has(s.key)).length, total: all.length };
      }),
    [book, gen.done],
  );
}

export function BookView({ book, update, onOpenChapter }: { book: Project; update: UpdateBook; onOpenChapter: (c: number) => void }) {
  const [tab, setTab] = useState<Tab>("chapters");
  const progress = useChapterProgress(book);
  const seconds = book.chapters.reduce((n, _, c) => n + chapterChars(book, c), 0) / CHARS_PER_SECOND;
  const resume = book.position.chapter > 0 || book.position.segment > 0;
  const posChapter = book.chapters[book.position.chapter];

  return (
    <div className="page">
      <header className="book-head">
        <Cover title={book.title} author={book.author} size="l" />
        <div className="book-head-text">
          <h1 className="book-title">{book.title}</h1>
          {book.author && <p className="book-author">{book.author}</p>}
          <p className="book-facts">
            {book.chapters.length} {book.chapters.length < 5 && book.chapters.length > 1 ? "kapitoly" : book.chapters.length === 1 ? "kapitola" : "kapitol"} · asi {formatDuration(seconds)} · {VOICE_NAMES[book.voice]} · {book.lang === "sk" ? "slovenčina" : "angličtina"}
          </p>
          <div className="book-actions">
            <PlayButton book={book} />
            <span className="resume">{resume ? <>Pokračovať: <strong>{posChapter?.title}</strong></> : "Počúvať od začiatku"}</span>
          </div>
          <Generation book={book} update={update} progress={progress} seconds={seconds} />
          {book.source?.imageOnlyPages.length ? (
            <p className="note-warn">{book.source.imageOnlyPages.length} strán PDF je len naskenovaný obrázok, ich text v knihe chýba.</p>
          ) : null}
          {book.source?.garbledChars ? <p className="note-warn">{GARBLED_NOTE}</p> : null}
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Časti knihy">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className="tab" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === "chapters" && <Chapters book={book} progress={progress} onOpenChapter={onOpenChapter} />}
        {tab === "voice" && <VoiceSettings book={book} update={update} />}
        {tab === "dictionary" && <Dictionary book={book} update={update} />}
        {tab === "export" && <Export book={book} progress={progress} />}
      </section>
    </div>
  );
}

function Generation({ book, update, progress, seconds }: { book: Project; update: UpdateBook; progress: { done: number; total: number }[]; seconds: number }) {
  const gen = useStore(generator);
  const model = useStore(tts);
  const done = progress.reduce((n, p) => n + p.done, 0);
  const total = progress.reduce((n, p) => n + p.total, 0);
  const running = gen.scope.kind === "book";
  const pct = total ? done / total : 0;
  const eta = gen.rtf ? (1 - pct) * seconds * gen.rtf : null;

  const set = (on: boolean) => {
    update((p) => ({ ...p, generating: on }));
    if (on) {
      void tts.load().catch(() => {});
      generator.start({ kind: "book" });
    } else generator.stop();
  };

  let status: string;
  if (done === total) status = "Celá kniha je pripravená na počúvanie aj bez pripojenia.";
  else if (model.status === "loading") status = `Sťahujem hlasový model, ${Math.min(100, Math.round((model.bytes / MODEL_BYTES) * 100))} %. Stiahne sa len raz.`;
  else if (running) status = eta ? `Pripravujem hlas, zostáva asi ${formatDuration(eta)}` : "Pripravujem hlas…";
  else status = `Pripravených ${Math.round(pct * 100)} %. Zvyšok sa dopripraví počas počúvania, alebo celú knihu naraz.`;

  return (
    <div className="gen" aria-live="polite">
      <div className="gen-row">
        <span className="gen-status">{running && done < total ? <Spinner /> : done === total ? <IconCheck size={18} /> : null} {status}</span>
        {done < total && (running
          ? <button className="btn btn-quiet" onClick={() => set(false)}><IconStop size={16} /> Zastaviť</button>
          : <button className="btn btn-quiet" onClick={() => set(true)}>Pripraviť celú knihu</button>)}
      </div>
      <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Pripravené"><span style={{ width: `${pct * 100}%` }} /></span>
      {gen.error && <p className="note-error" role="alert">Hlas sa nepodarilo pripraviť: {gen.error}. Skús obnoviť stránku.</p>}
      {model.status === "error" && <p className="note-error" role="alert">Hlasový model sa nepodarilo stiahnuť: {model.error}. Skontroluj pripojenie a skús znova.</p>}
    </div>
  );
}

function Chapters({ book, progress, onOpenChapter }: { book: Project; progress: { done: number; total: number }[]; onOpenChapter: (c: number) => void }) {
  const play = useStore(player);
  return (
    <ol className="chapter-list">
      {book.chapters.map((ch, i) => {
        const pr = progress[i];
        const current = play.chapter === i;
        return (
          <li key={ch.id} className={`chapter-row${current ? " current" : ""}`}>
            <button className="chapter-play" onClick={() => void player.playFrom(i, 0)} aria-label={`Prehrať ${ch.title || `kapitolu ${i + 1}`} od začiatku`}>
              <span className="chapter-no">{i + 1}</span>
              <span className="chapter-name">{ch.title || `Kapitola ${i + 1}`}</span>
              <span className="chapter-len">{formatDuration(chapterChars(book, i) / CHARS_PER_SECOND)}</span>
              <span className="chapter-state">
                {pr.done === pr.total ? <><IconCheck size={16} /> Pripravená</> : pr.done ? `${pr.done} z ${pr.total} viet` : "Čaká"}
              </span>
            </button>
            <button className="btn btn-quiet chapter-text" onClick={() => onOpenChapter(i)}>
              <IconText size={18} /> Text <IconChevronRight size={16} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function VoiceSettings({ book, update }: { book: Project; update: UpdateBook }) {
  const [previewing, setPreviewing] = useState<Voice | null>(null);
  const [audio] = useState(() => new Audio());
  useEffect(() => () => audio.pause(), [audio]);

  async function preview(v: Voice) {
    setPreviewing(v);
    try {
      const text = book.lang === "sk" ? "Dobrý deň, takto budem čítať vašu knihu." : "Hello, this is how I will read your book.";
      const pcm = await tts.synthesize(`preview-${v}-${Date.now()}`, text, book.lang, v, book.steps, 1);
      audio.src = URL.createObjectURL(wavBlob(pcm, tts.state.sampleRate ?? 44100, 0));
      await audio.play();
    } finally {
      setPreviewing(null);
    }
  }

  return (
    <div className="settings">
      <fieldset className="field">
        <legend>Jazyk knihy</legend>
        <div className="segmented">
          {(["sk", "en"] as const).map((l) => (
            <label key={l} className={book.lang === l ? "on" : ""}>
              <input type="radio" name="lang" value={l} checked={book.lang === l} onChange={() => update((p) => ({ ...p, lang: l }))} className="sr-only" />
              {l === "sk" ? "Slovenčina" : "Angličtina"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Hlas</legend>
        <p className="hint">Ženský hlas 4 sa v testoch najmenej mýlil. Zmena hlasu znamená, že sa kniha pripraví znova.</p>
        <ul className="voice-list">
          {VOICES.map((v) => (
            <li key={v} className={book.voice === v ? "on" : ""}>
              <label>
                <input type="radio" name="voice" value={v} checked={book.voice === v} onChange={() => update((p) => ({ ...p, voice: v }))} />
                {VOICE_NAMES[v]}
                {v === "F4" && <span className="tag">odporúčaný</span>}
              </label>
              <button className="icon-btn" onClick={() => void preview(v)} disabled={previewing !== null} aria-label={`Vypočuť ukážku: ${VOICE_NAMES[v]}`}>
                {previewing === v ? <Spinner /> : <IconSpeaker size={20} />}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="field">
        <legend>Kvalita</legend>
        <div className="segmented">
          {[[8, "Rýchla"], [16, "Vyššia"]].map(([n, label]) => (
            <label key={n} className={book.steps === n ? "on" : ""}>
              <input type="radio" name="steps" value={n} checked={book.steps === n} onChange={() => update((p) => ({ ...p, steps: Number(n) }))} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        <p className="hint">Vyššia kvalita sa menej mýli, ale pripravuje sa asi dvakrát dlhšie.</p>
      </fieldset>
    </div>
  );
}

function Dictionary({ book, update }: { book: Project; update: UpdateBook }) {
  const [word, setWord] = useState("");
  const [say, setSay] = useState("");
  const entries = Object.entries(book.dictionary);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !say.trim()) return;
    update((p) => ({ ...p, dictionary: { ...p.dictionary, [word.trim()]: say.trim() } }));
    setWord("");
    setSay("");
  };
  return (
    <div className="settings">
      <p className="hint">Mená a slová, ktoré hlas číta zle, napíš tak, ako sa vyslovujú. Platí to pre celú knihu a znova sa pripravia len dotknuté vety.</p>
      <form className="dict-form" onSubmit={add}>
        <label>V texte<input id="dict-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Didolićová" /></label>
        <label>Čítať ako<input id="dict-say" value={say} onChange={(e) => setSay(e.target.value)} placeholder="Didoličová" /></label>
        <button className="btn btn-primary" type="submit" disabled={!word.trim() || !say.trim()}>Pridať</button>
      </form>
      {entries.length ? (
        <ul className="dict-list">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span><strong>{k}</strong> → {v}</span>
              <button className="btn btn-quiet" onClick={() => update((p) => { const d = { ...p.dictionary }; delete d[k]; return { ...p, dictionary: d }; })}>Odstrániť</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Zatiaľ žiadne slová.</p>
      )}
    </div>
  );
}

function Export({ book, progress }: { book: Project; progress: { done: number; total: number }[] }) {
  const missing = progress.reduce((n, p) => n + p.total - p.done, 0);
  const [state, setState] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; info: string } | null>(null);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function run() {
    setResult(null);
    setState("Pripravujem…");
    try {
      const r = await exportBook(book, (d, t) => setState(`Ukladám zvuk, ${Math.round((d / t) * 100)} %`));
      setResult({ url: URL.createObjectURL(r.blob), info: `${formatDuration(r.seconds)} · ${r.chapters.length} kapitol · ${(r.blob.size / 1e6).toFixed(1)} MB` });
      setState(null);
    } catch (e) {
      setState(`Export sa nepodaril: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="settings">
      <p className="hint">Celá kniha ako jeden súbor .m4b s kapitolami. Otvoria ho appky na audioknihy aj prehrávače hudby.</p>
      {missing > 0 && <p className="note-warn">Ešte treba pripraviť {missing} viet. Spusti „Pripraviť celú knihu“ hore.</p>}
      <p className="hint">{AI_NOTICE} Táto informácia sa zapíše do súboru. Ak nahrávku zverejníš, uveď to aj ty.</p>
      <div className="row">
        <button className="btn btn-primary" disabled={missing > 0 || state === "Pripravujem…"} onClick={() => void run()}>Vytvoriť audioknihu</button>
        {result && <a className="btn btn-quiet" href={result.url} download={`${book.title}.m4b`}><IconDownload size={18} /> Stiahnuť ({result.info})</a>}
      </div>
      {state && <p className="hint" role="status">{state}</p>}
    </div>
  );
}
