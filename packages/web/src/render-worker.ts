/// <reference lib="webworker" />
import {
  imageToPenInk,
  type FlowLine,
  type GrayscaleImage,
  type PenInkOptions,
} from '@flow-lines/core';

/**
 * Raw line producer for Image → Ink. The worker now does one thing — run
 * `imageToPenInk` off the UI thread and hand back the raw lines — because the
 * compositor owns all the shared finishing (texture, page border, density
 * protection, SVG serialisation, multi-pen layer slicing). Keeping a single
 * shared render worker is the CLAUDE.md memory model: one resident worker, the
 * heavy raster work stays off the main thread.
 */
export interface RenderRequest {
  id: number;
  image: GrayscaleImage;
  options: PenInkOptions;
}

export interface RenderResponse {
  id: number;
  lines?: FlowLine[];
  width?: number;
  height?: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, image, options } = event.data;

  try {
    const result = imageToPenInk(image, options);
    const response: RenderResponse = {
      id,
      lines: result.lines,
      width: result.width,
      height: result.height,
    };
    self.postMessage(response);
  } catch (err) {
    const response: RenderResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
