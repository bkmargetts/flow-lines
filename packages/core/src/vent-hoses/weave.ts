import { makeRandom, subSeed } from '../lib/rng.js';
import type { HoseStrand } from './strand.js';
import type { Crossing } from './crossings.js';

/**
 * Over/under assignment, adapted from the ribbons module for open strands.
 * The weave rule — each hose alternates over, under, over… along its run —
 * becomes XOR constraints between arc-consecutive crossings on a strand
 * (open paths: NO wrap pair), 2-colored per connected component by BFS.
 * With open paths the constraint graph is bipartite unless self-crossings
 * close an odd cycle; the stray non-alternation that leaves is invisible in
 * a pile of ducts.
 *
 * Each component's free bit is fixed physically: the fatter hose lies on
 * top at the component's root crossing. And because a pile of ducts is not
 * a woven basket, a bias pass then overrides a deterministic fraction of
 * crossings to the same "fat hose wins" rule — runs of one duct simply
 * lying on top of another read as gravity, not weaving.
 */

export interface WeaveResult {
  /** Per crossing id: is end `a`'s strand on top? */
  aOnTop: boolean[];
  /** Constraint edges left unsatisfied (odd cycles). */
  violations: number;
}

interface Edge {
  to: number;
  /** Required XOR between aOnTop values of the two crossings. */
  req: number;
}

export function solveHoseWeave(
  strands: HoseStrand[],
  crossings: Crossing[],
  weaveBias: number,
  seed: number
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
    for (let i = 0; i < list.length - 1; i++) {
      const u = list[i];
      const v = list[i + 1];
      if (u.cid === v.cid) continue;
      // over_s(c) = aOnTop(c) XOR isB; alternation wants over_s(u) != over_s(v)
      // → aOnTop(u) XOR aOnTop(v) = isB_u XOR isB_v XOR 1.
      const req = (u.isB ^ v.isB ^ 1) & 1;
      adj[u.cid].push({ to: v.cid, req });
      adj[v.cid].push({ to: u.cid, req });
    }
  }
  for (const edges of adj) edges.sort((p, q) => p.to - q.to || p.req - q.req);

  /** Root preference: the fatter hose lies on top (ties: end `a`). */
  const fatOnTop = (c: Crossing): boolean =>
    strands[c.a.strand].r >= strands[c.b.strand].r;

  const aOnTop: boolean[] = new Array(n).fill(false);
  const color = new Int8Array(n).fill(-1);
  let violations = 0;
  const queue: number[] = [];
  for (let root = 0; root < n; root++) {
    if (color[root] !== -1) continue;
    color[root] = fatOnTop(crossings[root]) ? 1 : 0;
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

  // Bias pass: rands drawn unconditionally per crossing in id order so the
  // knob rescales smoothly instead of re-rolling. Self-crossings keep their
  // alternation — "fatter on top" is meaningless against yourself.
  const rand = makeRandom(subSeed(seed, 9));
  for (let i = 0; i < n; i++) {
    const roll = rand();
    const c = crossings[i];
    if (c.a.strand === c.b.strand) continue;
    if (strands[c.a.strand].r === strands[c.b.strand].r) continue;
    if (roll < weaveBias) aOnTop[i] = fatOnTop(c);
  }

  return { aOnTop, violations };
}
