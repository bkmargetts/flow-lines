import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { createNoise, SimplexNoise } from './noise.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { getSketchStyleConfig, type SketchStyle } from './sketch-styles.js';
import { traceIsoContours } from './iso-contours.js';
import type { GrayscaleImage } from './image.js';

/**
 * Procedural landscapes drawn as plottable pen-and-ink. The goal is work that
 * reads as *drawn by hand*, not three stacked texture swatches: tonal value
 * structure (atmospheric perspective — far light & loose, near dark & dense),
 * hatch craft (tapered & broken stroke ends, cross-hatch build-up in shadow,
 * low-frequency patchiness, slight non-parallelism, form-following strokes that
 * wrap a hill), and real compositional depth (overlapping receding headlands, a
 * dark foreground landform), plus restrained detail (carved clouds, sun rays,
 * trees, reflections, birds).
 *
 * Everything is single-pen stroked polylines, deterministic per seed — no fills,
 * no stroke-width tricks (bold = repeated offset passes). Mirrors the Planet /
 * Vine Generators: heavy algorithm here in core, a thin web/CLI wrapper feeds it.
 *
 * The geometric workhorse is `clipLineToPolygon`: inside-intervals of a line
 * against a region polygon (even-odd parity), the basis for every hatch family.
 */

export type ForegroundSide = 'left' | 'right';

export interface LandscapeOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  // Composition
  horizonFrac?: number; // 0..1 vertical position of the horizon
  horizonWobble?: number; // px amplitude of the horizon undulation
  horizonFreq?: number; // horizon noise frequency
  hasWater?: boolean; // water band below the horizon vs. land to the bottom
  waterFrac?: number; // 0..1 share of the below-horizon space given to water

  // Sky
  skyHatchSpacing?: number; // px between vertical sky lines (darkest)
  skyToneTop?: number; // 0..1 tone at the top of the sky
  skyToneHorizon?: number; // 0..1 tone near the horizon

  // Sun / moon (negative space)
  sun?: boolean;
  sunX?: number;
  sunY?: number;
  sunRadius?: number;
  sunHalo?: number; // 0..1 soft halo as a fraction of the radius
  moonRim?: boolean;
  sunRays?: boolean; // short radial glow strokes around the sun
  reflection?: boolean; // mirror shimmer in the water under sun/rocks/headlands
  reflectionWidth?: number; // px half-width of the sun's reflection column

  // Water
  waterHatchSpacing?: number; // px between horizontal water lines (darkest)
  waterDash?: number; // px mean dash length
  waterGap?: number; // px mean gap

  // Ridges / hills
  ridgeCount?: number;
  ridgeAmp?: number;
  ridgeFreq?: number;
  ridgeOctaves?: number;
  ridgePersistence?: number;
  ridgeHatchSpacing?: number; // px (darkest); the tone field opens it where light
  ridgeHatchAngle?: number; // degrees; used when formFollow is off
  slopeFollow?: boolean; // tilt the straight ridge hatch toward its descent
  formFollow?: boolean; // cross-contour comb that wraps the hill (overrides angle)

  // Compositional depth
  headlands?: number; // overlapping receding land fingers near the horizon
  foreground?: number; // 0..1 size of a dark foreground landform (0 = off)
  foregroundSide?: ForegroundSide;

  // Hatch craft
  toneContrast?: number; // 0..1 strength of the light/shadow modulation
  crossHatch?: number; // 0..2 extra shadow layers
  hatchPatchiness?: number; // 0..1 break shadow into hand-sized patches
  taper?: number; // 0..1 stroke-end trim / break / angle jitter

  // Detail marks
  clouds?: number; // 0..1 carved-cloud coverage
  trees?: number; // count of foliage clumps
  birds?: number; // count of gull marks

  // Rocks / islands
  rocks?: number;
  rockMaxSize?: number;
  rockHatchSpacing?: number;

  // Pen / finishing
  penWidth?: number;
  wobble?: number;
  sketch?: number;
  sketchStyle?: SketchStyle;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A runaway guard: never emit more strokes than this, however dense the knobs. */
const LINE_CAP = 90000;

/** Repo-standard LCG: deterministic [0,1) stream from an integer seed. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const DEFAULTS: Required<Omit<LandscapeOptions, 'width' | 'height' | 'margin' | 'seed' | 'sunX' | 'sunY'>> = {
  horizonFrac: 0.46,
  horizonWobble: 6,
  horizonFreq: 2.2,
  hasWater: true,
  waterFrac: 0.62,
  skyHatchSpacing: 6,
  skyToneTop: 0.5,
  skyToneHorizon: 0.62,
  sun: true,
  sunRadius: 42,
  sunHalo: 0.7,
  moonRim: false,
  sunRays: false,
  reflection: true,
  reflectionWidth: 26,
  waterHatchSpacing: 5.5,
  waterDash: 34,
  waterGap: 9,
  ridgeCount: 3,
  ridgeAmp: 34,
  ridgeFreq: 2.4,
  ridgeOctaves: 4,
  ridgePersistence: 0.5,
  ridgeHatchSpacing: 4.5,
  ridgeHatchAngle: 80,
  slopeFollow: false,
  formFollow: true,
  headlands: 0,
  foreground: 0,
  foregroundSide: 'left',
  toneContrast: 0.5,
  crossHatch: 1,
  hatchPatchiness: 0.5,
  taper: 0.5,
  clouds: 0,
  trees: 0,
  birds: 0,
  rocks: 0,
  rockMaxSize: 46,
  rockHatchSpacing: 4,
  penWidth: 1,
  wobble: 0.6,
  sketch: 0,
  sketchStyle: 'loose',
};

// ——————————————————————————————————————————————————————————————————————
// Geometry helpers
// ——————————————————————————————————————————————————————————————————————

/** Append `pts` as a FlowLine if it has enough points to draw. */
function pushRun(out: FlowLine[], pts: Point[], layer: string, pen?: 'fine' | 'bold'): void {
  if (out.length >= LINE_CAP) return;
  if (pts.length >= 2) out.push({ points: pts, layer, ...(pen ? { pen } : {}) });
}

/** Subdivide a straight segment so the hand-drawn finish can bow it. */
function densifySegment(a: Point, b: Point, step: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.min(40, Math.round(len / step)));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return pts;
}

/** Drop a fraction of a polyline's arc length from each end (tapered ends). */
function trimPolyline(points: Point[], fraction: number): Point[] {
  if (points.length < 3) return points;
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = cumulative[cumulative.length - 1];
  const trim = Math.min(total * fraction, 12);
  const start = cumulative.findIndex((c) => c >= trim);
  let end = points.length - 1;
  while (end > 0 && cumulative[end] > total - trim) end--;
  if (start < 0 || end - start < 1) return points;
  return points.slice(start, end + 1);
}

/** Offset a polyline perpendicular to its local direction (for bold passes). */
function offsetPolyline(points: Point[], distance: number): Point[] {
  if (Math.abs(distance) < 1e-6) return points.map((p) => ({ ...p }));
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = { x: points[i].x + (-ty / len) * distance, y: points[i].y + (tx / len) * distance };
  }
  return out;
}

/** A 1-D fbm silhouette profile sampled L→R; peaks rise `amp` above `baseY`. */
function makeProfile(
  noise: SimplexNoise,
  axis: number,
  x0: number,
  x1: number,
  step: number,
  baseY: number,
  amp: number,
  freq: number,
  octaves: number,
  persistence: number,
  span: number
): Point[] {
  const pts: Point[] = [];
  for (let x = x0; x <= x1 + 0.5; x += step) {
    const u = (x - x0) / Math.max(1, span);
    const h = noise.fbm(u * freq, axis, octaves, persistence, 2, 1);
    pts.push({ x, y: baseY - amp * (h * 0.5 + 0.5) });
  }
  if (pts.length && pts[pts.length - 1].x < x1) {
    const u = (x1 - x0) / Math.max(1, span);
    const h = noise.fbm(u * freq, axis, octaves, persistence, 2, 1);
    pts.push({ x: x1, y: baseY - amp * (h * 0.5 + 0.5) });
  }
  return pts;
}

/** Linear-interpolated y of a left→right profile at an arbitrary x. */
function sampleProfileY(profile: Point[], x: number): number {
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

/** Even-odd point-in-polygon test (mirrors vines.ts). */
function pointInPolygon(poly: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Closed region polygon from an upper (L→R) and lower (L→R) boundary. */
function closeRegion(upper: Point[], lower: Point[]): Point[] {
  const poly = upper.slice();
  for (let i = lower.length - 1; i >= 0; i--) poly.push(lower[i]);
  return poly;
}

/** Inside-intervals of the infinite line P(t)=O+t·D against a closed simple
 *  polygon, as sorted [tEnter,tExit] pairs (even-odd parity, half-open edges). */
function clipLineToPolygon(poly: Point[], O: Point, D: Point): [number, number][] {
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

/** Subtract a closed interval [rlo,rhi] from [lo,hi], returning what remains. */
function subtractInterval(lo: number, hi: number, rlo: number, rhi: number): [number, number][] {
  if (rhi <= lo || rlo >= hi) return [[lo, hi]];
  const out: [number, number][] = [];
  if (rlo > lo) out.push([lo, rlo]);
  if (rhi < hi) out.push([rhi, hi]);
  return out;
}

// ——————————————————————————————————————————————————————————————————————
// Hatch craft
// ——————————————————————————————————————————————————————————————————————

/** Per-stroke craft: a shared rng, end-taper amount, angle jitter, subdivision. */
interface Craft {
  rng: () => number;
  taper: number;
  jitter: number; // radians
  subStep: number;
}

/** A tone field: darkness 0..1 at a location (1 = tight hatch / dark). */
type ToneFn = (x: number, y: number) => number;

/** Emit one hatch stroke A→B with tapered/broken ends and a slight per-stroke
 *  rotation, so a region's hatch never looks like a printed screen. */
function emitStroke(out: FlowLine[], A: Point, B: Point, layer: string, craft: Craft): void {
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

type BreakFn = (t0: number, t1: number, O: Point, D: Point, rng: () => number) => [number, number][];

/** A family of parallel hatch lines across `poly` at `angleDeg`. Local spacing
 *  opens where `tone` is light (atmospheric perspective). `gate` lets a layer
 *  fill only the dark/patchy parts (cross-hatch). `breakFn` dashes the run. */
function sweepHatch(
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

interface LandParams {
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
function hatchLand(out: FlowLine[], upper: Point[], poly: Point[], tone: ToneFn, baseSpacing: number, layer: string, p: LandParams): void {
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

/** A confident bold silhouette built from trimmed (tapered) offset passes. */
function emitContour(out: FlowLine[], profile: Point[], layer: string, penWidth: number, passes: number): void {
  const w = Math.max(1, passes);
  for (let k = 0; k < w; k++) {
    const off = (k - (w - 1) / 2) * penWidth * 0.85;
    const passed = trimPolyline(offsetPolyline(profile, off), 0.04);
    pushRun(out, passed, layer, 'bold');
  }
}

/** Break a run into dashes of mean length `dash` separated by `gap`. */
function dashRun(t0: number, t1: number, _O: Point, _D: Point, rng: () => number, dash: number, gap: number): [number, number][] {
  const segs: [number, number][] = [];
  let t = t0;
  let guard = 0;
  while (t < t1 && guard++ < 400) {
    const d = dash * (0.55 + 0.9 * rng());
    const end = Math.min(t1, t + d);
    if (end - t > 1.5) segs.push([t, end]);
    t = end + gap * (0.5 + rng());
  }
  return segs;
}

/** A small rough triangular rock silhouette centred at (cx, baseY). */
function rockShape(cx: number, baseY: number, w: number, h: number, rng: () => number): Point[] {
  const apexX = cx + (rng() - 0.5) * w * 0.5;
  const apexY = baseY - h;
  const left = cx - w / 2;
  const right = cx + w / 2;
  const midL = lerp(left, apexX, 0.5) + (rng() - 0.5) * w * 0.12;
  const midLY = lerp(baseY, apexY, 0.55) + (rng() - 0.5) * h * 0.15;
  const midR = lerp(apexX, right, 0.5) + (rng() - 0.5) * w * 0.12;
  const midRY = lerp(apexY, baseY, 0.45) + (rng() - 0.5) * h * 0.15;
  return [
    { x: left, y: baseY },
    { x: midL, y: midLY },
    { x: apexX, y: apexY },
    { x: midR, y: midRY },
    { x: right, y: baseY },
  ];
}

// ——————————————————————————————————————————————————————————————————————
// Main
// ——————————————————————————————————————————————————————————————————————

/**
 * Generate a procedural pen-and-ink landscape. Returns plain stroked polylines
 * tagged by layer (`sky` / `water` / `reflection` / `ridge` / `headland` /
 * `foreground` / `contour` / `horizon` / `rock` / `cloud` / `tree` / `bird` /
 * `sun`), deterministic per seed.
 */
export function generateLandscape(options: LandscapeOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const usableW = Math.max(1, x1 - x0);
  const usableH = Math.max(1, y1 - y0);

  const rng = makeRandom(seed);
  const noise = createNoise(seed);
  const toneNoise = createNoise(seed + 555);
  const patchNoise = createNoise(seed + 1777);
  const cloudNoise = createNoise(seed + 909);
  const lines: FlowLine[] = [];

  const horizonY = y0 + clamp01(o.horizonFrac) * usableH;
  const profStep = Math.max(2, usableW / 200);
  const bottomLine: Point[] = [
    { x: x0, y: y1 },
    { x: x1, y: y1 },
  ];

  const horizon = makeProfile(noise, 7.3, x0, x1, profStep, horizonY, o.horizonWobble, o.horizonFreq, 3, 0.5, usableW);

  // Sun geometry (used by sky carving + reflections).
  const sunX = options.sunX ?? x0 + 0.52 * usableW;
  const sunY = options.sunY ?? y0 + 0.34 * usableH;
  const sunR = o.sunRadius;
  const haloR = sunR * (1 + Math.max(0, o.sunHalo));
  const sunActive = o.sun && sunY < horizonY - sunR * 0.3;

  // —— Land bands & contours ————————————————————————————————————————————
  interface Band {
    upper: Point[];
    lower: Point[];
    tone: ToneFn;
    baseSpacing: number;
    angleDeg: number;
    layer: string;
    formFollow: boolean;
    crossHatch: number;
  }
  const bands: Band[] = [];
  const contours: { profile: Point[]; layer: string; passes: number }[] = [];
  let skyBoundary = horizon;
  let waterTopY = horizonY;
  let waterBotY = horizonY;

  // Reflective features feeding the water shimmer.
  const reflectors: { x: number; top: number; height: number; half: number }[] = [];

  const ridgeTone = (f: number): ToneFn => {
    const base = lerp(0.4, 0.92, f);
    const fx = 2.6 / usableW;
    const fy = 2.6 / usableH;
    return (x, y) => clamp01(base + o.toneContrast * 0.42 * toneNoise.fbm(x * fx, y * fy + f * 3, 2, 0.5, 2, 1));
  };

  if (o.hasWater) {
    waterBotY = horizonY + clamp01(o.waterFrac) * (y1 - horizonY);
    const shoreline = makeProfile(noise, 21.1, x0, x1, profStep, waterBotY, o.horizonWobble * 1.4, o.horizonFreq * 1.3, 3, 0.5, usableW);
    const waterTone: ToneFn = (x, y) => {
      const fh = clamp01((y - waterTopY) / Math.max(1, waterBotY - waterTopY));
      const u = Math.abs(2 * fh - 1);
      return clamp01(0.34 + 0.4 * Math.pow(u, 1.3) + 0.08 * toneNoise.noise2D(x * 0.012, y * 0.05));
    };
    bands.push({ upper: horizon, lower: shoreline, tone: waterTone, baseSpacing: o.waterHatchSpacing, angleDeg: 0, layer: 'water', formFollow: false, crossHatch: 0 });
    if (waterBotY < y1 - 4) {
      // A calm, light near-shore band — the dark accent is the optional
      // foreground landform, so this stays a quiet beach rather than a second
      // heavy mass competing with it.
      const beachTone: ToneFn = (x, y) => clamp01(0.48 + o.toneContrast * 0.18 * toneNoise.fbm(x * 0.01, y * 0.01, 2, 0.5, 2, 1));
      bands.push({ upper: shoreline, lower: bottomLine, tone: beachTone, baseSpacing: o.ridgeHatchSpacing * 1.2, angleDeg: o.ridgeHatchAngle, layer: 'ridge', formFollow: o.formFollow, crossHatch: 0 });
      contours.push({ profile: shoreline, layer: 'contour', passes: 3 });
    }
    contours.push({ profile: horizon, layer: 'horizon', passes: 2 });
  } else {
    const n = Math.max(1, Math.round(o.ridgeCount));
    const profiles: Point[][] = [];
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / n;
      const baseY = lerp(horizonY, y1, f);
      const amp = o.ridgeAmp * (0.45 + 0.85 * f);
      profiles.push(makeProfile(noise, 13.7 * (k + 1), x0, x1, profStep, baseY, amp, o.ridgeFreq * (1 + 0.12 * k), o.ridgeOctaves, o.ridgePersistence, usableW));
    }
    skyBoundary = profiles[0];
    for (let k = 0; k < n; k++) {
      const upper = profiles[k];
      const lower = k + 1 < n ? profiles[k + 1] : bottomLine;
      const f = (k + 1) / n;
      let angle = o.ridgeHatchAngle;
      if (o.slopeFollow) angle += (k % 2 === 0 ? -1 : 1) * (12 + 8 * (1 - f));
      bands.push({ upper, lower, tone: ridgeTone(f), baseSpacing: o.ridgeHatchSpacing, angleDeg: angle, layer: 'ridge', formFollow: o.formFollow, crossHatch: o.crossHatch });
      // Far ridges fade to a single light contour pass (lost-and-found edges).
      contours.push({ profile: upper, layer: k === 0 ? 'horizon' : 'contour', passes: f < 0.4 ? 1 : f < 0.75 ? 2 : 3 });
    }
  }

  // —— Overlapping receding headlands on the water ————————————————————————
  if (o.hasWater && o.headlands > 0) {
    const count = Math.round(o.headlands);
    for (let i = 0; i < count; i++) {
      const f = i / Math.max(1, count - 1); // 0 back .. 1 front
      const cx = lerp(x0 + usableW * 0.12, x1 - usableW * 0.12, (i + 0.5) / count) + (rng() - 0.5) * usableW * 0.1;
      const halfW = usableW * (0.16 + 0.12 * rng() + 0.08 * f);
      const height = usableH * (0.04 + 0.07 * f) * (0.8 + 0.5 * rng());
      const baseY = lerp(horizonY + (waterBotY - horizonY) * 0.04, horizonY - usableH * 0.02, 1 - f);
      const hx0 = Math.max(x0, cx - halfW);
      const hx1 = Math.min(x1, cx + halfW);
      const profile: Point[] = [];
      const segs = Math.max(8, Math.round((hx1 - hx0) / profStep));
      for (let s = 0; s <= segs; s++) {
        const x = lerp(hx0, hx1, s / segs);
        const t = s / segs;
        // A smooth hump (sin) roughened by noise, dipping to the waterline at the ends.
        const hump = Math.sin(t * Math.PI);
        const rough = 0.7 + 0.5 * noise.fbm(t * 3 + i * 5, 33.3, 3, 0.5, 2, 1);
        profile.push({ x, y: baseY - height * hump * rough });
      }
      const lower: Point[] = [
        { x: hx0, y: baseY },
        { x: hx1, y: baseY },
      ];
      const poly = closeRegion(profile, lower);
      const tone = ridgeTone(0.3 + 0.4 * f);
      const craft: Craft = { rng, taper: o.taper, jitter: 2 * DEG, subStep: 10 };
      sweepHatch(lines, poly, 78, o.ridgeHatchSpacing * lerp(1.7, 1.1, f), tone, () => true, 'headland', craft, undefined, usableH * 0.03);
      emitContour(lines, profile, 'headland', o.penWidth, f < 0.5 ? 1 : 2);
      // Apex reflects in the water.
      const apex = profile.reduce((a, b) => (b.y < a.y ? b : a), profile[0]);
      reflectors.push({ x: apex.x, top: Math.max(waterTopY, baseY), height: (baseY - apex.y) * 0.9, half: halfW * 0.4 });
    }
  }

  // —— Hatch the main bands ——————————————————————————————————————————————
  for (const band of bands) {
    const poly = closeRegion(band.upper, band.lower);
    if (band.layer === 'water') {
      const craft: Craft = { rng, taper: o.taper * 0.5, jitter: 1.2 * DEG, subStep: 16 };
      const breakFn: BreakFn = (t0, t1, O, d, r) => dashRun(t0, t1, O, d, r, o.waterDash, o.waterGap);
      sweepHatch(lines, poly, 0, band.baseSpacing, band.tone, () => true, 'water', craft, breakFn);
    } else {
      hatchLand(lines, band.upper, poly, band.tone, band.baseSpacing, band.layer, {
        rng,
        taper: o.taper,
        jitter: 2 * DEG,
        formFollow: band.formFollow,
        baseAngleDeg: band.angleDeg,
        crossHatch: band.crossHatch,
        patchiness: o.hatchPatchiness,
        patchNoise,
        maxLen: usableH * 0.05,
      });
    }
  }

  // —— Foreground landform (repoussoir) ——————————————————————————————————
  if (o.foreground > 0.01) {
    const amt = clamp01(o.foreground);
    const left = o.foregroundSide === 'left';
    const sideX = left ? x0 : x1;
    const innerX = left ? x0 + (0.35 + 0.5 * amt) * usableW : x1 - (0.35 + 0.5 * amt) * usableW;
    const startY = lerp(y1, horizonY + (y1 - horizonY) * 0.25, amt);
    const segs = 40;
    const ridge: Point[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const x = lerp(sideX, innerX, t);
      const baseY = lerp(startY, y1, t * t);
      const wob = o.ridgeAmp * 0.8 * noise.fbm(t * 3.2, 71.1, 3, 0.55, 2, 1);
      ridge.push({ x, y: baseY - wob });
    }
    // Order the silhouette L→R for sampling/clipping.
    const ordered = ridge.slice().sort((a, b) => a.x - b.x);
    const lower: Point[] = left
      ? [
          { x: ordered[0].x, y: y1 },
          { x: ordered[ordered.length - 1].x, y: y1 },
        ]
      : [
          { x: ordered[0].x, y: y1 },
          { x: ordered[ordered.length - 1].x, y: y1 },
        ];
    const poly = closeRegion(ordered, lower);
    const fgTone: ToneFn = (x, y) => clamp01(0.84 + o.toneContrast * 0.2 * toneNoise.fbm(x * 0.01, y * 0.01, 2, 0.5, 2, 1));
    hatchLand(lines, ordered, poly, fgTone, o.ridgeHatchSpacing * 0.85, 'foreground', {
      rng,
      taper: o.taper,
      jitter: 2.4 * DEG,
      formFollow: o.formFollow,
      baseAngleDeg: left ? 62 : 118,
      crossHatch: Math.max(o.crossHatch, 1),
      patchiness: o.hatchPatchiness,
      patchNoise,
      maxLen: usableH * 0.06,
    });
    emitContour(lines, ordered, 'foreground', o.penWidth, 3);
  }

  // —— Rocks / islands ——————————————————————————————————————————————————
  if (o.rocks > 0) {
    const placeY = o.hasWater ? lerp(waterTopY, waterBotY, 0.55) : lerp(horizonY, y1, 0.6);
    for (let i = 0; i < Math.round(o.rocks); i++) {
      const w = o.rockMaxSize * (0.5 + 0.6 * rng());
      const h = w * (0.55 + 0.5 * rng());
      const cx = lerp(x0 + w, x1 - w, rng());
      const baseY = placeY + (rng() - 0.5) * (o.hasWater ? (waterBotY - waterTopY) * 0.5 : usableH * 0.12);
      const shape = rockShape(cx, baseY, w, h, rng);
      const poly = closeRegion(shape, [
        { x: shape[0].x, y: baseY },
        { x: shape[shape.length - 1].x, y: baseY },
      ]);
      const rockTone: ToneFn = (x, y) => clamp01(0.8 + 0.18 * toneNoise.noise2D(x * 0.05, y * 0.05));
      hatchLand(lines, shape, poly, rockTone, o.rockHatchSpacing, 'rock', {
        rng,
        taper: o.taper,
        jitter: 2.5 * DEG,
        formFollow: false,
        baseAngleDeg: 62,
        crossHatch: Math.max(o.crossHatch, 1),
        patchiness: o.hatchPatchiness * 0.6,
        patchNoise,
        maxLen: Math.max(10, h * 0.6),
      });
      emitContour(lines, shape, 'rock', o.penWidth, 2);
      if (o.hasWater) reflectors.push({ x: cx, top: Math.max(waterTopY, baseY), height: h * 0.9, half: w * 0.4 });
    }
  }

  // —— Water reflections: a concentrated shimmer directly under each feature,
  // not a wash of streaks. The sun gets a broader glitter column; rocks and
  // headlands get a short, faint smear right below them.
  if (o.hasWater && o.reflection && waterBotY > waterTopY + 4) {
    const reflNoise = createNoise(seed + 4242);
    const drawColumn = (cx: number, half: number, depth: number, density: number): void => {
      const cols = Math.max(1, Math.min(4, Math.round(half / 9)));
      for (let c = 0; c < cols; c++) {
        const colX = cx + (cols === 1 ? 0 : (c / (cols - 1) - 0.5) * 2 * half);
        let y = waterTopY + 2 + rng() * 5;
        let guard = 0;
        while (y < waterTopY + depth && guard++ < 40) {
          const dlen = 3 + rng() * 6;
          if (rng() < density) {
            const wob = reflNoise.noise2D(colX * 0.05, y * 0.08) * Math.min(5, half * 0.35);
            const b = Math.min(waterBotY - 1, y + dlen);
            if (b > y + 1) pushRun(lines, [{ x: colX + wob, y }, { x: colX + wob + (rng() - 0.5) * 2.5, y: b }], 'reflection');
          }
          y += dlen + 5 + rng() * 8;
        }
      }
    };
    if (sunActive) drawColumn(sunX, o.reflectionWidth, waterBotY - waterTopY, 0.85);
    for (const r of reflectors) drawColumn(r.x, Math.min(r.half, 10), Math.min(waterBotY - waterTopY, r.height * 1.1), 0.5);
  }

  // —— Sky: vertical hatch with a tonal gradient, sun + clouds carved out ——
  {
    const skyTopY = y0;
    // Cloud mass raster over the sky, traced as organic negative space.
    let cloudRaster: GrayscaleImage | null = null;
    let cloudIso = 0;
    let skyMaxY = skyTopY;
    for (const p of skyBoundary) if (p.y > skyMaxY) skyMaxY = p.y;
    const skyH = Math.max(1, skyMaxY - skyTopY);
    if (o.clouds > 0.01) {
      const cw = 128;
      const ch = 72;
      const data = new Float32Array(cw * ch);
      const cf = 2.4;
      for (let cy = 0; cy < ch; cy++) {
        for (let cx = 0; cx < cw; cx++) {
          const u = cx / (cw - 1);
          const v = cy / (ch - 1);
          // Bias clouds to the upper sky and flatten them horizontally.
          const n = cloudNoise.fbm(u * cf, v * cf * 2.2 + 11, 4, 0.5, 2, 1);
          data[cy * cw + cx] = n * (1 - v * 0.35);
        }
      }
      cloudRaster = { width: cw, height: ch, data };
      cloudIso = 0.5 - o.clouds * 0.85;
    }
    const inCloud = (px: number, py: number): boolean => {
      if (!cloudRaster) return false;
      const u = (px - x0) / usableW;
      const v = (py - skyTopY) / skyH;
      if (u < 0 || u > 1 || v < 0 || v > 1) return false;
      const fx = u * (cloudRaster.width - 1);
      const fy = v * (cloudRaster.height - 1);
      const ix = Math.min(cloudRaster.width - 2, Math.floor(fx));
      const iy = Math.min(cloudRaster.height - 2, Math.floor(fy));
      const tx = fx - ix;
      const ty = fy - iy;
      const d = cloudRaster.data;
      const w = cloudRaster.width;
      const v00 = d[iy * w + ix];
      const v10 = d[iy * w + ix + 1];
      const v01 = d[(iy + 1) * w + ix];
      const v11 = d[(iy + 1) * w + ix + 1];
      const val = lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
      return val > cloudIso;
    };

    const craft: Craft = { rng, taper: o.taper * 0.6, jitter: 0.8 * DEG, subStep: 14 };
    const half = o.skyHatchSpacing / 2;
    let i = 0;
    for (let x = x0 + (rng() % 1) * o.skyHatchSpacing; x <= x1; x += half, i++) {
      const skyline = sampleProfileY(skyBoundary, x);
      if (skyline <= skyTopY + 2) continue;
      const H = skyline - skyTopY;
      // Base columns full; infill (odd) columns only where the graded tone is dark.
      let segs: [number, number][];
      if (i % 2 === 0) {
        segs = [[skyTopY, skyline]];
      } else {
        const qTop = clamp01((o.skyToneTop - 0.42) / 0.45);
        const qHor = clamp01((o.skyToneHorizon - 0.42) / 0.45);
        segs = [];
        if (qTop > 0.02) segs.push([skyTopY, skyTopY + qTop * H]);
        if (qHor > 0.02) segs.push([skyline - qHor * H, skyline]);
        if (!segs.length) continue;
      }
      // Carve the sun.
      if (sunActive) {
        const dx = x - sunX;
        const adx = Math.abs(dx);
        if (adx < haloR) {
          const f = clamp01((haloR - adx) / Math.max(1, haloR - sunR));
          let hh = adx < sunR ? Math.sqrt(Math.max(0, sunR * sunR - dx * dx)) : 0;
          hh += f * (haloR - sunR) * (0.35 + 0.5 * rng());
          if (hh > 0) {
            const next: [number, number][] = [];
            for (const [lo, hi] of segs) for (const piece of subtractInterval(lo, hi, sunY - hh, sunY + hh)) next.push(piece);
            segs = next;
          }
        }
      }
      // Carve clouds (split each segment around cloudy spans, sampled cheaply).
      if (cloudRaster) {
        const refined: [number, number][] = [];
        for (const [lo, hi] of segs) {
          let runStart = lo;
          let inside = inCloud(x, lo);
          const stepY = 4;
          for (let y = lo + stepY; y <= hi; y += stepY) {
            const c = inCloud(x, y);
            if (c !== inside) {
              if (!inside && y - runStart > 2) refined.push([runStart, y - stepY * 0.5]);
              runStart = y;
              inside = c;
            }
          }
          if (!inside && hi - runStart > 2) refined.push([runStart, hi]);
        }
        segs = refined;
      }
      for (const [lo, hi] of segs) {
        if (hi - lo < 2) continue;
        emitStroke(lines, { x, y: lo }, { x, y: hi }, 'sky', craft);
      }
    }

    // The carved negative space already reads as clouds; a faint, lightly
    // trimmed outline along the traced mass boundary just firms up the softest
    // shapes without the scribble of an underside-only heuristic.
    if (cloudRaster) {
      const contoursC = traceIsoContours(cloudRaster, cloudIso);
      for (const c of contoursC) {
        if (c.length < 10) continue;
        const mapped = c.map((p) => ({ x: x0 + (p.x / (cloudRaster!.width - 1)) * usableW, y: skyTopY + (p.y / (cloudRaster!.height - 1)) * skyH }));
        pushRun(lines, trimPolyline(mapped, 0.12), 'cloud');
      }
    }

    // Sun rays / glow.
    if (sunActive && o.sunRays) {
      const rays = 16;
      for (let r = 0; r < rays; r++) {
        const a = (r / rays) * TAU + rng() * 0.1;
        const r0 = haloR * (1.02 + rng() * 0.1);
        const r1 = r0 + sunR * (0.3 + rng() * 0.5);
        pushRun(lines, [
          { x: sunX + Math.cos(a) * r0, y: sunY + Math.sin(a) * r0 },
          { x: sunX + Math.cos(a) * r1, y: sunY + Math.sin(a) * r1 },
        ], 'sun');
      }
    }
    if (sunActive && o.moonRim) {
      const rim: Point[] = [];
      for (let r = 0; r <= 64; r++) {
        const a = (r / 64) * TAU;
        rim.push({ x: sunX + Math.cos(a) * sunR, y: sunY + Math.sin(a) * sunR });
      }
      pushRun(lines, rim, 'sun', 'bold');
    }

    // Birds: a few shallow gull "vees" in the upper sky, clear of the sun.
    if (o.birds > 0) {
      for (let b = 0; b < Math.round(o.birds); b++) {
        const bx = lerp(x0 + usableW * 0.1, x1 - usableW * 0.1, rng());
        const by = lerp(skyTopY + usableH * 0.05, horizonY - usableH * 0.12, rng() * 0.7);
        if (sunActive && Math.hypot(bx - sunX, by - sunY) < haloR * 1.2) continue;
        const s = usableW * (0.012 + rng() * 0.012);
        const dip = s * 0.42;
        pushRun(lines, densifySegment({ x: bx - s, y: by }, { x: bx, y: by + dip }, 5), 'bird');
        pushRun(lines, densifySegment({ x: bx, y: by + dip }, { x: bx + s, y: by }, 5), 'bird');
      }
    }
  }

  // —— Contours (after fills so they sit on top) ————————————————————————
  for (const c of contours) emitContour(lines, c.profile, c.layer, o.penWidth, c.passes);

  // —— Trees / foliage clumps along the nearest land crest ——————————————
  if (o.trees > 0) {
    const crest = o.hasWater ? (bands.find((b) => b.layer === 'ridge')?.upper ?? horizon) : skyBoundary;
    drawTrees(lines, crest, Math.round(o.trees), usableW, rng);
  }

  // —— Hand-drawn finish + margin clip ————————————————————————————————————
  let finished: FlowLine[];
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = seed + p * 9301 + 7;
      const styled = applyHandDrawnStyle({ lines, width, height, seed: pseed }, { amplitude, wavelength, jitter, seed: pseed }).lines;
      for (const l of styled) acc.push(l);
    }
    finished = acc;
  } else {
    finished = applyHandDrawnStyle({ lines, width, height, seed }, { amplitude: o.wobble, wavelength: 42, seed }).lines;
  }
  finished = finished.map((l) => clampLineToRect(l, x0, y0, x1, y1)).flat();

  return { lines: finished, width, height, seed };
}

/** Small trees with a short trunk and a lumpy rounded canopy, set along a crest
 *  profile. The canopy is a single closed scalloped outline (a few interior
 *  shading strokes), so it reads as a tree rather than a scribble. */
function drawTrees(out: FlowLine[], crest: Point[], count: number, usableW: number, rng: () => number): void {
  const x0 = crest[0].x;
  const x1 = crest[crest.length - 1].x;
  for (let i = 0; i < count; i++) {
    const x = lerp(x0 + usableW * 0.05, x1 - usableW * 0.05, rng());
    const baseY = sampleProfileY(crest, x);
    const s = usableW * (0.022 + rng() * 0.016);
    const cy = baseY - s * 1.7;
    const rx = s * 0.85;
    const ry = s * 1.0;
    // Trunk.
    pushRun(out, [{ x, y: baseY }, { x, y: cy + ry * 0.6 }], 'tree');
    // Lumpy canopy outline: an ellipse roughened by a few low-frequency bumps.
    const segs = 30;
    const bumps = 4 + Math.floor(rng() * 3);
    const phase = rng() * TAU;
    const canopy: Point[] = [];
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU;
      const lump = 1 + 0.16 * Math.sin(a * bumps + phase);
      canopy.push({ x: x + Math.cos(a) * rx * lump, y: cy + Math.sin(a) * ry * lump });
    }
    pushRun(out, canopy, 'tree');
    // A couple of short interior shading flicks.
    for (let b = 0; b < 2; b++) {
      const ax = x + (rng() - 0.5) * rx;
      const ay = cy + (rng() - 0.2) * ry * 0.6;
      pushRun(out, [{ x: ax, y: ay }, { x: ax + rx * 0.3, y: ay + ry * 0.4 }], 'tree');
    }
  }
}

/** Clip a polyline to a rect, splitting it into the runs that lie inside. */
function clampLineToRect(line: FlowLine, x0: number, y0: number, x1: number, y1: number): FlowLine[] {
  const pts = line.points;
  if (pts.length < 2) return [];
  const runs: FlowLine[] = [];
  let run: Point[] = [];
  const eps = 1e-6;
  const push = (): void => {
    if (run.length >= 2) runs.push({ ...line, points: run });
    run = [];
  };
  for (let i = 1; i < pts.length; i++) {
    const seg = clipSegmentToRect(pts[i - 1], pts[i], x0, y0, x1, y1);
    if (!seg) {
      push();
      continue;
    }
    const [a, b] = seg;
    if (run.length === 0) run.push(a);
    else if (Math.hypot(a.x - run[run.length - 1].x, a.y - run[run.length - 1].y) > eps) {
      push();
      run.push(a);
    }
    run.push(b);
    if (Math.hypot(b.x - pts[i].x, b.y - pts[i].y) > eps) push();
  }
  push();
  return runs;
}

function clipSegmentToRect(a: Point, b: Point, x0: number, y0: number, x1: number, y1: number): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
  ];
}

// Exported only for tests / potential reuse — keeps the surface tiny otherwise.
export const _internals = { clipLineToPolygon, hatchPolygon: sweepHatch, closeRegion, pointInPolygon };
