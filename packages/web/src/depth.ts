import type { GrayscaleImage } from '@flow-lines/core';

const MODEL_ID = 'onnx-community/depth-anything-v2-small';

// Loaded lazily and cached; the model (~25MB quantized) is fetched from
// the HuggingFace CDN on first use and cached by the browser
let pipePromise: Promise<unknown> | null = null;

async function getPipeline(): Promise<unknown> {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      return pipeline('depth-estimation', MODEL_ID, {
        device,
        dtype: device === 'webgpu' ? 'fp16' : 'q8',
      });
    })().catch((err) => {
      pipePromise = null;
      throw err;
    });
  }
  return pipePromise;
}

/** Whether this browser can run depth estimation quickly (WebGPU) */
export function hasFastDepth(): boolean {
  return 'gpu' in navigator;
}

/**
 * Estimate a relative depth map (bright = near) for the image on the
 * given canvas using Depth Anything V2 small, fully in-browser.
 */
export async function estimateDepth(source: HTMLCanvasElement): Promise<GrayscaleImage> {
  const pipe = (await getPipeline()) as (
    input: string
  ) => Promise<{ depth: { width: number; height: number; data: Uint8Array | Uint8ClampedArray } }>;

  // transformers.js accepts data URLs for canvas content
  const result = await pipe(source.toDataURL('image/png'));
  const depth = result.depth;

  const data = new Float32Array(depth.width * depth.height);
  for (let i = 0; i < data.length; i++) {
    data[i] = depth.data[i] / 255;
  }

  return { width: depth.width, height: depth.height, data };
}
