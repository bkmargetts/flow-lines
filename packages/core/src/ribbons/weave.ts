import type { Strand } from './warp.js';
import type { Crossing } from './crossings.js';

/**
 * Over/under assignment. The weave rule — each strand alternates over,
 * under, over… along its length — becomes XOR constraints between
 * consecutive crossings on a strand (including the wrap pair on these closed
 * loops), and the constraint graph is 2-colored per connected component by
 * BFS.
 *
 * Each component's one free bit is fixed by the Celtic parity rule read off
 * the lattice: at an edge-midpoint crossing, the strand whose tangent runs
 * along the "\" diagonal is on top at horizontal edges and under at vertical
 * ones — the classification is exact at order 1 and merely picks a
 * deterministic global flip once the warp has washed the grid away.
 *
 * Odd cycles (a closed loop with an odd crossing count) make strict
 * alternation infeasible; BFS then leaves one non-alternating adjacency per
 * odd cycle, deterministically placed. A handful of those is invisible in a
 * tangle, and the pure plait is provably even (the parity rule *is* a valid
 * coloring there), which the tests pin.
 */

export interface WeaveResult {
  /** Per crossing id: is end `a`'s strand on top? */
  aOnTop: boolean[];
  /** Constraint edges left unsatisfied (odd cycles). */
  violations: number;
}

export interface LatticeFrame {
  cellW: number;
  cellH: number;
  ox: number;
  oy: number;
}

interface Edge {
  to: number;
  /** Required XOR between aOnTop values of the two crossings. */
  req: number;
}

export function solveWeave(
  strands: Strand[],
  crossings: Crossing[],
  frame: LatticeFrame
): WeaveResult {
  const n = crossings.length;
  const adj: Edge[][] = Array.from({ length: n }, () => []);

  // Per-strand occurrence lists (a self-crossing contributes two occurrences).
  const occ: { cid: number; arc: number; isB: number }[][] = Array.from(
    { length: strands.length },
    () => []
  );
  for (const c of crossings) {
    occ[c.a.strand].push({ cid: c.id, arc: c.a.arc, isB: 0 });
    occ[c.b.strand].push({ cid: c.id, arc: c.b.arc, isB: 1 });
  }
  for (let s = 0; s < occ.length; s++) {
    const list = occ[s];
    if (list.length < 2) continue;
    list.sort((p, q) => p.arc - q.arc || p.cid - q.cid);
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      const v = list[(i + 1) % list.length]; // wrap pair: the loops are closed
      if (u.cid === v.cid) continue;
      // over_s(c) = aOnTop(c) XOR isB; alternation wants over_s(u) != over_s(v)
      // → aOnTop(u) XOR aOnTop(v) = isB_u XOR isB_v XOR 1.
      const req = (u.isB ^ v.isB ^ 1) & 1;
      adj[u.cid].push({ to: v.cid, req });
      adj[v.cid].push({ to: u.cid, req });
    }
  }
  for (const edges of adj) edges.sort((p, q) => p.to - q.to || p.req - q.req);

  /** Root preference: the Celtic parity rule, read off the nearest lattice
   *  slot. Horizontal-edge midpoints sit at (half, integer) lattice coords,
   *  vertical ones at (integer, half). */
  const rootTop = (c: Crossing): boolean => {
    const fx = (c.x - frame.ox) / frame.cellW;
    const fy = (c.y - frame.oy) / frame.cellH;
    const dHalfX = Math.abs(fx - Math.floor(fx) - 0.5);
    const dIntX = Math.abs(fx - Math.round(fx));
    const dHalfY = Math.abs(fy - Math.floor(fy) - 0.5);
    const dIntY = Math.abs(fy - Math.round(fy));
    const isHorizontal = dHalfX + dIntY <= dIntX + dHalfY;
    const aDiagonal = c.a.tx * c.a.ty > 0; // the "\" family
    return isHorizontal !== aDiagonal;
  };

  const aOnTop: boolean[] = new Array(n).fill(false);
  const color = new Int8Array(n).fill(-1);
  let violations = 0;
  const queue: number[] = [];
  for (let root = 0; root < n; root++) {
    if (color[root] !== -1) continue;
    color[root] = rootTop(crossings[root]) ? 1 : 0;
    queue.length = 0;
    queue.push(root);
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      for (const e of adj[u]) {
        const want = color[u] ^ e.req;
        if (color[e.to] === -1) {
          color[e.to] = want;
          queue.push(e.to);
        } else if (color[e.to] !== want) {
          violations++; // odd cycle — counted twice (once per direction)
        }
      }
    }
  }
  violations = violations / 2;
  for (let i = 0; i < n; i++) aOnTop[i] = color[i] === 1;
  return { aOnTop, violations };
}
