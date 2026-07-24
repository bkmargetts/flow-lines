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
  type TileResult,
} from '@flow-lines/core';

export interface SheetsPreview {
  svg: string;
  width: number;
  height: number;
}

/** Per-tile SVGOptions for previews: no per-sheet mm dims (the outer document
 *  carries the layout), marks/crosses layers forced to ink so they render. */
function tilePreviewSvgOptions(opts: TilingOptions, svgOptions: SVGOptions): SVGOptions {
  return {
    ...svgOptions,
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
}

/** Nest one sheet's own SVG at a grid slot: the tile keeps its private px
 *  coordinate space, the outer document only places it. */
function nestTileSvg(t: TileResult, svgOptions: SVGOptions, x: number, y: number): string {
  return toSVG(t.result, svgOptions)
    .replace(/^<\?xml[^>]*\?>\s*/, '')
    .replace('<svg xmlns', `<svg x="${x}" y="${y}" xmlns`);
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
  const tileSvgOptions = tilePreviewSvgOptions(opts, svgOptions);
  const parts: string[] = [];
  for (const t of tiles) {
    const x = t.tile.col * (tw + gutter);
    const y = t.tile.row * (th + gutter);
    parts.push(
      `  <rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${paperTone}" stroke="rgba(0,0,0,0.28)" stroke-width="1"/>`
    );
    parts.push(nestTileSvg(t, tileSvgOptions, x, y));
  }
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
    `${parts.join('\n')}\n</svg>`;
  return { svg, width, height };
}

/**
 * The assembled overview — the total expected sheet: every page composed at
 * its final taped position (edge to edge, margins intact) so the whole work
 * reads as one, with solid strokes on the sheet edges and dashed lines on
 * the cut lines (the margin lines of edges that meet a neighbour). This is
 * how the sheets piece into the larger plot before any trimming; in exact-fit
 * assembly the outline is the artwork page itself. Same tiler as export.
 */
export function buildAssembledPreview(
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
  const width = layout.cols * tw;
  const height = layout.rows * th;
  const marginPx = opts.perSheetMargin ? opts.marginMm * page.pxPerMm : 0;
  const tileSvgOptions = tilePreviewSvgOptions(opts, svgOptions);
  const parts: string[] = [];
  const cuts: string[] = [];
  const dash = `stroke="rgba(180,60,60,0.5)" stroke-width="1" stroke-dasharray="6 4"`;
  for (const t of tiles) {
    const x = t.tile.col * tw;
    const y = t.tile.row * th;
    parts.push(
      `  <rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${paperTone}" stroke="rgba(0,0,0,0.28)" stroke-width="1"/>`
    );
    parts.push(nestTileSvg(t, tileSvgOptions, x, y));
    if (marginPx > 0) {
      // Cut lines sit on the margin lines of edges that meet a neighbour —
      // the same edges that carry trim marks. Overlaid last so they read
      // above the artwork.
      const { row, col } = t.tile;
      if (col > 0) cuts.push(`  <line x1="${x + marginPx}" y1="${y}" x2="${x + marginPx}" y2="${y + th}" ${dash}/>`);
      if (col < layout.cols - 1)
        cuts.push(`  <line x1="${x + tw - marginPx}" y1="${y}" x2="${x + tw - marginPx}" y2="${y + th}" ${dash}/>`);
      if (row > 0) cuts.push(`  <line x1="${x}" y1="${y + marginPx}" x2="${x + tw}" y2="${y + marginPx}" ${dash}/>`);
      if (row < layout.rows - 1)
        cuts.push(`  <line x1="${x}" y1="${y + th - marginPx}" x2="${x + tw}" y2="${y + th - marginPx}" ${dash}/>`);
    }
  }
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
    `${[...parts, ...cuts].join('\n')}\n</svg>`;
  return { svg, width, height };
}
