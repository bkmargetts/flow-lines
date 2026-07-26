import type { Point } from '../flow-lines.js';
import { clamp } from '../lib/math.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';

/** One placed cell, before any impact: the layout stage's whole output.
 *  The impact stage perturbs these; the render stage draws them — keeping
 *  the pipeline layout-agnostic so new arrangements slot in later. */
export interface PlacedCell {
  /** Stable per-cell index — the seed of every downstream per-cell random
   *  stream, so adding/removing other cells never reshuffles a cell's
   *  character. */
  index: number;
  centre: Point;
  /** Half extents, px (hx = hy for square cells). */
  hx: number;
  hy: number;
  /** Resting rotation, radians. */
  rotation: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  margin: number;
  seed: number;
  layout: 'grid' | 'frame' | 'bars';
  frameDepth: number;
  cellSize: number;
  sizeVariation: number;
  positionJitter: number;
  rotationJitter: number;
  gap: number;
  penWidth: number;
  region: RegionSpec;
}

/** Hard cap so a runaway cell-size knob can't blow up plot time. */
const MAX_CELLS = 4000;

/** The slab the mosaic occupies — a shaped object floating in paper, per
 *  the reference compositions, whose boundary the damage can erode. */
export type RegionKind = 'slab' | 'band' | 'disc' | 'full';

export interface RegionSpec {
  contains(x: number, y: number): boolean;
  /** Distance inside the boundary (0 outside) — the "penetration depth". */
  depth(x: number, y: number): number;
  /** Vertical extent of the region at column x, or null if outside. */
  yRange(x: number): [number, number] | null;
  centroid: Point;
  /** Half-diagonal — the pane-stress reach is scaled from this. */
  extent: number;
}

export function makeRegion(
  kind: RegionKind,
  width: number,
  height: number,
  margin: number
): RegionSpec {
  const innerW = width - 2 * margin;
  const innerH = height - 2 * margin;
  const rect = (x0: number, y0: number, x1: number, y1: number): RegionSpec => ({
    contains: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    depth: (x, y) =>
      Math.max(0, Math.min(x - x0, x1 - x, y - y0, y1 - y)),
    yRange: (x) => (x >= x0 && x <= x1 ? [y0, y1] : null),
    centroid: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    extent: Math.hypot(x1 - x0, y1 - y0) / 2,
  });
  switch (kind) {
    case 'full':
      return rect(margin, margin, width - margin, height - margin);
    case 'slab':
      return rect(
        margin + innerW * 0.08,
        margin + innerH * 0.15,
        width - margin - innerW * 0.08,
        height - margin - innerH * 0.15
      );
    case 'band':
      return rect(
        margin,
        margin + innerH * 0.29,
        width - margin,
        height - margin - innerH * 0.29
      );
    case 'disc': {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(innerW, innerH) * 0.4;
      return {
        contains: (x, y) => Math.hypot(x - cx, y - cy) <= r,
        depth: (x, y) => Math.max(0, r - Math.hypot(x - cx, y - cy)),
        yRange: (x) => {
          const dx = Math.abs(x - cx);
          if (dx >= r) return null;
          const h = Math.sqrt(r * r - dx * dx);
          return [cy - h, cy + h];
        },
        centroid: { x: cx, y: cy },
        extent: r,
      };
    }
  }
}

/** Closed 5-point ring for a rectangle at `centre`, half-extents `hx`/`hy`,
 *  rotated by `rotation`. */
export function rectAt(centre: Point, hx: number, hy: number, rotation: number): Point[] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corner = (sx: number, sy: number): Point => ({
    x: centre.x + (sx * hx * cos - sy * hy * sin),
    y: centre.y + (sx * hx * sin + sy * hy * cos),
  });
  const a = corner(-1, -1);
  return [a, corner(1, -1), corner(1, 1), corner(-1, 1), { x: a.x, y: a.y }];
}

/** Square convenience wrapper kept for the square-cell layouts. */
export function squareAt(centre: Point, half: number, rotation: number): Point[] {
  return rectAt(centre, half, half, rotation);
}

/**
 * The cell mosaic. 'grid' packs squares over the whole framed page; 'frame'
 * keeps only a border band of that grid; 'bars' builds tall columns of
 * stacked segments with ragged tops and bottoms — the vertical-strip
 * composition. Per-cell jitter plus a low-frequency simplex drift keep the
 * order configurable from near-perfect to hand-disordered.
 */
export function layoutCells(o: LayoutOptions): PlacedCell[] {
  const innerW = o.width - 2 * o.margin;
  const innerH = o.height - 2 * o.margin;
  if (innerW <= 0 || innerH <= 0) return [];
  if (o.layout === 'bars') return layoutBars(o, innerW, innerH);

  let pitch = Math.max(2, o.cellSize);
  if ((innerW / pitch) * (innerH / pitch) > MAX_CELLS) {
    pitch = Math.sqrt((innerW * innerH) / MAX_CELLS);
  }
  const cols = Math.floor(innerW / pitch);
  const rows = Math.floor(innerH / pitch);
  if (cols < 2 || rows < 2) return [];
  const originX = o.margin + (innerW - cols * pitch) / 2;
  const originY = o.margin + (innerH - rows * pitch) / 2;

  const drift = createNoise(subSeed(o.seed, 1));
  const depth = Math.max(1, Math.round(o.frameDepth));
  const cells: PlacedCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (
        o.layout === 'frame' &&
        row >= depth &&
        row < rows - depth &&
        col >= depth &&
        col < cols - depth
      ) {
        continue;
      }
      const index = row * cols + col;
      const rng = makeRandom(subSeed(o.seed, index));
      const cx = originX + (col + 0.5) * pitch + o.positionJitter * pitch * 0.35 * (2 * rng() - 1);
      const cy = originY + (row + 0.5) * pitch + o.positionJitter * pitch * 0.35 * (2 * rng() - 1);
      if (!o.region.contains(cx, cy)) continue;
      let half = (pitch / 2) * (1 - o.gap) * (1 + o.sizeVariation * 0.45 * (2 * rng() - 1));
      half *= 1 + 0.12 * drift.fbm(cx * 0.01, cy * 0.01, 2, 0.5, 2);
      half = clamp(half, o.penWidth, pitch);
      const rotation = o.rotationJitter * (Math.PI / 18) * (2 * rng() - 1);
      cells.push({ index, centre: { x: cx, y: cy }, hx: half, hy: half, rotation });
    }
  }
  return cells;
}

/** Columns of stacked segments spanning the page height, with ragged column
 *  ends and per-segment heights — the dense vertical-bar composition. */
function layoutBars(o: LayoutOptions, innerW: number, innerH: number): PlacedCell[] {
  const pitch = Math.max(2, o.cellSize);
  const colRng = makeRandom(subSeed(o.seed, 9));
  const cells: PlacedCell[] = [];
  let index = 0;
  let x = o.margin;
  while (x < o.margin + innerW - pitch * 0.4 && cells.length < MAX_CELLS) {
    const w = pitch * (0.55 + 0.5 * colRng()) * (1 + o.sizeVariation * 0.5 * (2 * colRng() - 1));
    if (x + w > o.margin + innerW) break;
    // Ragged column ends: each bar starts and stops a little short of the
    // region's edge at this column, more so as sizeVariation rises.
    const ragTop = colRng() * pitch * (0.4 + 2 * o.sizeVariation);
    const ragBot = colRng() * pitch * (0.4 + 2 * o.sizeVariation);
    const range = o.region.yRange(x + w / 2);
    if (!range) {
      x += w + o.gap * pitch * 0.5;
      continue;
    }
    let y = range[0] + ragTop;
    const yEnd = range[1] - ragBot;
    while (y < yEnd && cells.length < MAX_CELLS) {
      const rng = makeRandom(subSeed(o.seed, 100000 + index));
      const h = Math.min(
        pitch * (0.7 + 2.6 * rng()) * (1 + o.sizeVariation * rng()),
        yEnd - y
      );
      if (h < o.penWidth * 2) break;
      const gapPx = o.gap * pitch * 0.5;
      const cx = x + w / 2 + o.positionJitter * pitch * 0.2 * (2 * rng() - 1);
      const cy = y + h / 2 + o.positionJitter * pitch * 0.2 * (2 * rng() - 1);
      const rotation = o.rotationJitter * (Math.PI / 36) * (2 * rng() - 1);
      cells.push({
        index: 100000 + index,
        centre: { x: cx, y: cy },
        hx: Math.max(o.penWidth, (w - gapPx) / 2),
        hy: Math.max(o.penWidth, (h - gapPx) / 2),
        rotation,
      });
      index++;
      y += h;
    }
    x += w + o.gap * pitch * 0.5;
  }
  return cells;
}
