import { useEffect, useState } from "react";

/** Subscribe a component to one of the singletons (tts, generator, player). */
export function useStore<T>(store: { state: T; subscribe(fn: (s: T) => void): () => void }): T {
  const [s, set] = useState(store.state);
  useEffect(() => store.subscribe(set), [store]);
  return s;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : m ? `${m} min` : `${s} s`;
}
