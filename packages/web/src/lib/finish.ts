import {
  limitStrokeDensity,
  toSVG,
  type FlowLine,
  type FlowLinesResult,
  type PageMetrics,
  type SVGOptions,
} from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';
import type { DensitySettings } from '../PostProcessContext';
import type { DensityStats } from '../OutputContext';
import { buildBorder } from './border';
import { buildTexture } from './texture';

/** Faint ink for the preview-only ghosts of density-removed strokes. */
const REMOVED_COLOR = '#e8a0a0';

export interface FinishedPlot {
  /** Clean SVG for download (no removed-stroke ghosts). */
  exportSvg: string;
  /** SVG for the plot window — clean output plus ghosts of removed strokes. */
  previewSvg: string;
  /** Final composited result (texture + drawing + border) for per-layer export. */
  result: FlowLinesResult;
  svgOptions: SVGOptions;
  hasLayers: boolean;
  densityStats: DensityStats;
}

function distinctLayers(lines: FlowLine[]): number {
  const keys = new Set<string>();
  for (const l of lines) keys.add(l.layer ?? l.pen ?? 'default');
  return keys.size;
}

/**
 * Shared finishing pipeline for the main-thread projects (flow-field, conway,
 * complex-flow). Applies universal density protection to the drawing, frames it
 * with the universal page border, holds the background texture a halo off both,
 * and serialises a clean export plus a preview that ghosts what density removed.
 *
 * Border and density are pure additions/removals layered on top of each
 * project's own result, so a project's output is unchanged when both are off.
 */
export function finishPlot(
  frame: FrameSettings,
  page: PageMetrics,
  drawing: FlowLinesResult,
  svgOptions: SVGOptions,
  density: DensitySettings
): FinishedPlot {
  const border = buildBorder(frame, page);

  // Density protection thins the drawing only — texture and border are
  // deliberate, separate pens, never the pile-up we guard against.
  let drawingLines = drawing.lines;
  let removed: FlowLine[] = [];
  let densityStats: DensityStats = { enabled: false, removedCount: 0, removedTravelMm: 0 };
  if (density.enabled) {
    const cellPx = Math.max(1, svgOptions.strokeWidth ?? 1);
    const out = limitStrokeDensity(
      { ...drawing, lines: drawingLines },
      { maxPasses: density.maxPasses, cellPx }
    );
    drawingLines = out.result.lines;
    removed = out.removed;
    densityStats = {
      enabled: true,
      removedCount: removed.length,
      removedTravelMm: out.removedTravel / page.pxPerMm,
    };
  }

  // Texture sits behind, holding its halo off both the drawing and the border.
  const tex = buildTexture(frame, page, border.length ? [...drawingLines, ...border] : drawingLines);

  const finalLines: FlowLine[] = [
    ...(tex ? tex.lines : []),
    ...drawingLines,
    ...border,
  ];

  const layerColors: Record<string, string> = { ...(svgOptions.layerColors ?? {}) };
  if (tex) layerColors.texture = tex.color;
  if (border.length) layerColors.border = layerColors.border ?? svgOptions.strokeColor ?? '#111111';
  const opts: SVGOptions =
    Object.keys(layerColors).length > 0 ? { ...svgOptions, layerColors } : { ...svgOptions };

  const result: FlowLinesResult = { ...drawing, lines: finalLines };
  const exportSvg = toSVG(result, opts);

  // Preview ghosts the removed strokes on a non-exported 'removed' layer so the
  // plot window shows what density protection stripped.
  let previewSvg = exportSvg;
  if (removed.length > 0) {
    const ghosts: FlowLine[] = removed.map((l) => ({ points: l.points, layer: 'removed' }));
    const previewOpts: SVGOptions = {
      ...opts,
      layerColors: { ...layerColors, removed: REMOVED_COLOR },
    };
    previewSvg = toSVG({ ...drawing, lines: [...finalLines, ...ghosts] }, previewOpts);
  }

  return {
    exportSvg,
    previewSvg,
    result,
    svgOptions: opts,
    hasLayers: distinctLayers(finalLines) > 1,
    densityStats,
  };
}
