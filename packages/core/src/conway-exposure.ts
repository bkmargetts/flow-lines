import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { optimizePlot } from './optimize.js';
import { GrayscaleImage, gaussianBlur } from './image.js';
import { traceIsoContours } from './iso-contours.js';

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

function seedRPentomino(
  grid: Uint8Array,
  cols: number,
  rows: number,
  random: () => number
): void {
  const rot = Math.floor(random() * 4);
  const mirror = random() < 0.5;
  // Keep the detonation roughly centered: only a small jitter off the middle.
  const jx = Math.round((random() - 0.5) * cols * 0.08);
  const jy = Math.round((random() - 0.5) * rows * 0.08);
  const ox = Math.floor(cols / 2) + jx;
  const oy = Math.floor(rows / 2) + jy;

  for (const cell of R_PENTOMINO) {
    const [dx, dy] = orient(cell, rot, mirror);
    const x = ox + dx;
    const y = oy + dy;
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      grid[y * cols + x] = 1;
    }
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
  track: { maxCells: number; minGenerations: number; minDisplacement: number } | null
): Simulation {
  const n = cols * rows;
  let curr = new Uint8Array(n);
  let next = new Uint8Array(n);
  const exposure = new Float64Array(n);
  const lastAlive = new Int32Array(n).fill(-1);

  seedRPentomino(curr, cols, rows, random);

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
 * Render a long-exposure still of an R-pentomino Game of Life run as
 * plottable single-pen strokes.
 */
export function generateConwayExposure(options: ConwayExposureOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = Math.floor(Math.random() * 1000000),
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

  const cellSize = Math.max(2, options.cellSize ?? Math.round(width / 100));
  const wobble = options.wobble ?? Math.max(0.4, cellSize * 0.12);
  const haloRadius = options.haloRadius ?? cellSize * 0.6;

  const usableW = Math.max(0, width - 2 * margin);
  const usableH = Math.max(0, height - 2 * margin);
  const cols = Math.floor(usableW / cellSize);
  const rows = Math.floor(usableH / cellSize);

  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (cols < 3 || rows < 3) return empty();

  // Center the grid within the page margin.
  const originX = margin + (usableW - cols * cellSize) / 2;
  const originY = margin + (usableH - rows * cellSize) / 2;

  const random = makeRandom(seed);
  const sim = simulate(
    cols,
    rows,
    Math.max(0, generations),
    decay,
    random,
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

  // ---- The crisp present (shared by every style) -------------------------
  const renderPresent = (): void => {
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
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (!sim.finalAlive[i]) continue;
        const c = cellCenter(cx, cy);
        if (isCore[i]) {
          fillSolid(c);
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.06), pen: 'bold', layer: 'present' });
        } else {
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.1), pen: 'bold', layer: 'present' });
          lines.push({ points: cellSquare(c.x, c.y, half, cellSize * 0.24), pen: 'bold', layer: 'present' });
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
      for (let k = 0; k < count; k++) {
        const off = (k - (count - 1) / 2) * spacing;
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
        const t = tone[i];
        if (t < faintThreshold) continue;
        if (haloCells[i]) continue; // hold history off the present's halo
        const c = cellCenter(cx, cy);
        const dir = motionDir(sim.lastAlive, cols, rows, cx, cy);
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

  return result;
}
