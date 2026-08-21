/**
 * Lattice locus → plottable straight segments.
 *
 * 8-connected chain tracing is the obvious approach and it fails badly here: an
 * edge of rational slope p/q renders on the lattice as a STAIRCASE, and every
 * step of that stair has three 8-neighbours, so every step reads as a junction.
 * On a curve with about fourteen real edges it returned 1779 two-point
 * fragments.
 *
 * The limit edges are genuinely straight, so the right primitive is not "follow
 * the chain" but "extend while the pixels stay collinear". Each accepted run is
 * one edge of the tropical curve.
 */

/** Zhang–Suen thinning to a one-pixel skeleton. */
export function thin(src: Uint8Array, W: number, H: number): Uint8Array {
  const a = Uint8Array.from(src);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : a[y * W + x]);
  const doomed: number[] = [];
  for (let guard = 0; guard < 200; guard++) {
    let changed = false;
    for (const sub of [0, 1]) {
      doomed.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!a[y * W + x]) continue;
          const p = [
            at(x, y - 1),
            at(x + 1, y - 1),
            at(x + 1, y),
            at(x + 1, y + 1),
            at(x, y + 1),
            at(x - 1, y + 1),
            at(x - 1, y),
            at(x - 1, y - 1),
          ];
          let B = 0;
          for (const v of p) B += v;
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let i = 0; i < 8; i++) if (p[i] === 0 && p[(i + 1) % 8] === 1) A++;
          if (A !== 1) continue;
          if (sub === 0) {
            if (p[0] * p[2] * p[4] !== 0) continue;
            if (p[2] * p[4] * p[6] !== 0) continue;
          } else {
            if (p[0] * p[2] * p[6] !== 0) continue;
            if (p[0] * p[4] * p[6] !== 0) continue;
          }
          doomed.push(y * W + x);
        }
      }
      for (const i of doomed) a[i] = 0;
      if (doomed.length) changed = true;
    }
    if (!changed) break;
  }
  return a;
}

const N8: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export interface StraightRunOptions {
  /**
   * Collinearity tolerance in lattice units, and `minLen` the shortest run kept.
   *
   * THESE DEFAULTS ARE A PLOT BUDGET, NOT A FIDELITY SETTING. At A3 with 15mm
   * margins a 701 lattice is 0.38mm per unit, and tol 1.1 / minLen 4 puts HALF
   * the segments under 3mm — the regime where a lattice construction stops
   * reading as a woodcut and starts reading as a jaggy circle on graph paper.
   * tol 2.0 / minLen 10 drops that to 3% with a median segment near 12mm, keeps
   * about 86% of the locus, and is visually indistinguishable: the discarded
   * filigree is finer than a 0.3mm nib can render anyway. Loosen only when
   * plotting much larger than A3.
   */
  tol?: number;
  minLen?: number;
}

/** Maximal straight runs, as [start, end] lattice coordinate pairs. */
export function straightRuns(
  sk: Uint8Array,
  W: number,
  H: number,
  options: StraightRunOptions = {}
): [[number, number], [number, number]][] {
  const tol = options.tol ?? 2;
  const minLen = options.minLen ?? 10;
  const used = new Uint8Array(W * H);
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && sk[y * W + x] === 1 && !used[y * W + x];

  const maxDev = (pts: [number, number][], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    let m = 0;
    for (const p of pts) {
      const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L;
      if (d > m) m = d;
    }
    return m;
  };

  const runs: [[number, number], [number, number]][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!sk[y * W + x] || used[y * W + x]) continue;
      const pts: [number, number][] = [[x, y]];
      used[y * W + x] = 1;
      // Grow forward from the tip, then backward from the head; each extension
      // is accepted only if EVERY pixel so far stays within `tol` of the chord.
      for (const forward of [true, false]) {
        for (;;) {
          const tip = forward ? pts[pts.length - 1] : pts[0];
          const anchor = forward ? pts[0] : pts[pts.length - 1];
          let best: [number, number] | null = null;
          let bestDev = Infinity;
          for (const [dx, dy] of N8) {
            const nx = tip[0] + dx;
            const ny = tip[1] + dy;
            if (!free(nx, ny)) continue;
            const cand: [number, number] = [nx, ny];
            const dev = maxDev([...pts, cand], anchor, cand);
            if (dev <= tol && dev < bestDev) {
              bestDev = dev;
              best = cand;
            }
          }
          if (!best) break;
          used[best[1] * W + best[0]] = 1;
          if (forward) pts.push(best);
          else pts.unshift(best);
        }
      }
      if (pts.length >= minLen) runs.push([pts[0], pts[pts.length - 1]]);
    }
  }
  return runs;
}

/**
 * Close the junctions.
 *
 * `straightRuns` consumes pixels greedily, so whichever run reaches a junction
 * first claims its pixels and the others stop a step or two short — leaving
 * visible gaps where the tropical curve is in fact exactly incident. A tropical
 * curve IS a graph with balanced trivalent vertices, so the honest repair is to
 * snap: cluster run endpoints that lie within `snap` lattice units of each
 * other and move each cluster to its centroid.
 */
export function snapJunctions(
  runs: [[number, number], [number, number]][],
  snap = 6
): [[number, number], [number, number]][] {
  const ends: [number, number][] = [];
  for (const [a, b] of runs) ends.push(a, b);

  // Union-find over endpoints that fall in the same snap-radius neighbourhood.
  const parent = ends.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[b] = a;
  };

  const cell = Math.max(1, snap);
  const buckets = new Map<string, number[]>();
  ends.forEach((p, i) => {
    const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
    let list = buckets.get(k);
    if (!list) buckets.set(k, (list = []));
    list.push(i);
  });
  const snap2 = snap * snap;
  ends.forEach((p, i) => {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const j of buckets.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (j <= i) continue;
          const q = ends[j];
          if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 <= snap2) union(i, j);
        }
      }
    }
  });

  const sums = new Map<number, [number, number, number]>();
  ends.forEach((p, i) => {
    const r = find(i);
    const s = sums.get(r);
    if (s) {
      s[0] += p[0];
      s[1] += p[1];
      s[2] += 1;
    } else {
      sums.set(r, [p[0], p[1], 1]);
    }
  });

  return runs.map((_, i) => {
    const pick = (idx: number): [number, number] => {
      const s = sums.get(find(idx))!;
      return [s[0] / s[2], s[1] / s[2]];
    };
    return [pick(2 * i), pick(2 * i + 1)];
  });
}
