import { Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import type { Morph } from './morph.js';
import type { BuildingSpec, TierSpec } from './layout.js';

/**
 * The axonometric world: buildings live on a ground plane in world units
 * (u, v) with height z, all in page px. Classic 2:1 pixel-iso — clean plotter
 * geometry, trivial math, and (with y down) larger u+v lands lower on the
 * page, i.e. nearer the viewer. Every drawn point of a building — edges,
 * window corners, hatch strokes — routes through one `facePoint`-style
 * mapping that adds the building's spine (lean + bow) at that height, so
 * marks bend with a leaning tower for free. That single choke point is the
 * craft difference between "curved boxes" and a drawn city.
 */

export const KX = 1;
export const KY = 0.5;

/** Page-space placement of the projected world (set by the fit pass). */
export interface Proj {
  offX: number;
  offY: number;
}

export function project(pr: Proj, u: number, v: number, z: number): Point {
  return { x: pr.offX + (u - v) * KX, y: pr.offY + (u + v) * KY - z };
}

/** World-space centreline offset at height fraction t ∈ [0,1]: a linear lean
 *  plus a t² bow, both fixed per-building draws scaled by the morph. At
 *  order = 1 the spine is identically zero — a perfect prism. */
export type Spine = (t: number) => { du: number; dv: number };

export function makeSpine(b: BuildingSpec, morph: Morph, leanMul = 1, bendMul = 1): Spine {
  const leanA = morph.leanFrac * b.h * leanMul;
  const bendA = morph.bendFrac * b.h * bendMul;
  return (t: number) => ({
    du: b.leanU * leanA * t + b.bendU * bendA * t * t,
    dv: b.leanV * leanA * t + b.bendV * bendA * t * t,
  });
}

/** Project a world point of building `b`, bending it through the spine. */
export function bodyPoint(pr: Proj, b: BuildingSpec, spine: Spine, u: number, v: number, z: number): Point {
  const t = b.h > 0 ? Math.max(0, Math.min(1, z / b.h)) : 0;
  const s = spine(t);
  return project(pr, u + s.du, v + s.dv, z);
}

/**
 * A drawable face in its own 2D coordinates: `s` along the base edge (0 at
 * the near corner), `z` up from the ground. `at` maps face space to page
 * space through the spine, so facade marks (windows, hatch) foreshorten and
 * bend with the building without knowing anything about it.
 */
export interface Face {
  /** Face width in world px. */
  W: number;
  /** Bottom and top of this face's tier (world z). */
  z0: number;
  z1: number;
  at(s: number, z: number): Point;
}

/** The two visible side faces of a tier. With light from the left the left
 *  face is lit (windows) and the right face is the shadow face (hatch). */
export function tierFaces(pr: Proj, b: BuildingSpec, spine: Spine, tier: TierSpec): { left: Face; right: Face } {
  const { u0, u1, v0, v1, z0, z1 } = tier;
  return {
    // v = v1 plane, from the near corner (u1, v1) leftward.
    left: {
      W: u1 - u0,
      z0,
      z1,
      at: (s, z) => bodyPoint(pr, b, spine, u1 - s, v1, z),
    },
    // u = u1 plane, from the near corner (u1, v1) rightward.
    right: {
      W: v1 - v0,
      z0,
      z1,
      at: (s, z) => bodyPoint(pr, b, spine, u1, v1 - s, z),
    },
  };
}

/** Sampled roof-wave height offset — the wavy parapet of the flow end. Keyed
 *  on world position + a per-building phase so no two roofs share a wave. */
export function roofWave(noise: SimplexNoise, b: BuildingSpec, amp: number, u: number, v: number): number {
  if (amp <= 0) return 0;
  // Low frequency: a parapet undulates in two or three swells, it doesn't
  // shred — high-frequency wave reads as torn paper.
  return amp * noise.noise2D(u * 0.045 + b.wavePhase * 37.7, v * 0.045 - b.wavePhase * 61.3);
}

/**
 * The projected outline of one tier box — the occlusion mass and the bold
 * silhouette contour. An iso box outline is a hexagon: base near corner,
 * base-left, up the left outer vertical, across the two far roof edges, down
 * the right outer vertical, back along the base. Verticals are sampled
 * through the spine so a bowed tower's silhouette is genuinely curved, and
 * the roof edges carry the parapet wave.
 */
export interface Silhouette {
  ring: Point[];
  /** Indices of the ring's true corners (base and roof), so contour emission
   *  can keep them sharp through the SVG writer's short-segment smoothing. */
  corners: number[];
}

export function tierSilhouette(
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  noise: SimplexNoise,
  waveAmp: number
): Silhouette {
  const { u0, u1, v0, v1, z0, z1 } = tier;
  const pts: Point[] = [];
  const VS = 8; // vertical samples — enough to capture the bow
  const RS = 10; // roof-edge samples — enough to keep the wave smooth
  const top = (u: number, v: number): number => z1 + roofWave(noise, b, waveAmp, u, v);

  // Base: near corner → left base corner.
  pts.push(bodyPoint(pr, b, spine, u1, v1, z0));
  pts.push(bodyPoint(pr, b, spine, u0, v1, z0));
  // Up the left outer vertical (u0, v1).
  for (let i = 1; i <= VS; i++) {
    const z = z0 + ((z1 - z0) * i) / VS;
    pts.push(bodyPoint(pr, b, spine, u0, v1, Math.min(z, top(u0, v1))));
  }
  // Far roof edge along v: (u0, v1) → (u0, v0).
  for (let i = 1; i <= RS; i++) {
    const v = v1 + ((v0 - v1) * i) / RS;
    pts.push(bodyPoint(pr, b, spine, u0, v, top(u0, v)));
  }
  // Far roof edge along u: (u0, v0) → (u1, v0).
  for (let i = 1; i <= RS; i++) {
    const u = u0 + ((u1 - u0) * i) / RS;
    pts.push(bodyPoint(pr, b, spine, u, v0, top(u, v0)));
  }
  // Down the right outer vertical (u1, v0).
  for (let i = 1; i <= VS; i++) {
    const z = z1 - ((z1 - z0) * i) / VS;
    pts.push(bodyPoint(pr, b, spine, u1, v0, Math.min(Math.max(z, z0), top(u1, v0))));
  }
  // Base: right base corner → near corner (closes implicitly).
  pts.push(bodyPoint(pr, b, spine, u1, v1, z0));
  return {
    ring: pts,
    corners: [0, 1, 1 + VS, 1 + VS + RS, 1 + VS + 2 * RS, 1 + 2 * VS + 2 * RS, pts.length - 1],
  };
}
