import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { createNoise, SimplexNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig, type SketchStyle } from '../sketch-styles.js';
import { traceIsoContours } from '../iso-contours.js';
import type { GrayscaleImage } from '../image.js';
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
  emitStroke,
  sweepHatch,
  hatchLand,
} from './hatching.js';
import { closeRegion, rockShape, subtractPolygon, occludeBehind, drawTrees } from './features.js';

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

/** Subtract a closed interval [rlo,rhi] from [lo,hi], returning what remains. */
function subtractInterval(lo: number, hi: number, rlo: number, rhi: number): [number, number][] {
  if (rhi <= lo || rlo >= hi) return [[lo, hi]];
  const out: [number, number][] = [];
  if (rlo > lo) out.push([lo, rlo]);
  if (rhi < hi) out.push([rhi, hi]);
  return out;
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
      treeCrest = shoreline;
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
    treeCrest = profiles[n - 1];
    const m = profiles[0].length;
    // Overlapping ridges: each ridge is visible only above the upper envelope of
    // every nearer ridge — so a near crest that rises in front of a far one
    // genuinely occludes it, and the far ridge shows only the sliver poking above.
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / n;
      const env: number[] = new Array(m);
      for (let i = 0; i < m; i++) {
        let e = y1;
        for (let j = k + 1; j < n; j++) if (profiles[j][i].y < e) e = profiles[j][i].y;
        env[i] = e;
      }
      const lower: Point[] = profiles[k].map((p, i) => ({ x: p.x, y: Math.max(p.y, env[i]) }));
      let angle = o.ridgeHatchAngle;
      if (o.slopeFollow) angle += (k % 2 === 0 ? -1 : 1) * (12 + 8 * (1 - f));
      bands.push({ upper: profiles[k], lower, tone: ridgeTone(f), baseSpacing: o.ridgeHatchSpacing, angleDeg: angle, layer: 'ridge', formFollow: o.formFollow, crossHatch: o.crossHatch });
      // Contour only where the crest clears the nearer envelope. Far ridges fade
      // to a single light pass (lost-and-found edges).
      const passes = f < 0.4 ? 1 : f < 0.75 ? 2 : 3;
      let run: Point[] = [];
      for (let i = 0; i < m; i++) {
        if (env[i] >= profiles[k][i].y - 0.5) run.push(profiles[k][i]);
        else {
          if (run.length > 1) contours.push({ profile: run, layer: k === 0 ? 'horizon' : 'contour', passes });
          run = [];
        }
      }
      if (run.length > 1) contours.push({ profile: run, layer: k === 0 ? 'horizon' : 'contour', passes });
    }
  }

  // —— Hatch the main bands (water + beach/ridges), then their contours ————
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
    lines = occludeBehind(lines, poly); // a near mass — hide everything behind it
    skyOccluders.push(poly);
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
      lines = occludeBehind(lines, poly); // a rock hides the water behind it
      skyOccluders.push(poly);
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
            if (b > y + 1) pushRun(detail, [{ x: colX + wob, y }, { x: colX + wob + (rng() - 0.5) * 2.5, y: b }], 'reflection');
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
      // Hide the sky behind opaque masses that poke above the horizon (headlands).
      for (const occ of skyOccluders) {
        const ivs = clipLineToPolygon(occ, { x, y: 0 }, { x: 0, y: 1 });
        for (const [oy0, oy1] of ivs) {
          const next: [number, number][] = [];
          for (const [lo, hi] of segs) for (const piece of subtractInterval(lo, hi, oy0, oy1)) next.push(piece);
          segs = next;
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
        pushRun(detail, trimPolyline(mapped, 0.12), 'cloud');
      }
    }

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
