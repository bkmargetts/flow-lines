import type { GrayscaleImage } from '@flow-lines/core';
import type { DepthRequest, DepthResponse } from './depth-worker';

/** The model resizes inputs to ~518px anyway — feeding more wastes memory;
 * phones get a slightly smaller input to trim activation memory further */
const MAX_INPUT_DIM = /iP(hone|ad|od)/.test(navigator.userAgent) ? 512 : 640;

/** Downscale to the model's working size before encoding */
function toInputDataURL(source: HTMLCanvasElement): string {
  const scale = Math.min(1, MAX_INPUT_DIM / Math.max(source.width, source.height));
  if (scale >= 1) {
    return source.toDataURL('image/png');
  }

  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(source.width * scale));
  small.height = Math.max(1, Math.round(source.height * scale));
  const ctx = small.getContext('2d');
  if (!ctx) return source.toDataURL('image/png');
  ctx.drawImage(source, 0, 0, small.width, small.height);
  return small.toDataURL('image/png');
}

/**
 * Run depth estimation in a single persistent worker that loads the model
 * once and reuses it for every photo. Re-creating the ONNX runtime per
 * photo cost a ~250MB allocation spike each time, and iOS WebKit doesn't
 * reclaim a terminated worker's WASM memory promptly — so the spikes
 * stacked across photos and OOM'd after a few. Keeping one worker alive
 * holds memory flat (a resident ~25-50MB model) and isolates the heavy
 * WASM inference off the main thread. The worker is still off the UI
 * thread, so a long inference never hangs the page.
 */
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (depth: GrayscaleImage) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./depth-worker.ts', import.meta.url), {
    type: 'module',
  });
  w.onmessage = (event: MessageEvent<DepthResponse>) => {
    const { id, depth, error } = event.data;
    const cb = pending.get(id);
    if (!cb) return;
    pending.delete(id);
    if (depth) cb.resolve(depth);
    else cb.reject(new Error(error ?? 'Depth estimation failed'));
  };
  w.onerror = (event) => {
    // A worker-level crash kills every in-flight job; reject them all and
    // drop the worker so the next call spawns a fresh one.
    const err = new Error(event.message || 'Depth worker crashed');
    for (const cb of pending.values()) cb.reject(err);
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

export function estimateDepthInWorker(source: HTMLCanvasElement): Promise<GrayscaleImage> {
  const input = toInputDataURL(source);
  const id = ++nextId;

  return new Promise<GrayscaleImage>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: DepthRequest = { id, input };
    getWorker().postMessage(request);
  });
}
