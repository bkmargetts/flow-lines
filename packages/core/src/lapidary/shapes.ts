import { Point } from '../flow-lines.js';
import { normalizedBlobBoundary } from '../texture-region.js';
import { createNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp } from '../lib/math.js';

/** Shared angular resolution for every blob silhouette. All nested rings use
 *  the same θ grid so the per-θ monotonic clamp compares like with like. */
export const THETA_SAMPLES = 256;

/** Per-band silhouette language: organic blobs or straight-edged facets. */
export type LapidaryShape = 'organic' | 'angular';

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

/**
 * An angular (inorganic) boundary as the same kind of per-θ table: 5–8
 * seeded vertices with jittered angles and radii, connected by straight
 * chords — the polar form of the chord through (r1,θ1)-(r2,θ2) is exact, so
 * the table IS the polygon and the whole nesting/clamp/sampling pipeline is
 * shared with the organic blobs (the ellipse scaling is affine, so chords
 * stay straight on the page). Normalized to a max of 1 like the blobs.
 */
export function angularBoundaryTable(seed: number, irregularity: number): Float64Array {
  const rng = makeRandom(seed);
  const irr = clamp(irregularity, 0, 1);
  const n = 5 + Math.floor(rng() * 4); // 5..8 vertices
  const angs: number[] = new Array(n);
  const radii: number[] = new Array(n);
  let maxR = 0;
  for (let v = 0; v < n; v++) {
    angs[v] = ((v + 0.5 + (rng() - 0.5) * (0.3 + 0.5 * irr)) / n) * Math.PI * 2;
    radii[v] = 1 - rng() * (0.12 + 0.38 * irr);
    if (radii[v] > maxR) maxR = radii[v];
  }
  const table = new Float64Array(THETA_SAMPLES);
  for (let j = 0; j < THETA_SAMPLES; j++) {
    const theta = (j / THETA_SAMPLES) * Math.PI * 2;
    // Bracketing vertices around θ (angles are sorted by construction; the
    // wrap segment is unrolled by ±2π depending on which side θ sits).
    let v = -1;
    for (let k = 0; k < n; k++) {
      if (angs[k] <= theta) v = k;
      else break;
    }
    const a = (v + n) % n;
    const b = (a + 1) % n;
    let th1 = angs[a];
    let th2 = angs[b];
    if (v < 0) th1 -= Math.PI * 2;
    else if (b === 0) th2 += Math.PI * 2;
    const r1 = radii[a];
    const r2 = radii[b];
    // r(θ) of the straight chord through the two polar vertices.
    const denom = r1 * Math.sin(theta - th1) + r2 * Math.sin(th2 - theta);
    const r = Math.abs(denom) < 1e-9 ? r1 : (r1 * r2 * Math.sin(th2 - th1)) / denom;
    table[j] = Math.max(0.05, r) / maxR;
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
 * (`shapeFor` picks each ring's language: organic blobs blend ~40% with
 * their parent for family resemblance; angular facets never blend — the
 * corners are the point). The per-θ clamp keeps every ring at least
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
  minGapPx: number,
  shapeFor: (ring: number) => LapidaryShape
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
    const shape: Float64Array =
      shapeFor(i) === 'angular'
        ? angularBoundaryTable(subSeed(seed, 100 + i), irregularity)
        : blobBoundaryTable(subSeed(seed, 100 + i), irregularity, parentShape, 0.4);
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
 * roughly evenly spaced down [y0, y1] with seeded jitter. `styleFor` picks
 * each curve's language: organic curves wave with page-space fBm; angular
 * curves are stepped terraces — flat runs at seeded levels with near-vertical
 * jumps (piecewise-constant on the shared x grid, so the monotonic clamp
 * against the curve above still lines up sample-for-sample). Curves are
 * clamped monotonically apart by `minGapPx` so bands never cross. Returned
 * top→bottom, each as left→right points.
 */
export function strataCurves(
  seed: number,
  count: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  irregularity: number,
  minGapPx: number,
  styleFor: (curve: number) => LapidaryShape
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
    const angular = styleFor(k) === 'angular';
    // Stepped level function for angular curves: 2-5 seeded breakpoints,
    // each run at its own level.
    let levelAt: ((x: number) => number) | null = null;
    if (angular) {
      const stepAmp = irregularity * bandH * 0.8;
      const jumps = 2 + Math.floor(rng() * 4);
      const cuts: number[] = [];
      for (let j = 0; j < jumps; j++) cuts.push(x0 + (x1 - x0) * (0.1 + 0.8 * rng()));
      cuts.sort((p, q) => p - q);
      const levels = [baseY + (rng() - 0.5) * stepAmp * 2];
      for (let j = 0; j < jumps; j++) levels.push(baseY + (rng() - 0.5) * stepAmp * 2);
      levelAt = (x: number): number => {
        let idx = 0;
        while (idx < cuts.length && x >= cuts[idx]) idx++;
        return levels[idx];
      };
    }
    const pts: Point[] = [];
    for (let x = x0; x <= x1 + step * 0.5; x += step) {
      const xc = Math.min(x, x1);
      let y = levelAt ? levelAt(xc) : baseY + amp * noise.fbm(xc / lambda, k * 7.7, 2, 0.5, 2);
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
