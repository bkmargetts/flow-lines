import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect, offsetPolyline, smoothPolyline, trimPolyline } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { simulateMeander, MeanderSimParams } from './sim.js';

export { simulateMeander } from './sim.js';
export type {
  MeanderSimParams,
  MeanderSimResult,
  MeanderTrace,
  MeanderOxbow,
} from './sim.js';

/**
 * Meander — river-migration cartography (after the Fisk maps of the
 * Mississippi), rendered as plottable single-pen strokes.
 *
 * The sim (`sim.ts`) evolves one channel centerline by curvature-driven bank
 * erosion with an upstream friction lag, so bends grow, translate downstream,
 * pinch off into oxbow lakes, and leave a belt of history behind. The drawing
 * is that memory: historical traces as fine broken scroll-bar lines that
 * fragment with age, abandoned oxbows as narrowed bank pairs, and the present
 * channel as bold confident banks (offset single-pen passes, never stroke
 * width) with broken interior flow lines — engraved water. The modern channel
 * carves clean paper through everything older, the reserved-paper discipline
 * the rest of the toolbox uses.
 *
 * Strokes are tagged `channel` / `trace` / `oxbow` for per-pen SVG export.
 */
export interface MeanderOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: initial course, bank noise, stroke breaks */
  seed?: number;
  /**
   * Reference min dimension in px — clamps the dimension feature sizes
   * (channel width, bend scale, spacing) derive from so the river keeps its
   * tuned physical scale on sheets larger than the tuning anchor; the course
   * still spans the real page. Callers pass 297mm × pxPerMm; unset or ≥ the
   * page's min dimension is a no-op.
   */
  refMinDim?: number;
  /** Named look preset (default 'atlas') */
  preset?: MeanderPreset;

  // ---- Simulation ----
  /** Migration steps — how long the river has lived (default preset) */
  iterations?: number;
  /** Migration rate, 0..1 — how fast bends grow and wander (default preset) */
  migration?: number;
  /** Emergent bend scale as a fraction of the min dimension (default 0.09) */
  bendScale?: number;
  /** Valley belt width as a fraction of the min dimension (default preset) */
  valleyWidth?: number;
  /** Flow axis angle in degrees, 0 = left→right (default 12) */
  flowAngleDeg?: number;
  /** Perpendicular bank noise, 0..1 (default 0.35) */
  jitter?: number;
  /** Channel width in px (default ~minDim/42) */
  channelWidth?: number;

  // ---- History ----
  /** Historical centerline traces kept (default preset) */
  traces?: number;
  /** How aggressively old traces fragment with age, 0..1 (default preset) */
  fade?: number;
  /** Keep the abandoned loops as oxbow lakes (default preset) */
  oxbows?: boolean;

  // ---- Render ----
  /** Broken interior flow lines inside the channel, 0..5 (default preset) */
  flowLines?: number;
  /** Offset passes on the channel banks (default preset) */
  boldPasses?: number;
  /** End-taper fraction on bold offset passes (default 0.12) */
  taper?: number;
  /** Hand-drawn wobble amplitude in px (default scales with channel width) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export type MeanderPreset = 'atlas' | 'young' | 'tangle';

/**
 * Meander look presets. `atlas` is the Fisk plate: a long-lived river with a
 * dense belt of scroll-bar history and oxbows. `young` is an early river:
 * gentle bends, sparse memory, more paper. `tangle` is old age: heavy
 * migration in a wide belt, history crowded with cutoffs.
 */
export const MEANDER_PRESETS: Record<
  MeanderPreset,
  {
    iterations: number;
    migration: number;
    valleyWidth: number;
    traces: number;
    fade: number;
    oxbows: boolean;
    flowLines: number;
    boldPasses: number;
  }
> = {
  atlas: { iterations: 320, migration: 0.6, valleyWidth: 0.6, traces: 18, fade: 0.55, oxbows: true, flowLines: 2, boldPasses: 3 },
  young: { iterations: 150, migration: 0.5, valleyWidth: 0.45, traces: 7, fade: 0.7, oxbows: true, flowLines: 3, boldPasses: 2 },
  tangle: { iterations: 420, migration: 0.85, valleyWidth: 0.75, traces: 9, fade: 0.55, oxbows: true, flowLines: 1, boldPasses: 4 },
};

/** A cheap point-to-polyline distance field over a spatial grid. */
class NearLine {
  private grid = new Map<string, Point[]>();
  private cell: number;

  constructor(points: Point[], private radius: number) {
    this.cell = Math.max(1e-6, radius);
    for (const p of points) {
      const key = `${Math.floor(p.x / this.cell)},${Math.floor(p.y / this.cell)}`;
      let bucket = this.grid.get(key);
      if (!bucket) this.grid.set(key, (bucket = []));
      bucket.push(p);
    }
  }

  near(x: number, y: number): boolean {
    const gx = Math.floor(x / this.cell);
    const gy = Math.floor(y / this.cell);
    const r2 = this.radius * this.radius;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.grid.get(`${gx + dx},${gy + dy}`);
        if (!bucket) continue;
        for (const p of bucket) {
          const ddx = p.x - x;
          const ddy = p.y - y;
          if (ddx * ddx + ddy * ddy < r2) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Render a meandering river's life as plottable single-pen strokes.
 */
export function generateMeander(options: MeanderOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'atlas',
    bendScale = 0.09,
    flowAngleDeg = 12,
    jitter = 0.35,
    taper = 0.12,
    optimize = true,
  } = options;

  const p = MEANDER_PRESETS[preset] ?? MEANDER_PRESETS.atlas;
  const iterations = clamp(Math.round(options.iterations ?? p.iterations), 10, 2000);
  const migration = clamp(options.migration ?? p.migration, 0, 1);
  const valleyWidth = clamp(options.valleyWidth ?? p.valleyWidth, 0.15, 1);
  const traces = clamp(Math.round(options.traces ?? p.traces), 0, 80);
  const fade = clamp(options.fade ?? p.fade, 0, 1);
  const keepOxbows = options.oxbows ?? p.oxbows;
  const flowLineCount = clamp(Math.round(options.flowLines ?? p.flowLines), 0, 5);
  const boldPasses = clamp(Math.round(options.boldPasses ?? p.boldPasses), 1, 6);

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (innerW < 16 || innerH < 16) return empty();
  const minDim = Math.min(innerW, innerH);
  // Feature sizes anchor at refMinDim on oversized sheets (identity wherever
  // minDim is smaller); the course itself keeps the real dimensions.
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);

  const w = clamp(options.channelWidth ?? sizingDim / 42, 2, sizingDim / 6);
  const lag = Math.max(w * 1.5, bendScale * sizingDim);
  const valleyHalf = Math.max(w * 2, (valleyWidth * minDim) / 2);
  const ds = clamp(w * 0.55, 1.5, 6);

  const simParams: MeanderSimParams = {
    x0,
    y0,
    x1,
    y1,
    angle: (flowAngleDeg * Math.PI) / 180,
    channelWidth: w,
    valleyHalf,
    ds,
    iterations,
    // κ·W scaling happens in the sim; this is the px-per-iteration gain.
    rate: 0.1 + migration * 0.35,
    lag,
    jitter: clamp(jitter, 0, 1),
    cutoffDist: w * 1.35,
    snapshots: traces,
    endTaper: Math.max(w * 4, lag),
    overhang: Math.max(valleyHalf * 0.5, w * 6),
  };

  const noise = createNoise(seed);
  const breakNoise = createNoise(subSeed(seed, 3));
  const sim = simulateMeander(simParams, noise);
  if (sim.channel.length < 2) return empty();

  const lines: FlowLine[] = [];
  const pushClipped = (points: Point[], pen: 'fine' | 'bold', layer: string): void => {
    for (const piece of clipPolylineToRect(points, x0, y0, x1, y1)) {
      if (piece.length >= 2) lines.push({ points: piece, pen, layer });
    }
  };

  // The modern channel reserves clean paper: history within its banks (plus a
  // sliver) is silt under water and stays undrawn.
  const channelZone = new NearLine(sim.channel, w * 0.75);

  /**
   * Break a polyline into dashes: a run-noise along arclength (stretched so
   * the pen draws in runs, lifts in runs) plus the channel reserve. `breakFrac`
   * 0 keeps the whole line, 1 erases it.
   */
  const breakLine = (points: Point[], breakFrac: number, lane: number): Point[][] => {
    // Long runs and long gaps — the pen draws a stretch, lifts, resumes.
    // Confetti (dashes shorter than a couple of channel widths) is culled:
    // scattered short ticks read as noise, not memory.
    const runLen = Math.max(30, w * 10);
    const minPts = Math.max(3, Math.ceil((w * 1.8) / ds));
    const pieces: Point[][] = [];
    let current: Point[] = [];
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      if (i > 0) s += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      const noiseKeep = breakNoise.noise2D(s / runLen, lane * 13.7) * 0.5 + 0.5;
      const keep = noiseKeep > breakFrac && !channelZone.near(points[i].x, points[i].y);
      if (keep) {
        current.push(points[i]);
      } else {
        if (current.length >= minPts) pieces.push(current);
        current = [];
      }
    }
    if (current.length >= minPts) pieces.push(current);
    return pieces;
  };

  // ---- Historical traces: the scroll-bar memory, fragmenting with age ----
  let lane = 0;
  for (const trace of sim.traces) {
    const age = 1 - trace.iter / sim.iterations;
    const breakFrac = clamp(fade * (0.12 + 0.8 * age), 0, 0.92);
    const smoothed = smoothPolyline(trace.points, 1);
    for (const piece of breakLine(smoothed, breakFrac, lane)) {
      pushClipped(piece, 'fine', 'trace');
    }
    lane++;
  }

  // ---- Oxbow lakes: abandoned loops as narrowed bank pairs ----
  if (keepOxbows) {
    for (const oxbow of sim.oxbows) {
      const age = 1 - oxbow.iter / sim.iterations;
      const breakFrac = clamp(fade * (0.1 + 0.7 * age), 0, 0.88);
      const arc = smoothPolyline(oxbow.points, 2);
      if (arc.length < 3) continue;
      for (const side of [-1, 1]) {
        const bank = trimPolyline(offsetPolyline(arc, side * w * 0.3), 0.03);
        for (const piece of breakLine(bank, breakFrac, lane)) {
          pushClipped(piece, 'fine', 'oxbow');
        }
        lane++;
      }
    }
  }

  // ---- The present channel: bold banks + engraved-water flow lines ----
  const center = smoothPolyline(sim.channel, 2);
  const spread = clamp(w * 0.08, 0.5, 2);
  for (const side of [-1, 1]) {
    const bank = offsetPolyline(center, (side * w) / 2);
    pushClipped(bank, 'bold', 'channel');
    for (let pass = 1; pass < boldPasses; pass++) {
      const off = spread * (pass - (boldPasses - 1) / 2);
      const extra = trimPolyline(offsetPolyline(bank, off), taper);
      if (extra.length >= 2) pushClipped(extra, 'bold', 'channel');
    }
  }
  for (let i = 1; i <= flowLineCount; i++) {
    const frac = i / (flowLineCount + 1) - 0.5;
    const flow = offsetPolyline(center, frac * w * 0.8);
    // Long calm runs: the pen glints along the water, lifts, resumes.
    const runLen = Math.max(8, w * 8);
    let current: Point[] = [];
    let s = 0;
    for (let j = 0; j < flow.length; j++) {
      if (j > 0) s += Math.hypot(flow[j].x - flow[j - 1].x, flow[j].y - flow[j - 1].y);
      const keep = breakNoise.noise2D(s / runLen, 500 + i * 17.3) > -0.15;
      if (keep) {
        current.push(flow[j]);
      } else {
        if (current.length >= 3) pushClipped(trimPolyline(current, 0.05), 'fine', 'channel');
        current = [];
      }
    }
    if (current.length >= 3) pushClipped(trimPolyline(current, 0.05), 'fine', 'channel');
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  // Banks stay confident; the older the mark, the looser the hand.
  const wobble = options.wobble ?? Math.max(0.35, w * 0.07);
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: Math.max(24, w * 6),
    seed: subSeed(seed, 11),
    layerAmplitude: { channel: 0.5, trace: 1.15, oxbow: 1 },
  });

  if (optimize) result = optimizePlot(result);

  return result;
}
