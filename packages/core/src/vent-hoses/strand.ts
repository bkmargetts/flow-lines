import type { Point } from '../flow-lines.js';
import { normalsOf } from '../lib/spatial.js';

/**
 * Open-path strand plumbing. The ribbons module's `Strand` is closed-loop
 * (wrap-aware sampling, circular arc deltas); a vent hose is an open run with
 * two real ends, so everything here clamps instead of wrapping. Each strand
 * also carries its own tube radius — hoses come in mixed diameters, which is
 * what forces every downstream threshold to be per-pair rather than the
 * ribbons module's single global band width.
 */

export interface HoseStrand {
  /** Densified centerline; open — the ends are real hose ends. */
  pts: Point[];
  /** Unit normals per point (clamped central differences). */
  normals: Point[];
  /** Cumulative arc length per point; arc[0] = 0. */
  arc: number[];
  /** Total length (= arc of the last point; no closing segment). */
  len: number;
  /** Tube radius, px. */
  r: number;
}

export function finalizeOpen(pts: Point[], r: number): HoseStrand {
  const n = pts.length;
  const arc: number[] = new Array(n);
  arc[0] = 0;
  for (let i = 1; i < n; i++) {
    arc[i] = arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return { pts, normals: normalsOf(pts), arc, len: arc[n - 1], r };
}

export interface StrandSample {
  p: Point;
  n: Point;
  t: Point;
  /** Index of the segment the sample falls in. */
  i: number;
}

/** Interpolated point / normal / tangent at arc position `a` (clamped to the
 *  open run — no wrap). */
export function sampleAtOpen(s: HoseStrand, a: number): StrandSample {
  const n = s.pts.length;
  const arc = Math.max(0, Math.min(s.len, a));
  // Binary search for the last index with arc[i] <= arc.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.arc[mid] <= arc) lo = mid;
    else hi = mid - 1;
  }
  const i = Math.min(lo, n - 2);
  const p0 = s.pts[i];
  const p1 = s.pts[i + 1];
  const segLen = s.arc[i + 1] - s.arc[i];
  const t = segLen > 1e-9 ? Math.min(1, (arc - s.arc[i]) / segLen) : 0;
  const n0 = s.normals[i];
  const n1 = s.normals[i + 1];
  let nx = n0.x + (n1.x - n0.x) * t;
  let ny = n0.y + (n1.y - n0.y) * t;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const tx = p1.x - p0.x;
  const ty = p1.y - p0.y;
  const tl = Math.hypot(tx, ty) || 1;
  return {
    p: { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t },
    n: { x: nx, y: ny },
    t: { x: tx / tl, y: ty / tl },
    i,
  };
}
