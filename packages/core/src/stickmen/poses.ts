import { clamp } from '../lib/math.js';

/**
 * Pose resolution. A pose is the set of joint angles (radians) that
 * `skeleton.ts` turns into joint positions. Three modes:
 *
 * - `procedural` — every angle drawn independently from the figure's genome
 *   within a natural range, scaled by `poseEnergy` (0 = calm standing,
 *   1 = lively crowd). The v1 behavior, unchanged.
 * - `library` — the genome picks a named archetype (standing, walking,
 *   running, waving, cheering, pointing, looking) and jitters around its
 *   canonical angles. Archetypes carry the left/right coupling independent
 *   draws can never produce — a walker's opposite arm/leg swing.
 * - `mixed` — most figures take an archetype, the rest stay freeform, so a
 *   crowd reads as people doing things among people milling about.
 *
 * Every mode consumes the same fixed-length genome slice (`POSE_DRAWS`),
 * just interpreted differently — switching modes never moves or rescales a
 * figure. The slice is read in a fixed order; reordering would break the
 * golden hashes (appending is safe).
 */

export type PoseMode = 'procedural' | 'library' | 'mixed';

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
  /** Head nod about the chest, on top of torsoLean (+ = forward). */
  headTilt: number;
}

/** How many genome draws `resolvePose` consumes. Fixed — never reorder
 *  (g[13] = head tilt was appended in v2). */
export const POSE_DRAWS = 14;

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

/** Fully-procedural pose: 14 independent draws (13 v1 angles + head tilt). */
function proceduralPose(g: number[], e: number): PoseAngles {
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
    headTilt: ang(g[13] ?? 0.5, 0, 0.3, e, -0.35, 0.35),
  };
}

type Archetype =
  | 'standing'
  | 'walking'
  | 'running'
  | 'waving'
  | 'cheering'
  | 'pointing'
  | 'looking';

/** Weighted archetype table — everyday attitudes dominate, big gestures are
 *  the accents. Weights sum to 100; the pick is a plain CDF walk. */
const ARCHETYPES: Array<{ kind: Archetype; weight: number }> = [
  { kind: 'standing', weight: 30 },
  { kind: 'walking', weight: 25 },
  { kind: 'running', weight: 12 },
  { kind: 'waving', weight: 12 },
  { kind: 'cheering', weight: 8 },
  { kind: 'pointing', weight: 8 },
  { kind: 'looking', weight: 5 },
];

function pickArchetype(d: number): Archetype {
  let acc = 0;
  const t = clamp(d, 0, 0.999999) * 100;
  for (const a of ARCHETYPES) {
    acc += a.weight;
    if (t < acc) return a.kind;
  }
  return 'standing';
}

/**
 * A named archetype jittered by the genome. `pickDraw` selects the archetype;
 * jitters read g[1..13] so a figure keeps the same jitter identity whether it
 * arrived here via 'library' or 'mixed'. Jitter amplitude scales with energy
 * (at e = 0 the crowd collapses to clean canonical stances — several distinct
 * ones, unlike procedural's single mannequin); dynamic archetypes (walking /
 * running / cheering) also scale their gesture amplitude, so a low-energy
 * walker strolls and a high-energy one strides.
 */
function libraryPose(pickDraw: number, g: number[], e: number): PoseAngles {
  const kind = pickArchetype(pickDraw);
  // Two-sided jitter, energy-scaled. Draw indices are FIXED per joint.
  const j = (k: number, range: number): number => (((g[k] ?? 0.5) * 2 - 1) * range * e);
  const dyn = 0.35 + 0.65 * e;
  // Side pick for asymmetric archetypes: stable, not energy-dependent.
  const side = (g[1] ?? 0.5) < 0.5 ? 1 : -1;

  const base: PoseAngles = {
    hipSwingL: j(2, 0.08),
    hipSwingR: j(3, 0.08),
    hipSplayL: 0.06 + j(4, 0.05),
    hipSplayR: 0.06 + j(5, 0.05),
    kneeFlexL: Math.max(0, 0.08 + j(6, 0.08)),
    kneeFlexR: Math.max(0, 0.08 + j(7, 0.08)),
    shoulderSwingL: j(8, 0.15),
    shoulderSwingR: j(9, 0.15),
    shoulderAbductL: Math.max(0, 0.1 + j(10, 0.1)),
    shoulderAbductR: Math.max(0, 0.1 + j(11, 0.1)),
    elbowFlexL: Math.max(0, 0.12 + j(10, 0.15)),
    elbowFlexR: Math.max(0, 0.12 + j(11, 0.15)),
    torsoLean: j(12, 0.08),
    headTilt: j(13, 0.15),
  };

  switch (kind) {
    case 'standing': {
      // Contrapposto: weight on one leg, the other slack at the knee.
      base.kneeFlexL += side > 0 ? 0.25 : 0;
      base.kneeFlexR += side > 0 ? 0 : 0.25;
      base.hipSplayL += side > 0 ? 0.05 : 0;
      base.hipSplayR += side > 0 ? 0 : 0.05;
      return base;
    }
    case 'walking': {
      const A = (0.35 + 0.35 * e) * side;
      base.hipSwingL = A + j(2, 0.1);
      base.hipSwingR = -A + j(3, 0.1);
      // The back leg's knee folds through the swing.
      base.kneeFlexL = Math.max(0, (side > 0 ? 0.12 : 0.45 + 0.25 * e) + j(6, 0.1));
      base.kneeFlexR = Math.max(0, (side > 0 ? 0.45 + 0.25 * e : 0.12) + j(7, 0.1));
      // Opposite arm swing, elbows soft.
      base.shoulderSwingL = -0.7 * A + j(8, 0.12);
      base.shoulderSwingR = 0.7 * A + j(9, 0.12);
      base.elbowFlexL = Math.max(0, 0.3 + j(10, 0.15));
      base.elbowFlexR = Math.max(0, 0.3 + j(11, 0.15));
      base.torsoLean = 0.06 + j(12, 0.05);
      return base;
    }
    case 'running': {
      const A = (0.55 + 0.3 * e) * side;
      base.hipSwingL = A + j(2, 0.12);
      base.hipSwingR = -A + j(3, 0.12);
      base.kneeFlexL = Math.max(0, (side > 0 ? 0.3 : 1.0 + 0.3 * e) + j(6, 0.15));
      base.kneeFlexR = Math.max(0, (side > 0 ? 1.0 + 0.3 * e : 0.3) + j(7, 0.15));
      base.shoulderSwingL = -0.8 * A + j(8, 0.15);
      base.shoulderSwingR = 0.8 * A + j(9, 0.15);
      // Pumped elbows.
      base.elbowFlexL = Math.max(0, 1.3 * dyn + j(10, 0.2));
      base.elbowFlexR = Math.max(0, 1.3 * dyn + j(11, 0.2));
      base.torsoLean = clamp(0.2 + 0.12 * e + j(12, 0.05), -0.3, 0.35);
      base.headTilt = clamp(0.08 + j(13, 0.1), -0.35, 0.35);
      return base;
    }
    case 'waving': {
      // One arm up and waving, chin lifted toward whoever it greets.
      const abduct = clamp(2.1 + j(10, 0.3), 0, 2.7);
      const elbow = Math.max(0, 0.9 + j(11, 0.35));
      if (side > 0) {
        base.shoulderAbductL = abduct;
        base.elbowFlexL = elbow;
        base.shoulderAbductR = Math.max(0, 0.08 + j(11, 0.08));
        base.elbowFlexR = Math.max(0, 0.1 + j(10, 0.1));
      } else {
        base.shoulderAbductR = abduct;
        base.elbowFlexR = elbow;
        base.shoulderAbductL = Math.max(0, 0.08 + j(10, 0.08));
        base.elbowFlexL = Math.max(0, 0.1 + j(11, 0.1));
      }
      base.headTilt = clamp(-0.12 + j(13, 0.1), -0.35, 0.35);
      return base;
    }
    case 'cheering': {
      // Both arms thrown up; the whole gesture scales with energy.
      base.shoulderAbductL = clamp(2.3 * dyn + j(10, 0.25), 0, 2.7);
      base.shoulderAbductR = clamp(2.3 * dyn + j(11, 0.25), 0, 2.7);
      base.elbowFlexL = Math.max(0, 0.35 + j(10, 0.2));
      base.elbowFlexR = Math.max(0, 0.35 + j(11, 0.2));
      base.headTilt = clamp(-0.15 + j(13, 0.1), -0.35, 0.35);
      return base;
    }
    case 'pointing': {
      // One straight arm raised forward.
      const swing = clamp(1.0 + j(8, 0.25), -1.1, 1.1);
      if (side > 0) {
        base.shoulderSwingL = swing;
        base.elbowFlexL = Math.max(0, 0.12 + j(10, 0.1));
      } else {
        base.shoulderSwingR = swing;
        base.elbowFlexR = Math.max(0, 0.12 + j(11, 0.1));
      }
      return base;
    }
    case 'looking': {
      // Leaning back / craning — all attitude, no gesture.
      base.torsoLean = clamp(-0.18 + j(12, 0.08), -0.3, 0.35);
      base.headTilt = clamp(-0.25 + j(13, 0.1), -0.35, 0.35);
      return base;
    }
  }
}

/** The share of a 'mixed' crowd that takes a named archetype. */
const MIXED_LIBRARY_SHARE = 0.6;

/**
 * Resolve a pose from a fixed-length genome slice (`g.length === POSE_DRAWS`).
 * Each side is drawn independently, so the crowd reads as many different
 * attitudes rather than mirror-symmetric mannequins.
 */
export function resolvePose(g: number[], opts: PoseOpts): PoseAngles {
  const e = clamp(opts.poseEnergy, 0, 1);
  const mode = opts.mode ?? 'procedural';
  if (mode === 'library') return libraryPose(g[0], g, e);
  if (mode === 'mixed') {
    // Split on g[0], rescaled so both branches see a full-range first draw —
    // the same figure keeps its jitter identity (g[1..13]) in either branch.
    if (g[0] < MIXED_LIBRARY_SHARE) return libraryPose(g[0] / MIXED_LIBRARY_SHARE, g, e);
    const g0 = (g[0] - MIXED_LIBRARY_SHARE) / (1 - MIXED_LIBRARY_SHARE);
    return proceduralPose([g0, ...g.slice(1)], e);
  }
  return proceduralPose(g, e);
}
