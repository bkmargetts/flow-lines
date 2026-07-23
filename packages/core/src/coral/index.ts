import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect, smoothPolyline } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { offsetEmphasisPasses } from '../pen-ink/swell.js';
import { simulateCoral, CoralSimParams } from './sim.js';

export { simulateCoral } from './sim.js';
export type { CoralSimParams, CoralSimResult, CoralRing } from './sim.js';

/**
 * Coral — differential growth, rendered as plottable single-pen strokes.
 *
 * The sim (`sim.ts`) grows a node loop that self-repels and buckles: edge
 * insertion gives the curve length it has no room for, and the repulsion
 * radius sets the wavelength it folds at. The drawing is the organism plus its
 * memory: history snapshots as fine onion-skin rings that fragment with age
 * (the oldest all but dissolve), and the final silhouette as a bold confident
 * edge built from offset single-pen passes, never stroke width. Growth is
 * noise-gated into patches and biased toward outward tips, so lobes ramify
 * the way real coral does instead of buckling uniformly.
 *
 * Strokes are tagged `edge` / `ring` / `relic` for per-pen SVG export.
 */
export interface CoralOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: seed geometry, growth gate, stroke breaks */
  seed?: number;
  /**
   * Reference min dimension in px — clamps the dimension feature sizes (fold
   * wavelength, node spacing, seed radius) derive from so the organism keeps
   * its tuned physical scale on sheets larger than the tuning anchor; it
   * still grows into the real page. Callers pass 297mm × pxPerMm; unset or
   * ≥ the page's min dimension is a no-op.
   */
  refMinDim?: number;
  /** Named look preset (default 'reef') */
  preset?: CoralPreset;

  // ---- Simulation ----
  /** Growth steps — how long the organism has lived (default preset) */
  iterations?: number;
  /** Insertion rate, 0..1 — how eagerly the curve grows (default preset) */
  growth?: number;
  /** Fold wavelength: repulsion radius in px (default ~minDim/26) */
  repulsion?: number;
  /** Approximate node cap — growth stops here (default preset) */
  maxNodes?: number;
  /** Growth-gate patch size as a fraction of the min dimension (default 0.18) */
  noiseScale?: number;
  /** How hard noise gates growth into patches, 0..1 (default preset) */
  patchiness?: number;
  /** Growth preference for outward tips, 0..1 — lobes ramify (default preset) */
  curvatureBias?: number;
  /** Random per-node nudge, 0..1 (default 0.25) */
  jitter?: number;
  /** Initial geometry (default preset) */
  seedShape?: CoralSeedShape;
  /** Colony count for the 'blobs' seed, 2..6 (default 4) */
  blobs?: number;

  // ---- History ----
  /** Onion-skin history rings kept, 0 = final silhouette only (default preset) */
  rings?: number;
  /** How aggressively old rings fragment with age, 0..1 (default preset) */
  fade?: number;

  // ---- Render ----
  /** Offset passes on the final silhouette, 1..6 (default preset) */
  boldPasses?: number;
  /** End-taper fraction on bold offset passes (default 0.02 closed / 0.12 open) */
  taper?: number;
  /** Hand-drawn wobble amplitude in px (default scales with fold wavelength) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export type CoralPreset = 'reef' | 'brain' | 'lichen' | 'bloom' | 'maze';
export type CoralSeedShape = 'circle' | 'polygon' | 'line' | 'blobs';

/**
 * Coral look presets. `reef` is the balanced colony: a dense folded edge over
 * a readable belt of growth history. `brain` grows long and uniform into
 * tight brain-coral folds, silhouette-dominant. `lichen` is scattered
 * colonies with crumbly, patchy history. `bloom` is a lobed flower of
 * onion-skin rings — the history is the drawing. `maze` pins a line across
 * the page and lets it buckle into a labyrinth, final state only.
 */
export const CORAL_PRESETS: Record<
  CoralPreset,
  {
    seedShape: CoralSeedShape;
    iterations: number;
    growth: number;
    /** Fold wavelength as a divisor of the sizing dimension */
    foldDiv: number;
    patchiness: number;
    curvatureBias: number;
    maxNodes: number;
    rings: number;
    fade: number;
    boldPasses: number;
  }
> = {
  reef: { seedShape: 'circle', iterations: 420, growth: 0.6, foldDiv: 26, patchiness: 0.45, curvatureBias: 0.5, maxNodes: 3000, rings: 14, fade: 0.5, boldPasses: 3 },
  brain: { seedShape: 'circle', iterations: 550, growth: 0.85, foldDiv: 38, patchiness: 0.2, curvatureBias: 0.3, maxNodes: 3500, rings: 3, fade: 0.3, boldPasses: 4 },
  lichen: { seedShape: 'blobs', iterations: 360, growth: 0.55, foldDiv: 28, patchiness: 0.75, curvatureBias: 0.45, maxNodes: 3000, rings: 8, fade: 0.7, boldPasses: 2 },
  bloom: { seedShape: 'polygon', iterations: 300, growth: 0.5, foldDiv: 20, patchiness: 0.3, curvatureBias: 0.85, maxNodes: 3000, rings: 26, fade: 0.2, boldPasses: 3 },
  maze: { seedShape: 'line', iterations: 800, growth: 0.8, foldDiv: 26, patchiness: 0.35, curvatureBias: 0.4, maxNodes: 4500, rings: 0, fade: 0.5, boldPasses: 3 },
};

/** Wraparound 1-2-1 smoothing — `smoothPolyline` pins endpoints, which would
 * leave a seam kink on a closed loop. */
function smoothClosedLoop(points: Point[], passes: number): Point[] {
  let pts = points;
  for (let pass = 0; pass < passes; pass++) {
    const n = pts.length;
    const out: Point[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n];
      const b = pts[i];
      const c = pts[(i + 1) % n];
      out[i] = { x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 };
    }
    pts = out;
  }
  return pts;
}

/** Circle seed wound with increasing angle, so the sim's turn sign convention
 * (positive = outward tip) holds. */
function circleSeed(cx: number, cy: number, r: number, edgeLen: number): Point[] {
  const n = Math.max(12, Math.round((2 * Math.PI * r) / edgeLen));
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Irregular convex-ish polygon, densified to edgeLen spacing. */
function polygonSeed(
  cx: number,
  cy: number,
  r: number,
  edgeLen: number,
  rng: () => number
): Point[] {
  const k = 5 + Math.floor(rng() * 3);
  const verts: Point[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / k);
    const rr = r * (0.6 + rng() * 0.5);
    verts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  const pts: Point[] = [];
  for (let i = 0; i < k; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % k];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / edgeLen));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return pts;
}

/**
 * Render a differential-growth organism's life as plottable single-pen
 * strokes.
 */
export function generateCoral(options: CoralOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'reef',
    jitter = 0.25,
    optimize = true,
  } = options;

  const p = CORAL_PRESETS[preset] ?? CORAL_PRESETS.reef;
  const iterations = clamp(Math.round(options.iterations ?? p.iterations), 20, 2000);
  const growth = clamp(options.growth ?? p.growth, 0.05, 1);
  const maxNodes = clamp(Math.round(options.maxNodes ?? p.maxNodes), 200, 12000);
  const patchiness = clamp(options.patchiness ?? p.patchiness, 0, 1);
  const curvatureBias = clamp(options.curvatureBias ?? p.curvatureBias, 0, 1);
  const seedShape = options.seedShape ?? p.seedShape;
  const blobCount = clamp(Math.round(options.blobs ?? 4), 2, 6);
  const fade = clamp(options.fade ?? p.fade, 0, 1);
  const boldPasses = clamp(Math.round(options.boldPasses ?? p.boldPasses), 1, 6);
  const closed = seedShape !== 'line';
  const taper = clamp(options.taper ?? (closed ? 0.02 : 0.12), 0, 0.4);

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
  // minDim is smaller); the organism still grows into the real page.
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);

  const R = clamp(options.repulsion ?? sizingDim / p.foldDiv, 4, sizingDim / 4);
  const edgeLen = clamp(R / 6, 1.5, 8);
  const noiseScale = clamp(options.noiseScale ?? 0.18, 0.02, 1) * sizingDim;
  // The point budget: history is a multiple of the node cap, so stride the
  // snapshots down before they can swamp the plot.
  const rings = Math.min(
    clamp(Math.round(options.rings ?? p.rings), 0, 60),
    Math.max(1, Math.floor(150_000 / maxNodes))
  );

  const rng = makeRandom(seed);
  const gateNoise = createNoise(subSeed(seed, 1));
  const breakNoise = createNoise(subSeed(seed, 3));

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const seedLoops: Point[][] = [];
  if (seedShape === 'circle') {
    seedLoops.push(circleSeed(cx, cy, sizingDim * 0.14, edgeLen));
  } else if (seedShape === 'polygon') {
    seedLoops.push(polygonSeed(cx, cy, sizingDim * 0.16, edgeLen, rng));
  } else if (seedShape === 'blobs') {
    // Colonies scattered with breathing room: rejection-sampled centres, a
    // bounded number of tries so pathological rects still terminate.
    const pad = sizingDim * 0.12;
    const minSep = sizingDim * 0.3;
    const centres: Point[] = [];
    for (let tries = 0; centres.length < blobCount && tries < 200; tries++) {
      const bx = x0 + pad + rng() * Math.max(1, innerW - pad * 2);
      const by = y0 + pad + rng() * Math.max(1, innerH - pad * 2);
      if (centres.every((c) => Math.hypot(c.x - bx, c.y - by) > minSep)) {
        centres.push({ x: bx, y: by });
      }
    }
    for (const c of centres) {
      seedLoops.push(circleSeed(c.x, c.y, sizingDim * (0.05 + rng() * 0.03), edgeLen));
    }
  } else {
    // Pinned line across the frame, a gentle arc of noise so the buckling
    // has somewhere to start; ends held just inside the margin.
    const inset = Math.min(innerW * 0.04, R);
    const n = Math.max(8, Math.round((innerW - inset * 2) / edgeLen));
    const line: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ramp = Math.min(1, t * 4, (1 - t) * 4);
      const v = gateNoise.noise2D(t * 3.1, 91.7) * R * 0.5 * ramp;
      line.push({ x: x0 + inset + t * (innerW - inset * 2), y: cy + v });
    }
    seedLoops.push(line);
  }

  const simParams: CoralSimParams = {
    x0,
    y0,
    x1,
    y1,
    edgeLen,
    repulsionRadius: R,
    attraction: 0.35,
    alignment: 0.25,
    repulsion: 0.8,
    maxStep: edgeLen * 0.45,
    growth,
    maxNodes,
    iterations,
    snapshots: rings,
    noiseScale,
    patchiness,
    curvatureBias,
    jitter: clamp(jitter, 0, 1),
    boundaryPad: Math.max(edgeLen * 3, R * 0.75),
    seedLoops,
    closed,
  };

  const sim = simulateCoral(simParams, gateNoise, rng);
  if (sim.loops.every((loop) => loop.length < 3)) return empty();

  const lines: FlowLine[] = [];
  const pushClipped = (points: Point[], pen: 'fine' | 'bold', layer: string): void => {
    for (const piece of clipPolylineToRect(points, x0, y0, x1, y1)) {
      if (piece.length >= 2) lines.push({ points: piece, pen, layer });
    }
  };

  /**
   * Break a ring into dashes: run-noise along arclength (stretched so the pen
   * draws in runs, lifts in runs). `breakFrac` 0 keeps the whole ring, 1
   * erases it. Confetti (dashes shorter than a few node spacings) is culled —
   * scattered ticks read as noise, not memory.
   */
  const breakLine = (points: Point[], breakFrac: number, lane: number): Point[][] => {
    const runLen = Math.max(30, R * 5);
    // Ring nodes sit ~edgeLen apart, so this culls dashes under ~4 spacings.
    const minPts = 5;
    const pieces: Point[][] = [];
    let current: Point[] = [];
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      if (i > 0) s += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      const keep = breakNoise.noise2D(s / runLen, lane * 13.7) * 0.5 + 0.5 > breakFrac;
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

  // ---- History rings: onion-skin memory, fragmenting with age ----
  // The older half of the belt is `relic`, the newer half `ring`, so a
  // three-pen plot can let the past literally pale.
  let lane = 0;
  const relicCut = Math.floor(sim.rings.length / 2);
  for (let ri = 0; ri < sim.rings.length; ri++) {
    const snapshot = sim.rings[ri];
    const age = 1 - snapshot.iter / sim.iterations;
    const breakFrac = clamp(fade * (0.15 + 0.75 * age), 0, 0.92);
    const layer = ri < relicCut ? 'relic' : 'ring';
    for (const loop of snapshot.loops) {
      if (loop.length < 4) continue;
      const smoothed = closed ? smoothClosedLoop(loop, 1) : smoothPolyline(loop, 1);
      const drawn = closed ? [...smoothed, smoothed[0]] : smoothed;
      for (const piece of breakLine(drawn, breakFrac, lane)) {
        pushClipped(piece, 'fine', layer);
      }
      lane++;
    }
  }

  // ---- The final silhouette: bold confident edge ----
  const spread = clamp(edgeLen * 0.15, 0.5, 2);
  for (const loop of sim.loops) {
    if (loop.length < 4) continue;
    const smoothed = closed ? smoothClosedLoop(loop, 1) : smoothPolyline(loop, 1);
    const outline = closed ? [...smoothed, smoothed[0]] : smoothed;
    pushClipped(outline, 'bold', 'edge');
    for (const pass of offsetEmphasisPasses(outline, boldPasses, spread, taper)) {
      pushClipped(pass, 'bold', 'edge');
    }
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  // The edge stays confident; the older the ring, the looser the hand.
  const wobble = options.wobble ?? clamp(R * 0.03, 0.35, 1.2);
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: Math.max(24, R * 1.5),
    seed: subSeed(seed, 11),
    layerAmplitude: { edge: 0.5, ring: 1, relic: 1.2 },
  });

  if (optimize) result = optimizePlot(result);

  return result;
}
