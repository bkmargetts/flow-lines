/**
 * Multi-sheet tiling: split one large plot across a grid of smaller physical
 * sheets (an A0 drawing plotted as 5×5 A4 pages). Pure geometry — the grid is
 * computed in millimetres and applied to the finished, already-composited
 * `FlowLinesResult` as clip + translate, so rendering, density protection and
 * plot optimization all ran on the full virtual sheet and every tile is an
 * exact slice of the same drawing.
 *
 * Assembly model: each tile prints its full source band (owned region plus
 * any glue-flap overlap). Every cut is made exactly on the margin line (the
 * printable-band boundary): trim the margins off each edge that meets a
 * neighbour, then butt the sheets — any glue-flap overlap is pasted BEHIND
 * the neighbour's cut edge, never cut through. The trim marks sit on those
 * margin lines. The assembly is centered, so leftover sheet coverage splits
 * evenly instead of piling onto the last row/column. (`trimRect` still
 * records mid-overlap content ownership — which sheet a given artwork point
 * "belongs" to — used by slicing tests and previews, not by the scissors.)
 */

import type {
  PaperSize,
  Orientation,
  PageMetrics,
  Rect,
} from './paper-sizes.js';
import { orientedDimsMm } from './paper-sizes.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { clipPolylineToRect } from './lib/polyline.js';

export interface TilingOptions {
  /** Physical sheet each tile prints on. */
  sheet: PaperSize;
  sheetOrientation: Orientation;
  /** The artwork frame's margin in millimetres. */
  marginMm: number;
  /**
   * true → each tile keeps `marginMm` of clear paper inside its own sheet
   * (printable region shrinks by 2×margin; trim when assembling — safe for
   * plotters that can't reach the paper edge). false → tiles are raw
   * edge-to-edge slices; only the margin the artwork itself rendered remains,
   * around the assembled whole.
   */
  perSheetMargin: boolean;
  /** Glue-flap overlap: adjacent tiles repeat this much artwork, in mm. 0 = butt join. */
  overlapMm?: number;
  /** Corner trim ticks on their own 'tile-marks' pen layer. */
  registrationMarks?: boolean;
  /** Length of each trim tick, in mm. */
  markLengthMm?: number;
  /**
   * Gap between each tick and the margin line it marks, in mm (default 0 —
   * the tick ends exactly on the line). The offset pushes ticks back toward
   * the paper edge; the plotter-safety clearance still holds, so a crowded
   * margin shortens and eventually drops the ticks rather than letting them
   * near the edge.
   */
  markOffsetMm?: number;
  /**
   * Small + crosses in every corner of every sheet, on their own
   * 'tile-crosses' pen layer — re-register the paper between pen swaps, or
   * plot them in a light ink. They live entirely in the blank margin corner
   * and are dropped when they don't fit.
   */
  registrationCrosses?: boolean;
  /**
   * Distance from the paper edge to each cross's centre, in mm (default 3 —
   * just inside the default trim ticks). Clamped away from the paper edge by
   * the plotter-safety clearance.
   */
  crossOffsetMm?: number;
}

export interface TileSpec {
  /** 0-based grid position. */
  row: number;
  col: number;
  /** Artwork px actually printed on this sheet (owned region + flaps), clamped to the artwork. */
  sourceRect: Rect;
  /** Artwork px this tile owns after trimming flaps — trim lines sit at its edges. */
  trimRect: Rect;
  /** Physical sheet dimensions. */
  widthMm: number;
  heightMm: number;
  /** Sheet raster at the artwork's effective density. */
  widthPx: number;
  heightPx: number;
  /** Where sourceRect's top-left corner lands on this sheet, in tile px. */
  originX: number;
  originY: number;
}

export interface TilingLayout {
  rows: number;
  cols: number;
  /** Row-major, deterministic order. */
  tiles: TileSpec[];
  overlapPx: number;
  /** True when the whole artwork fits on a single sheet. */
  single: boolean;
}

export interface TileResult {
  tile: TileSpec;
  /** Lines in tile coordinates; width/height are the tile's px dims. */
  result: FlowLinesResult;
  /** '210mm'-style physical dims for SVGOptions. */
  physicalWidth: string;
  physicalHeight: string;
}

/** Pen layer carrying registration/trim ticks, colored/weighted like any other layer. */
export const TILE_MARKS_LAYER = 'tile-marks';

/** Pen layer carrying the corner registration crosses. */
export const TILE_CROSSES_LAYER = 'tile-crosses';

/** Half-length of a registration cross arm, in mm (3mm crosses). */
const CROSS_HALF_MM = 1.5;

interface AxisBand {
  /** Printable band in artwork mm (may extend past the artwork on edge tiles). */
  raw0: number;
  /** Band clamped to the artwork. */
  src0: number;
  src1: number;
  /** Owned (post-trim) span, clamped to the artwork. */
  trim0: number;
  trim1: number;
}

/**
 * 1-D tile layout along one axis. All in mm: printable span per sheet `pw`,
 * overlap `o`, artwork extent `aw`. Tiles advance by the stride `pw − o` so
 * neighbours share exactly `o`; the assembly is centered so excess coverage
 * splits evenly between the two edge tiles.
 */
function layoutAxis(aw: number, pw: number, o: number): AxisBand[] {
  const stride = pw - o;
  const count = aw > pw ? Math.max(1, Math.ceil((aw - o) / stride)) : 1;
  const coverage = count * stride + o;
  const origin = -(coverage - aw) / 2;
  const bands: AxisBand[] = [];
  for (let i = 0; i < count; i++) {
    const raw0 = origin + i * stride;
    const raw1 = raw0 + pw;
    // Trim lines sit mid-overlap; the outermost edges trim at the artwork.
    const trim0 = i === 0 ? 0 : origin + i * stride + o / 2;
    const trim1 = i === count - 1 ? aw : origin + (i + 1) * stride + o / 2;
    bands.push({
      raw0,
      src0: Math.max(0, raw0),
      src1: Math.min(aw, raw1),
      trim0: Math.max(0, trim0),
      trim1: Math.min(aw, trim1),
    });
  }
  return bands;
}

/**
 * Compute the sheet grid for splitting artwork of `art`'s physical size
 * across sheets of `opts.sheet`. Throws when the sheet's printable region
 * (sheet − 2×margin when `perSheetMargin`) is degenerate or smaller than the
 * overlap — callers presenting UI should clamp before calling.
 */
export function computeTiling(art: PageMetrics, opts: TilingOptions): TilingLayout {
  const { widthMm: sw, heightMm: sh } = orientedDimsMm(opts.sheet, opts.sheetOrientation);
  const margin = opts.perSheetMargin ? opts.marginMm : 0;
  const o = Math.max(0, opts.overlapMm ?? 0);
  const pw = sw - 2 * margin;
  const ph = sh - 2 * margin;
  if (pw <= 0 || ph <= 0) {
    throw new Error(`Tile sheet too small for its margin: ${sw}×${sh}mm minus 2×${margin}mm`);
  }
  if (o >= pw || o >= ph) {
    throw new Error(`Tile overlap (${o}mm) must be smaller than the printable region (${pw}×${ph}mm)`);
  }
  const k = art.pxPerMm;
  const marginPx = margin * k;
  const colBands = layoutAxis(art.widthMm, pw, o);
  const rowBands = layoutAxis(art.heightMm, ph, o);
  const widthPx = Math.max(1, Math.round(sw * k));
  const heightPx = Math.max(1, Math.round(sh * k));
  const tiles: TileSpec[] = [];
  for (let r = 0; r < rowBands.length; r++) {
    const rb = rowBands[r];
    for (let c = 0; c < colBands.length; c++) {
      const cb = colBands[c];
      tiles.push({
        row: r,
        col: c,
        sourceRect: {
          x: cb.src0 * k,
          y: rb.src0 * k,
          width: (cb.src1 - cb.src0) * k,
          height: (rb.src1 - rb.src0) * k,
        },
        trimRect: {
          x: cb.trim0 * k,
          y: rb.trim0 * k,
          width: (cb.trim1 - cb.trim0) * k,
          height: (rb.trim1 - rb.trim0) * k,
        },
        widthMm: sw,
        heightMm: sh,
        widthPx,
        heightPx,
        originX: marginPx + (cb.src0 - cb.raw0) * k,
        originY: marginPx + (rb.src0 - rb.raw0) * k,
      });
    }
  }
  return {
    rows: rowBands.length,
    cols: colBands.length,
    tiles,
    overlapPx: o * k,
    single: rowBands.length === 1 && colBands.length === 1,
  };
}

/** Shared tile naming for files and labels: 'r1c1' (1-based, row-major). */
export function tileLabel(tile: TileSpec): string {
  return `r${tile.row + 1}c${tile.col + 1}`;
}

/**
 * Trim ticks for one tile, in tile coordinates. Every cut runs exactly along
 * a margin line, so each edge that meets a neighbouring sheet gets a tick at
 * both ends of its cut line, drawn along the line inside the blank margin
 * band: the tick ends precisely on the margin-line corner (where the cut
 * turns) and starts a safety inset short of the paper edge, so a plotter
 * never strokes off the sheet. Outer edges of the assembly are never cut and
 * get no marks; with the per-sheet margin off there is no cut at all.
 */
function tileMarks(
  tile: TileSpec,
  layout: { rows: number; cols: number },
  marginPx: number,
  lengthMm: number,
  offsetPx: number,
  pxPerMm: number
): FlowLine[] {
  if (marginPx <= 0) return [];
  // Along-line tick span within the perpendicular margin band: end on the
  // margin corner (pulled back by any configured offset), start clear of the
  // paper edge. Degenerate combinations (offset or inset eats the whole
  // band) draw nothing rather than something unsafe.
  const edgeClearance = Math.max(1.5 * pxPerMm, 0.2 * marginPx);
  const end = marginPx - offsetPx;
  const start = Math.max(edgeClearance, end - lengthMm * pxPerMm);
  if (end - start < 0.75 * pxPerMm) return [];
  const w = tile.widthPx;
  const h = tile.heightPx;
  const seg = (x0: number, y0: number, x1: number, y1: number): Point[] => [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ];
  const ticks: Point[][] = [];
  // Vertical cut lines (left/right margin lines), ticks in the top and
  // bottom margin bands.
  for (const x of [
    ...(tile.col > 0 ? [marginPx] : []),
    ...(tile.col < layout.cols - 1 ? [w - marginPx] : []),
  ]) {
    ticks.push(seg(x, start, x, end));
    ticks.push(seg(x, h - end, x, h - start));
  }
  // Horizontal cut lines (top/bottom margin lines), ticks in the left and
  // right margin bands.
  for (const y of [
    ...(tile.row > 0 ? [marginPx] : []),
    ...(tile.row < layout.rows - 1 ? [h - marginPx] : []),
  ]) {
    ticks.push(seg(start, y, end, y));
    ticks.push(seg(w - end, y, w - start, y));
  }
  return ticks.map((points) => ({ points, pen: 'fine', layer: TILE_MARKS_LAYER }));
}

/**
 * Registration crosses for one tile, in tile coordinates: a small + in each
 * corner, centred `offsetPx` from both paper edges (clamped away from the
 * edge by the plotter-safety clearance). Crosses must sit entirely inside
 * the blank margin corner — where they'd reach the artwork area they are
 * dropped, never drawn over the drawing.
 */
function tileCrosses(
  tile: TileSpec,
  marginPx: number,
  offsetPx: number,
  pxPerMm: number
): FlowLine[] {
  if (marginPx <= 0) return [];
  const half = CROSS_HALF_MM * pxPerMm;
  // A fixed physical floor (not the ticks' proportional rule): the offset is
  // an explicit user position, so clamp only as far as pen safety demands.
  const c = Math.max(offsetPx, 1.5 * pxPerMm + half);
  if (c + half > marginPx) return [];
  const w = tile.widthPx;
  const h = tile.heightPx;
  const lines: FlowLine[] = [];
  for (const cx of [c, w - c]) {
    for (const cy of [c, h - c]) {
      lines.push({
        points: [
          { x: cx - half, y: cy },
          { x: cx + half, y: cy },
        ],
        pen: 'fine',
        layer: TILE_CROSSES_LAYER,
      });
      lines.push({
        points: [
          { x: cx, y: cy - half },
          { x: cx, y: cy + half },
        ],
        pen: 'fine',
        layer: TILE_CROSSES_LAYER,
      });
    }
  }
  return lines;
}

/**
 * Slice a finished result into one `FlowLinesResult` per tile: every line is
 * clipped to the tile's source band (owned region + flaps) and translated
 * into tile coordinates, preserving `pen` and `layer` so per-layer pens and
 * colors survive into each tile's SVG. Deterministic — pure arithmetic in
 * input order.
 */
export function sliceResultIntoTiles(
  result: FlowLinesResult,
  art: PageMetrics,
  layout: TilingLayout,
  opts: TilingOptions
): TileResult[] {
  return layout.tiles.map((tile) => {
    const { x, y, width, height } = tile.sourceRect;
    const dx = tile.originX - x;
    const dy = tile.originY - y;
    const lines: FlowLine[] = [];
    for (const line of result.lines) {
      for (const run of clipPolylineToRect(line.points, x, y, x + width, y + height)) {
        lines.push({
          ...line,
          points: run.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        });
      }
    }
    const marginPx = opts.perSheetMargin ? opts.marginMm * art.pxPerMm : 0;
    if (opts.registrationMarks) {
      lines.push(
        ...tileMarks(
          tile,
          layout,
          marginPx,
          opts.markLengthMm ?? 5,
          Math.max(0, opts.markOffsetMm ?? 0) * art.pxPerMm,
          art.pxPerMm
        )
      );
    }
    if (opts.registrationCrosses) {
      lines.push(
        ...tileCrosses(
          tile,
          marginPx,
          Math.max(0, opts.crossOffsetMm ?? 3) * art.pxPerMm,
          art.pxPerMm
        )
      );
    }
    return {
      tile,
      result: {
        lines,
        width: tile.widthPx,
        height: tile.heightPx,
        seed: result.seed,
      },
      physicalWidth: `${tile.widthMm}mm`,
      physicalHeight: `${tile.heightMm}mm`,
    };
  });
}
