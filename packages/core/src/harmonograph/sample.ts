import { Point } from '../flow-lines.js';

/**
 * Sampling helpers shared by the three tracers. All curves here are closed
 * form, so an exact parameter step comes straight from a speed bound —
 * `dt = detail / vMax` guarantees every chord is at most `detail` long —
 * and a streaming collinearity pass then throws away the samples a straight
 * stretch never needed.
 */

/** A traced curve in unit space (|x|,|y| ≤ 1) plus the pen group it cycles to. */
export interface TracedLine {
  points: Point[];
  group: number;
}

/**
 * Parameter step that keeps chords at or under `detail` given a speed bound,
 * stretched if the whole figure (total parameter `span` across all its
 * curves) would blow the point budget — the figure stays complete and merely
 * coarsens under a hostile slider combination.
 */
export function stepFor(detail: number, vMax: number, span: number, pointCap: number): number {
  let dt = detail / Math.max(1e-9, vMax);
  const estimate = span / dt;
  if (estimate > pointCap) dt = span / pointCap;
  return dt;
}

/**
 * Streaming decimation (Reumann–Witkam style): walk the polyline keeping an
 * anchor, drop every sample that stays within `tol` of the anchor's current
 * heading line. One pass, order preserved, endpoints kept exactly.
 */
export function decimate(points: Point[], tol: number): Point[] {
  if (tol <= 0 || points.length <= 2) return points;
  const out: Point[] = [points[0]];
  let a = points[0];
  let i = 1;
  while (i < points.length - 1) {
    const bx = points[i].x - a.x;
    const by = points[i].y - a.y;
    const len = Math.hypot(bx, by);
    if (len < 1e-12) {
      i++;
      continue;
    }
    const nx = -by / len;
    const ny = bx / len;
    let j = i + 1;
    while (j < points.length - 1) {
      const d = Math.abs((points[j].x - a.x) * nx + (points[j].y - a.y) * ny);
      if (d > tol) break;
      j++;
    }
    a = points[j - 1];
    out.push(a);
    i = j;
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail.x !== last.x || tail.y !== last.y) out.push(last);
  return out;
}
