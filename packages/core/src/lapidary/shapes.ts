import { Point } from '../flow-lines.js';
import { normalizedBlobBoundary } from '../texture-region.js';
import { createNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp } from '../lib/math.js';

/** Shared angular resolution for every blob silhouette. All nested rings use
 *  the same θ grid so the per-θ monotonic clamp compares like with like. */
export const THETA_SAMPLES = 256;

/**
 * A blob boundary as a per-θ multiplier table on the base ellipse vector
 * e(θ) = (cosθ·rx, sinθ·ry). Values are ≤ 1 (the blob is inscribed in its
 * radius box). Optionally blended with a parent ring's table so nested rings
 * share a family resemblance instead of wobbling independently.
 */
export function blobBoundaryTable(
  seed: number,
  irregularity: number,
  parent: Float64Array | null,
  parentBlend: number
): Float64Array {
  const m = normalizedBlobBoundary(seed, irregularity);
  const table = new Float64Array(THETA_SAMPLES);
  for (let j = 0; j < THETA_SAMPLES; j++) {
    const own = m((j / THETA_SAMPLES) * Math.PI * 2);
    table[j] = parent ? lerp(own, parent[j], parentBlend) : own;
  }
  return table;
}

/** Polygon from a per-θ multiplier table around a centre and radius box. */
export function ringPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  g: Float64Array
): Point[] {
  const poly: Point[] = new Array(THETA_SAMPLES);
  for (let j = 0; j < THETA_SAMPLES; j++) {
    const theta = (j / THETA_SAMPLES) * Math.PI * 2;
    poly[j] = { x: cx + Math.cos(theta) * rx * g[j], y: cy + Math.sin(theta) * ry * g[j] };
  }
  return poly;
}

/**
 * Nested agate rings as per-θ multiplier tables g_i on the shared ellipse
 * base (rx = halfW, ry = halfH). Ring 0 spans `coverage`; each deeper ring
 * shrinks by a seeded-jittered geometric step and re-seeds its own boundary
 * (blended ~40% with its parent). The per-θ clamp keeps every ring at least
 * `minGapPx` inside its parent regardless of irregularity — rings can never
 * invert, so the halo carve always has a real annulus to work with. Rings
 * whose clamped table collapses are dropped (deep nests at small coverage).
 */
export function nestedRingTables(
  seed: number,
  count: number,
  coverage: number,
  irregularity: number,
  halfW: number,
  halfH: number,
  minGapPx: number
): Float64Array[] {
  const rng = makeRandom(subSeed(seed, 1));
  const out: Float64Array[] = [];
  // Ring sizes are log-spaced from `coverage` down to a target core size, so
  // deep nests spread their bands across the whole radius instead of a plain
  // geometric shrink collapsing everything past ring three into the centre.
  const fMin = coverage * lerp(0.32, 0.13, clamp((count - 1) / 6, 0, 1));
  const ratio = count > 1 ? Math.pow(fMin / coverage, 1 / (count - 1)) : 1;
  let f = coverage;
  // The parent's raw (unscaled) shape drives the family blend; its scaled
  // table drives the clamp — mixing the two would compare different units.
  let parentShape: Float64Array | null = null;
  let parentScaled: Float64Array | null = null;
  for (let i = 0; i < count; i++) {
    const shape = blobBoundaryTable(subSeed(seed, 100 + i), irregularity, parentShape, 0.4);
    const scaled = new Float64Array(THETA_SAMPLES);
    let alive = false;
    for (let j = 0; j < THETA_SAMPLES; j++) {
      const theta = (j / THETA_SAMPLES) * Math.PI * 2;
      const baseLen = Math.hypot(Math.cos(theta) * halfW, Math.sin(theta) * halfH);
      let g = f * shape[j];
      if (parentScaled != null) {
        g = Math.min(g, parentScaled[j] - minGapPx / Math.max(1e-6, baseLen));
      }
      scaled[j] = Math.max(0, g);
      if (scaled[j] * baseLen > minGapPx * 1.5) alive = true;
    }
    if (!alive) break;
    out.push(scaled);
    parentShape = shape;
    parentScaled = scaled;
    f *= ratio * lerp(0.9, 1.1, rng());
  }
  return out;
}

/**
 * Noisy horizontal strata boundary curves across [x0, x1]: `count` curves,
 * roughly evenly spaced down [y0, y1] with seeded jitter, each waving with
 * page-space fBm. Curves are clamped monotonically apart by `minGapPx` so
 * bands never cross. Returned top→bottom, each as left→right points.
 */
export function strataCurves(
  seed: number,
  count: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  irregularity: number,
  minGapPx: number
): Point[][] {
  const rng = makeRandom(subSeed(seed, 2));
  const noise = createNoise(subSeed(seed, 3));
  const innerH = y1 - y0;
  const bandH = innerH / (count + 1);
  const amp = irregularity * bandH * 0.55;
  const lambda = Math.max(40, (x1 - x0) / 2.5);
  const step = Math.max(4, (x1 - x0) / 160);
  const curves: Point[][] = [];
  for (let k = 0; k < count; k++) {
    const baseY = y0 + bandH * (k + 1) + (rng() - 0.5) * bandH * 0.5;
    const pts: Point[] = [];
    for (let x = x0; x <= x1 + step * 0.5; x += step) {
      const xc = Math.min(x, x1);
      let y = baseY + amp * noise.fbm(xc / lambda, k * 7.7, 2, 0.5, 2);
      y = Math.min(y1 - minGapPx * 0.5, Math.max(y0 + minGapPx * 0.5, y));
      if (k > 0) {
        const prev = curves[k - 1][pts.length];
        if (prev) y = Math.max(y, prev.y + minGapPx);
      }
      pts.push({ x: xc, y });
      if (xc >= x1) break;
    }
    curves.push(pts);
  }
  return curves;
}
