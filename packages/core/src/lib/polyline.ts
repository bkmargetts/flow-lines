import type { Point } from '../flow-lines.js';

/**
 * Shared polyline geometry — internal to core (not part of the public API).
 * Bodies were lifted verbatim from the per-module copies (identical arithmetic
 * in identical order) so consolidating them cannot move a single float; the
 * golden suite pins that. Modules with genuinely divergent variants (pen-ink's
 * `{a, b, clippedEnd}` clipper, texture's tests-array clipper, landscape's
 * LINE_CAP-guarded pushRun) keep them locally.
 */

/** Trim a fraction of a polyline's arc length (capped at 12px) off both ends —
 *  frays hatch ends so they don't form a hard machine edge. */
export function trimPolyline(points: Point[], fraction: number): Point[] {
  if (points.length < 3) return points;
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    );
  }
  const total = cumulative[cumulative.length - 1];
  const trim = Math.min(total * fraction, 12);
  const start = cumulative.findIndex((c) => c >= trim);
  let end = points.length - 1;
  while (end > 0 && cumulative[end] > total - trim) end--;
  if (start < 0 || end - start < 1) return points;
  return points.slice(start, end + 1);
}

/** Offset a polyline sideways by a signed distance along the local normal
 *  (central-difference tangent) — the single-pen bold-line building block. */
export function offsetPolyline(points: Point[], distance: number): Point[] {
  if (Math.abs(distance) < 1e-6) return points.map((p) => ({ ...p }));
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = {
      x: points[i].x + (-ty / len) * distance,
      y: points[i].y + (tx / len) * distance,
    };
  }
  return out;
}

/** Iterated 1-2-1 smoothing with pinned endpoints. */
export function smoothPolyline(points: Point[], iterations: number): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Point[] = new Array(pts.length);
    out[0] = { ...pts[0] };
    out[pts.length - 1] = { ...pts[pts.length - 1] };
    for (let i = 1; i < pts.length - 1; i++) {
      out[i] = {
        x: (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4,
        y: (pts[i - 1].y + 2 * pts[i].y + pts[i + 1].y) / 4,
      };
    }
    pts = out;
  }
  return pts;
}

/** Even–odd ray-cast point-in-polygon test. */
export function pointInPolygon(poly: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Liang–Barsky segment clip against an axis-aligned rect. */
export function clipSegmentToRect(
  a: Point,
  b: Point,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // parallel and outside
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
  ];
}

/** Clip a polyline against an axis-aligned rect, splitting it into the runs
 *  that stay inside. */
export function clipPolylineToRect(pts: Point[], x0: number, y0: number, x1: number, y1: number): Point[][] {
  if (pts.length < 2) return [];
  const runs: Point[][] = [];
  let run: Point[] = [];
  const eps = 1e-6;
  for (let i = 1; i < pts.length; i++) {
    const seg = clipSegmentToRect(pts[i - 1], pts[i], x0, y0, x1, y1);
    if (!seg) {
      if (run.length >= 2) runs.push(run);
      run = [];
      continue;
    }
    const [a, b] = seg;
    if (run.length === 0) {
      run.push(a);
    } else {
      const last = run[run.length - 1];
      // Segment re-entered the rect somewhere new → start a fresh run.
      if (Math.hypot(a.x - last.x, a.y - last.y) > eps) {
        if (run.length >= 2) runs.push(run);
        run = [a];
      }
    }
    run.push(b);
    // Segment exited the rect (clipped end ≠ the real vertex) → end the run.
    if (Math.hypot(b.x - pts[i].x, b.y - pts[i].y) > eps) {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}
