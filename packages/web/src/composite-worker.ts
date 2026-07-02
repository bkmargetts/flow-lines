/// <reference lib="webworker" />
import { composite } from './lib/composite';
import { snapshotToStack, type CompositeSnapshot } from './composite-protocol';

/**
 * The composite worker: receives a full layer-stack snapshot and runs the
 * exact same `composite()` the main thread used to run in a memo — heavy pure
 * renders (lenia, physarum) no longer freeze the UI. One snapshot at a time
 * (the client enforces latest-wins); results post back keyed by request id.
 *
 * Bundle purity: this file reaches module code only through
 * `modules/render-registry.ts`, which imports the React-free `render.ts`
 * files — no Controls, no React, no ML.
 */

type Request = CompositeSnapshot & { id: number };

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, frame, page, layers } = e.data;
  try {
    const result = composite(frame, page, snapshotToStack(layers));
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
