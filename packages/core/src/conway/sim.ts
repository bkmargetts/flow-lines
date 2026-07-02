import { Point } from '../flow-lines.js';

export interface Simulation {
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

export function simulate(
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
export function classifyFinal(
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
export function motionDir(
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
