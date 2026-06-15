import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { optimizePlot } from './optimize.js';
import { GrayscaleImage, gaussianBlur } from './image.js';
import { traceIsoContours } from './iso-contours.js';
import { createNoise, SimplexNoise } from './noise.js';

/**
 * A still "long exposure" of Conway's Game of Life: one frame that holds the
 * recent history of a run. The final living configuration sits solid and
 * crisp; everything that came before fades backward into comet-like trails.
 *
 * The whole effect rides on one scalar per cell, accumulated as the simulation
 * runs:
 *
 *     exposure[i] = exposure[i] * decay + (aliveNow ? 1 : 0)
 *
 * After the final generation this equals Σ_g alive(i,g)·decay^(G−g): cells
 * alive through to the end (the final config, enduring still-lifes) saturate;
 * cells a glider only passed through long ago contribute a small, exponentially
 * decaying amount, so the receding track behind a glider's last position reads
 * as a comet tail. Because the toolbox plots a single pen at a single width,
 * that exposure is turned into ink as MARK DENSITY — sparse dashes for faint
 * ghosts, dense cross-hatch for solids — never opacity or stroke-width tricks.
 *
 * Three render styles share the same simulation:
 *  - `marks`   — discrete per-cell marks (the default look).
 *  - `contour` — nested iso-contours of the blurred light field: continuous
 *                organic ridges, comet tracks as long tapering loops.
 *  - `streaks` — the paths of moving clusters (gliders) traced as continuous
 *                centre-line strokes, with the core left as soft contours.
 *
 * Every stroke is tagged with a `layer` ('present' / 'ghost' / 'trail') so the
 * piece can be exported one SVG per pen.
 */
export interface ConwayExposureOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls the R-pentomino's placement and orientation, and wobble */
  seed?: number;
  /**
   * How many R-pentominoes to detonate at the start (default 1). One sits
   * near the centre; more are scattered across the central region, each with
   * its own orientation, so their evolutions collide and interleave.
   */
  seedCount?: number;
  /** Pixels per cell — sets the simulation's grid resolution (default ~width/100) */
  cellSize?: number;
  /** Generations to simulate from the seed (default 180) */
  generations?: number;
  /** Per-generation exposure decay, 0..1 (default 0.92) — higher = longer trails */
  decay?: number;
  /**
   * Perceptual lift applied to normalized exposure before tiering (default
   * 0.45). A moving point deposits little exposure per cell relative to a
   * stationary one, so without a <1 gamma the comet trails would be all but
   * invisible next to the solid core.
   */
  gamma?: number;
  /** Tone below this (0..1, post-gamma) leaves blank paper (default 0.1) */
  faintThreshold?: number;
  /** Faint→medium tone boundary (default 0.32) */
  mediumThreshold?: number;
  /** Medium→solid tone boundary (default 0.62) */
  solidThreshold?: number;
  /**
   * A connected cluster of final-generation cells this size or smaller is
   * "residue" (quiet still-lifes, glider heads) and is drawn as a crisp hollow
   * outline; anything larger is the turbulent "core" and is filled solid.
   * (default 6)
   */
  residueMaxCells?: number;
  /** Base hand-drawn wobble amplitude in px (default scales with cellSize) */
  wobble?: number;
  /** Render style for the history (default 'marks') */
  style?: 'marks' | 'contour' | 'streaks';
  /**
   * Reserved-paper sliver in px held around the crisp present (and, in
   * `streaks`, around the trails): history marks/lines stop short of it so the
   * present reads with a clean halo. (default ~cellSize * 0.6)
   */
  haloRadius?: number;
  /** Number of nested iso levels for the `contour` style (default 5) */
  contourLevels?: number;
  /** `streaks`: largest cluster (cells) tracked as a mover (default 8) */
  maxClusterCells?: number;
  /** `streaks`: a track must persist this many generations to count (default 12) */
  minTrackGenerations?: number;
  /** `streaks`: a track must travel this many cells end-to-end to count (default 6) */
  minTrackDisplacement?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;

  // ---- Art style (all optional; default to the drawn look, off = faithful) --
  /**
   * Master switch for the hand-drawn "art" treatment (default true). Each
   * sub-feature below defaults from this, so `artStyle: false` with nothing
   * else set reproduces the original faithful, grid-faithful render exactly.
   */
  artStyle?: boolean;
  /**
   * Draw the turbulent present-core as one traced mass — a confident tapered
   * silhouette filled with angled, jittered, patchy hatching — instead of a
   * grid of axis-aligned filled boxes (default = artStyle).
   */
  massCore?: boolean;
  /** Offset passes building the bold core silhouette (default 3) */
  massOutlinePasses?: number;
  /** Base interior hatch angle for the core mass, degrees (default -32) */
  hatchAngle?: number;
  /** Cross-hatch second-layer angle for the core mass, degrees (default 31) */
  crossHatchAngle?: number;
  /** Fraction of the core mass that gets the cross-hatch layer, 0..1 (default 0.5) */
  crossHatchAmount?: number;
  /** Low-frequency jitter on hatch spacing/phase, 0..1 (default 0.5) */
  hatchJitter?: number;
  /** Vary the faint-mark fallback angle with noise instead of a fixed 45° (default = artStyle) */
  markAngleNoise?: boolean;
  /**
   * Posterize the (blurred) exposure into this many committed value bands
   * before choosing marks, so trails read as decisive tonal shapes rather
   * than continuous per-cell noise. 0 = continuous (default artStyle ? 4 : 0).
   */
  valueBands?: number;
  /**
   * Bias a single detonation toward a rule-of-thirds point, 0..1
   * (default artStyle ? 0.6 : 0). 0 keeps the original centered placement.
   * Ignored when seedCount > 1 (those already scatter).
   */
  offCenter?: number;
  /**
   * Hold faint marks off the frame corners to reserve negative space, 0..1
   * (default artStyle ? 0.4 : 0). 0 = no vignette.
   */
  vignette?: number;
  /** Draw a plate-border line just inside the margin as plottable strokes (default = artStyle) */
  plateBorder?: boolean;
  /**
   * Gap between the drawing and the plate border, in grid cells (default 2).
   * The gutter is reserved for the whole art mode, so changing it resizes the
   * drawing area, but toggling the border on/off never does.
   */
  borderGap?: number;
}

interface Simulation {
  cols: number;
  rows: number;
  /** Σ_g alive·decay^(G−g) per cell */
  exposure: Float64Array;
  /** Last generation index each cell was alive, or -1 (drives motion direction) */
  lastAlive: Int32Array;
  /** 1 where a cell is alive in the final generation */
  finalAlive: Uint8Array;
  /** Theoretical maximum exposure (a cell alive every generation) */
  maxExposure: number;
  /** Tracked mover paths in cell coordinates (only when style === 'streaks') */
  tracks: Point[][];
}

/** Deterministic LCG, matching the convention used across the toolbox */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * R-pentomino cells, one of the smallest seeds with a long, violent evolution:
 *   .##
 *   ##.
 *   .#.
 */
const R_PENTOMINO: Array<[number, number]> = [
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [1, 2],
];

/** Rotate/mirror a cell offset within an 8-element symmetry group */
function orient([x, y]: [number, number], rot: number, mirror: boolean): [number, number] {
  let cx = mirror ? -x : x;
  let cy = y;
  for (let r = 0; r < rot; r++) {
    const nx = -cy;
    const ny = cx;
    cx = nx;
    cy = ny;
  }
  return [cx, cy];
}

function stampPentomino(
  grid: Uint8Array,
  cols: number,
  rows: number,
  ox: number,
  oy: number,
  rot: number,
  mirror: boolean
): void {
  for (const cell of R_PENTOMINO) {
    const [dx, dy] = orient(cell, rot, mirror);
    const x = ox + dx;
    const y = oy + dy;
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      grid[y * cols + x] = 1;
    }
  }
}

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

/**
 * Detonate `count` R-pentominoes. A single one sits near the centre (or, when
 * `offCenter > 0`, biased toward a rule-of-thirds point for a more composed
 * frame); two or more are scattered across the central region (inset from the
 * edges so each has room to evolve before its gliders fly out of frame), each
 * with its own orientation.
 */
function seedRPentominoes(
  grid: Uint8Array,
  cols: number,
  rows: number,
  random: () => number,
  count: number,
  offCenter: number
): void {
  if (count <= 1) {
    const rot = Math.floor(random() * 4);
    const mirror = random() < 0.5;
    if (offCenter > 0) {
      // Compose off-centre: bias toward a thirds point, small jitter around it.
      const o = thirdsOrigin(cols, rows, random, offCenter);
      const jx = Math.round((random() - 0.5) * cols * 0.04);
      const jy = Math.round((random() - 0.5) * rows * 0.04);
      stampPentomino(grid, cols, rows, o.cx + jx, o.cy + jy, rot, mirror);
      return;
    }
    // Faithful path: keep the detonation roughly centered (same random() draws
    // as the original, so existing seeds reproduce exactly).
    const jx = Math.round((random() - 0.5) * cols * 0.08);
    const jy = Math.round((random() - 0.5) * rows * 0.08);
    stampPentomino(grid, cols, rows, Math.floor(cols / 2) + jx, Math.floor(rows / 2) + jy, rot, mirror);
    return;
  }

  const inset = 0.16;
  for (let p = 0; p < count; p++) {
    const rot = Math.floor(random() * 4);
    const mirror = random() < 0.5;
    const ox = Math.round(cols * inset + random() * cols * (1 - 2 * inset));
    const oy = Math.round(rows * inset + random() * rows * (1 - 2 * inset));
    stampPentomino(grid, cols, rows, ox, oy, rot, mirror);
  }
}

/** One B3/S23 step with a fixed dead border (cells off-grid count as dead, so
 * gliders that reach the edge simply fly out of frame). Exported for tests. */
export function stepLife(curr: Uint8Array, next: Uint8Array, cols: number, rows: number): void {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= cols) continue;
          n += curr[yy * cols + xx];
        }
      }
      const i = y * cols + x;
      next[i] = curr[i] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }
}

/** Centroids (cell coords) of live clusters no larger than maxCells — the
 * candidate movers. Uses 8-connectivity flood fill over a reusable label
 * buffer so it can run cheaply every generation. */
function smallComponentCentroids(
  grid: Uint8Array,
  cols: number,
  rows: number,
  maxCells: number,
  comp: Int32Array
): Array<{ x: number; y: number; size: number }> {
  comp.fill(-1);
  const out: Array<{ x: number; y: number; size: number }> = [];
  const stack: number[] = [];
  const members: number[] = [];

  for (let start = 0; start < grid.length; start++) {
    if (!grid[start] || comp[start] !== -1) continue;
    members.length = 0;
    stack.push(start);
    comp[start] = start;
    while (stack.length) {
      const i = stack.pop() as number;
      members.push(i);
      const x = i % cols;
      const y = (i / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= cols) continue;
          const j = yy * cols + xx;
          if (grid[j] && comp[j] === -1) {
            comp[j] = start;
            stack.push(j);
          }
        }
      }
    }
    if (members.length <= maxCells) {
      let sx = 0;
      let sy = 0;
      for (const m of members) {
        sx += m % cols;
        sy += (m / cols) | 0;
      }
      out.push({ x: sx / members.length, y: sy / members.length, size: members.length });
    }
  }
  return out;
}

interface ActiveTrack {
  pts: Point[];
  alive: boolean;
}

/** Follow small clusters across generations, keeping only those that persist
 * and actually travel — i.e. gliders/spaceships, not the jittery core. */
function trackMovers(
  prev: ActiveTrack[],
  comps: Array<{ x: number; y: number; size: number }>,
  matchRadius: number
): ActiveTrack[] {
  const used = new Uint8Array(comps.length);
  const r2 = matchRadius * matchRadius;
  const next: ActiveTrack[] = [];

  for (const tr of prev) {
    const last = tr.pts[tr.pts.length - 1];
    let best = -1;
    let bestD = r2 + 1e-9;
    for (let ci = 0; ci < comps.length; ci++) {
      if (used[ci]) continue;
      const dx = comps[ci].x - last.x;
      const dy = comps[ci].y - last.y;
      const d = dx * dx + dy * dy;
      if (d <= r2 && d < bestD) {
        bestD = d;
        best = ci;
      }
    }
    if (best >= 0) {
      used[best] = 1;
      tr.pts.push({ x: comps[best].x, y: comps[best].y });
      next.push(tr);
    }
    // Tracks that miss a generation are dropped (collected by the caller).
  }

  for (let ci = 0; ci < comps.length; ci++) {
    if (!used[ci]) next.push({ pts: [{ x: comps[ci].x, y: comps[ci].y }], alive: true });
  }
  return next;
}

function simulate(
  cols: number,
  rows: number,
  generations: number,
  decay: number,
  random: () => number,
  seedCount: number,
  offCenter: number,
  track: { maxCells: number; minGenerations: number; minDisplacement: number } | null
): Simulation {
  const n = cols * rows;
  let curr = new Uint8Array(n);
  let next = new Uint8Array(n);
  const exposure = new Float64Array(n);
  const lastAlive = new Int32Array(n).fill(-1);

  seedRPentominoes(curr, cols, rows, random, seedCount, offCenter);

  const accumulate = (gen: number): void => {
    for (let i = 0; i < n; i++) {
      exposure[i] = exposure[i] * decay + curr[i];
      if (curr[i]) lastAlive[i] = gen;
    }
  };

  // Mover tracking (streaks only)
  const compScratch = track ? new Int32Array(n) : null;
  let active: ActiveTrack[] = [];
  const finished: Point[][] = [];
  const harvest = (carryOver: ActiveTrack[]): void => {
    for (const tr of carryOver) finished.push(tr.pts);
  };

  const recordTracks = (): void => {
    if (!track || !compScratch) return;
    const comps = smallComponentCentroids(curr, cols, rows, track.maxCells, compScratch);
    const updated = trackMovers(active, comps, 2);
    // Tracks present before but absent now have ended — push their points.
    const survivingFirstPoints = new Set(updated.map((t) => t.pts[0]));
    for (const tr of active) {
      if (!survivingFirstPoints.has(tr.pts[0])) finished.push(tr.pts);
    }
    active = updated;
  };

  accumulate(0);
  recordTracks();
  for (let gen = 1; gen <= generations; gen++) {
    stepLife(curr, next, cols, rows);
    const tmp = curr;
    curr = next;
    next = tmp;
    accumulate(gen);
    recordTracks();
  }
  harvest(active);

  let tracks: Point[][] = [];
  if (track) {
    tracks = finished.filter((pts) => {
      if (pts.length < track.minGenerations) return false;
      const a = pts[0];
      const b = pts[pts.length - 1];
      return Math.hypot(b.x - a.x, b.y - a.y) >= track.minDisplacement;
    });
  }

  // Σ_{k=0}^{G} decay^k — what a cell alive every generation would reach.
  const maxExposure =
    decay >= 1 ? generations + 1 : (1 - Math.pow(decay, generations + 1)) / (1 - decay);

  return { cols, rows, exposure, lastAlive, finalAlive: curr, maxExposure, tracks };
}

/** Label connected components of the final config (8-connectivity); a cell is
 * "core" when its component is larger than residueMaxCells. */
function classifyFinal(
  finalAlive: Uint8Array,
  cols: number,
  rows: number,
  residueMaxCells: number
): Uint8Array {
  const n = cols * rows;
  const comp = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];

  for (let start = 0; start < n; start++) {
    if (!finalAlive[start] || comp[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(start);
    comp[start] = id;
    while (stack.length) {
      const i = stack.pop() as number;
      size++;
      const x = i % cols;
      const y = (i / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= cols) continue;
          const j = yy * cols + xx;
          if (finalAlive[j] && comp[j] === -1) {
            comp[j] = id;
            stack.push(j);
          }
        }
      }
    }
    sizes.push(size);
  }

  const isCore = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (finalAlive[i]) isCore[i] = sizes[comp[i]] > residueMaxCells ? 1 : 0;
  }
  return isCore;
}

/** Unit direction toward more-recent activity (gradient of lastAlive), or null
 * where the field is flat — orients faint marks along glider tracks. */
function motionDir(
  lastAlive: Int32Array,
  cols: number,
  rows: number,
  x: number,
  y: number
): Point | null {
  const at = (xx: number, yy: number, fallback: number): number => {
    if (xx < 0 || xx >= cols || yy < 0 || yy >= rows) return fallback;
    const v = lastAlive[yy * cols + xx];
    return v < 0 ? fallback : v;
  };
  const here = lastAlive[y * cols + x];
  const dx = at(x + 1, y, here) - at(x - 1, y, here);
  const dy = at(x, y + 1, here) - at(x, y - 1, here);
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  return { x: dx / len, y: dy / len };
}

/** Closed square outline for a cell, inset by `inset` px from its bounds */
function cellSquare(cx: number, cy: number, half: number, inset: number): Point[] {
  const h = half - inset;
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
    { x: cx - h, y: cy - h },
  ];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Light moving-average smoothing with fixed endpoints — turns the blocky
 * cell-grid contours and centroid tracks into organic curves. */
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

/** Split a polyline into the runs of consecutive points that fall outside the
 * mask — used to hold trails/contours a sliver short of the haloed present. */
function clipPolylineByMask(points: Point[], inHalo: (p: Point) => boolean): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (inHalo(p)) {
      if (run.length >= 2) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

/**
 * Commit a tone to one of `bands` discrete levels spanning [lo, 1]. Anything
 * below `lo` returns 0 (clean paper), so the faint cutoff still culls empty
 * space — the bands only quantize the *visible* range into committed shapes.
 */
function posterize(t: number, bands: number, lo: number): number {
  if (bands <= 0) return t;
  if (t < lo) return 0;
  const span = 1 - lo;
  const k = Math.min(bands - 1, Math.floor(((t - lo) / span) * bands));
  return lo + ((k + 0.5) / bands) * span;
}

/** A unit vector whose angle varies smoothly with position via fBm noise. */
function noiseAngle(noise: SimplexNoise, x: number, y: number, freq: number): Point {
  const theta = Math.PI * noise.fbm(x * freq, y * freq, 2, 0.5, 2.2);
  return { x: Math.cos(theta), y: Math.sin(theta) };
}

/** Drop a fraction of a polyline's arc length from each end (local copy of the
 * pen-ink taper helper, kept private so the two renderers stay decoupled). */
function trimPolyline(points: Point[], fraction: number): Point[] {
  if (points.length < 3) return points;
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    );
  }
  const total = cumulative[cumulative.length - 1];
  const trim = Math.min(total * fraction, 12);
  const start = cumulative.findIndex((c) => c >= trim);
  let end = points.length - 1;
  while (end > 0 && cumulative[end] > total - trim) end--;
  if (start < 0 || end - start < 1) return points;
  return points.slice(start, end + 1);
}

/** Offset a polyline perpendicular to its local direction (local copy). */
function offsetPolyline(points: Point[], distance: number): Point[] {
  if (Math.abs(distance) < 1e-6) return points.map((p) => ({ ...p }));
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = {
      x: points[i].x + (-ty / len) * distance,
      y: points[i].y + (tx / len) * distance,
    };
  }
  return out;
}

/**
 * Trace the outline of the core mass as closed loops in cell coordinates.
 * The blocky 0/1 core raster is lightly blurred so marching squares rounds the
 * staircase into a confident silhouette (the same cloud-carving trick the
 * pen-ink sky treatment uses).
 */
function coreBoundaryPolylines(isCore: Uint8Array, cols: number, rows: number): Point[][] {
  const data = new Float32Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = isCore[i] ? 1 : 0;
  const blurred = gaussianBlur({ width: cols, height: rows, data }, 0.8);
  return traceIsoContours(blurred, 0.5);
}

/**
 * Parallel hatching at `angleRad`, clipped to a region. Walks scanlines in the
 * rotated frame; spacing and phase are jittered by low-frequency noise so the
 * fill never reads as an arithmetic screen, and each scanline is broken into
 * runs wherever it leaves the region — so strokes terminate at the silhouette,
 * not on cell borders. `coverage` (0..1) gates how much of the region is filled
 * (1 ≈ solid for the base layer; less for a partial cross-hatch). Output
 * segments are in cell coordinates.
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

/**
 * Render a long-exposure still of an R-pentomino Game of Life run as
 * plottable single-pen strokes.
 */
export function generateConwayExposure(options: ConwayExposureOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = Math.floor(Math.random() * 1000000),
    seedCount = 1,
    generations = 180,
    decay = 0.92,
    gamma = 0.45,
    faintThreshold = 0.1,
    mediumThreshold = 0.32,
    solidThreshold = 0.62,
    residueMaxCells = 6,
    style = 'marks',
    contourLevels = 5,
    maxClusterCells = 8,
    minTrackGenerations = 12,
    minTrackDisplacement = 6,
    optimize = true,
  } = options;

  // Art treatment, all gated off a single master switch so `artStyle: false`
  // (with nothing else set) reproduces the original faithful render exactly.
  const artStyle = options.artStyle ?? true;
  const massCore = options.massCore ?? artStyle;
  const massOutlinePasses = options.massOutlinePasses ?? 3;
  const hatchAngle = ((options.hatchAngle ?? -32) * Math.PI) / 180;
  const crossHatchAngle = ((options.crossHatchAngle ?? 31) * Math.PI) / 180;
  const crossHatchAmount = options.crossHatchAmount ?? 0.5;
  const hatchJitter = options.hatchJitter ?? 0.5;
  const markAngleNoise = options.markAngleNoise ?? artStyle;
  const valueBands = options.valueBands ?? (artStyle ? 4 : 0);
  const offCenter = options.offCenter ?? (artStyle ? 0.6 : 0);
  const vignette = options.vignette ?? (artStyle ? 0.4 : 0);
  const plateBorder = options.plateBorder ?? artStyle;
  const borderGap = Math.max(0.5, options.borderGap ?? 2);

  const cellSize = Math.max(2, options.cellSize ?? Math.round(width / 100));
  const wobble = options.wobble ?? Math.max(0.4, cellSize * 0.12);
  const haloRadius = options.haloRadius ?? cellSize * 0.6;
  const noise = createNoise(seed + 8101);

  // Reserve the border gutter (borderGap cells) for the whole art mode, not
  // just when the border is drawn — so toggling the plate border only
  // adds/removes the line and never resizes the grid (a different grid would
  // re-run an entirely different simulation). Changing the gap deliberately
  // does resize the drawing area. The faithful path keeps the full margin.
  const frameMargin = margin + (artStyle ? borderGap * cellSize : 0);

  const usableW = Math.max(0, width - 2 * frameMargin);
  const usableH = Math.max(0, height - 2 * frameMargin);
  const cols = Math.floor(usableW / cellSize);
  const rows = Math.floor(usableH / cellSize);

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (cols < 3 || rows < 3) return empty();

  // Center the grid within the (framed) page margin.
  const originX = frameMargin + (usableW - cols * cellSize) / 2;
  const originY = frameMargin + (usableH - rows * cellSize) / 2;

  const random = makeRandom(seed);
  const sim = simulate(
    cols,
    rows,
    Math.max(0, generations),
    decay,
    random,
    Math.max(1, Math.round(seedCount)),
    offCenter,
    style === 'streaks'
      ? {
          maxCells: maxClusterCells,
          minGenerations: minTrackGenerations,
          minDisplacement: minTrackDisplacement,
        }
      : null
  );
  const isCore = classifyFinal(sim.finalAlive, cols, rows, residueMaxCells);

  const half = cellSize / 2;
  const lines: FlowLine[] = [];

  // Per-cell perceptual tone, kept so the hand-drawn pass can loosen faint
  // ghosts and hold the crisp solids steady, and reused as the contour field.
  const tone = new Float32Array(cols * rows);
  for (let i = 0; i < tone.length; i++) {
    tone[i] = Math.pow(Math.min(1, sim.exposure[i] / sim.maxExposure), gamma);
  }

  // Optionally commit the trail tone to a few value bands so history reads as
  // decisive tonal tiers, not a continuous gradient. Quantizing only the
  // visible range (≥ faintThreshold) keeps empty space as clean paper — and we
  // posterize the raw tone (not a blurred copy), so the gamma-lifted skirt of
  // near-zero cells around every trail isn't promoted into a frame-wide haze.
  // The hand-drawn pass below still reads the raw `tone`, so wobble follows
  // true exposure rather than the bands.
  let markTone = tone;
  if (valueBands > 0) {
    markTone = new Float32Array(tone.length);
    for (let i = 0; i < markTone.length; i++) markTone[i] = posterize(tone[i], valueBands, faintThreshold);
  }

  const cellCenter = (cx: number, cy: number): Point => ({
    x: originX + (cx + 0.5) * cellSize,
    y: originY + (cy + 0.5) * cellSize,
  });
  const cellIndexAt = (x: number, y: number): number => {
    const cxi = Math.min(cols - 1, Math.max(0, Math.floor((x - originX) / cellSize)));
    const cyi = Math.min(rows - 1, Math.max(0, Math.floor((y - originY) / cellSize)));
    return cyi * cols + cxi;
  };

  // Reserved-paper halo: dilate the present's cells so history holds off them.
  const haloCells = new Uint8Array(cols * rows);
  const haloR = Math.max(0, Math.ceil(haloRadius / cellSize));
  if (haloR > 0) {
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (!sim.finalAlive[cy * cols + cx]) continue;
        for (let dy = -haloR; dy <= haloR; dy++) {
          const yy = cy + dy;
          if (yy < 0 || yy >= rows) continue;
          for (let dx = -haloR; dx <= haloR; dx++) {
            const xx = cx + dx;
            if (xx < 0 || xx >= cols) continue;
            haloCells[yy * cols + xx] = 1;
          }
        }
      }
    }
  }
  const inHalo = (p: Point): boolean => haloCells[cellIndexAt(p.x, p.y)] === 1;

  // Map a point from cell space (raster coords) to page px, matching the
  // cell-centre convention used by cellCenter / renderContour.
  const cellPointToPx = (p: Point): Point => ({
    x: originX + (p.x + 0.5) * cellSize,
    y: originY + (p.y + 0.5) * cellSize,
  });

  // Bold line = base pass + offset/tapered passes of the same pen (no stroke
  // width tricks), mirroring the pen-ink emphasis technique.
  const pushBoldMass = (points: Point[]): void => {
    lines.push({ points, pen: 'bold', layer: 'present' });
    const spread = cellSize * 0.18;
    for (let pass = 1; pass < massOutlinePasses; pass++) {
      const offset = spread * (pass - (massOutlinePasses - 1) / 2);
      const trimmed = trimPolyline(offsetPolyline(points, offset), 0.12);
      if (trimmed.length >= 2) lines.push({ points: trimmed, pen: 'bold', layer: 'present' });
    }
  };

  // ---- The crisp present (shared by every style) -------------------------
  const renderPresent = (): void => {
    // The faithful per-cell treatment: solid axis-aligned cross-hatch boxes.
    const fillSolid = (c: Point): void => {
      const spacing = Math.max(1, cellSize * 0.2);
      const reach = half * 0.92;
      for (let off = -reach; off <= reach; off += spacing) {
        lines.push({
          points: [
            { x: c.x - reach, y: c.y + off },
            { x: c.x + reach, y: c.y + off },
          ],
          pen: 'bold',
          layer: 'present',
        });
        lines.push({
          points: [
            { x: c.x + off, y: c.y - reach },
            { x: c.x + off, y: c.y + reach },
          ],
          pen: 'bold',
          layer: 'present',
        });
      }
    };

    // The drawn-mass treatment: trace the whole core as one tapered silhouette
    // and fill it with angled, jittered, patchy hatching.
    const renderCoreMass = (): void => {
      let minX = cols;
      let minY = rows;
      let maxX = -1;
      let maxY = -1;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          if (!isCore[cy * cols + cx]) continue;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        }
      }
      if (maxX < 0) return; // no core cells

      for (const loop of coreBoundaryPolylines(isCore, cols, rows)) {
        if (loop.length < 3) continue;
        pushBoldMass(smoothPolyline(loop.map(cellPointToPx), 2));
      }

      const inRegion = (cx: number, cy: number): boolean =>
        cx >= 0 && cx < cols && cy >= 0 && cy < rows && isCore[cy * cols + cx] === 1;
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
        if (seg.length >= 2) lines.push({ points: seg.map(cellPointToPx), pen: 'fine', layer: 'present' });
      }
    };

    if (massCore) renderCoreMass();

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (!sim.finalAlive[i]) continue;
        const c = cellCenter(cx, cy);
        if (isCore[i]) {
          if (massCore) continue; // drawn as one mass above
          fillSolid(c);
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.06), pen: 'bold', layer: 'present' });
        } else {
          // Residue still-lifes / glider heads: crisp hollow squares. In the
          // art style the inner inset is noise-jittered so they aren't all
          // pixel-identical.
          const jit = artStyle ? noise.noise2D(cx * 0.7, cy * 0.7) * 0.06 : 0;
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.1), pen: 'bold', layer: 'present' });
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * (0.24 + jit)), pen: 'bold', layer: 'present' });
        }
      }
    }
  };

  // ---- History as discrete marks -----------------------------------------
  const renderMarks = (): void => {
    const dashFor = (c: Point, dir: Point | null, lengthFrac: number, layer: string): FlowLine => {
      const d = dir ?? { x: 0.7071, y: 0.7071 };
      const h = (cellSize * lengthFrac) / 2;
      return {
        points: [
          { x: c.x - d.x * h, y: c.y - d.y * h },
          { x: c.x + d.x * h, y: c.y + d.y * h },
        ],
        pen: 'fine',
        layer,
      };
    };
    const hatchFor = (c: Point, dir: Point | null, count: number, layer: string): FlowLine[] => {
      const d = dir ?? { x: 0.7071, y: 0.7071 };
      const perp = { x: -d.y, y: d.x };
      const out: FlowLine[] = [];
      const span = cellSize * 0.8;
      const spacing = cellSize / (count + 1);
      // A touch of low-frequency jitter on the offset so bundles don't read as
      // arithmetically even (art style only).
      const jit = artStyle ? noise.noise2D(c.x * 0.05, c.y * 0.05) * spacing * 0.25 : 0;
      for (let k = 0; k < count; k++) {
        const off = (k - (count - 1) / 2) * spacing + jit;
        const ox = perp.x * off;
        const oy = perp.y * off;
        out.push({
          points: [
            { x: c.x + ox - d.x * span * 0.5, y: c.y + oy - d.y * span * 0.5 },
            { x: c.x + ox + d.x * span * 0.5, y: c.y + oy + d.y * span * 0.5 },
          ],
          pen: 'fine',
          layer,
        });
      }
      return out;
    };

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (sim.finalAlive[i]) continue; // present drawn separately
        // Reserve negative space in the frame corners by lightening tone there.
        let t = markTone[i];
        if (vignette > 0) {
          const fx = cols > 1 ? cx / (cols - 1) : 0.5;
          const fy = rows > 1 ? cy / (rows - 1) : 0.5;
          const w = Math.max(0, 1 - 2 * Math.min(fx, 1 - fx)) * Math.max(0, 1 - 2 * Math.min(fy, 1 - fy));
          t *= 1 - vignette * w;
        }
        if (t < faintThreshold) continue;
        if (haloCells[i]) continue; // hold history off the present's halo
        const c = cellCenter(cx, cy);
        const dir =
          motionDir(sim.lastAlive, cols, rows, cx, cy) ??
          (markAngleNoise ? noiseAngle(noise, cx, cy, 0.3) : null);
        if (t < mediumThreshold) {
          lines.push(dashFor(c, dir, 0.7, 'trail'));
        } else if (t < solidThreshold) {
          const count = 1 + Math.round(((t - mediumThreshold) / (solidThreshold - mediumThreshold)) * 2);
          lines.push(...hatchFor(c, dir, count, 'ghost'));
        } else {
          lines.push(...hatchFor(c, dir, 4, 'ghost'));
        }
      }
    }
  };

  // ---- History as nested iso-contours ------------------------------------
  const renderContour = (minLevelFrac: number): void => {
    const blurred = gaussianBlur({ width: cols, height: rows, data: new Float32Array(tone) }, 1.2);
    const span = solidThreshold - faintThreshold;
    for (let k = 0; k < contourLevels; k++) {
      const frac = (k + 0.5) / contourLevels;
      if (frac < minLevelFrac) continue;
      const iso = faintThreshold + span * frac;
      const layer = frac < 0.5 ? 'trail' : 'ghost';
      for (const poly of traceIsoContours(blurred, iso)) {
        if (poly.length < 3) continue;
        const px = poly.map((p) => ({
          x: originX + (p.x + 0.5) * cellSize,
          y: originY + (p.y + 0.5) * cellSize,
        }));
        for (const run of clipPolylineByMask(px, inHalo)) {
          const smooth = smoothPolyline(run, 2);
          if (smooth.length >= 2) lines.push({ points: smooth, pen: 'fine', layer });
        }
      }
    }
  };

  // ---- History as tracked centre-line streaks ----------------------------
  const renderStreaks = (): void => {
    for (const track of sim.tracks) {
      const px = track.map((p) => cellCenter(p.x, p.y));
      for (const run of clipPolylineByMask(px, inHalo)) {
        const smooth = smoothPolyline(run, 3);
        if (smooth.length >= 2) lines.push({ points: smooth, pen: 'fine', layer: 'trail' });
      }
    }
    // The chaotic core can't be tracked — render it as soft ghost contours.
    renderContour(0.5);
  };

  renderPresent();
  if (style === 'contour') renderContour(0);
  else if (style === 'streaks') renderStreaks();
  else renderMarks();

  let result: FlowLinesResult = { lines, width, height, seed };

  // Faint old marks wobble (haunted); crisp final cells stay sharp.
  result = applyHandDrawnStyle(result, {
    amplitude: wobble,
    wavelength: cellSize * 8,
    seed,
    amplitudeScale: (x, y) => lerp(1.4, 0.12, tone[cellIndexAt(x, y)]),
  });

  if (optimize) result = optimizePlot(result);

  // A crisp ruled plate border, framing the drawing like a print. Added last —
  // after wobble and plot optimization — as four straight two-point edges, so
  // it stays a clean rectangle (path simplification would otherwise strip a
  // densified loop back to corners and the SVG writer would round it to an
  // oval; the optimizer would re-chain split edges into the same loop).
  if (plateBorder) {
    // The border sits at the page margin; the drawing is already held a
    // borderGap-cell gutter inside it (via frameMargin above).
    const x0 = margin;
    const y0 = margin;
    const x1 = width - margin;
    const y1 = height - margin;
    if (x1 - x0 > cellSize && y1 - y0 > cellSize) {
      const corners: Point[] = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      for (let e = 0; e < 4; e++) {
        result.lines.push({ points: [corners[e], corners[(e + 1) % 4]], pen: 'bold', layer: 'present' });
      }
    }
  }

  return result;
}
