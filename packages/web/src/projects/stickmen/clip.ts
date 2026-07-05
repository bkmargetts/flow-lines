import type { FlowLine, Point } from '@flow-lines/core';

/**
 * Clip a polyline to an axis-aligned rectangle, returning the inside runs
 * (Cohen–Sutherland per segment, stitched into continuous runs). The core
 * generator deliberately leaves the crowd unclipped so the web zoom-out can
 * pull off-page figures into view; this runs AFTER the zoom transform to keep
 * the page — and the exported plot — inside the sheet at every zoom level.
 *
 * A local copy because the core's `clipPolylineToRect` is intentionally not on
 * the package barrel (see CLAUDE.md).
 */

const INSIDE = 0;
const LEFT = 1;
const RIGHT = 2;
const BOTTOM = 4;
const TOP = 8;

function code(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  let c = INSIDE;
  if (x < x0) c |= LEFT;
  else if (x > x1) c |= RIGHT;
  if (y < y0) c |= BOTTOM;
  else if (y > y1) c |= TOP;
  return c;
}

/** Clip a single segment; returns the inside portion or null. */
function clipSegment(
  a: Point,
  b: Point,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [Point, Point] | null {
  let ax = a.x;
  let ay = a.y;
  let bx = b.x;
  let by = b.y;
  let ca = code(ax, ay, x0, y0, x1, y1);
  let cb = code(bx, by, x0, y0, x1, y1);
  for (;;) {
    if (!(ca | cb)) return [{ x: ax, y: ay }, { x: bx, y: by }]; // both inside
    if (ca & cb) return null; // trivially outside
    const out = ca || cb;
    let x = 0;
    let y = 0;
    if (out & TOP) {
      x = ax + ((bx - ax) * (y1 - ay)) / (by - ay);
      y = y1;
    } else if (out & BOTTOM) {
      x = ax + ((bx - ax) * (y0 - ay)) / (by - ay);
      y = y0;
    } else if (out & RIGHT) {
      y = ay + ((by - ay) * (x1 - ax)) / (bx - ax);
      x = x1;
    } else {
      y = ay + ((by - ay) * (x0 - ax)) / (bx - ax);
      x = x0;
    }
    if (out === ca) {
      ax = x;
      ay = y;
      ca = code(ax, ay, x0, y0, x1, y1);
    } else {
      bx = x;
      by = y;
      cb = code(bx, by, x0, y0, x1, y1);
    }
  }
}

/** Clip a polyline to the rect, returning continuous inside runs as points. */
export function clipPolylineToRect(
  pts: Point[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Point[][] {
  if (pts.length < 2) return [];
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (let i = 1; i < pts.length; i++) {
    const seg = clipSegment(pts[i - 1], pts[i], x0, y0, x1, y1);
    if (!seg) {
      if (run.length >= 2) runs.push(run);
      run = [];
      continue;
    }
    const [s, e] = seg;
    if (run.length === 0) run.push(s);
    else if (run[run.length - 1].x !== s.x || run[run.length - 1].y !== s.y) {
      // The previous segment was clipped away or exited; start a fresh run.
      if (run.length >= 2) runs.push(run);
      run = [s];
    }
    run.push(e);
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

/** Clip every line in a layer to the rect, dropping empties. */
export function clipLinesToRect(
  lines: FlowLine[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): FlowLine[] {
  const out: FlowLine[] = [];
  for (const ln of lines) {
    for (const run of clipPolylineToRect(ln.points, x0, y0, x1, y1)) {
      out.push({ ...ln, points: run });
    }
  }
  return out;
}
