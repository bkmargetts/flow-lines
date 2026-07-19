import {
  sliceResultIntoTiles,
  toSVG,
  TILE_MARKS_LAYER,
  REGISTRATION_LAYER,
  type FlowLinesResult,
  type PageMetrics,
  type SVGOptions,
  type TilingLayout,
  type TilingOptions,
} from '@flow-lines/core';

export interface SheetsPreview {
  svg: string;
  width: number;
  height: number;
}

/**
 * The split preview the plotter output actually implies: every sheet drawn as
 * its own page — clear, even margin on all four sides when the per-sheet
 * margin is on — laid out on a grid with a small gutter so the page edges
 * read. The artwork is sliced exactly as export slices it, so content runs
 * continuously across the pages' printable areas (trim the margins and butt
 * the sheets to reconstitute the drawing), and glue-flap overlap shows as the
 * repeated band on adjacent pages. Pure string assembly over the same tiler
 * the export uses; recomputed only when the composite or split settings
 * change (a single linear clip pass over the finished lines).
 */
export function buildSheetsPreview(
  result: FlowLinesResult,
  page: PageMetrics,
  layout: TilingLayout,
  opts: TilingOptions,
  svgOptions: SVGOptions,
  paperTone: string
): SheetsPreview {
  const tiles = sliceResultIntoTiles(result, page, layout, opts);
  const tw = layout.tiles[0].widthPx;
  const th = layout.tiles[0].heightPx;
  // Stitch assembly tapes whole sheets edge-to-edge, so the faithful preview
  // has no gutter — the picture visibly continues across the white margins.
  const gutter =
    layout.single || opts.assembly === 'stitch'
      ? 0
      : Math.max(6, Math.round(Math.min(tw, th) * 0.04));
  const width = layout.cols * tw + (layout.cols - 1) * gutter;
  const height = layout.rows * th + (layout.rows - 1) * gutter;
  const tileSvgOptions: SVGOptions = {
    ...svgOptions,
    // The outer document carries the layout; per-tile mm dims belong to the
    // exported sheets, not the preview.
    physicalWidth: undefined,
    physicalHeight: undefined,
    ...(opts.registrationMarks || opts.registrationCrosses
      ? {
          layerColors: {
            ...svgOptions.layerColors,
            [TILE_MARKS_LAYER]: svgOptions.strokeColor ?? '#111111',
            [REGISTRATION_LAYER]: svgOptions.strokeColor ?? '#111111',
          },
        }
      : {}),
  };
  const parts: string[] = [];
  for (const t of tiles) {
    const x = t.tile.col * (tw + gutter);
    const y = t.tile.row * (th + gutter);
    parts.push(
      `  <rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${paperTone}" stroke="rgba(0,0,0,0.28)" stroke-width="1"/>`
    );
    // Nest each sheet's own SVG at its grid slot: the tile keeps its private
    // px coordinate space, the outer document only places it.
    parts.push(
      toSVG(t.result, tileSvgOptions)
        .replace(/^<\?xml[^>]*\?>\s*/, '')
        .replace('<svg xmlns', `<svg x="${x}" y="${y}" xmlns`)
    );
  }
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
    `${parts.join('\n')}\n</svg>`;
  return { svg, width, height };
}
