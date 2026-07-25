import { Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';

/**
 * Differential-growth simulation: one or more node loops evolve under three
 * competing pressures — a spring toward each node's loop neighbours (keeps the
 * curve coherent), Laplacian smoothing (keeps it fair), and repulsion from
 * every node within a radius (makes it fold). Growth is edge splitting: edges
 * that stretch past the target spacing may insert a midpoint, so the curve
 * gains length it has no room for and buckles into meanders — the fold
 * wavelength is set by the repulsion radius. The growth gate is what keeps the
 * result organic instead of uniform: low-frequency noise concentrates
 * insertion into patches (quiet stretches stay smooth arcs) and a curvature
 * bias feeds outward tips so lobes ramify the way coral does.
 *
 * Everything is deterministic: the caller supplies the noise source and the
 * rng, and the sim draws no randomness beyond them.
 */
export interface CoralSimParams {
  /** Inner drawing rect, px */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Target node spacing, px — the resolution everything derives from */
  edgeLen: number;
  /** Repulsion radius, px — the fold wavelength scale */
  repulsionRadius: number;
  /** Spring weight toward loop neighbours, 0..1 */
  attraction: number;
  /** Laplacian smoothing weight, 0..1 */
  alignment: number;
  /** Repulsion weight, 0..1 */
  repulsion: number;
  /** Per-iteration displacement clamp, px */
  maxStep: number;
  /** Gated insertion probability scale, 0..1 — how eagerly the curve grows */
  growth: number;
  /** Approximate total node cap — growth stops here (spacing splits may
   * overshoot it slightly to keep edges bounded) */
  maxNodes: number;
  /** Growth steps */
  iterations: number;
  /** How many evenly-spaced history snapshots to record */
  snapshots: number;
  /** Growth-gate noise patch size, px */
  noiseScale: number;
  /** How hard the noise gates growth, 0..1 — 0 grows everywhere evenly */
  patchiness: number;
  /** Growth preference for convex tips, 0..1 — lobes ramify */
  curvatureBias: number;
  /** Random per-node nudge, 0..1 of edgeLen — anneals symmetric stalemates */
  jitter: number;
  /** Soft-wall onset distance from the inner rect, px */
  boundaryPad: number;
  /** Initial loop(s), already positioned; each wound the same way */
  seedLoops: Point[][];
  /** False for the pinned open-curve (line) variant */
  closed: boolean;
}

export interface CoralRing {
  /** Snapshot of every loop at this moment */
  loops: Point[][];
  /** The iteration this snapshot was taken at */
  iter: number;
}

export interface CoralSimResult {
  /** The final loop(s) */
  loops: Point[][];
  /** History snapshots, oldest first */
  rings: CoralRing[];
  iterations: number;
}

/** Ring-distance between two indices on a loop of n nodes. */
function loopDist(a: number, b: number, n: number, closed: boolean): number {
  const d = Math.abs(a - b);
  return closed ? Math.min(d, n - d) : d;
}

export function simulateCoral(
  params: CoralSimParams,
  noise: SimplexNoise,
  rng: () => number
): CoralSimResult {
  const {
    x0,
    y0,
    x1,
    y1,
    edgeLen,
    repulsionRadius: R,
    attraction,
    alignment,
    repulsion,
    maxStep,
    growth,
    maxNodes,
    iterations,
    snapshots,
    noiseScale,
    patchiness,
    curvatureBias,
    jitter,
    boundaryPad,
    closed,
  } = params;

  const loops: Point[][] = params.seedLoops.map((loop) => loop.map((p) => ({ ...p })));

  // History is spread across the whole life but stops shy of the end — the
  // final loop is drawn as the bold silhouette, and a ring recorded a breath
  // earlier would double it.
  const snapAt = new Map<number, boolean>();
  for (let k = 1; k <= snapshots; k++) {
    const frac = 0.06 + (0.88 * k) / snapshots;
    snapAt.set(Math.max(1, Math.round(iterations * frac)), true);
  }

  const rings: CoralRing[] = [];
  const r2 = R * R;
  // Spacing splits keep the chain resolved; *injection* is what grows it —
  // crowding a node into an ordinary edge is the pressure that makes the
  // curve buckle, so the injection probability is the growth rate itself.
  const splitLen = edgeLen * 1.5;
  const injectLen = edgeLen * 0.8;
  const injectRate = 0.02;
  const mergeLen = edgeLen * 0.3;
  const jitterAmp = jitter * edgeLen * 0.1;
  const noiseFreq = 1 / Math.max(1e-6, noiseScale);

  // Dense bucket grid over the inner rect (plus an R apron): cell = R, so a
  // 3×3 neighbourhood covers every node within the repulsion radius. Buckets
  // are reused across iterations via a stamp, never re-allocated.
  const gridX0 = x0 - R;
  const gridY0 = y0 - R;
  const cols = Math.max(1, Math.ceil((x1 - x0 + 2 * R) / R));
  const rows = Math.max(1, Math.ceil((y1 - y0 + 2 * R) / R));
  const buckets: number[][] = new Array(cols * rows);
  const bucketStamp = new Int32Array(cols * rows);
  const colOf = (x: number): number =>
    Math.min(cols - 1, Math.max(0, Math.floor((x - gridX0) / R)));
  const rowOf = (y: number): number =>
    Math.min(rows - 1, Math.max(0, Math.floor((y - gridY0) / R)));

  // Soft wall: an inward push that fades in over boundaryPad, so the
  // organism flattens against the frame instead of hitting a fence.
  const wall = (dist: number): number => {
    const t = 1 - Math.min(1, Math.max(0, dist / boundaryPad));
    return t * t * maxStep;
  };

  // Flat scratch buffers, grown on demand.
  let cap = 256;
  let xs = new Float64Array(cap);
  let ys = new Float64Array(cap);
  let loopOf = new Int32Array(cap);
  let idxOf = new Int32Array(cap);

  for (let it = 1; it <= iterations; it++) {
    // Flatten for the grid: forces are computed against old positions only
    // (double-buffered), so the update order can never leak into the result.
    let total = 0;
    for (const loop of loops) total += loop.length;
    if (total > cap) {
      while (cap < total) cap *= 2;
      xs = new Float64Array(cap);
      ys = new Float64Array(cap);
      loopOf = new Int32Array(cap);
      idxOf = new Int32Array(cap);
    }
    {
      let n = 0;
      for (let li = 0; li < loops.length; li++) {
        const loop = loops[li];
        for (let i = 0; i < loop.length; i++, n++) {
          xs[n] = loop[i].x;
          ys[n] = loop[i].y;
          loopOf[n] = li;
          idxOf[n] = i;
          const cell = rowOf(loop[i].y) * cols + colOf(loop[i].x);
          if (bucketStamp[cell] !== it) {
            bucketStamp[cell] = it;
            if (buckets[cell]) buckets[cell].length = 0;
            else buckets[cell] = [];
          }
          buckets[cell].push(n);
        }
      }
    }

    let flat = 0;
    for (let li = 0; li < loops.length; li++) {
      const loop = loops[li];
      const n = loop.length;
      const next: Point[] = new Array(n);
      for (let i = 0; i < n; i++, flat++) {
        const p = loop[i];
        const pinned = !closed && (i === 0 || i === n - 1);
        if (pinned) {
          next[i] = { x: p.x, y: p.y };
          continue;
        }
        const prev = loop[closed ? (i + n - 1) % n : i - 1];
        const nxt = loop[closed ? (i + 1) % n : i + 1];

        // Spring toward each neighbour plus pull to their midpoint: the
        // spring keeps the chain taut, the midpoint keeps it fair.
        const mx = (prev.x + nxt.x) / 2;
        const my = (prev.y + nxt.y) / 2;
        let fx = (mx - p.x) * (attraction + alignment);
        let fy = (my - p.y) * (attraction + alignment);

        // Repulsion from every node within R, its own chain neighbours
        // excepted — smooth falloff so the force field has no cliff.
        const px = p.x;
        const py = p.y;
        let rx = 0;
        let ry = 0;
        const c0 = colOf(px);
        const rw0 = rowOf(py);
        const cLo = c0 > 0 ? c0 - 1 : 0;
        const cHi = c0 < cols - 1 ? c0 + 1 : cols - 1;
        const rLo = rw0 > 0 ? rw0 - 1 : 0;
        const rHi = rw0 < rows - 1 ? rw0 + 1 : rows - 1;
        for (let cr = rLo; cr <= rHi; cr++) {
          for (let cc = cLo; cc <= cHi; cc++) {
            const cell = cr * cols + cc;
            if (bucketStamp[cell] !== it) continue;
            const bucket = buckets[cell];
            for (let bi = 0; bi < bucket.length; bi++) {
              const j = bucket[bi];
              if (j === flat) continue;
              if (loopOf[j] === li && loopDist(idxOf[j], i, n, closed) <= 2) continue;
              const dx = px - xs[j];
              const dy = py - ys[j];
              const d2 = dx * dx + dy * dy;
              if (d2 >= r2 || d2 < 1e-12) continue;
              const d = Math.sqrt(d2);
              const w = 1 - d / R;
              const s = (w * w) / d;
              rx += dx * s;
              ry += dy * s;
            }
          }
        }
        fx += rx * repulsion * edgeLen;
        fy += ry * repulsion * edgeLen;

        // A whisper of noise breaks perfectly symmetric stalemates.
        if (jitterAmp > 0) {
          const a = rng() * Math.PI * 2;
          fx += Math.cos(a) * jitterAmp;
          fy += Math.sin(a) * jitterAmp;
        }

        const fl = Math.hypot(fx, fy);
        if (fl > maxStep) {
          fx = (fx / fl) * maxStep;
          fy = (fy / fl) * maxStep;
        }

        // The wall is applied outside the clamp so it always wins at the
        // frame: at the boundary it fully cancels an outward step, and past
        // it the push is inward — crowding can never ratchet the curve out.
        fx += wall(px - x0) - wall(x1 - px);
        fy += wall(py - y0) - wall(y1 - py);
        next[i] = { x: px + fx, y: py + fy };
      }
      loops[li] = next;
    }

    // ---- Adaptive resample: growth-gated splits, spacing splits, merges ----
    let nodeCount = 0;
    for (const loop of loops) nodeCount += loop.length;
    for (let li = 0; li < loops.length; li++) {
      const loop = loops[li];
      const grown: Point[] = [];
      const n = loop.length;
      const lastEdge = closed ? n : n - 1;
      for (let i = 0; i < n; i++) {
        const a = loop[i];
        grown.push(a);
        if (i >= lastEdge && !closed) break;
        const b = loop[(i + 1) % n];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        let split = len > splitLen;
        if (!split && len >= injectLen && nodeCount < maxNodes) {
          // The growth gate: patchy by noise, hungrier at outward tips.
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          const nz = noise.noise2D(cx * noiseFreq, cy * noiseFreq) * 0.5 + 0.5;
          let gate = 1 - patchiness + patchiness * nz;
          if (curvatureBias > 0) {
            const p0 = loop[(i + n - 1) % n];
            const p2 = loop[(i + 2) % n];
            const e0x = a.x - p0.x;
            const e0y = a.y - p0.y;
            const e1x = b.x - a.x;
            const e1y = b.y - a.y;
            const e2x = p2.x - b.x;
            const e2y = p2.y - b.y;
            let turn =
              Math.atan2(e0x * e1y - e0y * e1x, e0x * e1x + e0y * e1y) +
              Math.atan2(e1x * e2y - e1y * e2x, e1x * e2x + e1y * e2y);
            // Seeds are wound so positive turn is an outward tip; the open
            // curve has no inside, so any bend counts.
            if (!closed) turn = Math.abs(turn);
            gate *= 1 + curvatureBias * Math.max(0, turn * 2);
          }
          split = rng() < growth * gate * injectRate;
        }
        if (split) {
          const jx = (rng() - 0.5) * edgeLen * 0.1;
          const jy = (rng() - 0.5) * edgeLen * 0.1;
          grown.push({ x: (a.x + b.x) / 2 + jx, y: (a.y + b.y) / 2 + jy });
          nodeCount++;
        }
      }

      // Merge: drop nodes pinched between two short edges (never endpoints,
      // never two in a row — the survivor re-spaces the chain).
      const merged: Point[] = [];
      const m = grown.length;
      let dropped = false;
      for (let i = 0; i < m; i++) {
        const isEnd = !closed && (i === 0 || i === m - 1);
        if (!isEnd && !dropped && m > 8) {
          const prev = grown[(i + m - 1) % m];
          const nxt = grown[(i + 1) % m];
          const p = grown[i];
          const d0 = Math.hypot(p.x - prev.x, p.y - prev.y);
          const d1 = Math.hypot(nxt.x - p.x, nxt.y - p.y);
          if (d0 < mergeLen && d1 < mergeLen) {
            dropped = true;
            nodeCount--;
            continue;
          }
        }
        dropped = false;
        merged.push(grown[i]);
      }
      loops[li] = merged;
    }

    if (snapAt.has(it)) {
      rings.push({ loops: loops.map((loop) => loop.map((p) => ({ ...p }))), iter: it });
    }
  }

  return { loops, rings, iterations };
}
