import type { LabelImage } from '@flow-lines/core';
import type { LabelsRequest, LabelsResponse } from './labels-worker';

/**
 * The post-processing step upsamples the full 150-class logits tensor to
 * the *input* size — at 512px that is a single ~157MB allocation, which
 * iOS WebKit kills the tab over. The core SemanticMap downsamples labels
 * to <=256 anyway, so a 256px input loses nothing and cuts that spike to
 * ~39MB. (The model still infers at its native 512 internally.)
 */
const MAX_INPUT_DIM = 256;

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
 * Run scene segmentation in a dedicated worker that is terminated as soon
 * as the job finishes — the same disposable pattern as depth estimation:
 * phones kill pages whose main thread hangs or whose memory stays high,
 * and model files stay in the browser HTTP cache, so respawning is much
 * cheaper than the first run.
 */
export function estimateLabelsInWorker(source: HTMLCanvasElement): Promise<LabelImage> {
  const input = toInputDataURL(source);

  return new Promise<LabelImage>((resolve, reject) => {
    const worker = new Worker(new URL('./labels-worker.ts', import.meta.url), {
      type: 'module',
    });

    const finish = (fn: () => void): void => {
      worker.terminate();
      fn();
    };

    worker.onmessage = (event: MessageEvent<LabelsResponse>) => {
      const { labels, error } = event.data;
      if (labels) {
        finish(() => resolve(labels));
      } else {
        finish(() => reject(new Error(error ?? 'Scene labeling failed')));
      }
    };
    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || 'Labels worker crashed')));
    };

    const request: LabelsRequest = { input };
    worker.postMessage(request);
  });
}
