import type { PoseAngles } from './poses.js';

/**
 * The stick-man skeleton: proportion constants and a tiny forward-kinematics
 * solver. Everything here is a fraction of the figure's standing height `H`
 * (H-normalised) in a local right-handed frame — x = lateral (the figure's
 * right), y = forward (the way it faces), z = up. `figure.ts` multiplies by H,
 * rotates by the facing angle, and projects. Pure: no projection, no rng.
 *
 * Proportions follow a legible ~7-head cartoon canon, not anatomy — a stick
 * man reads by its silhouette, so the numbers are tuned for a clear pose.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Joint =
  | 'pelvis'
  | 'chest'
  | 'headBottom'
  | 'headCenter'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR';

/** Proportions as fractions of standing height H. */
export const PROP = {
  hipZ: 0.5,
  shoulderZ: 0.82,
  headBottomZ: 0.86,
  headCenterZ: 0.93,
  shoulderHalf: 0.1,
  hipHalf: 0.07,
  rHead: 0.075,
  rJoint: 0.018,
  upperArm: 0.16,
  foreArm: 0.15,
  thigh: 0.24,
  shin: 0.23,
} as const;

const DOWN: Vec3 = { x: 0, y: 0, z: -1 };

/** Rotate a vector about the x-axis (forward/back tilt). */
export function rotX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/** Rotate a vector about the y-axis (lateral swing / abduction). */
export function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function add(a: Vec3, b: Vec3, k: number): Vec3 {
  return { x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k };
}

/**
 * Solve joint positions (H-normalised, local frame) from a resolved pose.
 * Legs hang from the hips, arms from the shoulders; a whole-body `torsoLean`
 * tilts everything above the pelvis forward for running / jumping.
 */
export function buildLocalSkeleton(a: PoseAngles): Record<Joint, Vec3> {
  const pelvis: Vec3 = { x: 0, y: 0, z: PROP.hipZ };

  // Upper body, tilted forward about the pelvis by torsoLean.
  const lean = (v: Vec3): Vec3 => {
    const rel = rotX({ x: v.x, y: v.y, z: v.z - pelvis.z }, a.torsoLean);
    return { x: rel.x, y: rel.y, z: rel.z + pelvis.z };
  };
  const chest = lean({ x: 0, y: 0, z: PROP.shoulderZ });
  const headBottom = lean({ x: 0, y: 0, z: PROP.headBottomZ });
  const headCenter = lean({ x: 0, y: 0, z: PROP.headCenterZ });
  const shoulderR = lean({ x: PROP.shoulderHalf, y: 0, z: PROP.shoulderZ });
  const shoulderL = lean({ x: -PROP.shoulderHalf, y: 0, z: PROP.shoulderZ });

  const hipR: Vec3 = { x: PROP.hipHalf, y: 0, z: PROP.hipZ };
  const hipL: Vec3 = { x: -PROP.hipHalf, y: 0, z: PROP.hipZ };

  // Arm chain: abduction swings out to the side (about y), swing tilts
  // forward/back (about x), elbow bends the forearm further forward.
  const arm = (shoulder: Vec3, side: 1 | -1, swing: number, abduct: number, elbow: number) => {
    const upperDir = rotX(rotY(DOWN, side * abduct), swing);
    const elbowPt = add(shoulder, upperDir, PROP.upperArm);
    const foreDir = rotX(upperDir, elbow);
    const wristPt = add(elbowPt, foreDir, PROP.foreArm);
    return { elbowPt, wristPt };
  };
  const rArm = arm(shoulderR, 1, a.shoulderSwingR, a.shoulderAbductR, a.elbowFlexR);
  const lArm = arm(shoulderL, -1, a.shoulderSwingL, a.shoulderAbductL, a.elbowFlexL);

  // Leg chain: splay swings out to the side, swing forward/back, knee bends
  // the shin back.
  const leg = (hip: Vec3, side: 1 | -1, swing: number, splay: number, knee: number) => {
    const thighDir = rotX(rotY(DOWN, side * splay), swing);
    const kneePt = add(hip, thighDir, PROP.thigh);
    const shinDir = rotX(rotY(DOWN, side * splay), swing + knee);
    const anklePt = add(kneePt, shinDir, PROP.shin);
    return { kneePt, anklePt };
  };
  const rLeg = leg(hipR, 1, a.hipSwingR, a.hipSplayR, a.kneeFlexR);
  const lLeg = leg(hipL, -1, a.hipSwingL, a.hipSplayL, a.kneeFlexL);

  return {
    pelvis,
    chest,
    headBottom,
    headCenter,
    shoulderL,
    shoulderR,
    elbowL: lArm.elbowPt,
    elbowR: rArm.elbowPt,
    wristL: lArm.wristPt,
    wristR: rArm.wristPt,
    hipL,
    hipR,
    kneeL: lLeg.kneePt,
    kneeR: rLeg.kneePt,
    ankleL: lLeg.anklePt,
    ankleR: rLeg.anklePt,
  };
}
