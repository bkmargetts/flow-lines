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

/** Shared point budget across the whole bath: once spent, refinement stops
 *  adding midpoints (existing geometry still deforms exactly, rings just
 *  coarsen). Trips at the same op for a given seed/options, so output stays
 *  deterministic. */
export interface PointBudget {
  points: number;
  cap: number;
}

/** Total points across all rings — points, not rings, are the real cost in
 *  the deform loops and the SVG. Sited beside spatial.ts's LINE_CAP
 *  precedent but local to marbling (these cap points/rings, not lines). */
export const MARBLING_POINT_CAP = 140_000;
/** Rings = plotted polylines; drops × ringsPerDrop is clamped under this. */
export const MARBLING_RING_CAP = 900;

const MAX_REFINE_DEPTH = 5;

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
  const n = Math.max(16, Math.ceil((2 * Math.PI * r) / maxSeg));
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

/** True when the op cannot move any point of the ring visibly. */
export function ringOutOfReach(ring: Ring, op: MarblingOp, minDispPx: number): boolean {
  const reach = opInfluenceRadius(op, minDispPx);
  if (!isFinite(reach)) return false;
  if (op.kind === 'drop' || op.kind === 'vortex') {
    return bboxDistance(ring, op.cx, op.cy) > reach;
  }
  return false;
}

export function applyOpToRing(ring: Ring, op: MarblingOp, maxSeg: number, budget: PointBudget): void {
  const src = ring.pts;
  const n = src.length;
  const out: Point[] = [];
  const maxSeg2 = maxSeg * maxSeg;

  // Refine between original points a..b whose images ma..mb span too far.
  const refine = (a: Point, b: Point, ma: Point, mb: Point, depth: number): void => {
    const dx = mb.x - ma.x;
    const dy = mb.y - ma.y;
    if (dx * dx + dy * dy <= maxSeg2) return;
    if (depth >= MAX_REFINE_DEPTH || budget.points >= budget.cap) return;
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
