/// <reference lib="webworker" />
import {
  imageToPenInk,
  generateTexture,
  toSVG,
  type GrayscaleImage,
  type PenInkOptions,
  type SVGOptions,
  type TextureOptions,
} from '@flow-lines/core';

export interface RenderRequest {
  id: number;
  image: GrayscaleImage;
  options: PenInkOptions;
  svgOptions: SVGOptions;
  /** Optional background texture (the worker builds the halo from the art) */
  texture?: Omit<TextureOptions, 'avoid'>;
  textureColor?: string;
}

export interface RenderResponse {
  id: number;
  svg?: string;
  width?: number;
  height?: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, image, options, svgOptions, texture, textureColor } = event.data;

  try {
    const result = imageToPenInk(image, options);
    let opts = svgOptions;
    if (texture) {
      // Generate the texture here (the worker holds the result lines) so its
      // halo masks the actual drawing, and lay it behind on its own layer.
      const texLines = generateTexture({ ...texture, avoid: result.lines });
      result.lines = [...texLines, ...result.lines];
      opts = { ...svgOptions, layerColors: { ...svgOptions.layerColors, texture: textureColor ?? '#c9c2b4' } };
    }
    const svg = toSVG(result, opts);
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
