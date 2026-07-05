import { clamp } from '../lib/math.js';

/**
 * Pose resolution. A pose is the set of joint angles (radians) that
 * `skeleton.ts` turns into joint positions. v1 is fully procedural: every
 * angle is drawn from the figure's genome within a natural range, scaled by a
 * `poseEnergy` knob (0 = calm standing, 1 = lively crowd).
 *
 * The seam for later: `resolvePose` is the only place poses are decided, so a
 * named-pose library ('standing' | 'walking' | 'waving' | …) or a blend of
 * procedural + library can be added behind the `PoseMode` type without
 * touching callers. The genome slice it consumes is fixed-length and read in a
 * fixed order — reordering would break the golden hashes.
 */

// future: 'library' picks from a POSES table, 'mixed' blends the two.
export type PoseMode = 'procedural';

export interface PoseAngles {
  hipSwingL: number;
  hipSwingR: number;
  hipSplayL: number;
  hipSplayR: number;
  kneeFlexL: number;
  kneeFlexR: number;
  shoulderSwingL: number;
  shoulderSwingR: number;
  shoulderAbductL: number;
  shoulderAbductR: number;
  elbowFlexL: number;
  elbowFlexR: number;
  torsoLean: number;
}

/** How many genome draws `resolvePose` consumes. Fixed — never reorder. */
export const POSE_DRAWS = 13;

export interface PoseOpts {
  poseEnergy: number;
  mode?: PoseMode;
}

/** Map a draw d∈[0,1) to `center + (d*2-1)*range*energy`, then clamp. */
function ang(d: number, center: number, range: number, energy: number, lo: number, hi: number): number {
  return clamp(center + (d * 2 - 1) * range * energy, lo, hi);
}

/** One-sided draw d∈[0,1) → `base + d*range*energy`, clamped ≥0 (knees/elbows
 *  only fold one way; arms only abduct outward). */
function bend(d: number, base: number, range: number, energy: number, hi: number): number {
  return clamp(base + d * range * energy, 0, hi);
}

/**
 * Resolve a pose from a fixed-length genome slice (`g.length === POSE_DRAWS`).
 * Each side is drawn independently, so the crowd reads as many different
 * attitudes rather than mirror-symmetric mannequins.
 */
export function resolvePose(g: number[], opts: PoseOpts): PoseAngles {
  const e = clamp(opts.poseEnergy, 0, 1);
  return {
    hipSwingL: ang(g[0], 0, 0.55, e, -0.9, 0.9),
    hipSwingR: ang(g[1], 0, 0.55, e, -0.9, 0.9),
    hipSplayL: ang(g[2], 0.07, 0.14, e, -0.05, 0.4),
    hipSplayR: ang(g[3], 0.07, 0.14, e, -0.05, 0.4),
    kneeFlexL: bend(g[4], 0.1, 0.75, e, 1.7),
    kneeFlexR: bend(g[5], 0.1, 0.75, e, 1.7),
    shoulderSwingL: ang(g[6], 0, 0.6, e, -1.1, 1.1),
    shoulderSwingR: ang(g[7], 0, 0.6, e, -1.1, 1.1),
    shoulderAbductL: bend(g[8], 0.12, 1.5, e, 2.7),
    shoulderAbductR: bend(g[9], 0.12, 1.5, e, 2.7),
    elbowFlexL: bend(g[10], 0.15, 1.0, e, 2.2),
    elbowFlexR: bend(g[11], 0.15, 1.0, e, 2.2),
    torsoLean: ang(g[12], 0, 0.22, e, -0.3, 0.35),
  };
}
