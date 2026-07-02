import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { optimizePlot } from './optimize.js';
import { gaussianBlur } from './image.js';
import { traceIsoContours } from './iso-contours.js';
import { createNoise, SimplexNoise } from './noise.js';
import { makeRandom, randomSeed } from './lib/rng.js';

/**
 * Physarum — a slime-mold transport-network model (Jeff Jones, 2010), rendered
 * as plottable single-pen strokes. Thousands of agents crawl a toroidal grid;
 * each one samples a chemoattractant **trail** field at three points ahead
 * (left / centre / right sensors), steers toward the strongest, steps forward
 * and deposits more trail behind it. Every step the whole field diffuses (a
 * small box blur) and decays. Out of that purely local feedback emerges the
 * organism's hallmark: self-optimising vein networks — the same reticulated
 * webs *Physarum polycephalum* grows to connect food sources.
 *
 * Unlike Conway / Lenia / reaction-diffusion (whose state *is* a scalar field
 * the renderer contours), Physarum carries two things to ink, so it offers a
 * render style the others can't:
 *
 *  - `paths`   — the agents' own trajectories, traced as polylines. This is the
 *                distinctive one: the marks are literally the trails the slime
 *                laid down, layered by the strength of the channel they run in
 *                (busy shared veins read bold 'core'; lone explorers read faint
 *                'rim'). Toroidal wrap-arounds split a trajectory so no line
 *                ever streaks across the page.
 *  - `contour` — nested iso-contours of the blurred trail density (the same
 *                topographic look the other CA modules use).
 *  - `hatch`   — the dense network filled with angled hatching + a traced outline.
 *  - `dual`    — contour lines around a hatched core.
 *
 * Strokes are tagged with a `layer` ('core' / 'mid' / 'rim') so the piece can
 * be exported one SVG per pen.
 */
export interface PhysarumOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls agent placement, sensor tie-breaks, hatch jitter and wobble */
  seed?: number;

  // ---- Simulation ----
  /** Simulation grid width in cells; rows derive from the page aspect (default 200) */
  gridCols?: number;
  /** Named behaviour preset (default 'network') */
  preset?: PhysarumPreset;
  /** Number of agents (override of the preset's density-derived count) */
  agentCount?: number;
  /** Angle between the centre sensor and each side sensor, degrees (default 22.5) */
  sensorAngleDeg?: number;
  /** How many cells ahead the sensors look (default 9) */
  sensorDistance?: number;
  /** How far an agent turns toward the strongest sensor each step, degrees (default 45) */
  rotationAngleDeg?: number;
  /** Cells advanced per step (default 1) */
  stepSize?: number;
  /** Trail laid per agent per step (default 5) */
  depositAmount?: number;
  /** Fraction of trail lost per step, 0..1 (default 0.10) */
  decay?: number;
  /** 3×3 box-blur mix factor applied to the trail each step, 0..1 (default 0.6) */
  diffuseRate?: number;
  /** Simulation iterations (default 400) */
  steps?: number;
  /** How the agent cloud is seeded (default 'scatter') */
  startLayout?: 'scatter' | 'center' | 'ring';
  /** Bias clustered seeding toward a rule-of-thirds point, 0..1 (default artStyle ? 0.6 : 0) */
  offCenter?: number;

  // ---- Render ----
  /** Render style (default 'contour') */
  style?: 'paths' | 'contour' | 'hatch' | 'dual';
  /** 'paths': record an agent position every N steps (default 2) */
  sampleEvery?: number;
  /** 'paths': drop trajectory runs shorter than this, in cells (default 8) */
  minPathLength?: number;
  /** 'paths': fraction of agents whose trajectory is traced, 0..1 (default 0.05) */
  pathFraction?: number;
  /** 'paths': skip this fraction of the run before recording, so trails follow
   *  the consolidated network rather than the initial random scatter (default 0.45) */
  settleFraction?: number;
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
  /** Hold faint marks off the frame corners, 0..1 (default artStyle ? 0.35 : 0) */
  vignette?: number;
  /** Gutter reserved around the drawing in art mode, in grid cells (default 2) */
  borderGap?: number;

  // ---- Hand / plot ----
  /** Base hand-drawn wobble amplitude in px (default scales with cell px) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

export type PhysarumPreset = 'network' | 'veins' | 'denseWeb' | 'explore';

/**
 * Physarum behaviour presets. The names describe the look the parameters settle
 * into; `agentDensity` is agents per grid cell (the actual count is derived from
 * the resolved grid), and the sliders fine-tune from there.
 */
export const PHYSARUM_PRESETS: Record<
  PhysarumPreset,
  {
    agentDensity: number;
    sensorAngleDeg: number;
    sensorDistance: number;
    rotationAngleDeg: number;
    stepSize: number;
    depositAmount: number;
    decay: number;
    diffuseRate: number;
    startLayout: 'scatter' | 'center' | 'ring';
  }
> = {
  // The iconic reticulated transport web — veins enclosing open cells.
  network: { agentDensity: 0.3, sensorAngleDeg: 18, sensorDistance: 6, rotationAngleDeg: 55, stepSize: 1.0, depositAmount: 4, decay: 0.15, diffuseRate: 0.5, startLayout: 'scatter' },
  // Thicker, fewer, more organic channels — wider sensors, slower decay.
  veins: { agentDensity: 0.1, sensorAngleDeg: 35, sensorDistance: 12, rotationAngleDeg: 40, stepSize: 1.0, depositAmount: 6, decay: 0.06, diffuseRate: 0.8, startLayout: 'center' },
  // Crowded, finest reticulated mesh — most agents, tightest sensors, fast decay.
  denseWeb: { agentDensity: 0.45, sensorAngleDeg: 15, sensorDistance: 5, rotationAngleDeg: 60, stepSize: 1.0, depositAmount: 3.5, decay: 0.18, diffuseRate: 0.45, startLayout: 'scatter' },
  // Wandering, exploratory filaments from a ring — low deposit, long sensors.
  explore: { agentDensity: 0.08, sensorAngleDeg: 30, sensorDistance: 16, rotationAngleDeg: 25, stepSize: 1.2, depositAmount: 3, decay: 0.08, diffuseRate: 0.7, startLayout: 'ring' },
};

// Keep the synchronous, main-thread run well bounded (this renders inside a
// React useMemo, like Conway/RD/Lenia). Per-step cost is agents (sense+move) plus
// cells (diffuse+decay); cap each product.
const MAX_COLS = 240;
const MAX_STEPS = 1200;
const MAX_AGENTS = 60000;
const AGENT_STEP_BUDGET = 4e7;
const FIELD_STEP_BUDGET = 4.5e8;

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
 * marching-squares contours (and raw agent staircases) into organic curves
 * (shared with Conway/RD/Lenia). */
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
 * rotated frame; spacing and phase are jittered by low-frequency noise, and each
 * scanline is broken into runs wherever it leaves the region. `coverage` (0..1)
 * gates how much of the region is filled. Output segments are in cell
 * coordinates. (Shared technique with Conway/RD/Lenia.)
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

/** Bilinear sample of the toroidal trail field at fractional (x, y). */
function sampleTrail(trail: Float32Array, cols: number, rows: number, x: number, y: number): number {
  let fx = x % cols;
  if (fx < 0) fx += cols;
  let fy = y % rows;
  if (fy < 0) fy += rows;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = x0 + 1 >= cols ? 0 : x0 + 1;
  const y1 = y0 + 1 >= rows ? 0 : y0 + 1;
  const tx = fx - x0;
  const ty = fy - y0;
  const a = trail[y0 * cols + x0];
  const b = trail[y0 * cols + x1];
  const c = trail[y1 * cols + x0];
  const d = trail[y1 * cols + x1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

/** Agent state stored as parallel flat arrays for cache-friendly stepping. */
export interface PhysarumAgents {
  x: Float32Array;
  y: Float32Array;
  /** heading in radians */
  h: Float32Array;
}

export interface PhysarumStepParams {
  sensorAngle: number;
  sensorDistance: number;
  rotationAngle: number;
  stepSize: number;
  depositAmount: number;
  decay: number;
  diffuseRate: number;
}

/**
 * One Physarum update step on a toroidal grid: every agent senses three points
 * ahead, rotates toward the strongest, advances and deposits; then the whole
 * trail field is diffused (3×3 box blur mixed by `diffuseRate`) and decayed.
 * Mutates `agents` and `trail` in place; `scratch` is reused as the diffuse
 * buffer. Exported for tests, mirroring `stepLenia` / `stepReactionDiffusion`.
 */
export function stepPhysarum(
  agents: PhysarumAgents,
  trail: Float32Array,
  scratch: Float32Array,
  cols: number,
  rows: number,
  p: PhysarumStepParams,
  random: () => number
): void {
  const { x: ax, y: ay, h: ah } = agents;
  const n = ax.length;

  // Sense → rotate → move → deposit.
  for (let i = 0; i < n; i++) {
    const x = ax[i];
    const y = ay[i];
    const h = ah[i];
    const sd = p.sensorDistance;
    const cF = sampleTrail(trail, cols, rows, x + Math.cos(h) * sd, y + Math.sin(h) * sd);
    const hl = h - p.sensorAngle;
    const hr = h + p.sensorAngle;
    const cL = sampleTrail(trail, cols, rows, x + Math.cos(hl) * sd, y + Math.sin(hl) * sd);
    const cR = sampleTrail(trail, cols, rows, x + Math.cos(hr) * sd, y + Math.sin(hr) * sd);

    let nh = h;
    if (cF > cL && cF > cR) {
      // straight ahead is best — keep heading
    } else if (cF < cL && cF < cR) {
      // dead ahead is worst — turn randomly to break the symmetry
      nh += random() < 0.5 ? p.rotationAngle : -p.rotationAngle;
    } else if (cR > cL) {
      nh += p.rotationAngle;
    } else if (cL > cR) {
      nh -= p.rotationAngle;
    }

    let nx = x + Math.cos(nh) * p.stepSize;
    let ny = y + Math.sin(nh) * p.stepSize;
    nx = nx % cols;
    if (nx < 0) nx += cols;
    ny = ny % rows;
    if (ny < 0) ny += rows;

    ax[i] = nx;
    ay[i] = ny;
    ah[i] = nh;

    const cellX = Math.floor(nx);
    const cellY = Math.floor(ny);
    trail[cellY * cols + cellX] += p.depositAmount;
  }

  // Diffuse: 3×3 toroidal box blur into scratch, then mix back by diffuseRate.
  for (let y = 0; y < rows; y++) {
    const ym = y === 0 ? rows - 1 : y - 1;
    const yp = y === rows - 1 ? 0 : y + 1;
    for (let x = 0; x < cols; x++) {
      const xm = x === 0 ? cols - 1 : x - 1;
      const xp = x === cols - 1 ? 0 : x + 1;
      const sum =
        trail[ym * cols + xm] + trail[ym * cols + x] + trail[ym * cols + xp] +
        trail[y * cols + xm] + trail[y * cols + x] + trail[y * cols + xp] +
        trail[yp * cols + xm] + trail[yp * cols + x] + trail[yp * cols + xp];
      scratch[y * cols + x] = sum / 9;
    }
  }

  // Mix + decay in one pass.
  const keep = 1 - p.diffuseRate;
  const survive = 1 - p.decay;
  for (let i = 0; i < trail.length; i++) {
    trail[i] = (keep * trail[i] + p.diffuseRate * scratch[i]) * survive;
  }
}

interface PhysarumSimulation {
  cols: number;
  rows: number;
  /** Final trail density, row-major */
  trail: Float32Array;
  trailMax: number;
  /** Captured trajectory runs in cell space (paths style), or null */
  paths: Point[][] | null;
}

function simulatePhysarum(
  cols: number,
  rows: number,
  steps: number,
  agentCount: number,
  params: PhysarumStepParams,
  random: () => number,
  startLayout: 'scatter' | 'center' | 'ring',
  offCenter: number,
  recordCount: number,
  sampleEvery: number,
  recordFrom: number
): PhysarumSimulation {
  const n = cols * rows;
  const trail = new Float32Array(n);
  const scratch = new Float32Array(n);

  const ax = new Float32Array(agentCount);
  const ay = new Float32Array(agentCount);
  const ah = new Float32Array(agentCount);
  const TWO_PI = Math.PI * 2;

  if (startLayout === 'center') {
    const o = thirdsOrigin(cols, rows, random, offCenter > 0 ? offCenter : 0.6);
    const radius = Math.max(2, Math.min(cols, rows) * 0.12);
    for (let i = 0; i < agentCount; i++) {
      const ang = random() * TWO_PI;
      const r = Math.sqrt(random()) * radius;
      let x = o.cx + Math.cos(ang) * r;
      let y = o.cy + Math.sin(ang) * r;
      x = ((x % cols) + cols) % cols;
      y = ((y % rows) + rows) % rows;
      ax[i] = x;
      ay[i] = y;
      ah[i] = random() * TWO_PI;
    }
  } else if (startLayout === 'ring') {
    const cx = cols / 2;
    const cy = rows / 2;
    const radius = 0.35 * Math.min(cols, rows);
    for (let i = 0; i < agentCount; i++) {
      const ang = random() * TWO_PI;
      const r = radius * (0.92 + random() * 0.16);
      ax[i] = ((cx + Math.cos(ang) * r) % cols + cols) % cols;
      ay[i] = ((cy + Math.sin(ang) * r) % rows + rows) % rows;
      // Head roughly inward, with a tangential wobble, so the ring collapses
      // into a web rather than a clean circle.
      ah[i] = ang + Math.PI + (random() - 0.5) * 1.2;
    }
  } else {
    for (let i = 0; i < agentCount; i++) {
      ax[i] = random() * cols;
      ay[i] = random() * rows;
      ah[i] = random() * TWO_PI;
    }
  }

  const agents: PhysarumAgents = { x: ax, y: ay, h: ah };

  // Path capture: the first `recordCount` agents log their trajectory, but only
  // from `recordFrom` onward — by then the colony has settled onto its network,
  // so the trails trace established veins instead of the initial random scatter.
  // Toroidal wraps split a run so no stroke streaks across the page.
  const record = recordCount > 0;
  const paths: Point[][] = [];
  const runs: Point[][] = record ? Array.from({ length: recordCount }, () => []) : [];
  const prevX = record ? new Float32Array(recordCount) : null;
  const prevY = record ? new Float32Array(recordCount) : null;
  const halfC = cols / 2;
  const halfR = rows / 2;

  for (let s = 0; s < steps; s++) {
    stepPhysarum(agents, trail, scratch, cols, rows, params, random);
    if (record && s >= recordFrom && s % sampleEvery === 0) {
      for (let i = 0; i < recordCount; i++) {
        const x = ax[i];
        const y = ay[i];
        // A jump bigger than half the grid means the agent wrapped an edge:
        // close the current run and start a fresh one at the new position.
        if (runs[i].length > 0 && (Math.abs(x - prevX![i]) > halfC || Math.abs(y - prevY![i]) > halfR)) {
          if (runs[i].length >= 2) paths.push(runs[i]);
          runs[i] = [];
        }
        runs[i].push({ x, y });
        prevX![i] = x;
        prevY![i] = y;
      }
    }
  }
  if (record) {
    for (let i = 0; i < recordCount; i++) if (runs[i].length >= 2) paths.push(runs[i]);
  }

  let trailMax = 0;
  for (let i = 0; i < n; i++) if (trail[i] > trailMax) trailMax = trail[i];

  return { cols, rows, trail, trailMax, paths: record ? paths : null };
}

/**
 * Render a Physarum slime-mold network as plottable single-pen strokes.
 */
export function generatePhysarum(options: PhysarumOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'network',
    style = 'contour',
    sampleEvery = 2,
    minPathLength = 8,
    pathFraction = 0.05,
    settleFraction = 0.45,
    contourLevels = 6,
    blurSigma = 1.0,
    isoLow = 0.2,
    isoHigh = 0.9,
    fillThreshold = 0.4,
    crossHatchAmount = 0.5,
    hatchJitter = 0.5,
    optimize = true,
  } = options;

  const p = PHYSARUM_PRESETS[preset] ?? PHYSARUM_PRESETS.network;
  const sensorAngle = ((options.sensorAngleDeg ?? p.sensorAngleDeg) * Math.PI) / 180;
  const sensorDistance = Math.max(1, options.sensorDistance ?? p.sensorDistance);
  const rotationAngle = ((options.rotationAngleDeg ?? p.rotationAngleDeg) * Math.PI) / 180;
  const stepSize = Math.max(0.1, options.stepSize ?? p.stepSize);
  const depositAmount = Math.max(0, options.depositAmount ?? p.depositAmount);
  const decay = clamp(options.decay ?? p.decay, 0, 1);
  const diffuseRate = clamp(options.diffuseRate ?? p.diffuseRate, 0, 1);
  const startLayout = options.startLayout ?? p.startLayout;

  const artStyle = options.artStyle ?? true;
  const hatchAngle = ((options.hatchAngle ?? -32) * Math.PI) / 180;
  const crossHatchAngle = ((options.crossHatchAngle ?? 31) * Math.PI) / 180;
  const valueBands = options.valueBands ?? (artStyle ? 5 : 0);
  const vignette = options.vignette ?? (artStyle ? 0.35 : 0);
  const offCenter = options.offCenter ?? (artStyle ? 0.6 : 0);
  const borderGap = Math.max(0.5, options.borderGap ?? 2);

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });

  // The user picks the grid width; the grid *shape* follows the page aspect,
  // NOT the margin. A fixed-px margin changes the inner box's aspect ratio, so
  // deriving rows from the margined area made the margin silently resize the
  // simulation — and since the network is a sensitive emergent system, a
  // different grid shape grows a wholly different network instead of the same
  // one reframed. Tying rows to the page aspect means the margin only scales
  // and insets the same network. Sim cost depends on cols·rows·steps and
  // agents·steps, never on page resolution.
  const cols = clamp(Math.round(options.gridCols ?? 200), 8, MAX_COLS);
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

  const originX = frameMargin + (usableW - cols * cellPx) / 2;
  const originY = frameMargin + (usableH - rows * cellPx) / 2;

  // Agent count: explicit override, else the preset density over the grid.
  const agentCount = clamp(
    Math.round(options.agentCount ?? p.agentDensity * cols * rows),
    1,
    MAX_AGENTS
  );

  // Bound the synchronous run: cap steps, then trim by both budgets.
  let steps = clamp(Math.round(options.steps ?? 400), 0, MAX_STEPS);
  if (agentCount * steps > AGENT_STEP_BUDGET) steps = Math.max(1, Math.floor(AGENT_STEP_BUDGET / agentCount));
  const cellCount = cols * rows;
  if (cellCount * steps > FIELD_STEP_BUDGET) steps = Math.max(1, Math.floor(FIELD_STEP_BUDGET / cellCount));

  // Trail density: how many of the agents have their trajectory traced. A good
  // contour network wants many agents, but every traced trail adds ink, so this
  // fraction is the knob that thins `paths` from a delicate filigree to a dense
  // tangle. (An absolute ceiling well above the slider's range only guards
  // against a pathological agentCount×fraction blowing up the SVG.)
  const PATH_CEILING = 8000;
  const recordCount = style === 'paths'
    ? clamp(Math.round(clamp(pathFraction, 0, 1) * agentCount), 0, Math.min(agentCount, PATH_CEILING))
    : 0;

  const random = makeRandom(seed);
  const sim = simulatePhysarum(
    cols,
    rows,
    steps,
    agentCount,
    { sensorAngle, sensorDistance, rotationAngle, stepSize, depositAmount, decay, diffuseRate },
    random,
    startLayout,
    offCenter,
    recordCount,
    Math.max(1, Math.round(sampleEvery)),
    Math.floor(steps * clamp(settleFraction, 0, 0.95))
  );

  if (sim.trailMax < 1e-6) return empty();

  const noise = createNoise(seed + 8101);
  const lines: FlowLine[] = [];

  // Robust white point: a handful of cells where agents pile up carry trail
  // values far above the veins, so normalising by the raw max crushes the
  // network to invisibility. Use a high percentile as white and lift with a
  // gentle gamma so the veins span the tonal range.
  const sorted = Float32Array.from(sim.trail).sort();
  let white = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  if (white < 1e-6) white = sim.trailMax;
  const norm = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i++) norm[i] = Math.sqrt(clamp(sim.trail[i] / white, 0, 1));
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
  const normAtCell = (cx: number, cy: number): number =>
    norm[clamp(Math.floor(cy), 0, rows - 1) * cols + clamp(Math.floor(cx), 0, cols - 1)];

  // Hold faint marks off the four frame corners against a broken,
  // noise-thresholded edge (same as RD/Lenia). Splits a cell-space polyline
  // into the runs that survive.
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

  // Tag a band by strength: strong → bold 'core', mid → 'mid', faint → 'rim'.
  const bandFor = (frac: number): { layer: string; pen: 'fine' | 'bold' } =>
    frac >= 0.66
      ? { layer: 'core', pen: 'bold' }
      : frac >= 0.33
        ? { layer: 'mid', pen: 'fine' }
        : { layer: 'rim', pen: 'fine' };

  // ---- Agent trajectories as polylines (the distinctive style) ------------
  const renderPaths = (): void => {
    if (!sim.paths) return;
    for (const run of sim.paths) {
      if (run.length < 2) continue;
      for (const part of cullByVignette(run)) {
        if (part.length < 2) continue;
        // Length cull (cell space) — drop dust.
        let len = 0;
        for (let i = 1; i < part.length; i++) {
          len += Math.hypot(part[i].x - part[i - 1].x, part[i].y - part[i - 1].y);
        }
        if (len < minPathLength) continue;
        // Layer by the mean trail strength the run sits in.
        let acc = 0;
        for (const pt of part) acc += normAtCell(pt.x, pt.y);
        const { layer, pen } = bandFor(clamp(acc / part.length, 0, 0.999));
        const smooth = smoothPolyline(part.map(toPx), 2);
        if (smooth.length >= 2) lines.push({ points: smooth, pen, layer });
      }
    }
  };

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

  // ---- Dense network as a hatched, outlined mass -------------------------
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

  if (style === 'paths') {
    renderPaths();
  } else if (style === 'hatch') {
    renderHatch(fillThreshold, 'mid');
  } else if (style === 'dual') {
    renderContour(field);
    renderHatch(Math.max(fillThreshold, 0.55), 'core');
  } else {
    renderContour(field);
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  // Faint marks wobble more; the dense channels stay steady.
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
