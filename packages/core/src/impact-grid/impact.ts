import type { Point } from '../flow-lines.js';
import { clamp01 } from '../lib/math.js';
import { densify, smoothstep } from '../lib/spatial.js';

/** Nearest-point query result against the prepared impact path. */
export interface PathHit {
  /** Distance to the path, px. */
  d: number;
  /** Nearest point on the path. */
  qx: number;
  qy: number;
  /** Which side of the nearest segment the query point sits on (±1; +1 when
   *  the cross product of segment direction × offset is positive). Drives the
   *  brushed-past torque so squares rotate opposite ways across the path. */
  side: number;
}

export interface PathField {
  nearest(x: number, y: number): PathHit;
  falloff(d: number): number;
}

/** Longest segment list we'll query against — a slow careful drag can carry
 *  thousands of raw points; beyond this the extra resolution is invisible. */
const MAX_SEGMENTS = 512;

/**
 * Compile the drawn path into a queryable distance field. The raw drag points
 * are resampled to a density-independent polyline (drop near-duplicates, then
 * densify) so the output depends on the drawn *curve*, not on how fast the
 * pointer moved. Returns null when there's no usable path — the whole impact
 * stage is then skipped and the pristine grid renders byte-identical.
 */
export function preparePath(path: Point[] | undefined, radius: number): PathField | null {
  if (!path || path.length < 2) return null;
  const minStep = radius * 0.02;
  const thinned: Point[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = thinned[thinned.length - 1];
    if (Math.hypot(path[i].x - prev.x, path[i].y - prev.y) >= minStep) thinned.push(path[i]);
  }
  if (thinned.length < 2) return null;
  let pts = densify(thinned, minStep * 2);
  if (pts.length - 1 > MAX_SEGMENTS) {
    const stride = Math.ceil((pts.length - 1) / MAX_SEGMENTS);
    const strided: Point[] = [];
    for (let i = 0; i < pts.length; i += stride) strided.push(pts[i]);
    if (strided[strided.length - 1] !== pts[pts.length - 1]) strided.push(pts[pts.length - 1]);
    pts = strided;
  }

  const nearest = (x: number, y: number): PathHit => {
    let best = Infinity;
    let bqx = pts[0].x;
    let bqy = pts[0].y;
    let bside = 1;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x;
      const ay = pts[i - 1].y;
      const dx = pts[i].x - ax;
      const dy = pts[i].y - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + t * dx;
      const qy = ay + t * dy;
      const dist2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
      if (dist2 < best) {
        best = dist2;
        bqx = qx;
        bqy = qy;
        bside = dx * (y - ay) - dy * (x - ax) >= 0 ? 1 : -1;
      }
    }
    return { d: Math.sqrt(best), qx: bqx, qy: bqy, side: bside };
  };

  return { nearest, falloff: (d) => smoothstep(clamp01(1 - d / radius)) };
}

/** Everything the render stage needs to know about one square's impact
 *  response. `f` is the smoothstep falloff at the centre (0 = untouched). */
export interface SquareResponse {
  f: number;
  /** Unit push direction, radially away from the nearest path point. */
  ux: number;
  uy: number;
  /** Centre displacement. */
  dx: number;
  dy: number;
  /** Rotation added to the resting angle, radians. */
  theta: number;
  /** Side-length scale (compression near the blow). */
  scale: number;
  shattered: boolean;
}

const UNTOUCHED: SquareResponse = {
  f: 0,
  ux: 0,
  uy: 0,
  dx: 0,
  dy: 0,
  theta: 0,
  scale: 1,
  shattered: false,
};

/**
 * The per-square impact model, evaluated once at the square's centre:
 * quadratic-falloff push away from the path (the far field barely stirs),
 * a side-signed torque as if the impact brushed past, compression near the
 * blow, and a soft probabilistic shatter gate — no visible ring where
 * shattering starts.
 */
export function squareResponse(
  field: PathField,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  shatter: number,
  rng: () => number
): SquareResponse {
  const hit = field.nearest(cx, cy);
  if (hit.d >= radius) return UNTOUCHED;
  const f = field.falloff(hit.d);
  let ux: number;
  let uy: number;
  if (hit.d > 1e-6) {
    ux = (cx - hit.qx) / hit.d;
    uy = (cy - hit.qy) / hit.d;
  } else {
    const a = rng() * Math.PI * 2;
    ux = Math.cos(a);
    uy = Math.sin(a);
  }
  const push = strength * 0.5 * radius * f * f;
  const theta =
    hit.side * strength * (35 * Math.PI / 180) * f + (2 * rng() - 1) * (10 * Math.PI / 180) * f;
  const shatterRadius = radius * (0.2 + 0.5 * shatter);
  const shattered =
    hit.d < shatterRadius && rng() < shatter * smoothstep(1 - hit.d / shatterRadius);
  return {
    f,
    ux,
    uy,
    dx: push * ux,
    dy: push * uy,
    theta,
    scale: 1 - 0.35 * strength * f,
    shattered,
  };
}
