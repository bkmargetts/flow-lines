import type { GrayscaleImage } from '@flow-lines/core';

/**
 * Attempt order: WebGPU is much faster where it truly works, but mobile
 * WebGPU + ONNX is flaky, so every config degrades to plain WASM; the
 * Depth Anything V1 model id is a final fallback in case the V2 repo
 * is unavailable.
 */
const ATTEMPTS: { model: string; device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'q8' }[] = [
  { model: 'onnx-community/depth-anything-v2-small', device: 'webgpu', dtype: 'fp16' },
  { model: 'onnx-community/depth-anything-v2-small', device: 'wasm', dtype: 'q8' },
  { model: 'Xenova/depth-anything-small-hf', device: 'wasm', dtype: 'q8' },
];

type DepthPipeline = (input: string) => Promise<{
  depth: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
}>;

let pipePromise: Promise<DepthPipeline> | null = null;

async function createPipeline(): Promise<DepthPipeline> {
  const { pipeline, env } = await import('@huggingface/transformers');

  // Never probe for local models (avoids 404s against our own origin),
  // and load the ONNX WASM runtime from our origin — bundlers don't ship
  // it, and CDN fallbacks are exactly what broke the MediaPipe models
  env.allowLocalModels = false;
  const onnxEnv = env.backends?.onnx?.wasm as { wasmPaths?: string } | undefined;
  if (onnxEnv) {
    onnxEnv.wasmPaths = `${import.meta.env.BASE_URL}ort-wasm/`;
  }

  const hasWebGPU = 'gpu' in navigator;
  let lastError: unknown = new Error('No depth backend available');

  for (const attempt of ATTEMPTS) {
    if (attempt.device === 'webgpu' && !hasWebGPU) continue;

    try {
      const pipe = await pipeline('depth-estimation', attempt.model, {
        device: attempt.device,
        dtype: attempt.dtype,
      });
      return pipe as unknown as DepthPipeline;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function getPipeline(): Promise<DepthPipeline> {
  if (!pipePromise) {
    pipePromise = createPipeline().catch((err) => {
      // Allow a retry after transient network failures
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
 * given canvas using Depth Anything, fully in-browser. The model
 * (~25-50MB) is fetched from the HuggingFace CDN and cached on first use.
 */
export async function estimateDepth(source: HTMLCanvasElement): Promise<GrayscaleImage> {
  const pipe = await getPipeline();
  const result = await pipe(source.toDataURL('image/png'));
  const depth = result.depth;

  const data = new Float32Array(depth.width * depth.height);
  for (let i = 0; i < data.length; i++) {
    data[i] = depth.data[i] / 255;
  }

  return { width: depth.width, height: depth.height, data };
}
