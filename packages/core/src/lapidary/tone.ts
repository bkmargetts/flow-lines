import { Point } from '../flow-lines.js';
import type { ToneFn } from '../landscape/hatching.js';
import { clamp } from '../lib/math.js';
import { pointInPolygon } from '../lib/polyline.js';
import { SimplexNoise } from '../noise.js';
import type { Region, RegionRadial } from './layout.js';

/**
 * The tone a band holds at its nominal value. `sweepHatch` treats its
 * `baseSpacing` as the pitch at full darkness and opens the family up as tone
 * falls, so a band's value-derived pitch is handed over as
 * `spacing × TONE_REF` and the tone field then swings around `TONE_REF`. Pick
 * it mid-range: high enough that a graded band can still tighten, low enough
 * that it can open without hitting the paper cutoff.
 */
export const TONE_REF = 0.6;

/** A graded band may reach roughly a third of its nominal tone, or one and a
 *  half times it, and no further. Unclamped, a strong gradient dissolves one
 *  edge of the band into paper (which reads as a dropout, not a gradation) or
 *  drives the other into a solid mass. */
const TONE_LO = TONE_REF * 0.35;
const TONE_HI = Math.min(1, TONE_REF * 1.55);

/** Interpolated per-θ table lookup — the idiom three call sites were each
 *  rolling by hand. */
function tableAt(table: Float64Array, theta: number): number {
  const n = table.length;
  const fi = ((((theta / (Math.PI * 2)) * n) % n) + n) % n;
  const j = Math.floor(fi);
  return table[j] + (table[(j + 1) % n] - table[j]) * (fi - j);
}

/** Normalized radius inside a table-built silhouette: 0 at the centre, 1 on
 *  the boundary. */
export function radialRho(f: RegionRadial): (x: number, y: number) => number {
  return (x: number, y: number): number => {
    const ex = (x - f.cx) / f.rx;
    const ey = (y - f.cy) / f.ry;
    const r = Math.hypot(ex, ey);
    if (r === 0) return 0;
    const g = tableAt(f.table, Math.atan2(ey, ex));
    return g > 1e-9 ? r / g : 1;
  };
}

/** Nearest index into an index-aligned edge polyline. Coarse stride first,
 *  then a short refine — a spiral cell is a short arc, so this converges in a
 *  few dozen comparisons rather than walking the whole edge. */
function nearestIndex(edge: Point[], x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  const stride = Math.max(1, Math.floor(edge.length / 16));
  for (let i = 0; i < edge.length; i += stride) {
    const d = (edge[i].x - x) ** 2 + (edge[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const lo = Math.max(0, best - stride);
  const hi = Math.min(edge.length - 1, best + stride);
  for (let i = lo; i <= hi; i++) {
    const d = (edge[i].x - x) ** 2 + (edge[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * How far across its own band a point sits: 0 at the outer/upper edge, 1 at
 * the inner/lower one.
 *
 * Every region kind already carries the geometry to answer this — the radial
 * table, the strata band's bounding curves, the ribbon's index-aligned edges —
 * it was simply never asked. Regions with no such geometry (the full-frame
 * field) return null, and their tone stays flat.
 */
export function acrossBandCoord(region: Region): ((x: number, y: number) => number) | null {
  if (region.radial) {
    const f = region.radial;
    const rho = radialRho(f);
    const inner = f.innerTable;
    if (!inner) return (x, y) => clamp(1 - rho(x, y), 0, 1);
    // Renormalise onto the annulus that survives the carve. Measured across
    // the whole disc, a ring's drawn band occupies only `across` 0..0.35 or
    // so, which turned the gradient into a mostly-uniform tone offset.
    return (x, y) => {
      const theta = Math.atan2((y - f.cy) / f.ry, (x - f.cx) / f.rx);
      const outerG = tableAt(f.table, theta);
      const innerG = tableAt(inner, theta);
      const rhoInner = outerG > 1e-9 ? clamp(innerG / outerG, 0, 0.98) : 0;
      return clamp((1 - rho(x, y)) / (1 - rhoInner), 0, 1);
    };
  }

  if (region.strataBand) {
    const { top, bottom } = region.strataBand;
    if (top.length < 2 || top.length !== bottom.length) return null;
    const x0 = top[0].x;
    const span = top[top.length - 1].x - x0;
    if (!(Math.abs(span) > 1e-6)) return null;
    return (x, y) => {
      // The curves share one x grid, so the index is a direct lookup.
      const f = clamp((x - x0) / span, 0, 1) * (top.length - 1);
      const i = Math.min(top.length - 2, Math.floor(f));
      const t = f - i;
      const yTop = top[i].y + (top[i + 1].y - top[i].y) * t;
      const yBot = bottom[i].y + (bottom[i + 1].y - bottom[i].y) * t;
      const h = yBot - yTop;
      return Math.abs(h) < 1e-6 ? 0.5 : clamp((y - yTop) / h, 0, 1);
    };
  }

  if (region.ribbon) {
    const { outer, inner } = region.ribbon;
    const m = Math.min(outer.length, inner.length);
    if (m < 2) return null;
    return (x, y) => {
      const i = Math.min(m - 1, nearestIndex(outer, x, y));
      const ax = inner[i].x - outer[i].x;
      const ay = inner[i].y - outer[i].y;
      const len2 = ax * ax + ay * ay;
      if (len2 < 1e-9) return 0.5;
      return clamp(((x - outer[i].x) * ax + (y - outer[i].y) * ay) / len2, 0, 1);
    };
  }

  return null;
}

/**
 * The band's tone field: its planned value, graduated across its own width.
 *
 * A flat tone across every band is the printed-screen tell — real agate
 * darkens from one edge of a band to the other, and so does any hatching laid
 * down by hand. The ramp carries a little low-frequency noise so it reads as
 * worked material rather than as a mathematical gradient.
 */
/** Points sampled over the region to learn how `across` is actually
 *  distributed there. A ring is a disc, a strata bed is a slab and a spiral
 *  cell is a curved quad, so `across` is emphatically *not* uniform over any of
 *  them — normalising against a uniform assumption overshoots as badly as not
 *  normalising at all undershoots. */
const AREA_SAMPLES = 512;

export function regionTone(region: Region, noise: SimplexNoise): ToneFn {
  const t = region.tex;
  const across = acrossBandCoord(region);
  if (!across || t.gradient === 0) {
    const flat = clamp(TONE_REF, TONE_LO, TONE_HI);
    return () => flat;
  }
  const g = t.gradient;
  const lambda = Math.max(36, t.spacing * 16);

  // Hold the tone field's AREA MEAN on TONE_REF, and a gradation redistributes
  // ink instead of deleting it.
  //
  // Worth spelling out, because the obvious guess is wrong. `sweepHatch` steps
  // `s += base / meanTone`, so rows crowd where tone is high and the row *count*
  // follows a harmonic law — but ink is rows times chord length, and
  // `chord(s) x meanTone(s)` integrates to the tone integral over the area. So
  // ink is `(1/base) x ∫∫ tone dA` and the invariant is the plain arithmetic
  // mean over the region. `blueNoiseSeeds` lands a dot density proportional to
  // tone, giving the same integral, so one normalisation serves both.
  //
  // It has to be measured over the region's own geometry, not assumed uniform:
  // on a disc, area density goes as rho, so `across = 1 - rho` averages 1/3
  // rather than 1/2 and an un-normalised ramp comes out `1 - g/3` light — which
  // is the 18% loss that started this.
  //
  // Sample the polygon once by area, then iterate on the cached values, since
  // the clamps make the solve implicit.
  const ws: number[] = [];
  {
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (const p of region.poly) {
      if (p.x < bx0) bx0 = p.x;
      if (p.y < by0) by0 = p.y;
      if (p.x > bx1) bx1 = p.x;
      if (p.y > by1) by1 = p.y;
    }
    // A fixed low-discrepancy lattice, so the factor is deterministic and does
    // not consume any of the band's seeded stream.
    const golden = 0.618033988749895;
    for (let i = 0; i < AREA_SAMPLES; i++) {
      const u = (i + 0.5) / AREA_SAMPLES;
      const v = (i * golden) % 1;
      const x = bx0 + u * (bx1 - bx0);
      const y = by0 + v * (by1 - by0);
      if (pointInPolygon(region.poly, x, y)) ws.push(across(x, y));
    }
  }
  const shaped = (w: number, k: number): number =>
    clamp(TONE_REF * k * (1 + g * (2 * w - 1)), TONE_LO, TONE_HI);
  let k = 1;
  if (ws.length > 8) {
    for (let pass = 0; pass < 4; pass++) {
      let acc = 0;
      for (const w of ws) acc += shaped(w, k);
      const got = acc / ws.length;
      if (Math.abs(got - TONE_REF) < 1e-4) break;
      k *= TONE_REF / got;
    }
  }

  return (x, y) => {
    const ramp = 1 + g * (2 * across(x, y) - 1);
    const grain = 1 + 0.12 * Math.abs(g) * noise.fbm(x / lambda, y / lambda, 2, 0.5, 2);
    return clamp(TONE_REF * k * ramp * grain, TONE_LO, TONE_HI);
  };
}
