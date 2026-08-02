import type { Crossing } from './crossings.js';
import type { TangleStrand } from './strand.js';

/**
 * The stacking order.
 *
 * Hidden-line removal for a pile of hoses is one question — *which of these
 * two overlapping tubes is on top here?* — and the answer is a property of
 * an ARC, not of a strand. A hose is over one neighbour and under the next,
 * so a per-strand depth cannot express a weave; but if the strand is cut
 * into pieces, each piece can sit at its own depth and the weave falls out
 * of a single global order.
 *
 * Cut each strand at the MIDPOINTS between consecutive crossings along it.
 * Every arc then holds at most one crossing in its interior, so any two arcs
 * share at most one crossing — there is exactly one over/under decision per
 * arc pair and contradictory decisions cannot arise. Each crossing becomes
 * one edge "this arc is above that arc", straight from the weave solve, and
 * a topological sort turns the edges into a depth per arc.
 *
 * Self-crossings need no special case: a strand's two passes land in
 * different arcs (the crossing detector keeps them at least 6r apart in
 * arc), and the edge between them is just another constraint.
 */

export interface ArcTable {
  /** Arc id per strand, ordered along the strand. */
  byStrand: number[][];
  /** Arc-length boundaries per strand; `bounds[k]` has `byStrand[k].length + 1`
   *  entries running 0 → strand length. */
  bounds: number[][];
  /** Owning strand of each arc. */
  strandOf: number[];
  /** Stacking depth of each arc — higher sits on top. */
  depth: number[];
  /** Number of over/under constraints dropped to break a cycle. */
  cyclesBroken: number;
}

/** The arc covering position `a` on strand `k`. */
export function arcAt(table: ArcTable, k: number, a: number): number {
  const bounds = table.bounds[k];
  const ids = table.byStrand[k];
  // Linear scan: strands carry a handful of arcs, so a binary search would
  // cost more in bookkeeping than it saves.
  for (let i = 0; i < ids.length; i++) {
    if (a <= bounds[i + 1]) return ids[i];
  }
  return ids[ids.length - 1];
}

/**
 * Split every strand at the midpoints between its crossings, then order the
 * resulting arcs so that each crossing's winner sits above its loser.
 */
export function buildArcDepths(
  strands: TangleStrand[],
  crossings: Crossing[],
  aOnTop: boolean[]
): ArcTable {
  // --- 1. cut points: midpoints between consecutive crossings on a strand
  const occ: number[][] = strands.map(() => []);
  for (const c of crossings) {
    occ[c.a.strand].push(c.a.arc);
    occ[c.b.strand].push(c.b.arc);
  }
  const byStrand: number[][] = [];
  const bounds: number[][] = [];
  const strandOf: number[] = [];
  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    const at = occ[k].slice().sort((p, q) => p - q);
    const cuts: number[] = [0];
    for (let i = 1; i < at.length; i++) {
      const mid = (at[i - 1] + at[i]) / 2;
      // Two crossings can land on top of each other after the merge pass;
      // a zero-width arc would carry a constraint it cannot honour.
      if (mid > cuts[cuts.length - 1] + 1e-6 && mid < s.len - 1e-6) cuts.push(mid);
    }
    cuts.push(s.len);
    const ids: number[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      ids.push(strandOf.length);
      strandOf.push(k);
    }
    byStrand.push(ids);
    bounds.push(cuts);
  }

  const table: ArcTable = {
    byStrand,
    bounds,
    strandOf,
    depth: new Array(strandOf.length).fill(0),
    cyclesBroken: 0,
  };

  // --- 2. constraints: winner above loser, one edge per crossing
  const above: number[][] = strandOf.map(() => []); // above[x] = arcs that sit over x
  const indeg: number[] = strandOf.map(() => 0);
  const seen = new Set<number>();
  for (const c of crossings) {
    const over = aOnTop[c.id] ? c.a : c.b;
    const under = aOnTop[c.id] ? c.b : c.a;
    const hi = arcAt(table, over.strand, over.arc);
    const lo = arcAt(table, under.strand, under.arc);
    if (hi === lo) continue; // degenerate: both passes fell in one arc
    const key = lo * strandOf.length + hi;
    if (seen.has(key)) continue;
    seen.add(key);
    above[lo].push(hi);
    indeg[hi]++;
  }

  // --- 3. depth: Kahn's algorithm, thinnest first so fatter tubes float up
  //
  // Ready arcs are emitted thinnest-first, which reproduces the module's
  // long-standing "the fatter duct simply lies on top" convention wherever
  // the weave has no opinion (two tubes that overlap without ever crossing).
  // Ties fall back to arc id, so a seed always renders the same drawing.
  const rank = (x: number): number => strands[strandOf[x]].r;
  const ready: number[] = [];
  for (let x = 0; x < strandOf.length; x++) if (indeg[x] === 0) ready.push(x);
  const takeNext = (): number => {
    let best = 0;
    for (let i = 1; i < ready.length; i++) {
      const a = ready[i];
      const b = ready[best];
      if (rank(a) < rank(b) - 1e-9 || (Math.abs(rank(a) - rank(b)) <= 1e-9 && a < b)) best = i;
    }
    const x = ready[best];
    ready[best] = ready[ready.length - 1];
    ready.pop();
    return x;
  };

  let next = 0;
  const placed = new Uint8Array(strandOf.length);
  while (next < strandOf.length) {
    if (ready.length === 0) {
      // A cycle: the weave says A over B over C over A. Nothing can satisfy
      // that, and leaving it unresolved is what used to hide all three tubes
      // at once. Cut the knot at its thinnest unplaced arc — deterministic,
      // and the cost is a single crossing drawn the wrong way round.
      let pick = -1;
      for (let x = 0; x < strandOf.length; x++) {
        if (placed[x]) continue;
        if (pick < 0 || rank(x) < rank(pick) - 1e-9) pick = x;
      }
      if (pick < 0) break;
      table.cyclesBroken++;
      indeg[pick] = 0;
      ready.push(pick);
    }
    const x = takeNext();
    if (placed[x]) continue;
    placed[x] = 1;
    table.depth[x] = next++;
    for (const y of above[x]) {
      if (placed[y]) continue;
      if (--indeg[y] === 0) ready.push(y);
    }
  }

  return table;
}
