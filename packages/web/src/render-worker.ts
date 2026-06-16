/// <reference lib="webworker" />
import {
  imageToPenInk,
  generateTexture,
  limitStrokeDensity,
  pageBorder,
  toSVG,
  type FlowLine,
  type GrayscaleImage,
  type PenInkOptions,
  type SVGOptions,
  type TextureOptions,
} from '@flow-lines/core';

/** Universal page border, expressed in page px (the worker holds the result). */
export interface RenderBorder {
  marginPx: number;
  insetPx: number;
}

/** Density protection options from the shared page frame. */
export interface RenderDensity {
  maxPasses: number;
}

export interface RenderRequest {
  id: number;
  image: GrayscaleImage;
  options: PenInkOptions;
  svgOptions: SVGOptions;
  /** Optional background texture (the worker builds the halo from the art) */
  texture?: Omit<TextureOptions, 'avoid'>;
  textureColor?: string;
  /** Optional universal page border (drawn after density/texture). */
  border?: RenderBorder;
  /** Optional density protection (drops strokes off saturated paper). */
  density?: RenderDensity;
}

export interface RenderResponse {
  id: number;
  /** Clean SVG for download. */
  svg?: string;
  /** SVG for the plot window — clean output plus ghosts of removed strokes. */
  previewSvg?: string;
  width?: number;
  height?: number;
  error?: string;
}

/** Faint ink for the preview-only ghosts of density-removed strokes. */
const REMOVED_COLOR = '#e8a0a0';

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, image, options, svgOptions, texture, textureColor, border, density } = event.data;

  try {
    const result = imageToPenInk(image, options);

    // Density protection thins the drawing only (texture/border are deliberate,
    // separate pens), before the border frames it and the texture goes behind.
    let drawingLines = result.lines;
    let removed: FlowLine[] = [];
    if (density) {
      const cellPx = Math.max(1, svgOptions.strokeWidth ?? 1);
      const out = limitStrokeDensity(
        { ...result, lines: drawingLines },
        { maxPasses: density.maxPasses, cellPx }
      );
      drawingLines = out.result.lines;
      removed = out.removed;
    }

    const borderLines = border
      ? pageBorder({
          width: result.width,
          height: result.height,
          marginPx: border.marginPx,
          insetPx: border.insetPx,
        })
      : [];

    let layerColors = svgOptions.layerColors;
    let texLines: FlowLine[] = [];
    if (texture) {
      // Generate the texture here (the worker holds the result lines) so its
      // halo masks the actual drawing and the border, and lay it behind.
      const avoid = borderLines.length ? [...drawingLines, ...borderLines] : drawingLines;
      texLines = generateTexture({ ...texture, avoid });
      layerColors = { ...layerColors, texture: textureColor ?? '#c9c2b4' };
    }
    if (borderLines.length) {
      layerColors = { ...layerColors, border: layerColors?.border ?? svgOptions.strokeColor ?? '#111111' };
    }

    const finalLines = [...texLines, ...drawingLines, ...borderLines];
    const opts = layerColors ? { ...svgOptions, layerColors } : svgOptions;
    const svg = toSVG({ ...result, lines: finalLines }, opts);

    let previewSvg = svg;
    if (removed.length > 0) {
      const ghosts: FlowLine[] = removed.map((l) => ({ points: l.points, layer: 'removed' }));
      const previewOpts: SVGOptions = {
        ...opts,
        layerColors: { ...(layerColors ?? {}), removed: REMOVED_COLOR },
      };
      previewSvg = toSVG({ ...result, lines: [...finalLines, ...ghosts] }, previewOpts);
    }

    const response: RenderResponse = {
      id,
      svg,
      previewSvg,
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
