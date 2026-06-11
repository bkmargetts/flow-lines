/// <reference lib="webworker" />
import {
  imageToPenInk,
  toSVG,
  type GrayscaleImage,
  type PenInkOptions,
  type SVGOptions,
} from '@flow-lines/core';

export interface RenderRequest {
  id: number;
  image: GrayscaleImage;
  options: PenInkOptions;
  svgOptions: SVGOptions;
}

export interface RenderResponse {
  id: number;
  svg?: string;
  width?: number;
  height?: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, image, options, svgOptions } = event.data;

  try {
    const result = imageToPenInk(image, options);
    const svg = toSVG(result, svgOptions);
    const response: RenderResponse = { id, svg, width: result.width, height: result.height };
    self.postMessage(response);
  } catch (err) {
    const response: RenderResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
