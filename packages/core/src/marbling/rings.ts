import type { Point } from '../flow-lines.js';
import { MarblingOp, applyOp, opInfluenceRadius } from './ops.js';

/**
 * The bath: every ink boundary is a closed ring of points (closure implied —
 * last point ≠ first). Ops deform rings point-by-point through the exact
 * map; segments that stretch beyond `maxSeg` are refined by splitting the
 * *original* segment and mapping the midpoint exactly, so a drop renders as
 * a smooth bulge rather than a faceted polygon (post-hoc densify would
 * interpolate linearly on the already-deformed curve and miss the curvature).
 */
export interface Ring {
  pts: Point[];
  /** Ink-group index → pen layer `ink-<group>` */
  group: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Shared point budget across the whole bath. Pressure on the budget
 *  coarsens refinement smoothly (see `refineMaxSeg`) instead of switching
 *  it off — a refinement cliff turns every segment a later op stretches
 *  into a straight chord, the one artifact a marbled sheet cannot carry.
 *  Fully deterministic for a given seed/options. */
export interface PointBudget {
  points: number;
  cap: number;
}

/**
 * The working max-segment length under budget pressure: identity below 70%
 * spent, inflating smoothly to 16× at ~2× the cap. Ring growth stalls as
 * resolution drops, so the cap is approached asymptotically; the hard stop
 * (no refinement at all) sits at 2× cap and is practically unreachable.
 */
export function refineMaxSeg(maxSeg: number, budget: PointBudget): number {
  const u = budget.points / budget.cap;
  if (u <= 0.7) return maxSeg;
  return maxSeg * Math.min(16, Math.exp((u - 0.7) * 6.93));
}

/** Total points across all rings — points, not rings, are the real cost in
 *  the deform loops and the SVG. Sited beside spatial.ts's LINE_CAP
 *  precedent but local to marbling (these cap points/rings, not lines). */
export const MARBLING_POINT_CAP = 140_000;
/** Rings = plotted polylines; drops × ringsPerDrop is clamped under this. */
export const MARBLING_RING_CAP = 900;

// Deep enough to resolve the drop-centre singularity: a drop landing within
// ε of a segment sweeps it ~half-way around the rim, and resolving that
// wrap needs depth ~log2(r/ε). Depth 24 covers ε down to ~1e-5 px — below
// float noise — so no chord survives. Depth does NOT bound the work: refine
// only splits while a mapped span still exceeds maxSeg, so the points spent
// on a wrap are ~(arc length / maxSeg) regardless of how deep it recursed.
const MAX_REFINE_DEPTH = 24;

function computeBBox(ring: Ring): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring.pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  ring.minX = minX;
  ring.minY = minY;
  ring.maxX = maxX;
  ring.maxY = maxY;
}

export function makeCircleRing(
  cx: number,
  cy: number,
  r: number,
  group: number,
  maxSeg: number,
  budget: PointBudget
): Ring {
  // Never sample past the remaining budget: a bath that would overrun the
  // cap coarsens instead of silently disabling all later refinement (the
  // detail pre-scale in the generator makes this a rarely-hit backstop).
  const ideal = Math.max(16, Math.ceil((2 * Math.PI * r) / maxSeg));
  const n = Math.max(16, Math.min(ideal, budget.cap - budget.points));
  const pts: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts[i] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  budget.points += n;
  const ring: Ring = { pts, group, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  computeBBox(ring);
  return ring;
}

/** Distance from a point to a ring's bbox (0 inside). */
function bboxDistance(ring: Ring, x: number, y: number): number {
  const dx = Math.max(ring.minX - x, 0, x - ring.maxX);
  const dy = Math.max(ring.minY - y, 0, y - ring.maxY);
  return Math.hypot(dx, dy);
}

/** True when the ring's bbox sits wholly beyond the padded frame on one
 *  side — it can never return to the sheet, so it can be culled (and its
 *  points refunded to the budget). */
export function ringOffSheet(ring: Ring, f: RefineFrame): boolean {
  return (
    ring.maxX < f.x0 - f.pad ||
    ring.minX > f.x1 + f.pad ||
    ring.maxY < f.y0 - f.pad ||
    ring.minY > f.y1 + f.pad
  );
}

/** True when the op cannot move any point of the ring visibly. */
export function ringOutOfReach(ring: Ring, op: MarblingOp, minDispPx: number): boolean {
  const reach = opInfluenceRadius(op, minDispPx);
  if (!isFinite(reach)) return false;
  if (op.kind === 'drop' || op.kind === 'vortex') {
    return bboxDistance(ring, op.cx, op.cy) > reach;
  }
  return false;
}

/**
 * The frame refinement cares about: the margin box padded by the largest
 * displacement any remaining op could apply inward. Geometry beyond the pad
 * on one side can never re-enter the sheet, so its curvature is invisible —
 * spending budget resolving it starves the on-page drawing (the budget
 * pressure inflates `refineMaxSeg`, and the visible rings coarsen for
 * detail that gets clipped anyway).
 */
export interface RefineFrame {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pad: number;
}

/** Both points beyond the padded frame on the same side: the segment (and
 *  any chord between refinements of it) stays off-sheet for good. */
function offSheetSameSide(a: Point, b: Point, f: RefineFrame): boolean {
  return (
    (a.x < f.x0 - f.pad && b.x < f.x0 - f.pad) ||
    (a.x > f.x1 + f.pad && b.x > f.x1 + f.pad) ||
    (a.y < f.y0 - f.pad && b.y < f.y0 - f.pad) ||
    (a.y > f.y1 + f.pad && b.y > f.y1 + f.pad)
  );
}

export function applyOpToRing(
  ring: Ring,
  op: MarblingOp,
  maxSeg: number,
  budget: PointBudget,
  frame: RefineFrame
): void {
  const src = ring.pts;
  const n = src.length;
  const out: Point[] = [];
  const seg = refineMaxSeg(maxSeg, budget);
  const maxSeg2 = seg * seg;

  // Refine between original points a..b whose images ma..mb span too far.
  const refine = (a: Point, b: Point, ma: Point, mb: Point, depth: number): void => {
    const dx = mb.x - ma.x;
    const dy = mb.y - ma.y;
    if (dx * dx + dy * dy <= maxSeg2) return;
    if (offSheetSameSide(ma, mb, frame)) return;
    if (depth >= MAX_REFINE_DEPTH || budget.points >= budget.cap * 2) return;
    const mid: Point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mm = applyOp(mid.x, mid.y, op);
    refine(a, mid, ma, mm, depth + 1);
    out.push(mm);
    budget.points++;
    refine(mid, b, mm, mb, depth + 1);
  };

  const mapped: Point[] = new Array(n);
  for (let i = 0; i < n; i++) mapped[i] = applyOp(src[i].x, src[i].y, op);

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push(mapped[i]);
    refine(src[i], src[j], mapped[i], mapped[j], 0);
  }

  ring.pts = out;
  computeBBox(ring);
}
