/**
 * Cross-instance ML memory invariant for Image → Ink.
 *
 * A plot can now hold N image-ink layers, each with its own depth/labels jobs.
 * But the ONNX runtime's session creation costs a ~250MB transient regardless
 * of model size, and iOS WebKit doesn't reclaim a terminated worker's WASM
 * memory promptly (see CLAUDE.md). Two sessions alive at once OOMs the tab.
 *
 * So depth and scene-label inference must run *one at a time across every
 * instance*, never two ONNX sessions concurrently. This module owns the single
 * global serial queue plus the global low-memory verdict (one device-wide
 * truth, shared by all instances) and the crash breadcrumbs that derive it.
 */

/** Crash breadcrumbs: set while a depth result is being applied or scene
 * labeling is running; if one is still there on startup, the page died
 * mid-job — drop to low memory. Shared globally so any instance's crash
 * lowers memory for all of them. */
export const APPLY_FLAG = 'fl-applying-depth';
export const LABELING_FLAG = 'fl-labeling';
export const LOW_MEM_FLAG = 'fl-low-memory';

export function detectLowMemory(): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(APPLY_FLAG) || localStorage.getItem(LABELING_FLAG)) {
    localStorage.removeItem(APPLY_FLAG);
    localStorage.removeItem(LABELING_FLAG);
    localStorage.setItem(LOW_MEM_FLAG, '1');
  }
  return localStorage.getItem(LOW_MEM_FLAG) === '1';
}

/** Tail of the global ML queue — every scheduled task chains off it, so at most
 *  one ONNX session is ever instantiated across the whole app. */
let mlTail: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` after every previously-scheduled ML task has settled, so only one
 * runs at a time globally. The returned promise resolves/rejects with `fn`'s
 * result; a thrown task never wedges the queue (the chain swallows it).
 */
export function scheduleML<T>(fn: () => Promise<T>): Promise<T> {
  const run = mlTail.then(() => fn());
  // Keep the queue advancing even if this task rejected.
  mlTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
