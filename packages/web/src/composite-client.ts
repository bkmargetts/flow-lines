import { composite, type CompositeResult } from './lib/composite';
import { snapshotToStack, type CompositeSnapshot } from './composite-protocol';

export type { CompositeSnapshot, SnapshotLayer } from './composite-protocol';

/**
 * Client for the composite worker: ships the whole layer-stack snapshot off
 * the main thread and returns the composited sheet. The stack must composite
 * as one unit (hold-off resolves sequentially top→bottom), so latest-wins is
 * per-snapshot: one render in flight, at most one queued — a newer snapshot
 * replaces the queued one, whose promise rejects with `SUPERSEDED`.
 *
 * Heavy pure layers (lenia, physarum) used to run inside a `useMemo` on the
 * UI thread and froze the app on every slider drag; the worker runs the same
 * `composite()` byte-for-byte (module-goldens pin it), and the UI keeps the
 * previous sheet while busy.
 *
 * Fallback: environments without `Worker` (jsdom tests) or where the worker
 * fails to boot run `composite()` synchronously on the main thread, forever.
 */

/** Rejection sentinel for a queued snapshot displaced by a newer one. */
export const SUPERSEDED = Symbol('composite-superseded');

function compositeSync(snap: CompositeSnapshot): CompositeResult {
  return composite(snap.frame, snap.page, snapshotToStack(snap.layers));
}

interface Job {
  snap: CompositeSnapshot;
  resolve: (r: CompositeResult) => void;
  reject: (reason: unknown) => void;
}

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
let inFlight: (Job & { id: number }) | null = null;
let queued: Job | null = null;

function failPermanently(): void {
  // The worker is unusable — resolve everything synchronously from now on.
  workerFailed = true;
  worker?.terminate();
  worker = null;
  const jobs = [inFlight, queued].filter(Boolean) as Job[];
  inFlight = null;
  queued = null;
  for (const job of jobs) job.resolve(compositeSync(job.snap));
}

function ensureWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./composite-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerFailed = true;
      return null;
    }
    worker.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data as {
        id: number;
        result?: CompositeResult;
        error?: string;
      };
      if (!inFlight || inFlight.id !== id) return; // stale reply
      const job = inFlight;
      inFlight = null;
      if (error != null) {
        // A module render threw — surface it; the stack itself is bad, not the
        // worker, so don't fall back to sync (it would throw the same way).
        job.reject(new Error(error));
      } else {
        job.resolve(result!);
      }
      if (queued) {
        const next = queued;
        queued = null;
        start(next);
      }
    };
    worker.onerror = () => failPermanently();
  }
  return worker;
}

function start(job: Job): void {
  const w = ensureWorker();
  if (!w) {
    job.resolve(compositeSync(job.snap));
    return;
  }
  const id = nextId++;
  inFlight = { ...job, id };
  w.postMessage({ id, ...job.snap });
}

/**
 * Composite a stack snapshot off-thread (latest-wins). The returned promise
 * resolves with the sheet, or rejects with `SUPERSEDED` when a newer snapshot
 * displaced this one before it started — callers should ignore that rejection
 * (the newer request supplies the fresher sheet).
 */
export function requestComposite(snap: CompositeSnapshot): Promise<CompositeResult> {
  if (workerFailed || typeof Worker === 'undefined') {
    return Promise.resolve(compositeSync(snap));
  }
  return new Promise<CompositeResult>((resolve, reject) => {
    const job: Job = { snap, resolve, reject };
    if (inFlight) {
      queued?.reject(SUPERSEDED);
      queued = job;
    } else {
      start(job);
    }
  });
}
