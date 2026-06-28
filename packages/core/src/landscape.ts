import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { createNoise, SimplexNoise } from './noise.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { getSketchStyleConfig, type SketchStyle } from './sketch-styles.js';

/**
 * Procedural landscapes drawn as plottable pen-and-ink: a sky of vertical
 * hatching with a celestial body held as clean-paper negative space, a wobbly
 * horizon, horizontal broken-stroke water with a sun-reflection column, several
 * receding ridge silhouettes filled with steep "hanging" hatch that terminates
 * at the skyline, and small rocks/islands. Everything is single-pen stroked
 * polylines, deterministic per seed — no fills, no stroke-width tricks. Mirrors
 * the Planet / Vine Generators: heavy algorithm here in core, a thin web/CLI
 * wrapper feeds it.
 *
 * The one geometric workhorse is `hatchPolygon`: a family of parallel lines at a
 * region's hatch angle + spacing, each clipped to the region polygon by sorted
 * edge-intersection intervals (even-odd parity). Hatch terminating cleanly at a
 * silhouette is automatic — the silhouette *is* the polygon's upper edge.
 */

export interface LandscapeOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  // Composition
  horizonFrac?: number; // 0..1 vertical position of the horizon in the frame
  horizonWobble?: number; // px amplitude of the horizon's undulation
  horizonFreq?: number; // horizon noise frequency
  hasWater?: boolean; // water band below the horizon vs. land to the bottom
  waterFrac?: number; // 0..1 share of the below-horizon space given to water

  // Sky
  skyHatchSpacing?: number; // px between vertical sky lines
  skyToneTop?: number; // 0..1 line-length at the top (1 = full height)
  skyToneHorizon?: number; // 0..1 line-length near the horizon

  // Sun / moon (negative space)
  sun?: boolean;
  sunX?: number; // px (defaults to ~middle)
  sunY?: number; // px (defaults to upper sky)
  sunRadius?: number; // px
  sunHalo?: number; // 0..1 soft halo as a fraction of the radius
  moonRim?: boolean; // draw a faint bold rim (moon) instead of bare paper (sun)
  reflection?: boolean; // sun glitter column in the water
  reflectionWidth?: number; // px half-width of the column at the bottom

  // Water
  waterHatchSpacing?: number; // px between horizontal water lines (near the horizon)
  waterDash?: number; // px mean dash length (broken strokes)
  waterGap?: number; // px mean gap between dashes

  // Ridges / hills
  ridgeCount?: number; // receding silhouettes filling the land below the horizon
  ridgeAmp?: number; // px base amplitude (front ridge); scaled down for far ridges
  ridgeFreq?: number; // ridge noise frequency
  ridgeOctaves?: number;
  ridgePersistence?: number;
  ridgeHatchSpacing?: number; // px between ridge hatch lines (front)
  ridgeHatchAngle?: number; // degrees from horizontal; ~80 = steep "hanging" hatch
  slopeFollow?: boolean; // tilt each ridge's hatch toward its descent

  // Rocks / islands / small mountains
  rocks?: number; // count of small forms on the water / lower land
  rockMaxSize?: number; // px
  rockHatchSpacing?: number; // px

  // Pen / finishing
  penWidth?: number; // px
  wobble?: number; // px low-frequency hand-drawn wobble
  sketch?: number; // 0..1 hand-drawn overdraw
  sketchStyle?: SketchStyle;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A runaway guard: never emit more strokes than this, however dense the knobs. */
const LINE_CAP = 60000;

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
  skyToneTop: 1,
  skyToneHorizon: 1,
  sun: true,
  sunRadius: 42,
  sunHalo: 0.7,
  moonRim: false,
  reflection: true,
  reflectionWidth: 30,
  waterHatchSpacing: 6,
  waterDash: 36,
  waterGap: 10,
  ridgeCount: 3,
  ridgeAmp: 34,
  ridgeFreq: 2.4,
  ridgeOctaves: 4,
  ridgePersistence: 0.5,
  ridgeHatchSpacing: 5,
  ridgeHatchAngle: 80,
  slopeFollow: false,
  rocks: 0,
  rockMaxSize: 46,
  rockHatchSpacing: 4,
  penWidth: 1,
  wobble: 0.6,
  sketch: 0,
  sketchStyle: 'loose',
};

/** Append `pts` as a FlowLine if it has enough points to draw. */
function pushRun(out: FlowLine[], pts: Point[], layer: string, pen?: 'fine' | 'bold'): void {
  if (out.length >= LINE_CAP) return;
  if (pts.length >= 2) out.push({ points: pts, layer, ...(pen ? { pen } : {}) });
}

/** Subdivide a straight segment into evenly spaced points so the hand-drawn
 *  finish can bow it (a bare 2-point line only tilts, it can't wobble). */
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

/** A horizon / ridge silhouette: a 1-D fbm height profile sampled L→R. `baseY`
 *  is the valley line; peaks rise `amp` above it (toward smaller y). */
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
    const h = noise.fbm(u * freq, axis, octaves, persistence, 2, 1); // ~[-1,1]
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
  // profiles are near-uniform in x; a linear scan is fine at these sizes.
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

/**
 * Inside-intervals of the infinite line P(t)=O+t·D against a closed simple
 * polygon (convex or concave), as sorted [tEnter,tExit] pairs. Each polygon edge
 * is intersected with the line and the hit parameter `t` collected when the edge
 * is crossed; the half-open rule `0 ≤ u < 1` on the edge parameter counts a
 * shared vertex exactly once, so parity stays correct. The caller offsets each
 * sweep line by a seeded phase so a line never lands exactly on a vertex.
 */
function clipLineToPolygon(poly: Point[], O: Point, D: Point): [number, number][] {
  const ts: number[] = [];
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    // Solve O + t·D = a + u·e  →  2×2 system; det = ex·Dy − ey·Dx.
    const det = ex * D.y - ey * D.x;
    if (Math.abs(det) < 1e-9) continue; // edge parallel to the line
    const rx = a.x - O.x;
    const ry = a.y - O.y;
    const u = (D.x * ry - D.y * rx) / det;
    if (u < 0 || u >= 1) continue; // crossing point not on this edge (half-open)
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

/** Per-sub-interval break function: turns a clipped run [t0,t1] into drawable
 *  pieces (e.g. broken water dashes). `O`/`D` give world coordinates. */
type BreakFn = (t0: number, t1: number, O: Point, D: Point, rng: () => number) => [number, number][];

interface HatchOpts {
  /** Local spacing as a function of the sweep coordinate s (= nrm·point). */
  spacingAt?: (s: number) => number;
  /** Break each clipped run into pieces. */
  breakFn?: BreakFn;
  rng?: () => number;
  /** Pen-up subdivision step for the hand-drawn finish (px). */
  subStep?: number;
}

/**
 * Sweep a family of parallel hatch lines across `poly`'s extent at `angleRad`,
 * spaced `spacing` px apart (optionally varying via `opts.spacingAt`), each
 * clipped to the polygon. Returns drawable, densified polylines.
 */
function hatchPolygon(
  poly: Point[],
  angleRad: number,
  spacing: number,
  phase: number,
  opts: HatchOpts = {}
): Point[][] {
  const dir: Point = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
  const nrm: Point = { x: -Math.sin(angleRad), y: Math.cos(angleRad) };
  let sMin = Infinity;
  let sMax = -Infinity;
  for (const p of poly) {
    const s = nrm.x * p.x + nrm.y * p.y;
    if (s < sMin) sMin = s;
    if (s > sMax) sMax = s;
  }
  const baseSp = Math.max(0.8, spacing);
  const out: Point[][] = [];
  const subStep = opts.subStep ?? 12;
  let s = sMin + (phase % 1) * baseSp;
  let guard = 0;
  while (s <= sMax && guard++ < 5000) {
    const localSp = Math.max(0.8, opts.spacingAt ? opts.spacingAt(s) : baseSp);
    const O: Point = { x: nrm.x * s, y: nrm.y * s };
    const runs = clipLineToPolygon(poly, O, dir);
    for (const [t0, t1] of runs) {
      const pieces = opts.breakFn ? opts.breakFn(t0, t1, O, dir, opts.rng ?? Math.random) : [[t0, t1] as [number, number]];
      for (const [a, b] of pieces) {
        if (b - a < 1.5) continue;
        const p0: Point = { x: O.x + dir.x * a, y: O.y + dir.y * a };
        const p1: Point = { x: O.x + dir.x * b, y: O.y + dir.y * b };
        out.push(densifySegment(p0, p1, subStep));
      }
    }
    s += localSp;
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

/** Break a run into dashes of mean length `dash` separated by `gap`, with a
 *  per-dash gap multiplier from `gapBoost(centreX)` (used to lighten the water
 *  inside the sun-reflection column). */
function dashRun(
  t0: number,
  t1: number,
  O: Point,
  D: Point,
  rng: () => number,
  dash: number,
  gap: number,
  gapBoost: (x: number, y: number) => number
): [number, number][] {
  const segs: [number, number][] = [];
  let t = t0;
  let guard = 0;
  while (t < t1 && guard++ < 400) {
    const d = dash * (0.55 + 0.9 * rng());
    const end = Math.min(t1, t + d);
    if (end - t > 1.5) segs.push([t, end]);
    const mx = O.x + D.x * (end + 1);
    const my = O.y + D.y * (end + 1);
    const g = gap * (0.5 + rng()) * gapBoost(mx, my);
    t = end + g;
  }
  return segs;
}

/** A small rough triangular/blobby rock silhouette centred at (cx, baseY). */
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

/**
 * Generate a procedural pen-and-ink landscape. Returns plain stroked polylines
 * tagged by layer (`sky` / `water` / `reflection` / `ridge` / `contour` /
 * `horizon` / `rock` / `sun`), deterministic per seed.
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
  const lines: FlowLine[] = [];

  const horizonY = y0 + clamp01(o.horizonFrac) * usableH;
  const profStep = Math.max(2, usableW / 200);
  const bottomLine: Point[] = [
    { x: x0, y: y1 },
    { x: x1, y: y1 },
  ];

  // Far shore / horizon silhouette.
  const horizon = makeProfile(noise, 7.3, x0, x1, profStep, horizonY, o.horizonWobble, o.horizonFreq, 3, 0.5, usableW);

  // --- Build the land bands (each: upper + lower boundary, hatch angle/spacing).
  interface Band {
    upper: Point[];
    lower: Point[];
    angleDeg: number;
    spacing: number;
    layer: string;
    water?: boolean;
  }
  const bands: Band[] = [];
  const contours: { profile: Point[]; layer: string }[] = [];
  let skyBoundary = horizon; // the lower edge of the sky
  let waterTopY = horizonY;
  let waterBotY = horizonY;

  if (o.hasWater) {
    waterBotY = horizonY + clamp01(o.waterFrac) * (y1 - horizonY);
    const shoreline = makeProfile(noise, 21.1, x0, x1, profStep, waterBotY, o.horizonWobble * 1.4, o.horizonFreq * 1.3, 3, 0.5, usableW);
    bands.push({ upper: horizon, lower: shoreline, angleDeg: 0, spacing: o.waterHatchSpacing, layer: 'water', water: true });
    // Foreground landform from the shoreline down to the page bottom.
    if (waterBotY < y1 - 4) {
      bands.push({ upper: shoreline, lower: bottomLine, angleDeg: o.ridgeHatchAngle, spacing: o.ridgeHatchSpacing, layer: 'ridge' });
      contours.push({ profile: shoreline, layer: 'contour' });
    }
    contours.push({ profile: horizon, layer: 'horizon' });
  } else {
    // Stacked ridges fill the whole below-horizon space, nearer = lower & darker.
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
      const spacing = o.ridgeHatchSpacing * lerp(1.7, 0.85, f); // far = looser, near = tighter
      let angle = o.ridgeHatchAngle;
      if (o.slopeFollow) angle += (k % 2 === 0 ? -1 : 1) * (12 + 8 * (1 - f));
      bands.push({ upper, lower, angleDeg: angle, spacing, layer: 'ridge' });
      contours.push({ profile: upper, layer: k === 0 ? 'horizon' : 'contour' });
    }
  }

  // --- Sun geometry (negative space in the sky).
  const sunX = options.sunX ?? x0 + 0.52 * usableW;
  const sunY = options.sunY ?? y0 + 0.34 * usableH;
  const sunR = o.sunRadius;
  const haloR = sunR * (1 + Math.max(0, o.sunHalo));
  const sunActive = o.sun && sunY < horizonY - sunR * 0.3; // only when it sits in the sky

  // --- SKY: vertical hatch from the top down to the skyline, sun carved out.
  {
    const skyTop = y0;
    let x = x0 + (rng() % 1) * o.skyHatchSpacing;
    for (; x <= x1; x += o.skyHatchSpacing) {
      const skyline = sampleProfileY(skyBoundary, x);
      if (skyline <= skyTop + 2) continue;
      // Vertical tone: trim a fraction off the bottom (near horizon) / top.
      const topCut = lerp(0, (skyline - skyTop) * 0.5, 1 - clamp01(o.skyToneTop));
      const botCut = lerp(0, (skyline - skyTop) * 0.5, 1 - clamp01(o.skyToneHorizon));
      let segs: [number, number][] = [[skyTop + topCut, skyline - botCut]];
      if (sunActive) {
        const dx = x - sunX;
        const adx = Math.abs(dx);
        if (adx < haloR) {
          // Strength 0 at the halo rim → 1 at the core.
          const f = clamp01((haloR - adx) / Math.max(1, haloR - sunR));
          let half = adx < sunR ? Math.sqrt(Math.max(0, sunR * sunR - dx * dx)) : 0;
          // Soft halo: pull the cut outward, raggedly, as we near the core.
          half += f * (haloR - sunR) * (0.35 + 0.5 * rng());
          if (half > 0) {
            const next: [number, number][] = [];
            for (const [lo, hi] of segs) for (const piece of subtractInterval(lo, hi, sunY - half, sunY + half)) next.push(piece);
            segs = next;
          }
        }
      }
      for (const [lo, hi] of segs) {
        if (hi - lo < 2) continue;
        pushRun(lines, densifySegment({ x, y: lo }, { x, y: hi }, 14), 'sky');
      }
    }
    if (sunActive && o.moonRim) {
      const rim: Point[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * TAU;
        rim.push({ x: sunX + Math.cos(a) * sunR, y: sunY + Math.sin(a) * sunR });
      }
      pushRun(lines, rim, 'sun', 'bold');
    }
  }

  // --- Land & water bands.
  const colHalf = (y: number): number => {
    if (waterBotY <= waterTopY) return o.reflectionWidth;
    const f = clamp01((y - waterTopY) / (waterBotY - waterTopY));
    return o.reflectionWidth * (0.25 + 0.75 * f);
  };
  for (const band of bands) {
    const poly = closeRegion(band.upper, band.lower);
    const angleRad = band.angleDeg * DEG;
    if (band.water) {
      const spacingAt = (s: number): number => {
        // s = y for horizontal lines (nrm = (0,1)); tighter near the horizon.
        const f = clamp01((s - waterTopY) / Math.max(1, waterBotY - waterTopY));
        return band.spacing * lerp(1, 1.9, f);
      };
      const gapBoost = (px: number, py: number): number => {
        if (!(sunActive && o.reflection)) return 1;
        return Math.abs(px - sunX) < colHalf(py) ? 2.6 : 1;
      };
      const breakFn: BreakFn = (t0, t1, O, D, r) => dashRun(t0, t1, O, D, r, o.waterDash, o.waterGap, gapBoost);
      const strokes = hatchPolygon(poly, angleRad, band.spacing, rng(), { spacingAt, breakFn, rng, subStep: 16 });
      for (const st of strokes) {
        // Tag strokes inside the reflection column as their own layer (lighter ink option).
        const mid = st[Math.floor(st.length / 2)];
        const inCol = sunActive && o.reflection && Math.abs(mid.x - sunX) < colHalf(mid.y);
        pushRun(lines, st, inCol ? 'reflection' : 'water');
      }
    } else {
      const strokes = hatchPolygon(poly, angleRad, band.spacing, rng(), { rng, subStep: 12 });
      for (const st of strokes) pushRun(lines, st, band.layer);
    }
  }

  // --- Rocks / islands sitting on the water (or lower land).
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
      const strokes = hatchPolygon(poly, 62 * DEG, o.rockHatchSpacing, rng(), { rng, subStep: 8 });
      for (const st of strokes) pushRun(lines, st, 'rock');
      pushRun(lines, shape, 'rock', 'bold');
    }
  }

  // --- Silhouette contours: a confident bold line built from offset passes.
  for (const c of contours) {
    const passes = o.penWidth > 0.01 ? 2 : 1;
    for (let k = 0; k < passes; k++) {
      const off = k * o.penWidth * 0.9;
      pushRun(lines, c.profile.map((p) => ({ x: p.x, y: p.y + off })), c.layer, 'bold');
    }
  }

  // --- Hand-drawn finish: multi-pass sketch overdraw, or a single low wobble.
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

  // Keep the whole drawing inside the page margin.
  finished = finished.map((l) => clampLineToRect(l, x0, y0, x1, y1)).flat();

  return { lines: finished, width, height, seed };
}

/** Clip a polyline to a rect, splitting it into the runs that lie inside (so the
 *  plot keeps a clean margin). Liang–Barsky per segment, mirroring vines.ts. */
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
export const _internals = { clipLineToPolygon, hatchPolygon, closeRegion, pointInPolygon };
