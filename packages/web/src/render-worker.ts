/// <reference lib="webworker" />
import {
  imageToPenInk,
  generateTexture,
  limitStrokeDensity,
  pageBorder,
  toSVG,
  toSVGLayers,
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
  cornerRadiusPx: number;
}

/** Density protection options from the shared page frame. */
export interface RenderDensity {
  maxPasses: number;
  /** Minimum sustained-overlap run length (px) before a run is trimmed. */
  minOverlapPx?: number;
}

export interface RenderRequest {
  id: number;
  image: GrayscaleImage;
  options: PenInkOptions;
  svgOptions: SVGOptions;
  /** Optional background texture (the worker builds the halo from the art) */
  texture?: Omit<TextureOptions, 'avoid'>;
  /** Per-pen-layer texture colours: single 'texture' or multi-ink 'texture-NN'. */
  textureLayerColors?: Record<string, string>;
  /** Optional universal page border (drawn after density/texture). */
  border?: RenderBorder;
  /** Optional density protection (drops strokes off saturated paper). */
  density?: RenderDensity;
}

export interface RenderResponse {
  id: number;
  /** Clean SVG for download. */
  svg?: string;
  /** SVG for the plot window — the same clean, as-plotted output. */
  previewSvg?: string;
  /**
   * One standalone SVG per pen layer (drawing pens + texture + border), for the
   * multi-pen "download layers" export. Each shares the combined SVG's viewBox.
   */
  layers?: { layer: string; svg: string }[];
  width?: number;
  height?: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, image, options, svgOptions, texture, textureLayerColors, border, density } = event.data;

  try {
    const result = imageToPenInk(image, options);

    // Density protection thins the drawing only (texture/border are deliberate,
    // separate pens), before the border frames it and the texture goes behind.
    let drawingLines = result.lines;
    if (density) {
      const cellPx = Math.max(1, svgOptions.strokeWidth ?? 1);
      const out = limitStrokeDensity(
        { ...result, lines: drawingLines },
        // Bold outlines are deliberately built from repeated offset passes that
        // run along each other (tapered emphasis) — exempt that pen so density
        // protection never trims the intended bold line.
        { maxPasses: density.maxPasses, cellPx, minOverlapPx: density.minOverlapPx, skipLayers: ['bold'] }
      );
      drawingLines = out.result.lines;
    }

    const borderLines = border
      ? pageBorder({
          width: result.width,
          height: result.height,
          marginPx: border.marginPx,
          insetPx: border.insetPx,
          cornerRadiusPx: border.cornerRadiusPx,
        })
      : [];

    let layerColors = svgOptions.layerColors;
    let texLines: FlowLine[] = [];
    if (texture) {
      // Generate the texture here (the worker holds the result lines) so its
      // halo masks the actual drawing and the border, and lay it behind.
      const avoid = borderLines.length ? [...drawingLines, ...borderLines] : drawingLines;
      texLines = generateTexture({ ...texture, avoid });
      layerColors = { ...layerColors, ...(textureLayerColors ?? { texture: '#c9c2b4' }) };
    }
    if (borderLines.length) {
      layerColors = { ...layerColors, border: layerColors?.border ?? svgOptions.strokeColor ?? '#111111' };
    }

    const finalLines = [...texLines, ...drawingLines, ...borderLines];
    const opts = layerColors ? { ...svgOptions, layerColors } : svgOptions;
    const finalResult = { ...result, lines: finalLines };
    const svg = toSVG(finalResult, opts);

    // One SVG per pen layer for the multi-pen export (border and texture come
    // out on their own layers via their `layer` tags). Sliced here so the
    // serialisation stays off the UI thread alongside the combined render.
    const layers = toSVGLayers(finalResult, opts);

    // The plot window shows the clean, as-plotted output so the density
    // controls' effect reads directly on the artwork.
    const previewSvg = svg;

    const response: RenderResponse = {
      id,
      svg,
      previewSvg,
      layers,
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
