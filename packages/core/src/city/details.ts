import { FlowLine, Point } from '../flow-lines.js';
import { pushRun } from '../landscape/hatching.js';
import type { BuildingSpec, TierSpec } from './layout.js';
import type { RoofSpec } from './roof.js';
import { bodyPoint, type Proj, type Spine } from './project.js';

/**
 * Style-specific architectural details — chimneys, colonnades, cornices,
 * stoops. Each is a handful of restrained single-pen strokes hung off the
 * same projection machinery as everything else (`bodyPoint` / `Face.at`), so
 * details lean and bend with their building.
 */

/** Sample a straight world segment through the spine. */
function seg(
  out: FlowLine[],
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  a: { u: number; v: number; z: number },
  c: { u: number; v: number; z: number },
  n: number,
  layer: string
): void {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(
      bodyPoint(
        pr,
        b,
        spine,
        a.u + ((c.u - a.u) * i) / n,
        a.v + ((c.v - a.v) * i) / n,
        a.z + ((c.z - a.z) * i) / n
      )
    );
  }
  pushRun(out, pts, layer);
}

/**
 * A small chimney astride a gable ridge: a box that first occludes the ridge
 * line behind it, then draws its three visible verticals, the two near top
 * edges and one cap tick. Skipped when the pen couldn't resolve it.
 */
export function emitChimney(
  out: FlowLine[],
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  roof: RoofSpec,
  t: number,
  occlude: (ring: Point[]) => void
): void {
  const alongU = roof.ridgeAxis === 'u';
  const a0 = alongU ? tier.u0 : tier.v0;
  const a1 = alongU ? tier.u1 : tier.v1;
  const p0 = alongU ? tier.v0 : tier.u0;
  const p1 = alongU ? tier.v1 : tier.u1;
  const pm = (p0 + p1) / 2;
  const zR = tier.z1 + roof.rise;

  const cw = Math.min(0.5 * b.storey, 0.22 * (a1 - a0));
  if (cw < 1.8) return; // sub-pen chimneys read as dirt
  const ch = Math.max(2.2, 0.55 * b.storey);
  const ac = a0 + (0.2 + 0.6 * t) * (a1 - a0);
  const zT = zR + ch;
  // Where the chimney's near face meets the visible slope.
  const slope = roof.rise / Math.max(1e-6, (p1 - p0) / 2);
  const zNear = zR - (cw / 2) * slope;

  // Box corners in world (u, v) via the axis map.
  const P = (a: number, p: number, z: number): { u: number; v: number; z: number } =>
    alongU ? { u: a, v: p, z } : { u: p, v: a, z };
  const aL = ac - cw / 2;
  const aR = ac + cw / 2;
  const pN = pm + cw / 2; // near-slope side (+v for a 'u' ridge, +u for 'v')
  const pF = pm - cw / 2;

  // Occlusion: the chimney's box hexagon, dipped below the ridge so the
  // ridge line is erased where it passes behind.
  const zLow = zNear - 0.5;
  const bp = (a: number, p: number, z: number): Point => {
    const q = P(a, p, z);
    return bodyPoint(pr, b, spine, q.u, q.v, q.z);
  };
  const ring: Point[] = alongU
    ? [bp(aR, pN, zLow), bp(aL, pN, zLow), bp(aL, pN, zT), bp(aL, pF, zT), bp(aR, pF, zT), bp(aR, pF, zLow)]
    : [bp(aR, pN, zLow), bp(aR, pF, zLow), bp(aR, pF, zT), bp(aL, pF, zT), bp(aL, pN, zT), bp(aL, pN, zLow)];
  occlude(ring);

  // Three visible verticals: the two near-slope corners rise from the roof
  // surface, the far corner appears from behind the ridge.
  // (The visible-corner set maps to the same (a, p) pairs for either axis.)
  seg(out, pr, b, spine, P(aL, pN, zNear), P(aL, pN, zT), 2, 'roof');
  seg(out, pr, b, spine, P(aR, pN, zNear), P(aR, pN, zT), 2, 'roof');
  seg(out, pr, b, spine, P(aR, pF, zR), P(aR, pF, zT), 2, 'roof');
  // Near top edges + one cap tick.
  seg(out, pr, b, spine, P(aL, pN, zT), P(aR, pN, zT), 2, 'roof');
  seg(out, pr, b, spine, P(aR, pN, zT), P(aR, pF, zT), 2, 'roof');
  seg(out, pr, b, spine, P(aL + 0.25 * cw, pm, zT), P(aR - 0.25 * cw, pm, zT), 2, 'roof');
}
