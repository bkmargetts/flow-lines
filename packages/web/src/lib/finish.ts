import {
  limitStrokeDensity,
  toSVG,
  type FlowLine,
  type FlowLinesResult,
  type PageMetrics,
  type SVGOptions,
} from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';
import { buildBorder } from './border';
import { buildTexture } from './texture';

export interface FinishedPlot {
  /** Clean SVG for download. */
  exportSvg: string;
  /** SVG for the plot window — the same clean, as-plotted output. */
  previewSvg: string;
  /** Final composited result (texture + drawing + border) for per-layer export. */
  result: FlowLinesResult;
  svgOptions: SVGOptions;
  hasLayers: boolean;
}

function distinctLayers(lines: FlowLine[]): number {
  const keys = new Set<string>();
  for (const l of lines) keys.add(l.layer ?? l.pen ?? 'default');
  return keys.size;
}

/**
 * Shared finishing pipeline for the main-thread projects (flow-field, conway,
 * complex-flow). Applies the universal density protection to the drawing, frames
 * it with the universal page border, holds the background texture a halo off
 * both, and serialises the clean, as-plotted output for both download and the
 * plot-window preview. Border and density (both from the shared page frame) are pure
 * additions/removals on top of each project's result, so a project's output is
 * unchanged when both are off.
 */
export function finishPlot(
  frame: FrameSettings,
  page: PageMetrics,
  drawing: FlowLinesResult,
  svgOptions: SVGOptions
): FinishedPlot {
  const border = buildBorder(frame, page);

  // Density protection thins the drawing only — texture and border are
  // deliberate, separate pens, never the pile-up we guard against.
  let drawingLines = drawing.lines;
  if (frame.densityEnabled) {
    const cellPx = Math.max(1, svgOptions.strokeWidth ?? 1);
    const out = limitStrokeDensity(
      { ...drawing, lines: drawingLines },
      // Exempt the 'bold' pen: bold lines are deliberately built from repeated
      // offset passes that run along each other, not pile-up to trim.
      {
        maxPasses: frame.densityMaxPasses,
        cellPx,
        minOverlapPx: frame.densityMinOverlapMm * page.pxPerMm,
        skipLayers: ['bold'],
      }
    );
    drawingLines = out.result.lines;
  }

  // Texture sits behind, holding its halo off both the drawing and the border.
  const tex = buildTexture(frame, page, border.length ? [...drawingLines, ...border] : drawingLines);

  const finalLines: FlowLine[] = [...(tex ? tex.lines : []), ...drawingLines, ...border];

  const layerColors: Record<string, string> = { ...(svgOptions.layerColors ?? {}) };
  if (tex) Object.assign(layerColors, tex.layerColors);
  if (border.length) layerColors.border = layerColors.border ?? svgOptions.strokeColor ?? '#111111';
  const opts: SVGOptions =
    Object.keys(layerColors).length > 0 ? { ...svgOptions, layerColors } : { ...svgOptions };

  const result: FlowLinesResult = { ...drawing, lines: finalLines };
  const exportSvg = toSVG(result, opts);

  // The plot window shows exactly what will be drawn — the clean output after
  // density trimming — so the effect of the density controls reads directly on
  // the artwork instead of being masked by ghosts of what was removed.
  const previewSvg = exportSvg;

  return {
    exportSvg,
    previewSvg,
    result,
    svgOptions: opts,
    hasLayers: distinctLayers(finalLines) > 1,
  };
}
