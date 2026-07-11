import type { FlowLine, Point } from '../flow-lines.js';
import { pushRun } from '../planet/geometry.js';
import { type Vec3, TAU, cross, dot, norm, makeRotation } from '../planet/vec3.js';
import { clamp } from '../lib/math.js';

/**
 * Every ball is a unit sphere seen under orthographic projection: +z toward
 * the viewer, x/y the page. Seams are curves of unit vectors in the ball's
 * canonical frame; a per-ball rotation shows a different face of each ball,
 * and the z<=0 gate drops the back hemisphere so a seam vanishes exactly at
 * the silhouette — the planet generator's sample-and-emit pattern.
 */
export type RotFn = (v: Vec3) => Vec3;

export const IDENTITY_ROT: RotFn = (v) => v;

/** A fixed 3-axis rotation from the ball's rotation genome. `spin` scales the
 *  genome at replay time, so turning the knob re-orients every ball in place
 *  without re-rolling anyone's identity (spin 0 = canonical upright). */
export function makeBallRotation(rotG: readonly [number, number, number], spin: number): RotFn {
  if (spin <= 0) return IDENTITY_ROT;
  let k = 0;
  return makeRotation(() => rotG[k++ % 3] * spin);
}

/** Rotate, front-face-gate, and project a sphere curve onto the page. Runs
 *  are broken where the curve dips behind the silhouette (z <= 0). */
export function emitSphereCurve(
  out: FlowLine[],
  samples: readonly Vec3[],
  cx: number,
  cy: number,
  r: number,
  rot: RotFn,
  layer: string
): void {
  let run: Point[] = [];
  for (const s of samples) {
    const m = rot(s);
    if (m.z <= 0) {
      pushRun(out, run, layer);
      run = [];
    } else {
      run.push({ x: cx + r * m.x, y: cy + r * m.y });
    }
  }
  pushRun(out, run, layer);
}

/** Closed great circle spanned by two orthonormal vectors. */
export function greatCircle(u: Vec3, v: Vec3, n: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push({ x: u.x * c + v.x * s, y: u.y * c + v.y * s, z: u.z * c + v.z * s });
  }
  return pts;
}

/** Closed circle of constant colatitude about `axis` (colat 0 = the pole). */
export function smallCircle(axis: Vec3, colat: number, n: number): Vec3[] {
  const a = norm(axis);
  const ref: Vec3 = Math.abs(a.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = norm(cross(a, ref));
  const v = cross(a, u);
  const sc = Math.sin(colat);
  const cc = Math.cos(colat);
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const c = Math.cos(t) * sc;
    const s = Math.sin(t) * sc;
    pts.push({
      x: a.x * cc + u.x * c + v.x * s,
      y: a.y * cc + u.y * c + v.y * s,
      z: a.z * cc + u.z * c + v.z * s,
    });
  }
  return pts;
}

/** Shortest great-circle arc between two unit vectors, `n` segments. */
export function slerpArc(a: Vec3, b: Vec3, n: number): Vec3[] {
  const omega = Math.acos(clamp(dot(a, b), -1, 1));
  if (omega < 1e-6) return [a, b];
  const so = Math.sin(omega);
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w1 = Math.sin((1 - t) * omega) / so;
    const w2 = Math.sin(t * omega) / so;
    pts.push({ x: a.x * w1 + b.x * w2, y: a.y * w1 + b.y * w2, z: a.z * w1 + b.z * w2 });
  }
  return pts;
}
