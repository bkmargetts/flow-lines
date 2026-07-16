import type { FlowLine, Point } from '../flow-lines.js';
import { ellipse } from '../planet/geometry.js';
import { project, type Proj } from '../city/project.js';
import { smoothPolyline } from '../lib/polyline.js';
import { densify } from '../lib/spatial.js';
import { buildLocalSkeleton, resolveProportions, type Joint, type Vec3 } from './skeleton.js';
import { resolvePose, type PoseMode } from './poses.js';

const TAU = Math.PI * 2;

/** One placed figure: a ground anchor (u,v), a facing angle, a standing height
 *  H (px), and its stable genome (pose draws first). */
export interface FigureSpec {
  u0: number;
  v0: number;
  facing: number;
  H: number;
  /** Pose-angle draws (POSE_DRAWS of them), fixed order. */
  poseG: number[];
  /** Proportion draws (PROP_DRAWS of them), fixed order. */
  propG: number[];
  /** Painter's / occlusion depth key = u0 + v0 (larger = nearer). */
  depth: number;
}

/** A stamped occluder for the scene ZBuffer: the solid head disc. Only heads
 *  occlude — a limb may cross another figure's limbs freely, but it must not
 *  appear to pass through a nearer head. */
export interface Occluder {
  poly: Point[];
}

export interface FigureOpts {
  poseEnergy: number;
  poseMode: PoseMode;
  /** 0 = every figure the canonical body, 1 = full per-figure variation. */
  proportionVariance: number;
  penWidth: number;
  /** 0 = angular hinged limbs, 1 = limbs curve in a smooth continuous arc. */
  limbCurve: number;
}

export interface FigureBuild {
  strokes: FlowLine[];
  occluders: Occluder[];
  depth: number;
  /** Both ankle points in page px — used for the ground-contact shadow. */
  feet: Point[];
}

/**
 * Build one stick man: resolve its pose, run forward kinematics, rotate by the
 * facing angle, scale by H, project to the page, and emit thin single-pen
 * strokes (circle head, rounded-joint limbs). Also returns occluder geometry
 * for the scene hidden-line pass.
 */
export function buildFigure(spec: FigureSpec, proj: Proj, o: FigureOpts): FigureBuild {
  const pose = resolvePose(spec.poseG, { poseEnergy: o.poseEnergy, mode: o.poseMode });
  const prop = resolveProportions(spec.propG, o.proportionVariance);
  const local = buildLocalSkeleton(pose, prop);
  const cosF = Math.cos(spec.facing);
  const sinF = Math.sin(spec.facing);
  const H = spec.H;

  // Local (x=lateral, y=forward, z=up) → world (u,v,z) by facing/scale → page.
  const at = (v: Vec3): Point => {
    const du = v.x * cosF - v.y * sinF;
    const dv = v.x * sinF + v.y * cosF;
    return project(proj, spec.u0 + du * H, spec.v0 + dv * H, v.z * H);
  };
  const P = (j: Joint): Point => at(local[j]);

  const strokes: FlowLine[] = [];
  const occluders: Occluder[] = [];

  // A limb is one continuous line that starts ON the spine (chest for arms,
  // pelvis for legs), runs out through the shoulder/hip, and *curves* through
  // the elbow/knee — rounded, not a sharp hinge, and unmistakably attached to
  // the body. Densify + iterated-smooth pulls the joints into gentle arcs; a
  // near-straight standing leg stays straight.
  const curve = Math.max(0, Math.min(1, o.limbCurve));
  const limb = (pts: Point[]): Point[] => {
    if (curve <= 0) return pts;
    const dense = densify(pts, Math.max(1, o.penWidth * 1.4));
    return smoothPolyline(dense, 1 + Math.round(curve * 6));
  };

  const push = (points: Point[], layer: string): void => {
    if (points.length >= 2) strokes.push({ points, pen: 'fine', layer });
  };

  // Torso + neck (the spine every limb hangs from).
  push([P('pelvis'), P('chest')], 'figure');
  push([P('chest'), P('headBottom')], 'figure');
  // Arms: chest → shoulder → elbow → wrist.
  push(limb([P('chest'), P('shoulderL'), P('elbowL'), P('wristL')]), 'figure');
  push(limb([P('chest'), P('shoulderR'), P('elbowR'), P('wristR')]), 'figure');
  // Legs: pelvis → hip → knee → ankle.
  push(limb([P('pelvis'), P('hipL'), P('kneeL'), P('ankleL')]), 'figure');
  push(limb([P('pelvis'), P('hipR'), P('kneeR'), P('ankleR')]), 'figure');

  // Head: a screen-space circle (a ball head projects to a circle under iso).
  const head = P('headCenter');
  const rHead = prop.rHead * H;
  const headRing = ellipse(head.x, head.y, rHead, rHead, 0, 0, TAU);
  strokes.push({ points: headRing, pen: 'fine', layer: 'head' });
  // Occlude a hair beyond the drawn circle so a limb behind it stops cleanly
  // at the head's edge rather than poking a pixel through.
  const rOcc = rHead + Math.max(0.6, o.penWidth * 0.75);
  occluders.push({ poly: ellipse(head.x, head.y, rOcc, rOcc, 0, 0, TAU) });

  return { strokes, occluders, depth: spec.depth, feet: [P('ankleL'), P('ankleR')] };
}
