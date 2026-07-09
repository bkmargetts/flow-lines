import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import type { WeaveMorph } from './morph.js';

/**
 * The Celtic lattice (Kaplan–Cohen construction). A grid graph is laid over
 * the drawable box; strands run diagonally through the midpoints of the grid
 * edges, and each non-break edge midpoint is a crossing where two strand
 * passes meet. A "break" turns the crossing into two turn-backs: the strands
 * bounce off the edge instead of crossing it. Border edges are forced breaks,
 * which is what turns strands around at the frame — every strand is a closed
 * loop by construction. `breaks = 0` is the pure plait; raising it dissolves
 * the plait into knotwork.
 *
 * In `bleed` mode the lattice is built one cell-ring larger than the frame
 * with the forced breaks moved to the enlarged border, so strands run off the
 * page; the final rect clip opens the loops at the frame.
 */

export interface LatticeOptions {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Requested lattice pitch, px. */
  cell: number;
  /** 0..1 interior break density (scaled by the morph). */
  breaks: number;
  /** Extend one cell-ring past the frame and let strands run off-page. */
  bleed: boolean;
  /** Ribbon width, px — sets how far turns pull back from break edges. */
  bandWidth: number;
  /** Extra pull-back at turns beyond the band half-width — the finish pass's
   *  displacement reach, so wobbled/sketched ink can't poke past the frame. */
  pad: number;
  seed: number;
}

export interface Lattice {
  /** Closed centerline loops in px; the last point connects back to the first. */
  strands: Point[][];
  cellW: number;
  cellH: number;
  /** Lattice origin in px (node (0,0)) — lets the weave solver classify a
   *  crossing back onto the grid at high order. */
  ox: number;
  oy: number;
}

interface Dir {
  dx: number;
  dy: number;
}

/** Diagonal travel directions, in half-cell steps. Index order is part of the
 *  deterministic walk enumeration — do not reorder. */
const DIRS: Dir[] = [
  { dx: 1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: -1 },
];

export function buildLattice(o: LatticeOptions, morph: WeaveMorph): Lattice {
  const bw = o.x1 - o.x0;
  const bh = o.y1 - o.y0;
  let cols = Math.max(2, Math.round(bw / o.cell));
  let rows = Math.max(2, Math.round(bh / o.cell));
  const cellW = bw / cols;
  const cellH = bh / rows;
  let ox = o.x0;
  let oy = o.y0;
  if (o.bleed) {
    cols += 2;
    rows += 2;
    ox -= cellW;
    oy -= cellH;
  }
  const cellMin = Math.min(cellW, cellH);

  // Edge tables. Horizontal edge H(i,j) spans node (i,j)→(i+1,j), midpoint
  // (i+0.5, j); vertical edge V(i,j) spans (i,j)→(i,j+1), midpoint (i, j+0.5).
  const nH = cols * (rows + 1);
  const nV = (cols + 1) * rows;
  const nE = nH + nV;
  const isH = (e: number) => e < nH;
  const hI = (e: number) => e % cols;
  const hJ = (e: number) => Math.floor(e / cols);
  const vI = (e: number) => (e - nH) % (cols + 1);
  const vJ = (e: number) => Math.floor((e - nH) / (cols + 1));
  const isBorder = (e: number) =>
    isH(e) ? hJ(e) === 0 || hJ(e) === rows : vI(e) === 0 || vI(e) === cols;

  // Break genome (sub-seed 1): one draw per interior edge in fixed order, so
  // moving the breaks knob or the order slider adds/removes breaks
  // monotonically instead of re-rolling the whole knot.
  const breakRand = makeRandom(subSeed(o.seed, 1));
  const isBreak = new Uint8Array(nE);
  const breakP = o.breaks * morph.breakScale;
  for (let e = 0; e < nE; e++) {
    if (isBorder(e)) {
      isBreak[e] = 1;
      continue;
    }
    isBreak[e] = breakRand() < breakP ? 1 : 0;
  }

  // Midpoint jitter (sub-seed 2): drawn once per edge in fixed order. Border
  // edges keep only their along-edge component so turnarounds stay in frame.
  const jitRand = makeRandom(subSeed(o.seed, 2));
  const jitX = new Float64Array(nE);
  const jitY = new Float64Array(nE);
  const jAmp = morph.jitterFrac * cellMin;
  for (let e = 0; e < nE; e++) {
    let jx = (jitRand() * 2 - 1) * jAmp;
    let jy = (jitRand() * 2 - 1) * jAmp;
    if (isBorder(e)) {
      if (isH(e)) jy = 0;
      else jx = 0;
    }
    jitX[e] = jx;
    jitY[e] = jy;
  }

  /** Edge midpoint in lattice coordinates. */
  const midOf = (e: number): Point =>
    isH(e) ? { x: hI(e) + 0.5, y: hJ(e) } : { x: vI(e), y: vJ(e) + 0.5 };
  /** Lattice → px, with the edge's once-drawn jitter folded in. */
  const midPx = (e: number): Point => {
    const m = midOf(e);
    return { x: ox + m.x * cellW + jitX[e], y: oy + m.y * cellH + jitY[e] };
  };

  /** The edge whose midpoint lies one diagonal half-step from `e` along `d`,
   *  or -1 when that midpoint falls outside the lattice. */
  const neighbor = (e: number, d: Dir): number => {
    if (isH(e)) {
      const i = hI(e) + (d.dx > 0 ? 1 : 0);
      const j = hJ(e) + (d.dy > 0 ? 0 : -1);
      if (i < 0 || i > cols || j < 0 || j >= rows) return -1;
      return nH + j * (cols + 1) + i;
    }
    const i = vI(e) + (d.dx > 0 ? 0 : -1);
    const j = vJ(e) + (d.dy > 0 ? 1 : 0);
    if (i < 0 || i >= cols || j < 0 || j > rows) return -1;
    return j * cols + i;
  };

  /** Bounce off a break: the wall kills the perpendicular component. */
  const reflect = (e: number, d: Dir): Dir =>
    isH(e) ? { dx: d.dx, dy: -d.dy } : { dx: -d.dx, dy: d.dy };

  // How far a turn pulls back from the break edge. Deep enough that two
  // strands turning at the same edge from opposite sides clear each other's
  // band, shallow enough to stay inside the adjacent cells.
  const depth = Math.min(
    0.42 * cellMin,
    Math.max(0.2 * cellMin, o.bandWidth * 0.5 + 3 + o.pad)
  );

  const dirIndex = (d: Dir) =>
    (d.dx > 0 ? 0 : 2) + (d.dy > 0 ? 0 : 1);
  const stateKey = (e: number, d: Dir) => e * 4 + dirIndex(d);

  /** A directed state is real only if the strand came from inside the lattice. */
  const validStart = (e: number, d: Dir): boolean => {
    const m = midOf(e);
    const px = m.x - d.dx * 0.5;
    const py = m.y - d.dy * 0.5;
    return px >= 0 && px <= cols && py >= 0 && py <= rows;
  };

  const visited = new Uint8Array(nE * 4);
  const strands: Point[][] = [];
  const maxSteps = nE * 4 + 8;

  for (let e0 = 0; e0 < nE; e0++) {
    for (let di = 0; di < 4; di++) {
      const d0 = DIRS[di];
      if (visited[stateKey(e0, d0)] || !validStart(e0, d0)) continue;

      const pts: Point[] = [];
      let e = e0;
      let din = d0;
      let steps = 0;
      do {
        visited[stateKey(e, din)] = 1;
        let dout = din;
        const mp = midPx(e);
        if (isBreak[e]) {
          dout = reflect(e, din);
          // Turn vertex: pulled back from the wall on the strand's side.
          pts.push(
            isH(e)
              ? { x: mp.x, y: mp.y - din.dy * depth }
              : { x: mp.x - din.dx * depth, y: mp.y }
          );
        } else {
          pts.push(mp); // pass straight through the crossing
        }
        // The reverse traversal arrives here moving -dout — mark it too so
        // each loop is emitted exactly once.
        visited[stateKey(e, { dx: -dout.dx, dy: -dout.dy })] = 1;
        e = neighbor(e, dout);
        din = dout;
        if (e < 0) break; // unreachable while borders are breaks; belt & braces
      } while (!(e === e0 && dirIndex(din) === dirIndex(d0)) && ++steps < maxSteps);

      // Drop degenerate loops (tight break clusters) shorter than ~2 cells.
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        len += Math.hypot(b.x - a.x, b.y - a.y);
      }
      if (pts.length >= 3 && len >= 1.6 * cellMin) strands.push(pts);
    }
  }

  return { strands, cellW, cellH, ox, oy };
}
