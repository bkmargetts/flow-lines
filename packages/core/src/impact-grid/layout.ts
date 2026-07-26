import type { Point } from '../flow-lines.js';
import { clamp } from '../lib/math.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';

/** One placed square, before any impact: the layout stage's whole output.
 *  The impact stage perturbs these; the render stage draws them — keeping
 *  the pipeline layout-agnostic so new arrangements slot in later. */
export interface PlacedSquare {
  /** Stable per-cell index (row-major over the full lattice) — the seed of
   *  every downstream per-cell random stream, so adding/removing other cells
   *  never reshuffles a cell's character. */
  index: number;
  centre: Point;
  /** Half side length, px. */
  half: number;
  /** Resting rotation, radians. */
  rotation: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  margin: number;
  seed: number;
  layout: 'grid' | 'frame';
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

/** Closed 5-point ring for a square at `centre`, half-side `half`, rotated by
 *  `rotation`. (Conway's `cellSquare` is axis-aligned only — not shared.) */
export function squareAt(centre: Point, half: number, rotation: number): Point[] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corner = (sx: number, sy: number): Point => ({
    x: centre.x + (sx * half * cos - sy * half * sin),
    y: centre.y + (sx * half * sin + sy * half * cos),
  });
  const a = corner(-1, -1);
  return [a, corner(1, -1), corner(1, 1), corner(-1, 1), { x: a.x, y: a.y }];
}

/** The organic lattice: a centred grid of hand-ruled squares. Per-cell white
 *  noise jitters size/position/rotation, and a low-frequency simplex drift
 *  swells and shrinks sizes in neighbourhoods — the difference between a CAD
 *  grid and one ruled by a person. */
export function layoutSquares(o: LayoutOptions): PlacedSquare[] {
  const innerW = o.width - 2 * o.margin;
  const innerH = o.height - 2 * o.margin;
  if (innerW <= 0 || innerH <= 0) return [];

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
  const squares: PlacedSquare[] = [];
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
      squares.push({ index, centre: { x: cx, y: cy }, half, rotation });
    }
  }
  return squares;
}
