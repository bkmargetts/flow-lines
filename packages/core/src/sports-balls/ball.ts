import type { FlowLine, Point } from '../flow-lines.js';
import { ellipse, pushRun } from '../planet/geometry.js';
import { type Vec3, TAU, DEG, norm } from '../planet/vec3.js';
import { clamp } from '../lib/math.js';
import type { BallSpec } from './layout.js';
import {
  type RotFn,
  IDENTITY_ROT,
  makeBallRotation,
  emitSphereCurve,
  greatCircle,
  smallCircle,
} from './sphere.js';
import { SOCCER_EDGES } from './polyhedron.js';
import { slerpArc } from './sphere.js';

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const AXES: readonly Vec3[] = [X, Y, Z];

export interface BallBuildOpts {
  spin: number;
  shading: number;
  lightAngle: number;
  penWidth: number;
}

export interface BallBuild {
  strokes: FlowLine[];
  /** Silhouette disc (slightly inflated) for the shared depth buffer. */
  occluder: Point[];
  depth: number;
}

/** Sample count for a full seam circle, scaled to the ball so small balls
 *  stay cheap and big ones stay smooth. */
const circleSamples = (r: number): number => clamp(Math.round(r * 1.6), 24, 96);

/**
 * One ball: the outline circle plus type-specific seam curves — 3D curves on
 * the unit sphere, rotated by the ball's own orientation and front-face
 * clipped — and an optional shadow-side hatch of rings about the shared
 * page-space light axis (deliberately NOT ball-rotated, so the pile reads as
 * lit by one sky).
 */
export function buildBall(spec: BallSpec, o: BallBuildOpts): BallBuild {
  const { x, y, r, type } = spec;
  const strokes: FlowLine[] = [];

  strokes.push({ points: ellipse(x, y, r, r, 0, 0, TAU), pen: 'fine', layer: 'outline' });

  const rot = makeBallRotation(spec.rotG, clamp(o.spin, 0, 1));
  const n = circleSamples(r);

  switch (type) {
    case 'soccer':
      soccer(strokes, spec, rot);
      break;
    case 'basketball':
      basketball(strokes, spec, rot, n);
      break;
    case 'volleyball':
      volleyball(strokes, spec, rot, n);
      break;
    case 'baseball':
      figureEightSeam(strokes, spec, rot, { b: 0.35, c: 0.85, offset: 3.5 * DEG, stitches: true });
      break;
    case 'tennis':
      figureEightSeam(strokes, spec, rot, { b: 0.28, c: 0.7, offset: 1.5 * DEG, stitches: false });
      break;
    case 'pingpong':
      break; // outline only — it reads by being small and blank
  }

  if (o.shading > 0) shade(strokes, spec, o);

  const inflate = Math.max(0.6, o.penWidth * 0.75);
  return {
    strokes,
    occluder: ellipse(x, y, r + inflate, r + inflate, 0, 0, TAU),
    depth: spec.depth,
  };
}

/** Truncated-icosahedron panel net — every edge a short great-circle arc. */
function soccer(out: FlowLine[], spec: BallSpec, rot: RotFn): void {
  for (const [a, b] of SOCCER_EDGES) {
    emitSphereCurve(out, slerpArc(a, b, 6), spec.x, spec.y, spec.r, rot, 'seams');
  }
}

/** Equator + meridian great circles plus the two curved channel seams. */
function basketball(out: FlowLine[], spec: BallSpec, rot: RotFn, n: number): void {
  const emit = (samples: Vec3[]): void =>
    emitSphereCurve(out, samples, spec.x, spec.y, spec.r, rot, 'seams');
  emit(greatCircle(X, Y, n)); // equator (about Z)
  emit(greatCircle(Y, Z, n)); // meridian (about X)
  emit(smallCircle(Y, 55 * DEG, n));
  emit(smallCircle(Y, 125 * DEG, n));
}

/** The signed cube-face a direction belongs to: index 0..2 = axis, ±1 sign. */
function ownerFace(v: Vec3): { axis: number; sign: number } {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  if (ax >= ay && ax >= az) return { axis: 0, sign: v.x >= 0 ? 1 : -1 };
  if (ay >= az) return { axis: 1, sign: v.y >= 0 ? 1 : -1 };
  return { axis: 2, sign: v.z >= 0 ? 1 : -1 };
}

/**
 * Three families of parallel strips, each family wrapping one axis and kept
 * only on its two assigned cube faces — every face gets one family, adjacent
 * faces get different orientations, the way a volleyball's 18 panels read.
 * The sector clip runs inside the same run-splitting loop as the front-face
 * gate: a strip terminates at its panel border.
 */
function volleyball(out: FlowLine[], spec: BallSpec, rot: RotFn, n: number): void {
  const colats = [66 * DEG, 90 * DEG, 114 * DEG];
  const minRun = Math.max(3, Math.round(n / 12)); // drop corner slivers
  for (let k = 0; k < 3; k++) {
    const keepA = (k + 1) % 3; // face +A(k+1)
    const keepB = (k + 2) % 3; // face −A(k+2)
    for (const colat of colats) {
      // Split into kept runs BEFORE rotating — the panel borders live in the
      // ball's own frame, so the clip must not see the view rotation.
      let run: Vec3[] = [];
      const flush = (): void => {
        if (run.length >= minRun) {
          emitSphereCurve(out, run, spec.x, spec.y, spec.r, rot, 'seams');
        }
        run = [];
      };
      for (const s of smallCircle(AXES[k], colat, n)) {
        const f = ownerFace(s);
        if ((f.axis === keepA && f.sign > 0) || (f.axis === keepB && f.sign < 0)) run.push(s);
        else flush();
      }
      flush();
    }
  }
}

/**
 * The classic baseball/tennis figure-8 seam: a closed curve that swings
 * between the two poles. Baseball gets two parallel seams offset along the
 * surface binormal plus alternating stitch ticks; tennis a narrow groove.
 */
function figureEightSeam(
  out: FlowLine[],
  spec: BallSpec,
  rot: RotFn,
  opts: { b: number; c: number; offset: number; stitches: boolean }
): void {
  const N = 160;
  const centre: Vec3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    centre.push(
      norm({
        x: Math.cos(t) + opts.b * Math.cos(3 * t),
        y: Math.sin(t) - opts.b * Math.sin(3 * t),
        z: opts.c * Math.sin(2 * t),
      })
    );
  }

  // Offset each sample ±delta along the surface binormal (B = N × T).
  const offsetCurve = (delta: number): Vec3[] =>
    centre.map((p, i) => {
      const q = centre[Math.min(i + 1, N)];
      const prev = centre[Math.max(i - 1, 0)];
      const t = norm({ x: q.x - prev.x, y: q.y - prev.y, z: q.z - prev.z });
      const b = norm({
        x: p.y * t.z - p.z * t.y,
        y: p.z * t.x - p.x * t.z,
        z: p.x * t.y - p.y * t.x,
      });
      const cd = Math.cos(delta);
      const sd = Math.sin(delta);
      return norm({ x: p.x * cd + b.x * sd, y: p.y * cd + b.y * sd, z: p.z * cd + b.z * sd });
    });

  const left = offsetCurve(opts.offset);
  const right = offsetCurve(-opts.offset);
  const emit = (samples: Vec3[]): void =>
    emitSphereCurve(out, samples, spec.x, spec.y, spec.r, rot, 'seams');
  emit(left);
  emit(right);

  if (opts.stitches) {
    // Short alternating ticks between the seams — the V-stitch look. Skip
    // tiny balls where the ticks would just fuzz the seam.
    if (spec.r >= 9) {
      for (let i = 3; i < N; i += 6) {
        const tilt = (i / 6) % 2 === 0 ? 1 : -1;
        const a = left[Math.max(0, Math.min(N, i - tilt))];
        const b = right[Math.max(0, Math.min(N, i + tilt))];
        emit([a, b]);
      }
    }
  }
}

/**
 * Shadow-side form hatch: rings of constant colatitude about the anti-light
 * pole, stepping from just inside the terminator toward the shadow pole. The
 * pole sits behind the ball (light has +z), so the front-face gate leaves a
 * crescent against the silhouette away from the light — the colatitude range
 * IS the tone, no tone function needed.
 */
function shade(out: FlowLine[], spec: BallSpec, o: BallBuildOpts): void {
  if (spec.r < 5) return; // rings on a tiny ball turn to mush
  const shading = clamp(o.shading, 0, 1);
  const light = norm({ x: Math.cos(o.lightAngle), y: Math.sin(o.lightAngle), z: 0.55 });
  const pole: Vec3 = { x: -light.x, y: -light.y, z: -light.z };
  // A ring at colatitude θ (from the pole) fronts the viewer at projected
  // radius ρ(θ) = sin(θ + φ) of r, where φ = atan2(|light_xy|, light_z) —
  // rings spaced evenly in colatitude bunch into a solid band at the rim, so
  // step evenly in ρ instead and invert. ρ is capped short of 1 to hold a
  // sliver of paper between the deepest ring and the outline.
  const phi = Math.atan2(Math.hypot(light.x, light.y), light.z);
  const from = 82 * DEG; // just inside the terminator
  const thetaMin = Math.max((82 - 52 * shading) * DEG, Math.PI / 2 - phi + 2 * DEG);
  const rho0 = Math.sin(from + phi);
  const rho1 = Math.min(Math.sin(thetaMin + phi), 0.965);
  const spacingPx = Math.max(2.5, o.penWidth * 2.2);
  const rings = Math.max(2, Math.round(((rho1 - rho0) * spec.r) / spacingPx));
  const n = circleSamples(spec.r);
  for (let k = 0; k < rings; k++) {
    const rho = Math.min(1, rho0 + ((rho1 - rho0) * k) / (rings - 1));
    const colat = Math.PI - Math.asin(rho) - phi;
    emitSphereCurve(
      out,
      smallCircle(pole, colat, n),
      spec.x,
      spec.y,
      spec.r,
      IDENTITY_ROT,
      'shading'
    );
  }
}
