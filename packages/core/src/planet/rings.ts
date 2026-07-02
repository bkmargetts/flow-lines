import { Point } from '../flow-lines.js';
import { type Vec3, TAU, DEG, dot } from './vec3.js';
import { pushRun } from './geometry.js';
import type { SceneCtx } from './context.js';

/** Tilted ring system around a body at (rcx, rcy) of disk radius rR, lit by rL;
 *  occluded behind the sphere (a spheroid squashed by `ky`) and cut by the
 *  planet's shadow — an elliptic cylinder under parallel light. */
export function renderRings(scene: SceneCtx, rcx: number, rcy: number, rR: number, rL: Vec3, ky = 1): void {
  const { o, lines } = scene;
  const tau = o.ringTilt * DEG; // opening angle from edge-on
  const sinTau = Math.sin(tau);
  const cosTau = Math.cos(tau);
  const yaw = o.ringYaw * DEG;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const inner = o.ringInner * rR;
  const outer = o.ringOuter * rR;
  const span = Math.max(1, outer - inner);
  const gapStart = inner + span * (0.5 - o.ringGap / 2);
  const gapEnd = inner + span * (0.5 + o.ringGap / 2);
  const N = 540;
  const traceRing = (rr: number): void => {
    let run: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU;
      const ex = rr * Math.cos(th);
      const ey = rr * Math.sin(th) * sinTau; // foreshortened minor axis
      const ez = rr * Math.sin(th) * cosTau; // depth toward the viewer
      const px = ex * cosYaw - ey * sinYaw;
      const py = ex * sinYaw + ey * cosYaw;
      const sx = rcx + px;
      const sy = rcy + py;
      const pyk = py / ky;
      const rd2 = px * px + pyk * pyk;
      let hidden = rd2 < rR * rR && ez < Math.sqrt(rR * rR - rd2);
      if (!hidden && o.ringShadow) {
        const p: Vec3 = { x: px, y: py, z: ez };
        const d = dot(p, rL);
        if (d < 0) {
          const qx = p.x - d * rL.x;
          const qy = (p.y - d * rL.y) / ky;
          const qz = p.z - d * rL.z;
          if (qx * qx + qy * qy + qz * qz < rR * rR) hidden = true;
        }
      }
      if (hidden) {
        pushRun(lines, run, 'ring');
        run = [];
        continue;
      }
      run.push({ x: sx, y: sy });
    }
    pushRun(lines, run, 'ring');
  };
  const sub = Math.max(1, Math.round(o.ringDensity));
  const subSpacing = Math.max(1.2, o.penWidth * 1.6);
  for (let bandi = 0; bandi < o.ringCount; bandi++) {
    const rrC = inner + (span * (bandi + 0.5)) / o.ringCount;
    if (o.ringGap > 0 && rrC >= gapStart && rrC <= gapEnd) continue; // Cassini gap
    const subN = Math.max(1, Math.round(sub * (1.35 - 0.6 * (bandi / o.ringCount))));
    for (let k = 0; k < subN; k++) {
      const rr = rrC + (k - (subN - 1) / 2) * subSpacing;
      traceRing(rr);
    }
  }
}
