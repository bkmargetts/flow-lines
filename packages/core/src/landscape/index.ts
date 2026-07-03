import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { createNoise, SimplexNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig, type SketchStyle } from '../sketch-styles.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { trimPolyline, offsetPolyline, clipSegmentToRect, pointInPolygon } from '../lib/polyline.js';
import { lerp, clamp01 } from '../lib/math.js';
import {
  TAU,
  DEG,
  pushRun,
  densifySegment,
  sampleProfileY,
  clipLineToPolygon,
  type Craft,
  type ToneFn,
  type BreakFn,
  sweepHatch,
  hatchLand,
  hatchGround,
} from './hatching.js';
import { closeRegion, rockShape, subtractPolygon, occludeBehind, drawTrees } from './features.js';
import { drawSky } from './sky.js';

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
  skyToneTop?: number; // 0..1 hatch coverage at the top of the sky (0 = paper)
  skyToneHorizon?: number; // 0..1 hatch coverage near the horizon

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
  ridgeSharpness?: number; // 0..1 rolling swell → peaked, skewed summits
  atmosphere?: number; // 0..1 depth haze: far ridges lighter, hatch fades to mist

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

const DEFAULTS: Required<Omit<LandscapeOptions, 'width' | 'height' | 'margin' | 'seed' | 'sunX' | 'sunY'>> = {
  horizonFrac: 0.46,
  horizonWobble: 6,
  horizonFreq: 2.2,
  hasWater: true,
  waterFrac: 0.62,
  skyHatchSpacing: 6,
  skyToneTop: 0.32,
  skyToneHorizon: 0.58,
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
  ridgeSharpness: 0.3,
  atmosphere: 0.4,
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

/** A 1-D fbm silhouette profile sampled L→R; peaks rise `amp` above `baseY`.
 *  `sharpness` blends toward ridged noise (real peaks instead of rolling swell),
 *  skews the flanks asymmetric, and both get shaped by a low-frequency peak
 *  envelope so a ridge carries one or two dominant summits — uniform-amplitude
 *  profiles stack into corrugated strips, the strongest "computer" tell in the
 *  land scenes. */
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
  span: number,
  sharpness = 0
): Point[] {
  const sample = (x: number): Point => {
    const u0 = (x - x0) / Math.max(1, span);
    const u = u0 + 0.18 * sharpness * noise.noise2D(u0 * 0.9, axis + 31.7);
    const base = noise.fbm(u * freq, axis, octaves, persistence, 2, 1);
    let h = base * 0.5 + 0.5;
    if (sharpness > 0) {
      const ridged = 1 - Math.abs(noise.fbm(u * freq, axis + 50, octaves, persistence, 2, 1));
      h = lerp(h, ridged * ridged, sharpness);
    }
    const env = Math.min(1, Math.max(0.1, 0.55 + 0.45 * noise.noise2D(u0 * 1.1, axis * 0.7 + 9.3)));
    return { x, y: baseY - amp * h * env };
  };
  const pts: Point[] = [];
  for (let x = x0; x <= x1 + 0.5; x += step) pts.push(sample(x));
  if (pts.length && pts[pts.length - 1].x < x1) pts.push(sample(x1));
  return pts;
}

/** Break a silhouette into 2–4 pieces separated by small gaps — a contour
 *  emerging from mist is drawn lost-and-found, not as one continuous line. */
function breakProfile(profile: Point[], rng: () => number): Point[][] {
  const m = profile.length;
  if (m < 12) return [profile];
  const gaps = 1 + Math.floor(rng() * 2);
  const cuts: [number, number][] = [];
  for (let g = 0; g < gaps; g++) {
    const c = Math.floor(m * (0.2 + 0.6 * rng()));
    const half = Math.max(2, Math.floor(m * (0.03 + 0.05 * rng())));
    cuts.push([c - half, c + half]);
  }
  cuts.sort((a, b) => a[0] - b[0]);
  const out: Point[][] = [];
  let start = 0;
  for (const [lo, hi] of cuts) {
    if (lo - start > 1) out.push(profile.slice(start, lo));
    start = Math.max(start, hi);
  }
  if (m - start > 1) out.push(profile.slice(start));
  return out.filter((p) => p.length > 1);
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
  const seed = options.seed ?? randomSeed();
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
  // `let` because occlusion rebuilds the array (front masses erase what's behind).
  let lines: FlowLine[] = [];
  // Detail marks emitted after the land masses (cloud outlines, sun rays, birds,
  // trees) are collected here so they can be occluded by those masses before
  // being merged in — otherwise they'd float over the mountains.
  let detail: FlowLine[] = [];
  // Opaque land masses (headlands / foreground / rocks), in front of sky & detail.
  const skyOccluders: Point[][] = [];

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
    mist?: number; // 0..1 — this band's share of the depth haze
    maxLenFrac?: number; // stroke length cap as a fraction of usableH
  }
  const bands: Band[] = [];
  const contours: { profile: Point[]; layer: string; passes: number }[] = [];
  let skyBoundary = horizon;
  // The nearest land crest, where trees sit (so they're in front, not floating
  // on a distant ridge).
  let treeCrest = horizon;
  let waterTopY = horizonY;
  let waterBotY = horizonY;

  // Reflective features feeding the water shimmer.
  const reflectors: { x: number; top: number; height: number; half: number }[] = [];

  // Horizontal light direction for slope shading (from the sun's side).
  const lightX = sunX >= x0 + usableW / 2 ? 1 : -1;

  const ridgeTone = (f: number, mist = 0): ToneFn => {
    const base = lerp(0.3, 0.95, Math.pow(f, 1.15)) * lerp(1, 0.45, mist);
    const fx = 2.6 / usableW;
    const fy = 2.6 / usableH;
    return (x, y) => clamp01(base + o.toneContrast * 0.42 * toneNoise.fbm(x * fx, y * fy + f * 3, 2, 0.5, 2, 1));
  };

  // Deferred ground-plane call (the beach hatches after the water band so the
  // draw order matches the old band sequence).
  let beach: (() => void) | null = null;

  if (o.hasWater) {
    waterBotY = horizonY + clamp01(o.waterFrac) * (y1 - horizonY);
    const shoreline = makeProfile(noise, 21.1, x0, x1, profStep, waterBotY, o.horizonWobble * 1.4, o.horizonFreq * 1.3, 3, 0.5, usableW);
    // Dark reflection strip under the horizon, near-paper middle distance, a
    // slight darkening at the shore — the old symmetric curve kept the whole
    // band above the paper cutoff, a full screen of dashes edge to edge.
    const ss = (t: number): number => {
      const u = clamp01(t);
      return u * u * (3 - 2 * u);
    };
    const waterTone: ToneFn = (x, y) => {
      const fh = clamp01((y - waterTopY) / Math.max(1, waterBotY - waterTopY));
      return clamp01(0.18 + 0.75 * Math.exp(-fh * 5.5) + 0.35 * ss((fh - 0.82) / 0.18) + 0.06 * toneNoise.noise2D(x * 0.012, y * 0.05));
    };
    bands.push({ upper: horizon, lower: shoreline, tone: waterTone, baseSpacing: o.waterHatchSpacing, angleDeg: 0, layer: 'water', formFollow: false, crossHatch: 0 });
    if (waterBotY < y1 - 4) {
      // A calm, light near-shore ground plane — the dark accent is the optional
      // foreground landform, so this stays a quiet beach rather than a second
      // heavy mass competing with it.
      const beachTone: ToneFn = (x, y) => clamp01(0.48 + o.toneContrast * 0.3 * toneNoise.fbm(x * 0.01, y * 0.01, 2, 0.5, 2, 1));
      const beachCraft: Craft = { rng, taper: o.taper, jitter: 1.2 * DEG, subStep: 10 };
      beach = () => hatchGround(lines, shoreline, y1, beachTone, o.ridgeHatchSpacing * 1.2, 'ridge', beachCraft, toneNoise);
      contours.push({ profile: shoreline, layer: 'contour', passes: 3 });
      treeCrest = shoreline;
    }
    contours.push({ profile: horizon, layer: 'horizon', passes: 2 });
  } else {
    const n = Math.max(1, Math.round(o.ridgeCount));
    const gap = (y1 - horizonY) / n;
    const profiles: Point[][] = [];
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / n;
      // Jittered stack: a metronomic lerp of baseY/amp reads as corrugation.
      const baseY = lerp(horizonY, y1, f) + (k < n - 1 ? (rng() - 0.5) * 0.7 * gap : 0);
      const amp = o.ridgeAmp * (0.45 + 0.85 * f) * (0.7 + 0.6 * rng());
      profiles.push(
        makeProfile(noise, 13.7 * (k + 1), x0, x1, profStep, baseY, amp, o.ridgeFreq * (1 + 0.12 * k), o.ridgeOctaves, o.ridgePersistence, usableW, o.ridgeSharpness)
      );
    }
    skyBoundary = profiles[0];
    treeCrest = profiles[n - 1];
    const m = profiles[0].length;
    // Overlapping ridges: each ridge is visible only above the upper envelope of
    // every nearer ridge — so a near crest that rises in front of a far one
    // genuinely occludes it, and the far ridge shows only the sliver poking above.
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / n;
      const mist = o.atmosphere * (1 - f);
      const env: number[] = new Array(m);
      for (let i = 0; i < m; i++) {
        let e = y1;
        for (let j = k + 1; j < n; j++) if (profiles[j][i].y < e) e = profiles[j][i].y;
        env[i] = e;
      }
      const lower: Point[] = profiles[k].map((p, i) => ({ x: p.x, y: Math.max(p.y, env[i]) }));
      let angle = o.ridgeHatchAngle;
      if (o.slopeFollow) angle += (k % 2 === 0 ? -1 : 1) * (8 + 6 * (1 - f));
      bands.push({
        upper: profiles[k],
        lower,
        tone: ridgeTone(f, mist),
        baseSpacing: o.ridgeHatchSpacing * lerp(1.9, 1.0, f),
        angleDeg: angle,
        layer: 'ridge',
        formFollow: o.formFollow,
        // The 33° shadow sweep across a distant band reads as stray diagonal
        // scratches; only the near ridges have earned cross-hatch darks.
        crossHatch: f > 0.55 ? o.crossHatch : 0,
        mist,
        maxLenFrac: lerp(0.03, 0.06, f),
      });
      // Contour only where the crest clears the nearer envelope. Far ridges fade
      // to a single light pass (lost-and-found edges), broken up when the haze
      // is heavy — a silhouette emerging from mist is drawn in pieces.
      const passes = f < 0.4 ? 1 : f < 0.75 ? 2 : 3;
      const breakUp = o.atmosphere > 0.5 && f < 0.5;
      let run: Point[] = [];
      const flush = (): void => {
        if (run.length > 1) {
          const layer = k === 0 ? 'horizon' : 'contour';
          if (breakUp) for (const piece of breakProfile(run, rng)) contours.push({ profile: piece, layer, passes });
          else contours.push({ profile: run, layer, passes });
        }
        run = [];
      };
      for (let i = 0; i < m; i++) {
        if (env[i] >= profiles[k][i].y - 0.5) run.push(profiles[k][i]);
        else flush();
      }
      flush();
    }
  }

  // —— Hatch the main bands (water + beach/ridges), then their contours ————
  for (const band of bands) {
    const poly = closeRegion(band.upper, band.lower);
    if (band.layer === 'water') {
      const craft: Craft = { rng, taper: o.taper * 0.5, jitter: 1.2 * DEG, subStep: 16 };
      // Rows are horizontal, so O.y is the row height: light mid-water rows
      // break into shorter dashes with much wider gaps (open water on paper).
      const breakFn: BreakFn = (t0, t1, O, d, r) => {
        const tw = band.tone(x0 + usableW / 2, O.y);
        return dashRun(t0, t1, O, d, r, o.waterDash * lerp(0.5, 1.2, tw), o.waterGap * lerp(3.5, 1, tw));
      };
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
        maxLen: usableH * (band.maxLenFrac ?? 0.05),
        shade: { mist: band.mist ?? 0, fadeNoise: patchNoise, shadeSlope: o.toneContrast * 0.8, lightX },
      });
    }
  }
  if (beach) beach();
  // Ridge / horizon / shore contours (emitted now so nearer masses occlude them).
  for (const c of contours) emitContour(lines, c.profile, c.layer, o.penWidth, c.passes);

  // —— Overlapping receding headlands on the water (each occludes what's behind) —
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
      const poly = closeRegion(profile, [
        { x: hx0, y: baseY },
        { x: hx1, y: baseY },
      ]);
      lines = occludeBehind(lines, poly); // hide water + farther headlands behind it
      skyOccluders.push(poly);
      const tone = ridgeTone(0.3 + 0.4 * f);
      const craft: Craft = { rng, taper: o.taper, jitter: 2 * DEG, subStep: 10 };
      sweepHatch(lines, poly, 78, o.ridgeHatchSpacing * lerp(1.7, 1.1, f), tone, () => true, 'headland', craft, undefined, usableH * 0.03);
      emitContour(lines, profile, 'headland', o.penWidth, f < 0.5 ? 1 : 2);
      const apex = profile.reduce((a, b) => (b.y < a.y ? b : a), profile[0]);
      reflectors.push({ x: apex.x, top: Math.max(waterTopY, baseY), height: (baseY - apex.y) * 0.9, half: halfW * 0.4 });
    }
  }

  // —— Foreground landform (repoussoir) ——————————————————————————————————
  if (o.foreground > 0.01) {
    const amt = clamp01(o.foreground);
    const left = o.foregroundSide === 'left';
    const sideX = left ? x0 : x1;
    const innerX = left ? x0 + (0.35 + 0.5 * amt) * usableW : x1 - (0.35 + 0.5 * amt) * usableW;
    const startY = lerp(y1, horizonY + (y1 - horizonY) * 0.25, amt);
    // A coarse, faceted rocky silhouette — the old 40-segment fbm ramp read
    // as a smooth monotone slide.
    const segs = 14;
    const ridge: Point[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const x = lerp(sideX, innerX, t) + (s > 0 && s < segs ? (rng() - 0.5) * (usableW * 0.012) : 0);
      const baseY = lerp(startY, y1, t * t);
      const ridged = 1 - Math.abs(noise.fbm(t * 3.2, 71.1, 3, 0.55, 2, 1));
      const wob = o.ridgeAmp * 0.9 * (ridged - 0.35) + (s > 0 && s < segs ? (rng() - 0.5) * o.ridgeAmp * 0.3 : 0);
      ridge.push({ x, y: Math.min(y1 - 1, baseY - wob) });
    }
    // Order the silhouette L→R for sampling/clipping.
    const ordered = ridge.slice().sort((a, b) => a.x - b.x);
    const fgX0 = ordered[0].x;
    const fgX1 = ordered[ordered.length - 1].x;
    const lower: Point[] = [
      { x: fgX0, y: y1 },
      { x: fgX1, y: y1 },
    ];
    const poly = closeRegion(ordered, lower);
    lines = occludeBehind(lines, poly); // a near mass — hide everything behind it
    skyOccluders.push(poly);
    // Light top rim (paper picks out the edge) grounding to a dark base.
    const ridgeYAt = (x: number): number => sampleProfileY(ordered, x);
    const fgTone: ToneFn = (x, y) => {
      const rY = ridgeYAt(x);
      const depth = clamp01((y - rY) / Math.max(8, y1 - rY));
      return clamp01(0.55 + 0.35 * depth + 0.15 * toneNoise.fbm(x * 0.01, y * 0.01, 2, 0.5, 2, 1));
    };
    // Patch-built form shading: vertical strips, each hatched at its own
    // slope-derived angle — one continuous fixed-angle cross-hatch read as a
    // wire-mesh net over the whole mass.
    const fgCraft: Craft = { rng, taper: o.taper, jitter: 2.4 * DEG, subStep: 12 };
    const patchCount = 4 + Math.floor(rng() * 4);
    let px = fgX0;
    for (let pIdx = 0; pIdx < patchCount; pIdx++) {
      const pxe = pIdx === patchCount - 1 ? fgX1 : px + ((fgX1 - fgX0) / patchCount) * (0.7 + 0.6 * rng());
      if (pxe - px < 6) {
        px = pxe;
        continue;
      }
      // Strip sub-polygon: profile points inside [px, pxe] closed to the bottom.
      const strip: Point[] = [{ x: px, y: ridgeYAt(px) }];
      for (const p of ordered) if (p.x > px && p.x < pxe) strip.push(p);
      strip.push({ x: pxe, y: ridgeYAt(pxe) });
      const stripPoly = closeRegion(strip, [
        { x: px, y: y1 },
        { x: pxe, y: y1 },
      ]);
      const slope = (ridgeYAt(pxe) - ridgeYAt(px)) / Math.max(1e-6, pxe - px);
      const surfDeg = Math.atan(slope) / DEG;
      const angle = surfDeg + 90 + (rng() - 0.5) * 28;
      sweepHatch(lines, stripPoly, angle, o.ridgeHatchSpacing * 0.85, fgTone, () => true, 'foreground', fgCraft, undefined, usableH * 0.05);
      // Only the darkest patches earn a second layer, at a shallow offset.
      const midTone = fgTone((px + pxe) / 2, (ridgeYAt((px + pxe) / 2) + y1) / 2);
      if (midTone > 0.75) {
        sweepHatch(lines, stripPoly, angle + 30, o.ridgeHatchSpacing * 1.4, fgTone, (xx, yy, t) => t > 0.7, 'foreground', fgCraft, undefined, usableH * 0.04);
      }
      px = pxe;
    }
    // A few confident interior contours echoing the silhouette.
    const echoes = 2 + (rng() < 0.5 ? 1 : 0);
    for (let e = 0; e < echoes; e++) {
      const off = 5 + 7 * rng() + e * 4;
      const echo = offsetPolyline(ordered, off);
      const w0 = rng() * 0.5;
      const w1 = w0 + 0.25 + rng() * 0.2;
      const i0 = Math.floor(w0 * echo.length);
      const i1 = Math.min(echo.length, Math.floor(w1 * echo.length));
      const piece = echo.slice(i0, i1).filter((p) => p.y < y1 - 2);
      if (piece.length > 2) pushRun(lines, trimPolyline(piece, 0.15), 'foreground');
    }
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
      lines = occludeBehind(lines, poly); // a rock hides the water behind it
      skyOccluders.push(poly);
      // Shade only the flank away from the sun; the lit side is held as paper
      // with the contour carrying the form.
      const apex = shape.reduce((a, b) => (b.y < a.y ? b : a), shape[0]);
      const lightFromLeft = sunX < cx;
      const shadowEnd = lightFromLeft ? shape[shape.length - 1] : shape[0];
      const flankSlope = (shadowEnd.y - apex.y) / (shadowEnd.x - apex.x || 1);
      const flankDeg = Math.atan(flankSlope) / DEG;
      const rockTone: ToneFn = (x, y) => {
        const side = lightFromLeft ? clamp01((x - apex.x) / Math.max(4, Math.abs(shadowEnd.x - apex.x))) : clamp01((apex.x - x) / Math.max(4, Math.abs(apex.x - shadowEnd.x)));
        return clamp01(0.3 + 0.65 * Math.pow(side, 0.8) + 0.12 * toneNoise.noise2D(x * 0.05, y * 0.05));
      };
      const rockCraft: Craft = { rng, taper: o.taper * 0.7, jitter: 2.5 * DEG, subStep: 10 };
      sweepHatch(lines, poly, flankDeg + 90, o.rockHatchSpacing * 0.75, rockTone, () => true, 'rock', rockCraft, undefined, Math.max(10, h * 0.6));
      if (w > o.rockMaxSize * 0.75) {
        sweepHatch(lines, poly, flankDeg + 60, o.rockHatchSpacing * 1.3, rockTone, (xx, yy, t) => t > 0.7, 'rock', rockCraft, undefined, Math.max(8, h * 0.45));
      }
      // A curved fracture stroke or two toward the base — big rocks only (on a
      // small one they dangle below like legs).
      const fractures = h > 20 ? 1 + (rng() < 0.5 ? 1 : 0) : 0;
      for (let fr = 0; fr < fractures; fr++) {
        const fx0 = apex.x + (rng() - 0.5) * w * 0.2;
        const fy0 = apex.y + h * (0.1 + 0.15 * rng());
        const fx1 = fx0 + (lightFromLeft ? 1 : -1) * w * (0.15 + 0.2 * rng());
        const bow = (rng() - 0.5) * w * 0.12;
        pushRun(lines, [
          { x: fx0, y: fy0 },
          { x: (fx0 + fx1) / 2 + bow, y: lerp(fy0, baseY - 1, 0.55) },
          { x: fx1, y: baseY - 1 },
        ], 'rock');
      }
      // Waterline: a couple of short horizontal dashes hugging each side.
      if (o.hasWater) {
        for (const sideSign of [-1, 1]) {
          const wx = cx + sideSign * w * (0.55 + rng() * 0.2);
          const wl = 4 + rng() * 7;
          pushRun(lines, densifySegment({ x: wx, y: baseY + 1 + rng() * 2 }, { x: wx + sideSign * wl, y: baseY + 1 + rng() * 2 }, 5), 'rock');
        }
      }
      emitContour(lines, shape, 'rock', o.penWidth, 2);
      if (o.hasWater) reflectors.push({ x: cx, top: Math.max(waterTopY, baseY), height: h * 0.9, half: w * 0.4 });
    }
  }

  // —— Water reflections: a concentrated shimmer directly under each feature,
  // not a wash of streaks. Glints are short HORIZONTAL dashes — the water's
  // own stroke language — bunched in a column that widens and thins with
  // depth. (Vertical ticks fought the horizontal water hatch and read as
  // scratches, not light on water.)
  if (o.hasWater && o.reflection && waterBotY > waterTopY + 4) {
    const waterH = Math.max(1, waterBotY - waterTopY);
    const drawGlints = (cx: number, half: number, depth: number, density: number): void => {
      let y = waterTopY + 2 + rng() * 4;
      let guard = 0;
      while (y < Math.min(waterBotY - 1, waterTopY + depth) && guard++ < 80) {
        const fh = clamp01((y - waterTopY) / waterH);
        if (rng() < lerp(density, density * 0.35, fh)) {
          const nGlints = 1 + Math.floor(rng() * 3);
          for (let g = 0; g < nGlints; g++) {
            const w = half * (0.5 + 0.7 * fh);
            const gx = cx + (rng() - 0.5) * 2 * w;
            const len = 4 + rng() * 10;
            const gy = y + (rng() - 0.5) * 2;
            pushRun(detail, densifySegment({ x: gx - len / 2, y: gy }, { x: gx + len / 2, y: gy }, 6), 'reflection');
          }
        }
        y += o.waterHatchSpacing * (0.8 + 1.2 * fh) + rng() * 3;
      }
    };
    if (sunActive) drawGlints(sunX, o.reflectionWidth, waterBotY - waterTopY, 0.9);
    for (const r of reflectors) drawGlints(r.x, Math.min(r.half, 14), Math.min(waterBotY - waterTopY, r.height * 1.2), 0.55);
  }

  // —— Sky: broken vertical hatch carrying a continuous tonal gradient, sun +
  // clouds carved out (sky.ts) ——
  {
    const skyTopY = y0;
    drawSky(lines, detail, {
      x0,
      x1,
      skyTopY,
      usableW,
      skyBoundary,
      skyOccluders,
      spacing: o.skyHatchSpacing,
      toneTop: o.skyToneTop,
      toneHorizon: o.skyToneHorizon,
      sun: { active: sunActive, x: sunX, y: sunY, r: sunR, haloR },
      clouds: o.clouds,
      taper: o.taper,
      rng,
      toneNoise,
      cloudNoise,
    });

    // Sun rays / glow (→ detail, so the land masses occlude them).
    if (sunActive && o.sunRays) {
      const rays = 16;
      for (let r = 0; r < rays; r++) {
        const a = (r / rays) * TAU + rng() * 0.1;
        const r0 = haloR * (1.02 + rng() * 0.1);
        const r1 = r0 + sunR * (0.3 + rng() * 0.5);
        pushRun(detail, [
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
      pushRun(detail, rim, 'sun', 'bold');
    }

    // Birds: a few shallow gull "vees" in the upper sky, clear of the sun.
    if (o.birds > 0) {
      for (let b = 0; b < Math.round(o.birds); b++) {
        const bx = lerp(x0 + usableW * 0.1, x1 - usableW * 0.1, rng());
        const by = lerp(skyTopY + usableH * 0.05, horizonY - usableH * 0.12, rng() * 0.7);
        if (sunActive && Math.hypot(bx - sunX, by - sunY) < haloR * 1.2) continue;
        const s = usableW * (0.012 + rng() * 0.012);
        const dip = s * 0.42;
        pushRun(detail, densifySegment({ x: bx - s, y: by }, { x: bx, y: by + dip }, 5), 'bird');
        pushRun(detail, densifySegment({ x: bx, y: by + dip }, { x: bx + s, y: by }, 5), 'bird');
      }
    }
  }

  // (Ridge / horizon / shore contours were emitted before the masses so the
  // nearer masses occlude them; nothing more to draw here.)

  // —— Trees / foliage clumps along the nearest land crest ——————————————
  if (o.trees > 0) {
    drawTrees(detail, treeCrest, Math.round(o.trees), usableW, rng);
  }

  // Occlude the after-mass detail (cloud outlines, sun rays, birds, trees) by the
  // land masses so it sits behind them, then merge it in.
  for (const occ of skyOccluders) detail = occludeBehind(detail, occ);
  for (const d of detail) lines.push(d);

  // —— Hand-drawn finish + margin clip ————————————————————————————————————
  let finished: FlowLine[];
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, p);
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

// Exported only for tests / potential reuse — keeps the surface tiny otherwise.
export const _internals = { clipLineToPolygon, hatchPolygon: sweepHatch, closeRegion, pointInPolygon, subtractPolygon, occludeBehind };
