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

type SegmentationPipeline = (
  input: string,
  options?: { target_sizes?: [number, number][] }
) => Promise<NamedMask[]>;

let pipePromise: Promise<SegmentationPipeline> | null = null;

async function configureEnv(): Promise<typeof import('@huggingface/transformers')> {
  const transformers = await import('@huggingface/transformers');

  // Never probe for local models (avoids 404s against our own origin),
  // and load the ONNX WASM runtime from our origin — bundlers don't ship
  // it, and CDN fallbacks are exactly what broke the MediaPipe models.
  // The runtime is pinned to the PLAIN build by explicit file paths:
  // left to its own devices ort loads the asyncify build on browsers
  // without JSPI (all of iOS) — 23.6MB vs 12.9MB, roughly double the
  // WASM-compile memory spike and 2x slower inference, measured. This
  // worker only ever runs the WASM EP, so the async-capable builds buy
  // nothing here
  transformers.env.allowLocalModels = false;
  const onnxEnv = transformers.env.backends?.onnx?.wasm as
    | { wasmPaths?: string | { wasm?: string; mjs?: string } }
    | undefined;
  if (onnxEnv) {
    const base = `${import.meta.env.BASE_URL}ort-wasm/`;
    onnxEnv.wasmPaths = {
      wasm: `${base}ort-wasm-simd-threaded.wasm`,
      mjs: `${base}ort-wasm-simd-threaded.mjs`,
    };
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

function isMobile(): boolean {
  return /iP(hone|ad|od)|Android/i.test(navigator.userAgent) || isIOSWebKit();
}

async function createPipeline(): Promise<SegmentationPipeline> {
  const transformers = await configureEnv();
  const { pipeline } = transformers;
  const mobile = isMobile();

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
        // The ORT CPU arena holds inference's high-water mark forever;
        // labels run once per upload, so on phones we trade a little
        // speed for giving the memory back
        ...(mobile && {
          session_options: { enableCpuMemArena: false, enableMemPattern: false },
        }),
      });

      // The checkpoint's processor resizes everything to 512×512 before
      // inference; encoder attention and the decoder's four-stage concat
      // scale quadratically with that. Phones drop to 256/320 (measured:
      // same classes detected as 512 on the test bank, ~40% lower peak)
      // — labels gate mark dispatch through ~1%-of-frame feathered
      // confidence, so the lost boundary precision is below what the
      // renderer can see
      if (mobile) {
        const dim = isIOSWebKit() ? 256 : 320;
        const proc = (
          pipe as unknown as {
            processor?: { image_processor?: { size?: { height: number; width: number } } };
          }
        ).processor;
        if (proc?.image_processor?.size) {
          proc.image_processor.size = { height: dim, width: dim };
        }
      }

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
 * raster. `targetSize` ([height, width]) caps the post-processing
 * resolution: the pipeline otherwise bilinearly upsamples the full
 * 150-class logits tensor to the *input* size — a ~150MB allocation at
 * 512px, which is what kills mobile tabs. Runs wherever it is called —
 * the app calls it inside a dedicated worker (see labels-worker.ts) so
 * WASM inference never blocks the page and the model memory is fully
 * released afterwards.
 */
export async function estimateLabels(
  input: string,
  targetSize?: [number, number]
): Promise<LabelImage> {
  const pipe = await getPipeline();
  const results = await pipe(input, targetSize ? { target_sizes: [targetSize] } : undefined);
  return labelsFromAdeMasks(results);
}
