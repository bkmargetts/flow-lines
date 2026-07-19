/**
 * Multi-sheet tiling: split one large plot across a grid of smaller physical
 * sheets (an A0 drawing plotted as 5×5 A4 pages). Pure geometry — the grid is
 * computed in millimetres and applied to the finished, already-composited
 * `FlowLinesResult` as clip + translate, so rendering, density protection and
 * plot optimization all ran on the full virtual sheet and every tile is an
 * exact slice of the same drawing.
 *
 * Assembly model: each tile prints its full source band (owned region plus
 * any glue-flap overlap). Trim lines sit at the midpoint of each shared
 * overlap band (with zero overlap they coincide with the butt joint); cutting
 * at the trim marks and butting — or gluing flaps behind neighbours —
 * reconstructs the artwork. The assembly is centered, so leftover sheet
 * coverage splits evenly instead of piling onto the last row/column.
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
 * Trim ticks for one tile, in tile coordinates: where each trim line meets
 * the sheet boundary, a short tick runs from the sheet edge inward along the
 * trim line itself — lay a ruler across the two collinear ticks to cut. With
 * a per-sheet margin the ticks live entirely in the clear border; without
 * one they overlay the outermost sliver of artwork (the poster-tiling
 * convention). Ticks are clipped to the sheet, so a trim line riding the
 * sheet edge leaves no stray marks.
 */
function tileMarks(
  tile: TileSpec,
  lengthMm: number,
  pxPerMm: number
): FlowLine[] {
  const dx = tile.originX - tile.sourceRect.x;
  const dy = tile.originY - tile.sourceRect.y;
  const tx0 = tile.trimRect.x + dx;
  const ty0 = tile.trimRect.y + dy;
  const tx1 = tile.trimRect.x + tile.trimRect.width + dx;
  const ty1 = tile.trimRect.y + tile.trimRect.height + dy;
  const len = lengthMm * pxPerMm;
  const w = tile.widthPx;
  const h = tile.heightPx;
  const seg = (x0: number, y0: number, x1: number, y1: number): Point[] => [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ];
  const ticks: Point[][] = [
    // Vertical trim lines: ticks entering from the top and bottom sheet edges.
    seg(tx0, 0, tx0, len),
    seg(tx0, h - len, tx0, h),
    seg(tx1, 0, tx1, len),
    seg(tx1, h - len, tx1, h),
    // Horizontal trim lines: ticks entering from the left and right sheet edges.
    seg(0, ty0, len, ty0),
    seg(w - len, ty0, w, ty0),
    seg(0, ty1, len, ty1),
    seg(w - len, ty1, w, ty1),
  ];
  const eps = 1e-6;
  const lines: FlowLine[] = [];
  for (const tick of ticks) {
    // A trim line riding the sheet edge needs no mark (nothing to cut).
    const [a, b] = tick;
    if (a.x === b.x && (a.x < eps || a.x > w - eps)) continue;
    if (a.y === b.y && (a.y < eps || a.y > h - eps)) continue;
    for (const run of clipPolylineToRect(tick, 0, 0, w, h)) {
      lines.push({ points: run, pen: 'fine', layer: TILE_MARKS_LAYER });
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
    if (opts.registrationMarks) {
      lines.push(...tileMarks(tile, opts.markLengthMm ?? 5, art.pxPerMm));
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
