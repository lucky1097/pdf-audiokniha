# Brief J: one shared voice download, startable from the library

## Goal
Today the 380 MB voice model is downloaded only when a book first plays (`BookController.ensureModel` in book.ts
calls `downloadModel`). The library's new first-run screen must start the same download with a button and show its
progress, and a book opened meanwhile must join that download, never start a second one. Add a small module-level
download store in engine.ts and make book.ts use it.

## Files
Read: CLAUDE.md, docs/known-issues.md, apps/mobile/src/lib/engine.ts, apps/mobile/src/lib/book.ts (`ensureModel`).
Change only: apps/mobile/src/lib/engine.ts, apps/mobile/src/lib/book.ts (only `ensureModel` and its imports).

## engine.ts
Keep `downloadModel`, `modelDownloaded`, `MODEL_BYTES` and `DownloadProgress` as they are. Add below `downloadModel`:

```ts
export interface ModelDownload {
  status: "missing" | "downloading" | "done" | "error";
  progress: DownloadProgress | null;
  error: string | null;
}
export function getModelDownload(): ModelDownload;            // current snapshot (same object until it changes)
export function subscribeModelDownload(fn: () => void): () => void; // returns unsubscribe
export function startModelDownload(): Promise<void>;          // idempotent, see below
```

- The snapshot is created lazily on the first `getModelDownload()`: status `"done"` if `modelDownloaded()`, else
  `"missing"`. Every change replaces the snapshot with a NEW object (so React `useSyncExternalStore` sees it) and
  calls every listener.
- `startModelDownload()`:
  - if `!voiceAvailable`: reject with `new Error(NO_VOICE_MESSAGE)`, do not change state;
  - if a download is running: return the same promise;
  - if `modelDownloaded()`: set status `"done"` (if not already) and resolve;
  - else: status `"downloading"`, progress `{ bytes: 0, total: MODEL_BYTES, file: 0, files: <FILES.length> }`,
    error null; keep the screen awake during it with `activateKeepAwakeAsync("model").catch(() => {})` from
    expo-keep-awake, and `deactivateKeepAwake("model")` in a finally; call `downloadModel`, updating `progress`
    on each callback; on success status `"done"`, progress null; on failure status `"error"`, error = the message
    (Error.message or String(e)), and the returned promise rejects with the same error. The running promise is
    cleared when it settles, so a retry after an error starts again.
- Throttle listener calls during progress: notify at most once per 250 ms (always notify on status changes).

## book.ts
Rewrite only `ensureModel` so it uses the store:
```ts
if (!voiceAvailable) throw new Error(NO_VOICE_MESSAGE);
if (!modelDownloaded()) {
  this.set({ phase: "downloading", download: getModelDownload().progress ?? { bytes: 0, total: MODEL_BYTES, file: 0, files: 1 } });
  const off = subscribeModelDownload(() => { const p = getModelDownload().progress; if (p) this.set({ download: p }); });
  try { await startModelDownload(); } finally { off(); }
  this.set({ download: null });
}
this.set({ phase: "loading" });
await loadEngine();
```
Drop `downloadModel` from book.ts's imports if unused; nothing else in book.ts changes.

## Done when
1. `npx tsc --noEmit -p apps/mobile` from the repo root prints nothing.
2. `npm run typecheck` prints nothing and `npm test` ends with `ℹ fail 0`.
3. `git diff --stat` lists only apps/mobile/src/lib/engine.ts and apps/mobile/src/lib/book.ts (plus this brief file if untracked).
4. `git diff apps/mobile/src/lib/book.ts` changes only the `ensureModel` method and the import lines.
