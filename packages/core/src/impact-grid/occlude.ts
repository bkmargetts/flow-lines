import type { Point } from '../flow-lines.js';

/** Axis-aligned bounds of a point set. */
export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function boundsOf(points: Point[]): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** Andrew monotone-chain convex hull, returned as a closed ring. Warped cell
 *  outlines are only mildly non-convex, so the hull is a tight, convex,
 *  clip-safe stand-in for the drawn shape. */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return [...pts, ...pts.slice(0, 1)];
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  return [...hull, { x: hull[0].x, y: hull[0].y }];
}

/** One occluding shape, prepared for fast segment clipping: outward edge
 *  normals with the ring, so "inside" is a max over edge half-planes. */
export interface Occluder {
  bounds: Bounds;
  /** Edge anchor points. */
  ex: number[];
  ey: number[];
  /** Outward unit normals per edge. */
  nx: number[];
  ny: number[];
}

export function makeOccluder(ring: Point[]): Occluder | null {
  const n = ring.length - 1;
  if (n < 3) return null;
  let gx = 0;
  let gy = 0;
  for (let i = 0; i < n; i++) {
    gx += ring[i].x;
    gy += ring[i].y;
  }
  gx /= n;
  gy /= n;
  const ex: number[] = [];
  const ey: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    let ux = dy / len;
    let uy = -dx / len;
    // Point the normal away from the centroid, whatever the winding.
    if (ux * (gx - a.x) + uy * (gy - a.y) > 0) {
      ux = -ux;
      uy = -uy;
    }
    ex.push(a.x);
    ey.push(a.y);
    nx.push(ux);
    ny.push(uy);
  }
  if (ex.length < 3) return null;
  return { bounds: boundsOf(ring), ex, ey, nx, ny };
}

/**
 * Remove the parts of a polyline hidden by a convex occluder grown by
 * `outset` (the paper hold-off: lines beneath stop a hair short of the shape
 * on top, the way the layer compositor holds lower layers off). Segments are
 * clipped analytically (Cyrus–Beck), so nothing needs densifying first.
 * Returns the surviving sub-polylines.
 */
export function clipLineOutside(line: Point[], occ: Occluder, outset: number): Point[][] {
  const out: Point[][] = [];
  let current: Point[] = [];
  const flush = () => {
    if (current.length >= 2) out.push(current);
    current = [];
  };
  const edges = occ.ex.length;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    // Feasible t-interval where the segment is INSIDE every grown edge.
    let lo = 0;
    let hi = 1;
    for (let e = 0; e < edges && lo <= hi; e++) {
      const c = occ.nx[e] * (a.x - occ.ex[e]) + occ.ny[e] * (a.y - occ.ey[e]) - outset;
      const d = occ.nx[e] * (b.x - a.x) + occ.ny[e] * (b.y - a.y);
      if (Math.abs(d) < 1e-12) {
        if (c > 0) {
          lo = 1;
          hi = 0;
        }
      } else if (d > 0) {
        hi = Math.min(hi, -c / d);
      } else {
        lo = Math.max(lo, -c / d);
      }
    }
    if (lo >= hi) {
      // Entirely visible.
      if (current.length === 0) current.push(a);
      current.push(b);
      continue;
    }
    const lerpAt = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (lo > 1e-9) {
      if (current.length === 0) current.push(a);
      current.push(lerpAt(lo));
    }
    flush();
    if (hi < 1 - 1e-9) {
      current.push(lerpAt(hi));
      current.push(b);
    }
  }
  flush();
  return out;
}
