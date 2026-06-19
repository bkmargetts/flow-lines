import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { optimizePlot } from './optimize.js';
import { GrayscaleImage, gaussianBlur } from './image.js';
import { traceIsoContours } from './iso-contours.js';
import { createNoise, SimplexNoise } from './noise.js';

/**
 * A Gray–Scott reaction–diffusion field, rendered as plottable single-pen
 * strokes. Two virtual chemicals, U and V, sit on a grid; every step U
 * diffuses and is fed in, V diffuses and is consumed, and the reaction
 * U + 2V → 3V converts U into more V wherever the two meet:
 *
 *     U' = U + (Du·∇²U − U·V² + f·(1 − U))·dt
 *     V' = V + (Dv·∇²V + U·V² − (f + k)·V)·dt
 *
 * Tuned feed `f` and kill `k` rates settle into Turing patterns — coral,
 * dividing spots, labyrinths, fingerprints, travelling waves. Unlike Conway's
 * long exposure there is no time accumulation: the final V concentration *is*
 * the image. That scalar field is what we ink.
 *
 * The Laplacian is the standard weighted 9-point Gray–Scott stencil (centre
 * −1, edge neighbours 0.2, diagonal neighbours 0.05). Paired with Du = 1.0,
 * Dv = 0.5 and dt = 1 — the Karl Sims canonical, where the stencil's centre
 * weight of −1 (not −4) keeps the explicit scheme stable at dt = 1 — so the
 * classic Pearson/Sims feed/kill table applies directly and the reagents
 * actually spread and branch. (Weaker diffusion freezes a seed into one
 * stable spot instead of growing coral.) Boundaries are Neumann (edge cells
 * replicated), so reagent doesn't leak and contours don't pick up a seam.
 *
 * Because the toolbox plots a single pen at a single width, the V field is
 * turned into ink as line work — nested iso-contours of the blurred field, or
 * angled hatching of the high-V regions — never opacity or stroke-width
 * tricks. Strokes are tagged with a `layer` ('core' / 'mid' / 'rim') so the
 * piece can be exported one SVG per pen.
 *
 * Three render styles share the same simulation:
 *  - `contour` — nested iso-contours of the blurred field (the default look).
 *  - `hatch`   — the high-V region filled with angled, jittered hatching and a
 *                confident traced outline.
 *  - `dual`    — contour lines for the outer field plus a hatched core, so a
 *                multi-pen plot reads as line work around a solid mass.
 */
export interface ReactionDiffusionOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls V-seed placement, hatch jitter and wobble */
  seed?: number;

  // ---- Simulation ----
  /** Simulation grid width in cells; rows derive from the page aspect (default 180) */
  gridCols?: number;
  /** Named feed/kill preset (default 'coral') */
  preset?: RDPreset;
  /** Feed rate f override; when set, ignores the preset's f */
  feed?: number;
  /** Kill rate k override; when set, ignores the preset's k */
  kill?: number;
  /** Simulation iterations (default 4000) */
  steps?: number;
  /** Time step (default 1.0) */
  dt?: number;
  /** U diffusion rate (default 1.0) */
  du?: number;
  /** V diffusion rate (default 0.5) */
  dv?: number;
  /** Count of V seed blobs (default 12; ignored for the 'center' layout) */
  seedSpots?: number;
  /** Seed blob half-size in cells (default 3) */
  seedSize?: number;
  /** How the initial V perturbation is placed (default 'scatter') */
  seedLayout?: 'scatter' | 'center' | 'grid';
  /** Bias 'center'/single-blob seeding toward a rule-of-thirds point, 0..1 (default artStyle ? 0.6 : 0) */
  offCenter?: number;

  // ---- Render ----
  /** Render style for the field (default 'contour') */
  style?: 'contour' | 'hatch' | 'dual';
  /** Nested iso levels for the 'contour'/'dual' styles (default 6) */
  contourLevels?: number;
  /** Pre-trace Gaussian blur on the V field, in cells (default 1.0) */
  blurSigma?: number;
  /** Lowest iso level as a fraction of the V range, 0..1 (default 0.2) */
  isoLow?: number;
  /** Highest iso level as a fraction of the V range, 0..1 (default 0.9) */
  isoHigh?: number;
  /** V threshold (normalized) that becomes inked region for the 'hatch'/'dual' styles (default 0.4) */
  fillThreshold?: number;

  // ---- Art treatment (all default off artStyle, off = faithful field) ----
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
  /** Posterize the normalized V field into this many value bands before tracing; 0 = continuous (default artStyle ? 5 : 0) */
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

export type RDPreset =
  | 'coral'
  | 'mitosis'
  | 'maze'
  | 'fingerprint'
  | 'holes'
  | 'waves'
  | 'solitons'
  | 'worms';

/** Canonical Pearson/Sims feed (f) and kill (k) rates for Du=1.0, Dv=0.5, dt=1. */
export const RD_PRESETS: Record<RDPreset, { f: number; k: number }> = {
  coral: { f: 0.0545, k: 0.062 },
  mitosis: { f: 0.0367, k: 0.0649 },
  maze: { f: 0.029, k: 0.057 },
  fingerprint: { f: 0.026, k: 0.051 },
  holes: { f: 0.039, k: 0.058 },
  waves: { f: 0.014, k: 0.045 },
  solitons: { f: 0.03, k: 0.062 },
  worms: { f: 0.058, k: 0.063 },
};

// Keep the synchronous, main-thread run well bounded (this renders inside a
// React useMemo, like Conway). Cost ≈ cols·rows·steps cell-updates.
const MAX_COLS = 250;
const MAX_STEPS = 6000;
const STEP_BUDGET = 4.5e8;

/** Deterministic LCG, matching the convention used across the toolbox. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

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
 * marching-squares contours into organic curves (shared with Conway). */
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
 * below `lo` returns 0, so empty field stays clean paper — the bands only
 * quantize the visible range into committed shapes.
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
 * rotated frame; spacing and phase are jittered by low-frequency noise so the
 * fill never reads as an arithmetic screen, and each scanline is broken into
 * runs wherever it leaves the region — so strokes terminate at the silhouette.
 * `coverage` (0..1) gates how much of the region is filled. Output segments are
 * in cell coordinates. (Shared technique with Conway's core-mass hatch.)
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

/** Stamp a square blob of pure V (and half-depleted U) into the grid. */
function stampBlob(
  u: Float32Array,
  v: Float32Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  half: number
): void {
  for (let dy = -half; dy <= half; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= rows) continue;
    for (let dx = -half; dx <= half; dx++) {
      const xx = cx + dx;
      if (xx < 0 || xx >= cols) continue;
      const i = yy * cols + xx;
      u[i] = 0.5;
      v[i] = 1;
    }
  }
}

/**
 * One Gray–Scott step with Neumann (replicated-edge) boundaries. Exported for
 * tests, mirroring Conway's exported `stepLife`.
 */
export function stepReactionDiffusion(
  u: Float32Array,
  v: Float32Array,
  uNext: Float32Array,
  vNext: Float32Array,
  cols: number,
  rows: number,
  du: number,
  dv: number,
  f: number,
  k: number,
  dt: number
): void {
  for (let y = 0; y < rows; y++) {
    const yUp = (y > 0 ? y - 1 : 0) * cols;
    const yDn = (y < rows - 1 ? y + 1 : rows - 1) * cols;
    const yC = y * cols;
    for (let x = 0; x < cols; x++) {
      const xL = x > 0 ? x - 1 : 0;
      const xR = x < cols - 1 ? x + 1 : cols - 1;
      const i = yC + x;
      const uC = u[i];
      const vC = v[i];

      const lapU =
        (u[yC + xL] + u[yC + xR] + u[yUp + x] + u[yDn + x]) * 0.2 +
        (u[yUp + xL] + u[yUp + xR] + u[yDn + xL] + u[yDn + xR]) * 0.05 -
        uC;
      const lapV =
        (v[yC + xL] + v[yC + xR] + v[yUp + x] + v[yDn + x]) * 0.2 +
        (v[yUp + xL] + v[yUp + xR] + v[yDn + xL] + v[yDn + xR]) * 0.05 -
        vC;

      const reaction = uC * vC * vC;
      const nu = uC + (du * lapU - reaction + f * (1 - uC)) * dt;
      const nv = vC + (dv * lapV + reaction - (f + k) * vC) * dt;
      uNext[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
      vNext[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    }
  }
}

interface RDSimulation {
  cols: number;
  rows: number;
  /** Final V concentration, row-major, in [0, 1] */
  v: Float32Array;
  /** Observed maximum V, for normalization */
  vMax: number;
}

function simulateRD(
  cols: number,
  rows: number,
  steps: number,
  du: number,
  dv: number,
  f: number,
  k: number,
  dt: number,
  random: () => number,
  seedSpots: number,
  seedSize: number,
  seedLayout: 'scatter' | 'center' | 'grid',
  offCenter: number
): RDSimulation {
  const n = cols * rows;
  let u = new Float32Array(n).fill(1);
  let v = new Float32Array(n);
  let uNext = new Float32Array(n);
  let vNext = new Float32Array(n);

  const half = Math.max(1, Math.round(seedSize));
  if (seedLayout === 'center') {
    let cx = Math.floor(cols / 2);
    let cy = Math.floor(rows / 2);
    if (offCenter > 0) {
      const o = thirdsOrigin(cols, rows, random, offCenter);
      cx = o.cx;
      cy = o.cy;
    }
    cx += Math.round((random() - 0.5) * cols * 0.04);
    cy += Math.round((random() - 0.5) * rows * 0.04);
    stampBlob(u, v, cols, rows, cx, cy, half);
  } else if (seedLayout === 'grid') {
    const per = Math.max(1, Math.round(Math.sqrt(seedSpots)));
    for (let gy = 0; gy < per; gy++) {
      for (let gx = 0; gx < per; gx++) {
        const cx = Math.round((cols * (gx + 1)) / (per + 1) + (random() - 0.5) * cols * 0.03);
        const cy = Math.round((rows * (gy + 1)) / (per + 1) + (random() - 0.5) * rows * 0.03);
        stampBlob(u, v, cols, rows, cx, cy, half);
      }
    }
  } else {
    const inset = 0.12;
    for (let s = 0; s < seedSpots; s++) {
      const cx = Math.round(cols * inset + random() * cols * (1 - 2 * inset));
      const cy = Math.round(rows * inset + random() * rows * (1 - 2 * inset));
      stampBlob(u, v, cols, rows, cx, cy, half);
    }
  }

  for (let s = 0; s < steps; s++) {
    stepReactionDiffusion(u, v, uNext, vNext, cols, rows, du, dv, f, k, dt);
    let tmp = u;
    u = uNext;
    uNext = tmp;
    tmp = v;
    v = vNext;
    vNext = tmp;
  }

  let vMax = 0;
  for (let i = 0; i < n; i++) if (v[i] > vMax) vMax = v[i];
  return { cols, rows, v, vMax };
}

/**
 * Render a Gray–Scott reaction–diffusion field as plottable single-pen strokes.
 */
export function generateReactionDiffusion(options: ReactionDiffusionOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = Math.floor(Math.random() * 1000000),
    preset = 'coral',
    dt = 1.0,
    du = 1.0,
    dv = 0.5,
    seedSpots = 12,
    seedSize = 3,
    seedLayout = 'scatter',
    style = 'contour',
    contourLevels = 6,
    blurSigma = 1.0,
    isoLow = 0.2,
    isoHigh = 0.9,
    fillThreshold = 0.4,
    crossHatchAmount = 0.5,
    hatchJitter = 0.5,
    optimize = true,
  } = options;

  const artStyle = options.artStyle ?? true;
  const hatchAngle = ((options.hatchAngle ?? -32) * Math.PI) / 180;
  const crossHatchAngle = ((options.crossHatchAngle ?? 31) * Math.PI) / 180;
  const valueBands = options.valueBands ?? (artStyle ? 5 : 0);
  const vignette = options.vignette ?? (artStyle ? 0.35 : 0);
  const offCenter = options.offCenter ?? (artStyle ? 0.6 : 0);
  const borderGap = Math.max(0.5, options.borderGap ?? 2);

  const { f, k } = RD_PRESETS[preset] ?? RD_PRESETS.coral;
  const feed = options.feed ?? f;
  const kill = options.kill ?? k;

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });

  // The user picks the grid width; the grid *shape* follows the page aspect,
  // not the margin. Sim cost depends only on cols·rows·steps, never on the page
  // resolution. Deriving rows from the margined area let a fixed-px margin
  // change the inner box's aspect ratio and so the grid shape, re-running a
  // different pattern on every margin tweak; tying rows to the page aspect means
  // the margin only scales and insets the same field. The border gutter is
  // reserved from a reference cell size off the margin box, so toggling the
  // shared plate border never resizes the grid.
  const cols = clamp(Math.round(options.gridCols ?? 180), 8, MAX_COLS);
  const rows = clamp(Math.round((height / width) * cols), 8, 2 * MAX_COLS);
  const innerW = Math.max(0, width - 2 * margin);
  const refCell = cols > 0 ? innerW / cols : 0;
  const gutter = artStyle ? borderGap * refCell : 0;
  const frameMargin = margin + gutter;
  const usableW = Math.max(0, width - 2 * frameMargin);
  const usableH = Math.max(0, height - 2 * frameMargin);
  // Square cells that fit the framed page in both axes.
  const cellPx = Math.min(cols > 0 ? usableW / cols : 0, rows > 0 ? usableH / rows : 0);
  if (cellPx < 0.5 || cols < 8 || rows < 8) return empty();

  // Centre the grid within the framed page.
  const originX = frameMargin + (usableW - cols * cellPx) / 2;
  const originY = frameMargin + (usableH - rows * cellPx) / 2;

  // Bound the synchronous run: cap steps, then trim further if the grid is big.
  let steps = clamp(Math.round(options.steps ?? 4000), 0, MAX_STEPS);
  const cellCount = cols * rows;
  if (cellCount * steps > STEP_BUDGET) steps = Math.floor(STEP_BUDGET / cellCount);

  const random = makeRandom(seed);
  const sim = simulateRD(
    cols,
    rows,
    steps,
    du,
    dv,
    feed,
    kill,
    dt,
    random,
    Math.max(1, Math.round(seedSpots)),
    seedSize,
    seedLayout,
    offCenter
  );
  if (sim.vMax < 1e-6) return empty();

  const noise = createNoise(seed + 8101);
  const lines: FlowLine[] = [];

  // Normalized V field, and a posterized copy committed to value bands.
  const norm = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i++) norm[i] = clamp(sim.v[i] / sim.vMax, 0, 1);
  let field = norm;
  if (valueBands > 0) {
    field = new Float32Array(cellCount);
    for (let i = 0; i < cellCount; i++) field[i] = posterize(norm[i], valueBands, isoLow);
  }

  // Cell raster (corner coords) → page px, matching Conway's cell-centre
  // convention so marks land a half-cell inside the usable box.
  const toPx = (p: Point): Point => ({
    x: originX + (p.x + 0.5) * cellPx,
    y: originY + (p.y + 0.5) * cellPx,
  });
  const cellIndexAt = (x: number, y: number): number => {
    const cxi = clamp(Math.floor((x - originX) / cellPx), 0, cols - 1);
    const cyi = clamp(Math.floor((y - originY) / cellPx), 0, rows - 1);
    return cyi * cols + cxi;
  };

  // Hold faint contours off the four frame corners: vignette sets how far in
  // from each corner (as a fraction of the half-frame, capped at 0.45) the
  // clearing reaches. A point is culled by how deep it sits into that corner
  // square, against a low-frequency noise threshold — so the cleared edge is
  // broken and organic rather than a hard rectangle. Splits a cell-space
  // polyline into the runs that survive.
  const vignetteBand = vignette * 0.45;
  const cullByVignette = (pts: Point[]): Point[][] => {
    if (vignetteBand <= 0) return pts.length >= 2 ? [pts] : [];
    const runs: Point[][] = [];
    let run: Point[] = [];
    for (const p of pts) {
      const fx = cols > 1 ? p.x / (cols - 1) : 0.5;
      const fy = rows > 1 ? p.y / (rows - 1) : 0.5;
      // Distance to the nearest vertical/horizontal edge (0 at edge, 0.5 mid).
      const ex = Math.min(fx, 1 - fx);
      const ey = Math.min(fy, 1 - fy);
      // Depth into the corner square: 0 outside the band, → 1 at the corner.
      const cx = Math.max(0, (vignetteBand - ex) / vignetteBand);
      const cy = Math.max(0, (vignetteBand - ey) / vignetteBand);
      const depth = cx * cy;
      const n = noise.noise2D(p.x * 0.12 + 30.5, p.y * 0.12 + 17.5) * 0.5 + 0.5;
      const cull = depth > lerp(0.12, 0.6, n);
      if (!cull) {
        run.push(p);
      } else {
        if (run.length >= 2) runs.push(run);
        run = [];
      }
    }
    if (run.length >= 2) runs.push(run);
    return runs;
  };

  // Tag an iso band by depth: inner V → bold 'core', mid → 'mid', outer → 'rim'.
  const bandFor = (frac: number): { layer: string; pen: 'fine' | 'bold' } =>
    frac >= 0.66
      ? { layer: 'core', pen: 'bold' }
      : frac >= 0.33
        ? { layer: 'mid', pen: 'fine' }
        : { layer: 'rim', pen: 'fine' };

  // ---- Field as nested iso-contours --------------------------------------
  const renderContour = (): void => {
    const blurred = gaussianBlur(
      { width: cols, height: rows, data: new Float32Array(field) },
      blurSigma
    );
    // Span the iso levels across the blurred field's actual range, so the
    // innermost band always traces a loop near the peak (a fixed absolute iso
    // can sit above the smoothed maximum and drop the whole band). isoLow/High
    // pick the sub-range of that span the contours cover.
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

  // ---- High-V region as a hatched, outlined mass -------------------------
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

    // Confident traced silhouette (blur rounds the staircase, Conway's trick).
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
      ...angledRegionHatch(
        inRegion,
        bounds,
        crossHatchAngle,
        0.55,
        noise,
        hatchJitter,
        0.27,
        crossHatchAmount
      ),
    ];
    for (const seg of segs) {
      if (seg.length >= 2) lines.push({ points: seg.map(toPx), pen: 'fine', layer: fillLayer });
    }
  };

  if (style === 'hatch') {
    renderHatch(fillThreshold, 'mid');
  } else if (style === 'dual') {
    // Nested line work over the whole field, with the dense core filled solid —
    // a multi-pen plot that reads as contours wrapped around an inked mass.
    renderContour();
    renderHatch(Math.max(fillThreshold, 0.55), 'core');
  } else {
    renderContour();
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
