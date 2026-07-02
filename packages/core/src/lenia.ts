import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { optimizePlot } from './optimize.js';
import { gaussianBlur } from './image.js';
import { traceIsoContours } from './iso-contours.js';
import { createNoise, SimplexNoise } from './noise.js';
import { makeRandom, randomSeed } from './lib/rng.js';

/**
 * Lenia — a continuous-domain generalisation of Conway's Game of Life
 * (Bert Chan, 2018) — rendered as plottable single-pen strokes. The grid holds
 * one continuous state `A(x, y) ∈ [0, 1]`; every step it is convolved with a
 * radially-symmetric ring kernel `K` to a normalised potential, run through a
 * smooth Gaussian growth function, and nudged by a small time step:
 *
 *     U = K * A                              (normalised neighbourhood, ∈ [0,1])
 *     G(U) = 2·exp(−(U−μ)² / 2σ²) − 1        (growth, ∈ [−1,1])
 *     A' = clamp(A + (1/T)·G(U), 0, 1)
 *
 * Unlike Conway's hard birth/death rule, the smoothness lets coherent
 * "creatures" emerge and *glide* — the canonical `Orbium` is a solitary
 * travelling lifeform. Tuned μ/σ over a random soup instead settles into
 * pulsing cell-colonies. The continuous state `A` is the image, exactly as the
 * V concentration is for reaction–diffusion, so the same line-work renderer
 * applies: nested iso-contours of the blurred field, or angled hatching of the
 * dense regions — never opacity or stroke-width tricks.
 *
 * The distinctive twist is the **long exposure** (borrowed from the Conway
 * module): accumulate a per-cell light field `E[i] = max(E[i]·decay, A[i])`
 * across the run, gamma-lift it, and ink *that* — so a gliding creature leaves
 * a comet trail of where it has been, with the final live form traced crisp on
 * top. Off, the field is simply the final `A` (a still life of the colony).
 *
 * Three render styles share the same simulation:
 *  - `contour` — nested iso-contours of the blurred field (the default look).
 *  - `hatch`   — the dense region filled with angled, jittered hatching and a
 *                confident traced outline.
 *  - `dual`    — contour lines for the outer field plus a hatched core.
 *
 * Strokes are tagged with a `layer` ('core' / 'mid' / 'rim') so the piece can
 * be exported one SVG per pen.
 */
export interface LeniaOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls soup placement, hatch jitter and wobble */
  seed?: number;

  // ---- Simulation ----
  /** Simulation grid width in cells; rows derive from the page aspect (default 120) */
  gridCols?: number;
  /** Named rule/seed preset (default 'orbium') */
  preset?: LeniaPreset;
  /** Kernel radius in cells (override of the preset's R) */
  kernelRadius?: number;
  /** Growth centre μ (override of the preset) */
  mu?: number;
  /** Growth width σ (override of the preset) */
  sigma?: number;
  /** Time resolution T; the step is dt = 1/T (override of the preset) */
  timeRes?: number;
  /** Kernel ring peak weights β; length sets the ring count (override) */
  beta?: number[];
  /** How the initial state is placed (override of the preset) */
  seedPattern?: LeniaSeedPattern;
  /** Count of soup patches (default 5; ignored for the 'orbium' pattern) */
  seedSpots?: number;
  /** Simulation iterations (default 280) */
  steps?: number;
  /** Bias single-specimen seeding toward a rule-of-thirds point, 0..1 (default artStyle ? 0.6 : 0) */
  offCenter?: number;

  // ---- Long exposure ----
  /** Accumulate a comet-trail light field across the run (default = preset) */
  longExposure?: boolean;
  /** Per-step exposure decay, 0..1 (default 0.97) — higher = longer trails */
  decay?: number;
  /** Perceptual lift on the exposure before tracing, <1 brightens trails (default 0.5) */
  gamma?: number;

  // ---- Render ----
  /** Render style for the field (default 'contour') */
  style?: 'contour' | 'hatch' | 'dual';
  /** Nested iso levels for the 'contour'/'dual' styles (default 6) */
  contourLevels?: number;
  /** Pre-trace Gaussian blur on the field, in cells (default 1.0) */
  blurSigma?: number;
  /** Lowest iso level as a fraction of the field range, 0..1 (default 0.2) */
  isoLow?: number;
  /** Highest iso level as a fraction of the field range, 0..1 (default 0.9) */
  isoHigh?: number;
  /** Field threshold (normalized) that becomes inked region for 'hatch'/'dual' (default 0.4) */
  fillThreshold?: number;

  // ---- Art treatment (off = faithful field) ----
  /** Master switch for the hand-drawn art treatment (default true) */
  artStyle?: boolean;
  /** Base interior hatch angle for the filled region, degrees (default -32) */
  hatchAngle?: number;
  /** Cross-hatch second-layer angle, degrees (default 31) */
  crossHatchAngle?: number;
  /** Fraction of the filled region that gets the cross-hatch layer, 0..1 (default 0.5) */
  crossHatchAmount?: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 (default 0.5) */
  hatchJitter?: number;
  /** Posterize the normalized field into this many value bands before tracing; 0 = continuous (default artStyle ? 5 : 0) */
  valueBands?: number;
  /** Hold faint contours off the frame corners, 0..1 (default artStyle ? 0.35 : 0) */
  vignette?: number;
  /** Gutter reserved around the drawing in art mode, in grid cells (default 2) */
  borderGap?: number;

  // ---- Hand / plot ----
  /** Base hand-drawn wobble amplitude in px (default scales with cell px) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export type LeniaPreset = 'orbium' | 'cells' | 'rings' | 'pulse';

export type LeniaSeedPattern = 'orbium' | 'soup' | 'symmetric';

/**
 * Lenia rule presets. `orbium` is Bert Chan's canonical solitary glider (its
 * exact rule + seed bitmap); the others are soup regimes whose μ/σ/kernel
 * settle into colonies — names describe the look, and the sliders fine-tune
 * from there.
 */
export const LENIA_PRESETS: Record<
  LeniaPreset,
  {
    R: number;
    mu: number;
    sigma: number;
    T: number;
    beta: number[];
    seedPattern: LeniaSeedPattern;
    longExposure: boolean;
  }
> = {
  orbium: { R: 13, mu: 0.15, sigma: 0.015, T: 10, beta: [1], seedPattern: 'orbium', longExposure: true },
  cells: { R: 12, mu: 0.15, sigma: 0.017, T: 10, beta: [1], seedPattern: 'soup', longExposure: false },
  rings: { R: 12, mu: 0.18, sigma: 0.025, T: 10, beta: [0.5, 1, 0.667], seedPattern: 'soup', longExposure: false },
  pulse: { R: 11, mu: 0.26, sigma: 0.036, T: 10, beta: [1], seedPattern: 'symmetric', longExposure: false },
};

/**
 * Bert Chan's published `Orbium` seed (R = 13): a 20×20 float bitmap of the
 * solitary glider. Stamped 1:1 into the grid, it travels — the long exposure
 * traces its wake. (From the Lenia reference notebook.)
 */
// prettier-ignore
export const ORBIUM: number[][] = [
  [0,0,0,0,0,0,0.1,0.14,0.1,0,0,0.03,0.03,0,0,0.3,0,0,0,0],
  [0,0,0,0,0,0.08,0.24,0.3,0.3,0.18,0.14,0.15,0.16,0.15,0.09,0.2,0,0,0,0],
  [0,0,0,0,0,0.15,0.34,0.44,0.46,0.38,0.18,0.14,0.11,0.13,0.19,0.18,0.45,0,0,0],
  [0,0,0,0,0.06,0.13,0.39,0.5,0.5,0.37,0.06,0,0,0,0.02,0.16,0.68,0,0,0],
  [0,0,0,0.11,0.17,0.17,0.33,0.4,0.38,0.28,0.14,0,0,0,0,0,0.18,0.42,0,0],
  [0,0,0.09,0.18,0.13,0.06,0.08,0.26,0.32,0.32,0.27,0,0,0,0,0,0,0.82,0,0],
  [0.27,0,0.16,0.12,0,0,0,0.25,0.38,0.44,0.45,0.34,0,0,0,0,0,0.22,0.17,0],
  [0,0.07,0.2,0.02,0,0,0,0.31,0.48,0.57,0.6,0.57,0,0,0,0,0,0,0.49,0],
  [0,0.59,0.19,0,0,0,0,0.2,0.57,0.69,0.76,0.76,0.49,0,0,0,0,0,0.36,0],
  [0,0.58,0.19,0,0,0,0,0,0.67,0.83,0.9,0.92,0.87,0.12,0,0,0,0,0.22,0.07],
  [0,0,0.46,0,0,0,0,0,0.7,0.93,1,1,1,0.61,0,0,0,0,0.18,0.11],
  [0,0,0.82,0,0,0,0,0,0.47,1,1,0.98,1,0.96,0.27,0,0,0,0.19,0.1],
  [0,0,0.46,0,0,0,0,0,0.25,1,1,0.84,0.92,0.97,0.54,0.14,0.04,0.1,0.21,0.05],
  [0,0,0,0.4,0,0,0,0,0.09,0.8,1,0.82,0.8,0.85,0.63,0.31,0.18,0.19,0.2,0.01],
  [0,0,0,0.36,0.1,0,0,0,0.05,0.54,0.86,0.79,0.74,0.72,0.6,0.39,0.28,0.24,0.13,0],
  [0,0,0,0.01,0.3,0.07,0,0,0.08,0.36,0.64,0.7,0.64,0.6,0.51,0.39,0.29,0.19,0.04,0],
  [0,0,0,0,0.1,0.24,0.14,0.1,0.15,0.29,0.45,0.53,0.52,0.46,0.4,0.31,0.21,0.08,0,0],
  [0,0,0,0,0,0.08,0.21,0.21,0.22,0.29,0.36,0.39,0.37,0.33,0.26,0.18,0.09,0,0,0],
  [0,0,0,0,0,0,0.03,0.13,0.19,0.22,0.24,0.24,0.23,0.18,0.13,0.05,0,0,0,0],
  [0,0,0,0,0,0,0,0,0.02,0.06,0.08,0.09,0.07,0.05,0.01,0,0,0,0,0],
];

// Keep the synchronous, main-thread run well bounded (this renders inside a
// React useMemo, like Conway/RD). Lenia's per-cell cost is the kernel tap
// count (≈ πR²), so the budget counts convolution multiply-adds, not steps.
const MAX_COLS = 180;
const MAX_STEPS = 900;
const MAX_RADIUS = 18;
const TAP_BUDGET = 2e9;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** A seeded rule-of-thirds intersection, lerped out from centre by `bias`. */
function thirdsOrigin(
  cols: number,
  rows: number,
  random: () => number,
  bias: number
): { cx: number; cy: number } {
  const fx = random() < 0.5 ? 1 / 3 : 2 / 3;
  const fy = random() < 0.5 ? 1 / 3 : 2 / 3;
  return {
    cx: Math.round(cols * (0.5 + (fx - 0.5) * bias)),
    cy: Math.round(rows * (0.5 + (fy - 0.5) * bias)),
  };
}

/** Light moving-average smoothing with fixed endpoints — turns the blocky
 * marching-squares contours into organic curves (shared with Conway/RD). */
function smoothPolyline(points: Point[], iterations: number): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Point[] = new Array(pts.length);
    out[0] = { ...pts[0] };
    out[pts.length - 1] = { ...pts[pts.length - 1] };
    for (let i = 1; i < pts.length - 1; i++) {
      out[i] = {
        x: (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4,
        y: (pts[i - 1].y + 2 * pts[i].y + pts[i + 1].y) / 4,
      };
    }
    pts = out;
  }
  return pts;
}

/**
 * Commit a tone to one of `bands` discrete levels spanning [lo, 1]. Anything
 * below `lo` returns 0, so empty field stays clean paper.
 */
function posterize(t: number, bands: number, lo: number): number {
  if (bands <= 0) return t;
  if (t < lo) return 0;
  const span = 1 - lo;
  const k = Math.min(bands - 1, Math.floor(((t - lo) / span) * bands));
  return lo + ((k + 0.5) / bands) * span;
}

/**
 * Parallel hatching at `angleRad`, clipped to a region. Walks scanlines in the
 * rotated frame; spacing and phase are jittered by low-frequency noise, and
 * each scanline is broken into runs wherever it leaves the region. `coverage`
 * (0..1) gates how much of the region is filled. Output segments are in cell
 * coordinates. (Shared technique with Conway/RD.)
 */
function angledRegionHatch(
  inRegion: (cx: number, cy: number) => boolean,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  angleRad: number,
  baseSpacing: number,
  noise: SimplexNoise,
  jitter: number,
  phaseOffset: number,
  coverage: number
): Point[][] {
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const nx = -dy;
  const ny = dx;
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const c of corners) {
    const u = c.x * nx + c.y * ny;
    const v = c.x * dx + c.y * dy;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const threshold = coverage * 2 - 1;
  const segs: Point[][] = [];
  const vStep = 0.4;
  let u = uMin + phaseOffset;
  while (u <= uMax) {
    let run: Point[] = [];
    for (let v = vMin; v <= vMax; v += vStep) {
      const x = nx * u + dx * v;
      const y = ny * u + dy * v;
      const inside =
        inRegion(Math.floor(x), Math.floor(y)) &&
        (coverage >= 1 || noise.noise2D(x * 0.06 + 13.1, y * 0.06 + 7.7) < threshold);
      if (inside) {
        run.push({ x, y });
      } else {
        if (run.length >= 2) segs.push(run);
        run = [];
      }
    }
    if (run.length >= 2) segs.push(run);
    const spacing = baseSpacing * (1 + jitter * 0.5 * noise.noise2D(u * 0.15, phaseOffset));
    u += Math.max(0.3, spacing);
  }
  return segs;
}

/** Smooth bell core for the kernel: peaks at x = 0.5, vanishes at 0 and 1. */
function bell(x: number): number {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp(4 - 1 / (x * (1 - x)));
}

/** Lenia growth: a Gaussian bump centred at μ, mapped to [-1, 1]. */
export function growthFn(u: number, mu: number, sigma: number): number {
  const d = u - mu;
  return 2 * Math.exp(-(d * d) / (2 * sigma * sigma)) - 1;
}

export interface RingKernel {
  dx: Int32Array;
  dy: Int32Array;
  w: Float32Array;
  taps: number;
}

/**
 * Build the radially-symmetric ring kernel as a flat offset list, normalised so
 * Σw = 1 (so the convolution potential U is a weighted neighbourhood mean in
 * [0,1]). `beta` peak weights split the normalised radius into concentric
 * rings; near-zero taps are pruned to keep the convolution cheap.
 */
export function makeRingKernel(R: number, beta: number[]): RingKernel {
  const nb = Math.max(1, beta.length);
  const dxs: number[] = [];
  const dys: number[] = [];
  const ws: number[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r = dist / R;
      if (r >= 1) continue;
      const br = r * nb;
      const idx = Math.min(nb - 1, Math.floor(br));
      const weight = beta[idx] * bell(br - idx);
      if (weight <= 4e-3) continue;
      dxs.push(dx);
      dys.push(dy);
      ws.push(weight);
    }
  }
  let total = 0;
  for (const w of ws) total += w;
  const inv = total > 0 ? 1 / total : 0;
  return {
    dx: Int32Array.from(dxs),
    dy: Int32Array.from(dys),
    w: Float32Array.from(ws.map((w) => w * inv)),
    taps: ws.length,
  };
}

/**
 * One Lenia update step with toroidal (wrap-around) boundaries. Convolves `A`
 * with the ring kernel to the potential U, applies the Gaussian growth and the
 * time step dt = 1/T. Exported for tests, mirroring `stepReactionDiffusion`.
 */
export function stepLenia(
  A: Float32Array,
  ANext: Float32Array,
  cols: number,
  rows: number,
  kernel: RingKernel,
  mu: number,
  sigma: number,
  dt: number
): void {
  const { dx: kdx, dy: kdy, w: kw, taps } = kernel;
  const inv2s2 = 1 / (2 * sigma * sigma);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let u = 0;
      for (let t = 0; t < taps; t++) {
        let nx = x + kdx[t];
        if (nx < 0) nx += cols;
        else if (nx >= cols) nx -= cols;
        let ny = y + kdy[t];
        if (ny < 0) ny += rows;
        else if (ny >= rows) ny -= rows;
        u += kw[t] * A[ny * cols + nx];
      }
      const d = u - mu;
      const g = 2 * Math.exp(-(d * d) * inv2s2) - 1;
      const i = y * cols + x;
      const a = A[i] + dt * g;
      ANext[i] = a < 0 ? 0 : a > 1 ? 1 : a;
    }
  }
}

/** Rotate a bitmap by `quarter` × 90° clockwise (changes a glider's heading). */
function rotateBitmap(grid: number[][], quarter: number): number[][] {
  let g = grid;
  for (let q = ((quarter % 4) + 4) % 4; q > 0; q--) {
    const h = g.length;
    const w = g[0].length;
    const out: number[][] = Array.from({ length: w }, () => new Array(h).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) out[x][h - 1 - y] = g[y][x];
    }
    g = out;
  }
  return g;
}

/** Stamp a bitmap into the grid with its top-left at (ox, oy). */
function stampBitmap(
  A: Float32Array,
  cols: number,
  rows: number,
  ox: number,
  oy: number,
  bmp: number[][]
): void {
  for (let r = 0; r < bmp.length; r++) {
    const yy = oy + r;
    if (yy < 0 || yy >= rows) continue;
    const row = bmp[r];
    for (let c = 0; c < row.length; c++) {
      const xx = ox + c;
      if (xx < 0 || xx >= cols) continue;
      A[yy * cols + xx] = row[c];
    }
  }
}

/** Fill a soft circular patch of seeded random soup, centred at (cx, cy). */
function stampSoup(
  A: Float32Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  radius: number,
  random: () => number
): void {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= rows) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const xx = cx + dx;
      if (xx < 0 || xx >= cols) continue;
      if (dx * dx + dy * dy > r2) continue;
      // Scale the soup down: a full-strength [0,1] field convolves to a
      // potential well above μ everywhere and the colony dies on the first
      // step. ~0.6 lands the neighbourhood mean in the growth band so
      // structure self-organises across the regimes.
      A[yy * cols + xx] = random() * 0.6;
    }
  }
}

interface LeniaSimulation {
  cols: number;
  rows: number;
  /** Final state A, row-major, in [0, 1] */
  a: Float32Array;
  /** Accumulated exposure (long-exposure mode), or null */
  exposure: Float32Array | null;
}

function simulateLenia(
  cols: number,
  rows: number,
  steps: number,
  kernel: RingKernel,
  mu: number,
  sigma: number,
  dt: number,
  random: () => number,
  seedPattern: LeniaSeedPattern,
  seedSpots: number,
  offCenter: number,
  longExposure: boolean,
  decay: number
): LeniaSimulation {
  const n = cols * rows;
  let a = new Float32Array(n);
  let aNext = new Float32Array(n);

  if (seedPattern === 'orbium') {
    // Several gliders at random thirds positions and headings: their wakes
    // weave and collide, so the long exposure reads as a rich tangle of tracks
    // rather than one thin comet. (One creature alone leaves too little ink.)
    const count = clamp(Math.round(seedSpots), 1, 6);
    for (let s = 0; s < count; s++) {
      const bmp = rotateBitmap(ORBIUM, Math.floor(random() * 4));
      const bw = bmp[0].length;
      const bh = bmp.length;
      const o = thirdsOrigin(cols, rows, random, offCenter > 0 ? offCenter : 0.7);
      const ox = clamp(o.cx - (bw >> 1) + Math.round((random() - 0.5) * cols * 0.15), 0, cols - bw);
      const oy = clamp(o.cy - (bh >> 1) + Math.round((random() - 0.5) * rows * 0.15), 0, rows - bh);
      stampBitmap(a, cols, rows, ox, oy, bmp);
    }
  } else if (seedPattern === 'symmetric') {
    // Fill the left half with overlapping soup, then mirror across the vertical
    // axis for a colony with bilateral symmetry.
    const radius = Math.max(3, Math.round(Math.min(cols, rows) * 0.18));
    const spots = Math.max(2, Math.round(seedSpots));
    for (let s = 0; s < spots; s++) {
      const cx = Math.round(cols * (0.12 + random() * 0.3));
      const cy = Math.round(rows * (0.15 + random() * 0.7));
      stampSoup(a, cols, rows, cx, cy, radius, random);
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols >> 1; x++) {
        a[y * cols + (cols - 1 - x)] = a[y * cols + x];
      }
    }
  } else {
    // A generous central soup region guarantees ignition (a too-small or
    // too-sparse seed just decays before any structure forms), with a few
    // satellite patches for variety.
    const cx0 = Math.round(cols / 2);
    const cy0 = Math.round(rows / 2);
    stampSoup(a, cols, rows, cx0, cy0, Math.round(Math.min(cols, rows) * 0.33), random);
    const radius = Math.max(3, Math.round(Math.min(cols, rows) * 0.16));
    const spots = Math.max(0, Math.round(seedSpots) - 1);
    const inset = 0.18;
    for (let s = 0; s < spots; s++) {
      const cx = Math.round(cols * inset + random() * cols * (1 - 2 * inset));
      const cy = Math.round(rows * inset + random() * rows * (1 - 2 * inset));
      stampSoup(a, cols, rows, cx, cy, radius, random);
    }
  }

  const exposure = longExposure ? new Float32Array(n) : null;
  if (exposure) for (let i = 0; i < n; i++) exposure[i] = a[i];

  for (let s = 0; s < steps; s++) {
    stepLenia(a, aNext, cols, rows, kernel, mu, sigma, dt);
    const tmp = a;
    a = aNext;
    aNext = tmp;
    if (exposure) {
      for (let i = 0; i < n; i++) {
        const e = exposure[i] * decay;
        exposure[i] = a[i] > e ? a[i] : e;
      }
    }
  }

  return { cols, rows, a, exposure };
}

/**
 * Render a Lenia field as plottable single-pen strokes.
 */
export function generateLenia(options: LeniaOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'orbium',
    seedSpots = 5,
    style = 'contour',
    contourLevels = 6,
    blurSigma = 1.0,
    isoLow = 0.2,
    isoHigh = 0.9,
    fillThreshold = 0.4,
    crossHatchAmount = 0.5,
    hatchJitter = 0.5,
    decay = 0.985,
    gamma = 0.5,
    optimize = true,
  } = options;

  const p = LENIA_PRESETS[preset] ?? LENIA_PRESETS.orbium;
  const R = clamp(Math.round(options.kernelRadius ?? p.R), 3, MAX_RADIUS);
  const mu = options.mu ?? p.mu;
  const sigma = Math.max(1e-4, options.sigma ?? p.sigma);
  const T = Math.max(1, options.timeRes ?? p.T);
  const beta = options.beta ?? p.beta;
  const seedPattern = options.seedPattern ?? p.seedPattern;
  const longExposure = options.longExposure ?? p.longExposure;

  const artStyle = options.artStyle ?? true;
  const hatchAngle = ((options.hatchAngle ?? -32) * Math.PI) / 180;
  const crossHatchAngle = ((options.crossHatchAngle ?? 31) * Math.PI) / 180;
  const valueBands = options.valueBands ?? (artStyle ? 5 : 0);
  const vignette = options.vignette ?? (artStyle ? 0.35 : 0);
  const offCenter = options.offCenter ?? (artStyle ? 0.6 : 0);
  const borderGap = Math.max(0.5, options.borderGap ?? 2);

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });

  // The user picks the grid width; the grid *shape* follows the page aspect,
  // not the margin. Deriving rows from the margined area let a fixed-px margin
  // change the inner box's aspect ratio and so the grid shape, which re-ran a
  // wholly different simulation on every margin tweak; tying rows to the page
  // aspect means the margin only scales and insets the same field. Sim cost
  // depends on cols·rows·steps·taps, never on page resolution.
  const cols = clamp(Math.round(options.gridCols ?? 120), 8, MAX_COLS);
  const rows = clamp(Math.round((height / width) * cols), 8, 2 * MAX_COLS);
  const innerW = Math.max(0, width - 2 * margin);
  const refCell = cols > 0 ? innerW / cols : 0;
  const gutter = artStyle ? borderGap * refCell : 0;
  const frameMargin = margin + gutter;
  const usableW = Math.max(0, width - 2 * frameMargin);
  const usableH = Math.max(0, height - 2 * frameMargin);
  // Square cells that fit the framed page in both axes.
  const cellPx = Math.min(cols > 0 ? usableW / cols : 0, rows > 0 ? usableH / rows : 0);
  // The toroidal kernel needs the grid comfortably larger than its diameter.
  if (cellPx < 0.5 || cols < 2 * R + 2 || rows < 2 * R + 2) return empty();

  const originX = frameMargin + (usableW - cols * cellPx) / 2;
  const originY = frameMargin + (usableH - rows * cellPx) / 2;

  const kernel = makeRingKernel(R, beta);
  if (kernel.taps === 0) return empty();

  // Bound the synchronous run: cap steps, then trim by the convolution budget.
  let steps = clamp(Math.round(options.steps ?? 280), 0, MAX_STEPS);
  const perStep = cols * rows * kernel.taps;
  if (perStep * steps > TAP_BUDGET) steps = Math.max(1, Math.floor(TAP_BUDGET / perStep));

  const random = makeRandom(seed);
  const sim = simulateLenia(
    cols,
    rows,
    steps,
    kernel,
    mu,
    sigma,
    1 / T,
    random,
    seedPattern,
    seedSpots,
    offCenter,
    longExposure,
    decay
  );

  const cellCount = cols * rows;
  const noise = createNoise(seed + 8101);
  const lines: FlowLine[] = [];

  // The field we ink: the gamma-lifted exposure trail, or the final state.
  const source = longExposure && sim.exposure ? sim.exposure : sim.a;
  let srcMax = 0;
  for (let i = 0; i < cellCount; i++) if (source[i] > srcMax) srcMax = source[i];
  if (srcMax < 1e-4) return empty();

  const norm = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    const t = clamp(source[i] / srcMax, 0, 1);
    norm[i] = longExposure ? Math.pow(t, gamma) : t;
  }
  let field = norm;
  if (valueBands > 0) {
    field = new Float32Array(cellCount);
    for (let i = 0; i < cellCount; i++) field[i] = posterize(norm[i], valueBands, isoLow);
  }

  const toPx = (pt: Point): Point => ({
    x: originX + (pt.x + 0.5) * cellPx,
    y: originY + (pt.y + 0.5) * cellPx,
  });
  const cellIndexAt = (x: number, y: number): number => {
    const cxi = clamp(Math.floor((x - originX) / cellPx), 0, cols - 1);
    const cyi = clamp(Math.floor((y - originY) / cellPx), 0, rows - 1);
    return cyi * cols + cxi;
  };

  // Hold faint contours off the four frame corners against a broken,
  // noise-thresholded edge (same as RD). Splits a cell-space polyline into the
  // runs that survive.
  const vignetteBand = vignette * 0.45;
  const cullByVignette = (pts: Point[]): Point[][] => {
    if (vignetteBand <= 0) return pts.length >= 2 ? [pts] : [];
    const runs: Point[][] = [];
    let run: Point[] = [];
    for (const pt of pts) {
      const fx = cols > 1 ? pt.x / (cols - 1) : 0.5;
      const fy = rows > 1 ? pt.y / (rows - 1) : 0.5;
      const ex = Math.min(fx, 1 - fx);
      const ey = Math.min(fy, 1 - fy);
      const cx = Math.max(0, (vignetteBand - ex) / vignetteBand);
      const cy = Math.max(0, (vignetteBand - ey) / vignetteBand);
      const depth = cx * cy;
      const nv = noise.noise2D(pt.x * 0.12 + 30.5, pt.y * 0.12 + 17.5) * 0.5 + 0.5;
      if (!(depth > lerp(0.12, 0.6, nv))) {
        run.push(pt);
      } else {
        if (run.length >= 2) runs.push(run);
        run = [];
      }
    }
    if (run.length >= 2) runs.push(run);
    return runs;
  };

  // Tag an iso band by depth: inner → bold 'core', mid → 'mid', outer → 'rim'.
  const bandFor = (frac: number): { layer: string; pen: 'fine' | 'bold' } =>
    frac >= 0.66
      ? { layer: 'core', pen: 'bold' }
      : frac >= 0.33
        ? { layer: 'mid', pen: 'fine' }
        : { layer: 'rim', pen: 'fine' };

  // ---- Field as nested iso-contours --------------------------------------
  const renderContour = (src: Float32Array): void => {
    const blurred = gaussianBlur({ width: cols, height: rows, data: new Float32Array(src) }, blurSigma);
    let fMin = Infinity;
    let fMax = -Infinity;
    for (let i = 0; i < blurred.data.length; i++) {
      const d = blurred.data[i];
      if (d < fMin) fMin = d;
      if (d > fMax) fMax = d;
    }
    if (fMax - fMin < 1e-4) return;
    for (let level = 0; level < contourLevels; level++) {
      const frac = (level + 0.5) / contourLevels;
      const iso = fMin + (fMax - fMin) * (isoLow + (isoHigh - isoLow) * frac);
      const { layer, pen } = bandFor(frac);
      for (const poly of traceIsoContours(blurred, iso)) {
        if (poly.length < 3) continue;
        for (const run of cullByVignette(poly)) {
          const smooth = smoothPolyline(run.map(toPx), 2);
          if (smooth.length >= 2) lines.push({ points: smooth, pen, layer });
        }
      }
    }
  };

  // ---- Dense region as a hatched, outlined mass --------------------------
  const renderHatch = (threshold: number, fillLayer: string): void => {
    const inRegionRaster = new Float32Array(cellCount);
    let minX = cols;
    let minY = rows;
    let maxX = -1;
    let maxY = -1;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (norm[cy * cols + cx] < threshold) continue;
        inRegionRaster[cy * cols + cx] = 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
      }
    }
    if (maxX < 0) return;

    const blurredMask = gaussianBlur({ width: cols, height: rows, data: inRegionRaster }, 0.8);
    for (const loop of traceIsoContours(blurredMask, 0.5)) {
      if (loop.length < 3) continue;
      const smooth = smoothPolyline(loop.map(toPx), 2);
      if (smooth.length >= 2) lines.push({ points: smooth, pen: 'bold', layer: 'core' });
    }

    const inRegion = (cx: number, cy: number): boolean =>
      cx >= 0 && cx < cols && cy >= 0 && cy < rows && norm[cy * cols + cx] >= threshold;
    const bounds = { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
    const segs = [
      ...angledRegionHatch(inRegion, bounds, hatchAngle, 0.55, noise, hatchJitter, 0, 1),
      ...angledRegionHatch(inRegion, bounds, crossHatchAngle, 0.55, noise, hatchJitter, 0.27, crossHatchAmount),
    ];
    for (const seg of segs) {
      if (seg.length >= 2) lines.push({ points: seg.map(toPx), pen: 'fine', layer: fillLayer });
    }
  };

  if (style === 'hatch') {
    renderHatch(fillThreshold, 'mid');
  } else if (style === 'dual') {
    renderContour(field);
    renderHatch(Math.max(fillThreshold, 0.55), 'core');
  } else {
    renderContour(field);
  }

  // In long-exposure mode, trace the final living creature crisp over its wake.
  if (longExposure) {
    let aMax = 0;
    for (let i = 0; i < cellCount; i++) if (sim.a[i] > aMax) aMax = sim.a[i];
    if (aMax > 1e-3) {
      const present = new Float32Array(cellCount);
      for (let i = 0; i < cellCount; i++) present[i] = sim.a[i] / aMax;
      const blurred = gaussianBlur({ width: cols, height: rows, data: present }, 0.8);
      for (const loop of traceIsoContours(blurred, 0.4)) {
        if (loop.length < 3) continue;
        const smooth = smoothPolyline(loop.map(toPx), 2);
        if (smooth.length >= 2) lines.push({ points: smooth, pen: 'bold', layer: 'core' });
      }
    }
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  // Faint rim contours wobble more; the dense core stays steady.
  const wobble = options.wobble ?? Math.max(0.4, cellPx * 0.12);
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: cellPx * 8,
    seed,
    amplitudeScale: (x, y) => lerp(1.2, 0.3, norm[cellIndexAt(x, y)]),
  });

  if (optimize) result = optimizePlot(result);

  return result;
}
