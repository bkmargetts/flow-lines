import type { GrayscaleImage } from '@flow-lines/core';

/**
 * Attempt order: WebGPU fp16 is the fast desktop path; phones often have
 * tight GPU memory limits, so a quantized WebGPU attempt and plain WASM
 * fallbacks follow. The Depth Anything V1 model id is a final fallback
 * in case the V2 repo is unavailable.
 */
const ATTEMPTS: { model: string; device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'q8' }[] = [
  { model: 'onnx-community/depth-anything-v2-small', device: 'webgpu', dtype: 'fp16' },
  { model: 'onnx-community/depth-anything-v2-small', device: 'webgpu', dtype: 'q8' },
  { model: 'onnx-community/depth-anything-v2-small', device: 'wasm', dtype: 'q8' },
  { model: 'Xenova/depth-anything-small-hf', device: 'wasm', dtype: 'q8' },
];

/** The model resizes inputs to ~518px anyway — feeding more wastes memory */
export const MAX_INPUT_DIM = 640;

type DepthPipeline = (input: string) => Promise<{
  depth: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
}>;

interface ActivePipeline {
  pipe: DepthPipeline;
  device: 'webgpu' | 'wasm';
}

let pipePromise: Promise<ActivePipeline> | null = null;

async function configureEnv(): Promise<typeof import('@huggingface/transformers')> {
  const transformers = await import('@huggingface/transformers');

  // Never probe for local models (avoids 404s against our own origin),
  // and load the ONNX WASM runtime from our origin — bundlers don't ship
  // it, and CDN fallbacks are exactly what broke the MediaPipe models
  transformers.env.allowLocalModels = false;
  const onnxEnv = transformers.env.backends?.onnx?.wasm as { wasmPaths?: string } | undefined;
  if (onnxEnv) {
    onnxEnv.wasmPaths = `${import.meta.env.BASE_URL}ort-wasm/`;
  }

  return transformers;
}

/** iOS WebKit (incl. iPadOS reporting as MacIntel) — tight memory budgets */
function isIOSWebKit(): boolean {
  const nav = navigator as Navigator & { platform?: string };
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (nav.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

async function createPipeline(wasmOnly: boolean): Promise<ActivePipeline> {
  const transformers = await configureEnv();
  const { pipeline } = transformers;

  // Phones: single WASM thread, no WebGPU — every saved allocation
  // matters when the OS kills pages over memory
  if (isIOSWebKit()) {
    const onnxEnv = transformers.env.backends?.onnx?.wasm as
      | { numThreads?: number }
      | undefined;
    if (onnxEnv) onnxEnv.numThreads = 1;
  }

  const hasWebGPU = 'gpu' in navigator && !isIOSWebKit();
  const failures: string[] = [];

  for (const attempt of ATTEMPTS) {
    if (attempt.device === 'webgpu' && (!hasWebGPU || wasmOnly)) continue;

    try {
      const pipe = await pipeline('depth-estimation', attempt.model, {
        device: attempt.device,
        dtype: attempt.dtype,
      });
      return { pipe: pipe as unknown as DepthPipeline, device: attempt.device };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${attempt.device}/${attempt.dtype}: ${msg}`);
    }
  }

  throw new Error(failures.join(' | ') || 'No depth backend available');
}

function getPipeline(wasmOnly = false): Promise<ActivePipeline> {
  if (!pipePromise) {
    pipePromise = createPipeline(wasmOnly).catch((err) => {
      // Allow a retry after transient network failures
      pipePromise = null;
      throw err;
    });
  }
  return pipePromise;
}

function toGrayscale(depth: {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}): GrayscaleImage {
  const data = new Float32Array(depth.width * depth.height);
  for (let i = 0; i < data.length; i++) {
    data[i] = depth.data[i] / 255;
  }
  return { width: depth.width, height: depth.height, data };
}

/**
 * Estimate a relative depth map (bright = near) for an already-downscaled
 * input data URL. Runs wherever it is called — the app calls it inside a
 * dedicated worker (see depth-worker.ts) so heavy WASM inference never
 * blocks the page and its memory is fully released afterwards.
 */
export async function estimateDepth(input: string): Promise<GrayscaleImage> {
  const active = await getPipeline();

  try {
    const result = await active.pipe(input);
    return toGrayscale(result.depth);
  } catch (err) {
    // GPU memory can also run out at inference time, not just at model
    // load — rebuild on plain WASM and try once more
    if (active.device === 'webgpu') {
      pipePromise = null;
      const fallback = await getPipeline(true);
      const result = await fallback.pipe(input);
      return toGrayscale(result.depth);
    }
    throw err;
  }
}
