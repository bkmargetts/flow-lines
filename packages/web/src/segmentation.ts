import { FilesetResolver, InteractiveSegmenter } from '@mediapipe/tasks-vision';
import type { GrayscaleImage } from '@flow-lines/core';

// The WASM runtime is copied out of node_modules into public/mediapipe-wasm
// at build time (see scripts/copy-mediapipe-wasm.mjs), so it is served from
// our own origin and always matches the installed package version
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';

let segmenterPromise: Promise<InteractiveSegmenter> | null = null;

function getSegmenter(): Promise<InteractiveSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return InteractiveSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })().catch((err) => {
      // Allow a retry after transient network failures
      segmenterPromise = null;
      throw err;
    });
  }
  return segmenterPromise;
}

/**
 * Segment the object at the given normalized point (0-1) using MediaPipe's
 * interactive segmenter (runs fully in the browser; the ~6MB model is
 * fetched and cached on first use). Returns a subject mask where
 * 1 = subject, 0 = background.
 */
export async function isolateSubjectAt(
  source: HTMLCanvasElement,
  nx: number,
  ny: number
): Promise<GrayscaleImage> {
  const segmenter = await getSegmenter();

  return new Promise((resolvePromise, reject) => {
    segmenter.segment(source, { keypoint: { x: nx, y: ny } }, (result) => {
      try {
        const mask = result.confidenceMasks?.[0];
        if (!mask) {
          reject(new Error('Segmentation returned no mask'));
          return;
        }

        const width = mask.width;
        const height = mask.height;
        const confidence = mask.getAsFloat32Array();

        // The mask polarity isn't guaranteed; the clicked point is the
        // subject by definition, so flip if it scored as background
        const cx = Math.min(width - 1, Math.max(0, Math.round(nx * width)));
        const cy = Math.min(height - 1, Math.max(0, Math.round(ny * height)));
        const flip = confidence[cy * width + cx] < 0.5;

        const data = new Float32Array(width * height);
        for (let i = 0; i < data.length; i++) {
          data[i] = flip ? 1 - confidence[i] : confidence[i];
        }

        resolvePromise({ width, height, data });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } finally {
        result.close();
      }
    });
  });
}
