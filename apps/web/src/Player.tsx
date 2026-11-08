import { useEffect, useMemo, useRef } from "react";
import { formatDuration, useStore } from "./hooks.ts";
import { generator } from "./lib/generator.ts";
import { chapterSentences, type Project } from "./lib/project.ts";
import { CHARS_PER_SECOND } from "./useBook.ts";
import { player } from "./lib/player.ts";
import { Cover } from "./ui/Cover.tsx";
import { IconChevronDown, IconNext, IconPause, IconPlay, IconPrev, Spinner } from "./ui/icons.tsx";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const speedLabel = (s: number) => `${s.toLocaleString("sk-SK")}×`;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** Chapter time from sentence lengths (about 13 characters per second), and how much of it is ready. */
function useChapterTime(book: Project, chapter: number, sentence: number, speed: number) {
  const gen = useStore(generator);
  const all = useMemo(() => chapterSentences(book, chapter), [book, chapter]);
  const secs = all.map((s) => s.text.length / CHARS_PER_SECOND / speed);
  const elapsed = secs.slice(0, sentence).reduce((a, b) => a + b, 0);
  const total = secs.reduce((a, b) => a + b, 0);
  const ready = all.filter((s) => gen.done.has(s.key)).length;
  const working = gen.running || gen.scope.kind !== "idle";
  return { elapsed, left: Math.max(0, total - elapsed), ready, count: all.length, working, rtf: gen.rtf, totalSpeech: total * speed };
}

function usePlayback(book: Project) {
  const s = useStore(player);
  const total = chapterSentences(book, s.chapter).length;
  const playing = s.playing && !player.paused;
  return { s, total, playing, chapter: book.chapters[s.chapter] };
}

export function PlayButton({ book, size = "l" }: { book: Project; size?: "s" | "l" }) {
  const { s, playing } = usePlayback(book);
  return (
    <button className={`play-btn play-${size}`} onClick={() => player.toggle()} aria-label={playing ? "Pozastaviť" : "Prehrať"}>
      {s.waiting && s.playing ? <Spinner size={size === "l" ? 28 : 20} /> : playing ? <IconPause size={size === "l" ? 30 : 22} /> : <IconPlay size={size === "l" ? 30 : 22} />}
    </button>
  );
}

export function PlayerPanel({ book, onClose }: { book: Project; onClose?: () => void }) {
  const { s, total, chapter } = usePlayback(book);
  const time = useChapterTime(book, s.chapter, s.sentence, s.speed);
  const closeRef = useRef<HTMLButtonElement>(null);
  const missing = time.count - time.ready;
  let status: string | null = null;
  if (missing > 0) {
    const eta = time.rtf && time.count ? (missing / time.count) * time.totalSpeech * time.rtf : null;
    status = time.working
      ? `Pripravujem hlas kapitoly${eta ? `, zostáva asi ${formatDuration(eta)}` : "…"}`
      : `Kapitola je pripravená z ${Math.round((time.ready / Math.max(1, time.count)) * 100)} %, zvyšok sa dopripraví počas počúvania`;
  }
  useEffect(() => {
    if (!onClose) return;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="player">
      {onClose && (
        <button ref={closeRef} className="icon-btn sheet-close" onClick={onClose} aria-label="Zavrieť prehrávač">
          <IconChevronDown />
        </button>
      )}
      <Cover title={book.title} author={book.author} size="l" />
      <div className="player-titles">
        <p className="player-chapter">{chapter?.title || `Kapitola ${s.chapter + 1}`}</p>
        <p className="player-book">{book.title}</p>
      </div>
      <div className="scrub">
        <label className="sr-only" htmlFor="scrub">Veta v kapitole</label>
        <input
          id="scrub"
          type="range"
          min={1}
          max={Math.max(1, total)}
          value={Math.min(s.sentence + 1, Math.max(1, total))}
          onChange={(e) => void player.playFrom(s.chapter, Number(e.target.value) - 1)}
          style={{ "--fill": `${total > 1 ? (s.sentence / (total - 1)) * 100 : 0}%` } as React.CSSProperties}
        />
        <div className="scrub-meta">
          <span>{clock(time.elapsed)}</span>
          <span>{s.waiting && s.playing ? "Pripravujem hlas…" : `Veta ${Math.min(s.sentence + 1, total)} z ${total}`}</span>
          <span>−{clock(time.left)}</span>
        </div>
      </div>
      <div className="transport">
        <button className="icon-btn" onClick={() => player.skip(-1)} aria-label="Predchádzajúca veta"><IconPrev /></button>
        <PlayButton book={book} />
        <button className="icon-btn" onClick={() => player.skip(1)} aria-label="Ďalšia veta"><IconNext /></button>
      </div>
      {status && <p className="player-status" aria-live="polite">{status}</p>}
      <div className="speed" role="group" aria-label="Rýchlosť čítania">
        {SPEEDS.map((v) => (
          <button key={v} className={`chip${s.speed === v ? " on" : ""}`} aria-pressed={s.speed === v} onClick={() => player.setSpeed(v)}>
            {speedLabel(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MiniPlayer({ book, onExpand }: { book: Project; onExpand: () => void }) {
  const { s, total, chapter } = usePlayback(book);
  return (
    <div className="mini-player">
      <button className="mini-open" onClick={onExpand} aria-label="Otvoriť prehrávač">
        <Cover title={book.title} size="s" />
        <span className="mini-text">
          <span className="truncate mini-chapter">{chapter?.title || `Kapitola ${s.chapter + 1}`}</span>
          <span className="mini-sub">Veta {Math.min(s.sentence + 1, total)} z {total}</span>
        </span>
      </button>
      <PlayButton book={book} size="s" />
      <span className="mini-progress" style={{ width: `${total ? ((s.sentence + 1) / total) * 100 : 0}%` }} aria-hidden="true" />
    </div>
  );
}
