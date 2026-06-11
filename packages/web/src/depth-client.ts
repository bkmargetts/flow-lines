import type { GrayscaleImage } from '@flow-lines/core';
import type { DepthRequest, DepthResponse } from './depth-worker';

/** The model resizes inputs to ~518px anyway — feeding more wastes memory */
const MAX_INPUT_DIM = 640;

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
 * Run depth estimation in a dedicated worker that is terminated as soon
 * as the job finishes. Phones kill pages whose main thread hangs (WASM
 * inference) or whose memory stays high (a resident 25-50MB model) —
 * isolating the model in a disposable worker fixes both. Model files stay
 * in the browser HTTP cache, so respawning is much cheaper than the
 * first run.
 */
export function estimateDepthInWorker(source: HTMLCanvasElement): Promise<GrayscaleImage> {
  const input = toInputDataURL(source);

  return new Promise<GrayscaleImage>((resolve, reject) => {
    const worker = new Worker(new URL('./depth-worker.ts', import.meta.url), {
      type: 'module',
    });

    const finish = (fn: () => void): void => {
      worker.terminate();
      fn();
    };

    worker.onmessage = (event: MessageEvent<DepthResponse>) => {
      const { depth, error } = event.data;
      if (depth) {
        finish(() => resolve(depth));
      } else {
        finish(() => reject(new Error(error ?? 'Depth estimation failed')));
      }
    };
    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || 'Depth worker crashed')));
    };

    const request: DepthRequest = { input };
    worker.postMessage(request);
  });
}
