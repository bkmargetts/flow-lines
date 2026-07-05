import { FlowLine, Point } from '../flow-lines.js';
import { pushRun } from '../landscape/hatching.js';
import type { BuildingSpec, TierSpec } from './layout.js';
import type { RoofSpec } from './roof.js';
import { bodyPoint, type Face, type Proj, type Spine } from './project.js';
import { emitFaceStroke, type FaceCraft } from './facade.js';

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

/** A horizontal face-space stroke across the full face width at height z. */
function faceLine(out: FlowLine[], face: Face, craft: FaceCraft, z: number, inset: number, layer: string): void {
  const pts: Point[] = [];
  for (let i = 0; i <= 3; i++) {
    pts.push(face.at(inset + ((face.W - 2 * inset) * i) / 3, z));
  }
  emitFaceStroke(out, pts, layer, craft);
}

/**
 * A cornice band under the roof line: one or two horizontal strokes across
 * the face. Double is the brownstone/entablature look.
 */
export function emitCornice(
  out: FlowLine[],
  face: Face,
  craft: FaceCraft,
  o: { drop: number; double: boolean }
): void {
  if (face.W < 6) return;
  faceLine(out, face, craft, face.z1 - o.drop, 1, 'roof');
  if (o.double) faceLine(out, face, craft, face.z1 - o.drop * 0.55, 1, 'roof');
}

/**
 * A classical colonnade across one face: an entablature band and a row of
 * evenly pitched columns, each a pair of verticals with a base tick — the
 * Greek-villa portico. Column strokes spend the shared window budget (they
 * are the facade's marks, windows' peers).
 */
export function emitColonnade(
  out: FlowLine[],
  face: Face,
  craft: FaceCraft,
  o: { pitch: number; capDrop: number; inset: number; budget: { left: number } }
): void {
  const usable = face.W - 2 * o.inset;
  const H = face.z1 - face.z0;
  const n = Math.floor(usable / o.pitch);
  if (n < 2 || face.W < 10 || H < 3.5) return;
  const zTop = face.z1 - o.capDrop;
  const zBase = face.z0 + 0.06 * H;
  if (zTop - zBase < 2.5) return;
  // Entablature: the double band the columns carry.
  faceLine(out, face, craft, face.z1 - o.capDrop, o.inset * 0.5, 'roof');
  faceLine(out, face, craft, face.z1 - o.capDrop * 0.55, o.inset * 0.5, 'roof');
  const pitchC = usable / n;
  const colW = Math.max(1.2, 0.18 * pitchC);
  const paired = pitchC >= 3.5;
  for (let k = 0; k <= n; k++) {
    if (o.budget.left <= 0) return;
    const s = o.inset + k * pitchC;
    const col = (sc: number): void => {
      const pts: Point[] = [];
      for (let i = 0; i <= 3; i++) pts.push(face.at(sc, zBase + ((zTop - zBase) * i) / 3));
      emitFaceStroke(out, pts, 'window', craft);
      o.budget.left--;
    };
    if (paired) {
      col(s - colW / 2);
      col(s + colW / 2);
    } else {
      col(s);
    }
    // Base tick — the plinth.
    const pts: Point[] = [face.at(s - colW, zBase), face.at(s + colW, zBase)];
    pushRun(out, pts, 'window');
    o.budget.left--;
  }
}

/**
 * A brownstone stoop: a door (two verticals + lintel) on the visible face
 * plus two step strokes on the ground in front of it.
 */
export function emitStoop(
  out: FlowLine[],
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  side: 'left' | 'right',
  craft: FaceCraft,
  o: { doorT: number }
): void {
  const { u0, u1, v0, v1 } = tier;
  const W = side === 'left' ? u1 - u0 : v1 - v0;
  const doorW = Math.min(0.55 * b.storey, 0.22 * W);
  if (doorW < 1.6) return;
  const doorH = 0.85 * b.storey;
  const cT = 0.2 + 0.6 * o.doorT;
  // World-space anchor: on the v1 plane for the left face, u1 for the right.
  const at = (s: number, z: number, offOut = 0): Point =>
    side === 'left'
      ? bodyPoint(pr, b, spine, u1 - cT * W + s, v1 + offOut, z)
      : bodyPoint(pr, b, spine, u1 + offOut, v1 - cT * W + s, z);
  const line = (pts: Point[], layer: string): void => pushRun(out, pts, layer);
  // Door: jambs + lintel.
  line([at(-doorW / 2, 0), at(-doorW / 2, doorH)], 'window');
  line([at(doorW / 2, 0), at(doorW / 2, doorH)], 'window');
  line([at(-doorW / 2, doorH), at(doorW / 2, doorH)], 'window');
  // Steps: two short ground strokes stepping out from the door.
  line([at(-doorW * 0.75, 0, 1.1), at(doorW * 0.75, 0, 1.1)], 'edge');
  line([at(-doorW * 0.95, 0, 2.2), at(doorW * 0.95, 0, 2.2)], 'edge');
}
