import { labelsFromAdeMasks, type LabelImage, type NamedMask } from '@flow-lines/core';

/**
 * SegFormer-b0 on ADE20K: ~5MB quantized, fast enough on plain WASM that
 * the WebGPU complexity isn't worth it — labels only gate mark dispatch,
 * so coarse boundaries are fine (the core feathers them anyway). The
 * unquantized fallback covers checkpoints without q8 weights.
 */
const ATTEMPTS: { model: string; dtype: 'q8' | 'fp32' }[] = [
  { model: 'Xenova/segformer-b0-finetuned-ade-512-512', dtype: 'q8' },
  { model: 'Xenova/segformer-b0-finetuned-ade-512-512', dtype: 'fp32' },
];

type SegmentationPipeline = (input: string) => Promise<NamedMask[]>;

let pipePromise: Promise<SegmentationPipeline> | null = null;

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
  const nav = navigator as Navigator & { platform?: string; maxTouchPoints?: number };
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
  );
}

async function createPipeline(): Promise<SegmentationPipeline> {
  const transformers = await configureEnv();
  const { pipeline } = transformers;

  // Phones: single WASM thread — every saved allocation matters when the
  // OS kills pages over memory (same policy as the depth pipeline)
  if (isIOSWebKit()) {
    const onnxEnv = transformers.env.backends?.onnx?.wasm as
      | { numThreads?: number }
      | undefined;
    if (onnxEnv) onnxEnv.numThreads = 1;
  }

  const failures: string[] = [];

  for (const attempt of ATTEMPTS) {
    try {
      const pipe = await pipeline('image-segmentation', attempt.model, {
        device: 'wasm',
        dtype: attempt.dtype,
      });
      return pipe as unknown as SegmentationPipeline;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${attempt.model}/${attempt.dtype}: ${msg}`);
    }
  }

  throw new Error(failures.join(' | ') || 'No segmentation backend available');
}

function getPipeline(): Promise<SegmentationPipeline> {
  if (!pipePromise) {
    pipePromise = createPipeline().catch((err) => {
      // Allow a retry after transient network failures
      pipePromise = null;
      throw err;
    });
  }
  return pipePromise;
}

/**
 * Segment an already-downscaled input data URL into a semantic label
 * raster. Runs wherever it is called — the app calls it inside a
 * dedicated worker (see labels-worker.ts) so WASM inference never blocks
 * the page and the model memory is fully released afterwards.
 */
export async function estimateLabels(input: string): Promise<LabelImage> {
  const pipe = await getPipeline();
  const results = await pipe(input);
  return labelsFromAdeMasks(results);
}
