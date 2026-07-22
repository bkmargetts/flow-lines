/**
 * Pure undo/redo core: a bounded snapshot history plus a quiet-period
 * recorder that coalesces bursts of changes (a slider drag fires dozens of
 * updates) into single entries. No React, no DOM — the app-facing bridge
 * lives in `HistoryContext.tsx`; this file is unit-tested in plain node.
 *
 * Snapshots are cheap: store state is updated immutably everywhere, so an
 * entry is just references into mostly-shared structure.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** Default depth cap — generous for a session, bounded for memory. */
export const HISTORY_CAP = 50;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Record `next` as the new present. A reference-equal `next` is a no-op (the
 * restore echo and spurious effect runs must never push entries). Any real
 * commit clears the redo branch and trims the oldest entries past `cap`.
 */
export function commit<T>(h: History<T>, next: T, cap: number = HISTORY_CAP): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > cap) past.splice(0, past.length - cap);
  return { past, present: next, future: [] };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  const past = h.past.slice(0, -1);
  const present = h.past[h.past.length - 1];
  return { past, present, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  const [present, ...future] = h.future;
  return { past: [...h.past, h.present], present, future };
}

/** Injectable timer so the recorder tests run without real time. */
export interface Scheduler {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

export interface Recorder<T> {
  /**
   * Report the latest state after a change. The first report in a burst
   * starts the quiet-period clock; further reports push it back. When the
   * burst goes quiet the latest reported state is committed as one entry.
   */
  report: (state: T) => void;
  /** Commit any pending burst now (call before undo/redo so a drag followed
   *  by an immediate Ctrl+Z undoes the whole drag, not half of it). */
  flush: () => void;
  /** Drop any pending burst without committing (after a restore, the change
   *  it would record is the restore itself). */
  cancel: () => void;
}

/** How long a burst must go quiet before it commits, in ms. */
export const RECORD_QUIET_MS = 500;

export function createRecorder<T>(
  commitFn: (state: T) => void,
  scheduler: Scheduler,
  quietMs: number = RECORD_QUIET_MS
): Recorder<T> {
  let pending: { state: T } | null = null;
  let timer: unknown = null;

  const clearTimer = () => {
    if (timer != null) {
      scheduler.clear(timer);
      timer = null;
    }
  };

  const flush = () => {
    clearTimer();
    if (pending) {
      const { state } = pending;
      pending = null;
      commitFn(state);
    }
  };

  return {
    report(state: T) {
      pending = { state };
      clearTimer();
      timer = scheduler.set(flush, quietMs);
    },
    flush,
    cancel() {
      clearTimer();
      pending = null;
    },
  };
}
