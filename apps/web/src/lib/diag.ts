// A short log of what the app did, kept in localStorage so it survives Safari closing the tab (on iPhone
// there is no console to look at). The library shows it under "Diagnostika".
const KEY = "audiokniha-diag";
const MAX = 80;

type Listener = (lines: string[]) => void;
const listeners = new Set<Listener>();

export function diagLines(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function diag(message: string): void {
  const t = new Date();
  const stamp = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
  const lines = [...diagLines(), `${stamp} ${message.slice(0, 400)}`].slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked or full: the log is a convenience only.
  }
  for (const l of listeners) l(lines);
}

export function clearDiag(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  for (const l of listeners) l([]);
}

export function onDiag(l: Listener): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}
