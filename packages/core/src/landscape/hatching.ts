import { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { lerp } from '../lib/math.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** A runaway guard: never emit more strokes than this, however dense the knobs. */
const LINE_CAP = 90000;

// ——————————————————————————————————————————————————————————————————————
// Geometry helpers
// ——————————————————————————————————————————————————————————————————————

/** Append `pts` as a FlowLine if it has enough points to draw. */
export function pushRun(out: FlowLine[], pts: Point[], layer: string, pen?: 'fine' | 'bold'): void {
  if (out.length >= LINE_CAP) return;
  if (pts.length >= 2) out.push({ points: pts, layer, ...(pen ? { pen } : {}) });
}

/** Subdivide a straight segment so the hand-drawn finish can bow it. */
export function densifySegment(a: Point, b: Point, step: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.min(40, Math.round(len / step)));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return pts;
}

/** Linear-interpolated y of a left→right profile at an arbitrary x. */
export function sampleProfileY(profile: Point[], x: number): number {
  if (x <= profile[0].x) return profile[0].y;
  const last = profile[profile.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].x >= x) {
      const a = profile[i - 1];
      const b = profile[i];
      const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
      return lerp(a.y, b.y, t);
    }
  }
  return last.y;
}

/** Inside-intervals of the infinite line P(t)=O+t·D against a closed simple
 *  polygon, as sorted [tEnter,tExit] pairs (even-odd parity, half-open edges). */
export function clipLineToPolygon(poly: Point[], O: Point, D: Point): [number, number][] {
  const ts: number[] = [];
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const det = ex * D.y - ey * D.x;
    if (Math.abs(det) < 1e-9) continue;
    const rx = a.x - O.x;
    const ry = a.y - O.y;
    const u = (D.x * ry - D.y * rx) / det;
    if (u < 0 || u >= 1) continue;
    const t = (ex * ry - ey * rx) / det;
    ts.push(t);
  }
  if (ts.length < 2) return [];
  ts.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < ts.length; i += 2) {
    if (ts[i + 1] - ts[i] > 1e-6) out.push([ts[i], ts[i + 1]]);
  }
  return out;
}

// ——————————————————————————————————————————————————————————————————————
// Hatch craft
// ——————————————————————————————————————————————————————————————————————

/** Per-stroke craft: a shared rng, end-taper amount, angle jitter, subdivision. */
export interface Craft {
  rng: () => number;
  taper: number;
  jitter: number; // radians
  subStep: number;
}

/** A tone field: darkness 0..1 at a location (1 = tight hatch / dark). */
export type ToneFn = (x: number, y: number) => number;

/** Emit one hatch stroke A→B with tapered/broken ends and a slight per-stroke
 *  rotation, so a region's hatch never looks like a printed screen. */
export function emitStroke(out: FlowLine[], A: Point, B: Point, layer: string, craft: Craft): void {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (len < 1.5) return;
  const ux = dx / len;
  const uy = dy / len;
  const maxTrim = Math.min(len * 0.35, 8) * craft.taper;
  let a = craft.rng() * maxTrim * 0.7;
  let b = len - craft.rng() * maxTrim * 0.7;
  if (b - a < 1.5) {
    a = 0;
    b = len;
  }
  const segs: [number, number][] = [];
  if (craft.taper > 0 && b - a > 16 && craft.rng() < craft.taper * 0.22) {
    const g = 2 + craft.rng() * 4;
    const m = a + (0.4 + 0.2 * craft.rng()) * (b - a);
    segs.push([a, m - g / 2]);
    segs.push([m + g / 2, b]);
  } else {
    segs.push([a, b]);
  }
  const ang = (craft.rng() * 2 - 1) * craft.jitter;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const mx = A.x + ux * ((a + b) / 2);
  const my = A.y + uy * ((a + b) / 2);
  const at = (t: number): Point => {
    const x = A.x + ux * t;
    const y = A.y + uy * t;
    const rx = x - mx;
    const ry = y - my;
    return { x: mx + rx * ca - ry * sa, y: my + rx * sa + ry * ca };
  };
  for (const [s, e] of segs) {
    if (e - s < 1.5) continue;
    pushRun(out, densifySegment(at(s), at(e), craft.subStep), layer);
  }
}

/** Emit a hatch run as a chain of SHORT strokes (with small pen-up gaps) when
 *  it would otherwise span the whole band — real hill hatching is built from
 *  short marks, not band-long lines. `maxLen <= 0` keeps the run whole. */
function emitHatchRun(out: FlowLine[], A: Point, B: Point, layer: string, craft: Craft, maxLen: number): void {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (maxLen <= 0 || len <= maxLen * 1.25) {
    emitStroke(out, A, B, layer, craft);
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  let t = 0;
  let guard = 0;
  while (t < len - 1 && guard++ < 200) {
    const seg = maxLen * (0.7 + 0.6 * craft.rng());
    const e = Math.min(len, t + seg);
    emitStroke(out, { x: A.x + ux * t, y: A.y + uy * t }, { x: A.x + ux * e, y: A.y + uy * e }, layer, craft);
    t = e + 1.5 + craft.rng() * 3.5;
  }
}

/** Hand-sized low-frequency patch mask, so cross-hatch builds up in worked
 *  patches instead of an even screen (deeper layers patchier). */
function makePatchMask(noise: SimplexNoise, x: number, y: number, layer: number, scale: number, amount: number): boolean {
  if (amount <= 0) return true;
  const freq = 1 / Math.max(1, scale);
  const cut = -1 + amount * (0.5 + 0.35 * Math.max(0, layer - 1));
  return noise.noise2D(x * freq, y * freq) > cut;
}

export type BreakFn = (t0: number, t1: number, O: Point, D: Point, rng: () => number) => [number, number][];

/** A family of parallel hatch lines across `poly` at `angleDeg`. Local spacing
 *  opens where `tone` is light (atmospheric perspective). `gate` lets a layer
 *  fill only the dark/patchy parts (cross-hatch). `breakFn` dashes the run. */
export function sweepHatch(
  out: FlowLine[],
  poly: Point[],
  angleDeg: number,
  baseSpacing: number,
  tone: ToneFn,
  gate: (x: number, y: number, t: number) => boolean,
  layer: string,
  craft: Craft,
  breakFn?: BreakFn,
  maxLen = 0
): void {
  const ang = angleDeg * DEG;
  const dir: Point = { x: Math.cos(ang), y: Math.sin(ang) };
  const nrm: Point = { x: -Math.sin(ang), y: Math.cos(ang) };
  let sMin = Infinity;
  let sMax = -Infinity;
  for (const p of poly) {
    const s = nrm.x * p.x + nrm.y * p.y;
    if (s < sMin) sMin = s;
    if (s > sMax) sMax = s;
  }
  let s = sMin + craft.rng() * baseSpacing;
  let guard = 0;
  while (s <= sMax && guard++ < 6000) {
    const O: Point = { x: nrm.x * s, y: nrm.y * s };
    const runs = clipLineToPolygon(poly, O, dir);
    let stepTone = 0.5;
    for (const [t0, t1] of runs) {
      const mt = (t0 + t1) / 2;
      const mx = O.x + dir.x * mt;
      const my = O.y + dir.y * mt;
      const tv = tone(mx, my);
      if (tv > stepTone) stepTone = tv;
      if (!gate(mx, my, tv)) continue;
      const pieces = breakFn ? breakFn(t0, t1, O, dir, craft.rng) : ([[t0, t1]] as [number, number][]);
      for (const [a, b] of pieces) {
        emitHatchRun(out, { x: O.x + dir.x * a, y: O.y + dir.y * a }, { x: O.x + dir.x * b, y: O.y + dir.y * b }, layer, craft, maxLen);
      }
    }
    s += Math.max(0.8, baseSpacing / Math.max(0.18, stepTone));
  }
}

/** Cross-contour comb: short strokes dropped from the silhouette `upper` along
 *  the local slope-normal, clipped to the band — hatch that wraps the hill. */
function combHatch(out: FlowLine[], upper: Point[], poly: Point[], baseSpacing: number, tone: ToneFn, layer: string, craft: Craft, maxLen = 0): void {
  const x0 = upper[0].x;
  const x1 = upper[upper.length - 1].x;
  let x = x0 + craft.rng() * baseSpacing;
  let guard = 0;
  while (x <= x1 && guard++ < 4000) {
    const yTop = sampleProfileY(upper, x);
    const xa = Math.max(x0, x - 3);
    const xb = Math.min(x1, x + 3);
    const tx = xb - xa;
    const ty = sampleProfileY(upper, xb) - sampleProfileY(upper, xa);
    const tl = Math.hypot(tx, ty) || 1;
    let nx = -ty / tl;
    let ny = tx / tl;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const O: Point = { x: x + nx * 0.5, y: yTop + ny * 0.5 + 0.5 };
    const dir: Point = { x: nx, y: ny };
    const runs = clipLineToPolygon(poly, O, dir);
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const iv of runs) {
      if (iv[1] <= 0) continue;
      const d = Math.abs(iv[0]);
      if (d < bd) {
        bd = d;
        best = iv;
      }
    }
    const tv = tone(x, yTop);
    if (best) {
      const a = Math.max(0, best[0]);
      const b = best[1];
      if (b - a > 1.5) emitHatchRun(out, { x: O.x + dir.x * a, y: O.y + dir.y * a }, { x: O.x + dir.x * b, y: O.y + dir.y * b }, layer, craft, maxLen);
    }
    x += Math.max(0.8, baseSpacing / Math.max(0.18, tv));
  }
}

export interface LandParams {
  rng: () => number;
  taper: number;
  jitter: number;
  formFollow: boolean;
  baseAngleDeg: number;
  crossHatch: number;
  patchiness: number;
  patchNoise: SimplexNoise;
  maxLen: number;
}

/** Hatch a land band: a base pass (form-following comb or straight sweep) plus
 *  cross-hatch shadow layers gated by tone + patchiness. Strokes are kept short
 *  (`maxLen`) so the band reads as worked hatching, not band-long lines. */
export function hatchLand(out: FlowLine[], upper: Point[], poly: Point[], tone: ToneFn, baseSpacing: number, layer: string, p: LandParams): void {
  const craft: Craft = { rng: p.rng, taper: p.taper, jitter: p.jitter, subStep: 12 };
  if (p.formFollow) combHatch(out, upper, poly, baseSpacing, tone, layer, craft, p.maxLen);
  else sweepHatch(out, poly, p.baseAngleDeg, baseSpacing, tone, () => true, layer, craft, undefined, p.maxLen);
  const light: Craft = { rng: p.rng, taper: Math.min(1, p.taper + 0.2), jitter: p.jitter * 1.3, subStep: 12 };
  for (let k = 1; k <= p.crossHatch; k++) {
    const ang = 33 + (k - 1) * 27;
    const thr = 0.5 + 0.12 * k;
    sweepHatch(out, poly, ang, baseSpacing * 1.5, tone, (x, y, t) => t > thr && makePatchMask(p.patchNoise, x, y, k, baseSpacing * 4, p.patchiness), layer, light, undefined, p.maxLen * 0.8);
  }
}
