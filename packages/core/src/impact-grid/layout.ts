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
}

/** Hard cap so a runaway cell-size knob can't blow up plot time. */
const MAX_CELLS = 4000;

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
    // frame, more so as sizeVariation rises.
    const ragTop = colRng() * pitch * (0.4 + 2 * o.sizeVariation);
    const ragBot = colRng() * pitch * (0.4 + 2 * o.sizeVariation);
    let y = o.margin + ragTop;
    const yEnd = o.margin + innerH - ragBot;
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
