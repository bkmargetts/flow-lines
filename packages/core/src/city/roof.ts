import type { Point } from '../flow-lines.js';
import type { FlowLine } from '../flow-lines.js';
import { pushRun } from '../landscape/hatching.js';
import type { BuildingSpec, TierSpec } from './layout.js';
import { bodyPoint, type Proj, type Silhouette, type Spine } from './project.js';

/**
 * Roof geometry beyond the flat parapet box: a roof is a cap *above* the top
 * tier — `tiers[top].z1` is the eave, `rise` lifts the ridge, and `b.h`
 * includes the rise so the spine's t = z/h normalisation reaches 1 at the
 * ridge and a leaning house gets a genuinely bent ridge line for free.
 */

export interface RoofSpec {
  kind: 'flat' | 'gable';
  /** Ridge direction: 'u' = ridge runs along u at v-mid, 'v' = along v at u-mid. */
  ridgeAxis: 'u' | 'v';
  /** Ridge height above the eave (world px). 0 for flat. */
  rise: number;
}

export function flatRoof(): RoofSpec {
  return { kind: 'flat', ridgeAxis: 'u', rise: 0 };
}

interface P3 {
  u: number;
  v: number;
  z: number;
}

/** The 10 vertices of a gabled box: 4 base, 4 eave, 2 ridge ends. */
function gableVertices(tier: TierSpec, roof: RoofSpec): P3[] {
  const { u0, u1, v0, v1, z0, z1 } = tier;
  const zR = z1 + roof.rise;
  const pts: P3[] = [
    { u: u0, v: v0, z: z0 },
    { u: u1, v: v0, z: z0 },
    { u: u1, v: v1, z: z0 },
    { u: u0, v: v1, z: z0 },
    { u: u0, v: v0, z: z1 },
    { u: u1, v: v0, z: z1 },
    { u: u1, v: v1, z: z1 },
    { u: u0, v: v1, z: z1 },
  ];
  if (roof.ridgeAxis === 'u') {
    const vm = (v0 + v1) / 2;
    pts.push({ u: u0, v: vm, z: zR }, { u: u1, v: vm, z: zR });
  } else {
    const um = (u0 + u1) / 2;
    pts.push({ u: um, v: v0, z: zR }, { u: um, v: v1, z: zR });
  }
  return pts;
}

/** Monotone-chain convex hull, returning input indices in hull order.
 *  Collinear points are dropped — the hull stays minimal. */
function hullIndices(pts: Point[]): number[] {
  const idx = pts.map((_, i) => i).sort((a, b) => pts[a].x - pts[b].x || pts[a].y - pts[b].y);
  const cross = (o: Point, a: Point, b: Point): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: number[] = [];
  for (const i of idx) {
    while (lower.length >= 2 && cross(pts[lower[lower.length - 2]], pts[lower[lower.length - 1]], pts[i]) <= 0) {
      lower.pop();
    }
    lower.push(i);
  }
  const upper: number[] = [];
  for (let k = idx.length - 1; k >= 0; k--) {
    const i = idx[k];
    while (upper.length >= 2 && cross(pts[upper[upper.length - 2]], pts[upper[upper.length - 1]], pts[i]) <= 0) {
      upper.pop();
    }
    upper.push(i);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * The projected outline of a gabled top tier. A gabled box is convex, so its
 * silhouette is the convex hull of its 10 projected vertices — one
 * implementation covers both ridge axes and any pitch (a steep ridge that
 * clears the far eave and a shallow one that hides behind it swap which
 * edges are on the outline; the hull gets both right). Each hull edge is
 * then re-sampled in world space through the spine, so a leaning house's
 * silhouette genuinely bends, exactly like `tierSilhouette`.
 */
export function gableSilhouette(
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  roof: RoofSpec
): Silhouette {
  const verts = gableVertices(tier, roof);
  const proj = verts.map((p) => bodyPoint(pr, b, spine, p.u, p.v, p.z));
  const hull = hullIndices(proj);
  const ring: Point[] = [];
  const corners: number[] = [];
  for (let e = 0; e <= hull.length; e++) {
    const a = verts[hull[e % hull.length]];
    corners.push(ring.length);
    if (e === hull.length) {
      ring.push(bodyPoint(pr, b, spine, a.u, a.v, a.z));
      break;
    }
    const c = verts[hull[(e + 1) % hull.length]];
    // Verticals and slope edges bend with the spine (z varies) — sample them;
    // constant-z edges project straight, one segment is exact.
    const n = a.z === c.z ? 1 : 8;
    for (let i = 0; i < n; i++) {
      ring.push(
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
  }
  return { ring, corners };
}

/**
 * The visible interior fold lines of a gable roof, as fine 'roof' strokes:
 * the ridge, the near eave (where the near slope meets the long facade), the
 * near gable-end edge, and — when the pitch is shallow enough that the far
 * slope shows — the far gable-end edge. Outline edges are the silhouette
 * ring's job; these are only the folds inside it.
 */
export function emitGableEdges(
  out: FlowLine[],
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  roof: RoofSpec
): void {
  const { u0, u1, v0, v1, z1 } = tier;
  const zR = z1 + roof.rise;
  const seg = (a: P3, c: P3, n: number): void => {
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
    pushRun(out, pts, 'roof');
  };
  if (roof.ridgeAxis === 'u') {
    const vm = (v0 + v1) / 2;
    // Shallow pitch: the far slope is visible, the ridge sits inside the
    // outline and the visible gable end shows both of its slope edges.
    const shallow = roof.rise < (v1 - v0) / 2;
    if (shallow) seg({ u: u0, v: vm, z: zR }, { u: u1, v: vm, z: zR }, 6); // ridge
    seg({ u: u0, v: v1, z: z1 }, { u: u1, v: v1, z: z1 }, 4); // near eave
    seg({ u: u1, v: v1, z: z1 }, { u: u1, v: vm, z: zR }, 4); // near end edge
    if (shallow) seg({ u: u1, v: vm, z: zR }, { u: u1, v: v0, z: z1 }, 4); // far end edge
  } else {
    const um = (u0 + u1) / 2;
    const shallow = roof.rise < (u1 - u0) / 2;
    if (shallow) seg({ u: um, v: v0, z: zR }, { u: um, v: v1, z: zR }, 6); // ridge
    seg({ u: u1, v: v0, z: z1 }, { u: u1, v: v1, z: z1 }, 4); // near eave
    seg({ u: u1, v: v1, z: z1 }, { u: um, v: v1, z: zR }, 4); // near end edge
    if (shallow) seg({ u: um, v: v1, z: zR }, { u: u0, v: v1, z: z1 }, 4); // far end edge
  }
}
