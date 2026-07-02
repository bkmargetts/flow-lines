import { Point } from '../flow-lines.js';
import { makeRandom } from '../lib/rng.js';
import { clamp01 } from '../lib/math.js';
import { type Vec3, TAU } from './vec3.js';
import { pushRun, dot4 } from './geometry.js';
import type { BodyCtx } from './context.js';

/** Sample gate shared by the hatch passes: reject back-facing, occluded,
 *  masked, or below-threshold points, else project and extend the run. */
function sampleAndEmit(ctx: BodyCtx, N: Vec3, thr: number, run: Point[]): boolean {
  // returns whether the point was kept (continues the run)
  if (N.z <= 0) return false;
  const sx = ctx.bx + ctx.br * N.x;
  const sy = ctx.by + ctx.br * N.y;
  if (ctx.occluded(sx, sy)) return false;
  if (!ctx.hatchMask(N)) return false;
  if (ctx.toneAt(N) < thr) return false;
  run.push({ x: sx, y: sy });
  return true;
}

// Form-following cross-contour hatching.
// The lit cap is held clean (tone below the base threshold gets no marks),
// so curved single-direction hatch carries the midtones and cross-hatch only
// builds in the shadow — a tonal sphere, not a wireframe globe. Keeping the
// base threshold up also blanks the sub-light point, avoiding a bullseye.
const PASSES: { kind: 'ring' | 'meridian'; phase: number; thr: number }[] = [
  { kind: 'ring', phase: 0, thr: 0.2 },
  { kind: 'ring', phase: 0.5, thr: 0.44 },
  { kind: 'meridian', phase: 0, thr: 0.6 },
  { kind: 'ring', phase: 0.25, thr: 0.74 },
  { kind: 'meridian', phase: 0.5, thr: 0.86 },
];

export function renderHatch(ctx: BodyCtx): void {
  const { scene, b, br, bA, bU, bV } = ctx;
  const { o, SPIN, US, VS, lines } = scene;
  const layerCount = Math.max(1, Math.min(PASSES.length, Math.round(o.crossHatchLayers)));
  const dt = Math.max(0.01, o.hatchSpacing / br); // angular step ≈ hatchSpacing px

  // Gas giants hatch around the spin axis so "ring" passes lay down as
  // horizontal belts; everything else hatches around the light axis so the
  // shading bunches toward the terminator. Tone gating (which folds the belt
  // albedo) still tightens the shadow side in both frames.
  const beltHatch = b.bodyType === 'gas-giant' || b.bodyType === 'ringed';
  const HA = beltHatch ? SPIN : bA;
  const HU = beltHatch ? US : bU;
  const HV = beltHatch ? VS : bV;

  for (let p = 0; p < layerCount; p++) {
    const pass = PASSES[p];
    if (pass.kind === 'ring') {
      // Circles of constant colatitude around the light axis (parallel to the
      // terminator) — concentric shading that bunches into the shadow.
      for (let m = 1; (m + pass.phase) * dt < Math.PI; m++) {
        const t0 = (m + pass.phase) * dt;
        const sinT = Math.sin(t0);
        const cosT = Math.cos(t0);
        const ns = Math.max(16, Math.ceil((TAU * br * sinT) / o.hatchSpacing));
        let run: Point[] = [];
        for (let s = 0; s <= ns; s++) {
          const ss = (s / ns) * TAU;
          const dir = Math.cos(ss);
          const dir2 = Math.sin(ss);
          const N: Vec3 = {
            x: HA.x * cosT + (HU.x * dir + HV.x * dir2) * sinT,
            y: HA.y * cosT + (HU.y * dir + HV.y * dir2) * sinT,
            z: HA.z * cosT + (HU.z * dir + HV.z * dir2) * sinT,
          };
          if (!sampleAndEmit(ctx, N, pass.thr, run)) {
            pushRun(lines, run, 'hatch');
            run = [];
          }
        }
        pushRun(lines, run, 'hatch');
      }
    } else {
      // Meridian arcs from the lit pole to the anti-lit pole — the cross-hatch.
      const dPhi = dt;
      for (let m = 0; (m + pass.phase) * dPhi < TAU; m++) {
        const phi = (m + pass.phase) * dPhi;
        const cphi = Math.cos(phi);
        const sphi = Math.sin(phi);
        const dirU = { x: HU.x * cphi + HV.x * sphi, y: HU.y * cphi + HV.y * sphi, z: HU.z * cphi + HV.z * sphi };
        const nt = Math.max(24, Math.ceil(Math.PI / dt));
        let run: Point[] = [];
        for (let s = 0; s <= nt; s++) {
          const t = (s / nt) * Math.PI;
          const sinT = Math.sin(t);
          const cosT = Math.cos(t);
          const N: Vec3 = {
            x: HA.x * cosT + dirU.x * sinT,
            y: HA.y * cosT + dirU.y * sinT,
            z: HA.z * cosT + dirU.z * sinT,
          };
          if (!sampleAndEmit(ctx, N, pass.thr, run)) {
            pushRun(lines, run, 'hatch');
            run = [];
          }
        }
        pushRun(lines, run, 'hatch');
      }
    }
  }
}

/** Terminator emphasis: extra rings hugging the day/night boundary (the great
 *  circle at colatitude π/2 around the light axis), for the classic engraved
 *  ramp from light into shadow. */
export function renderTerminatorEmphasis(ctx: BodyCtx): void {
  const { scene, b, br, bA, bU, bV } = ctx;
  const { o, lines } = scene;
  if (!(o.terminatorEmphasis > 0 && b.bodyType !== 'star')) return;
  const dt = Math.max(0.01, o.hatchSpacing / br);
  const eband = 0.5;
  const estep = Math.max(0.012, dt * (1 - 0.55 * o.terminatorEmphasis));
  for (let t0 = Math.PI / 2 - eband; t0 <= Math.PI / 2 + eband + 1e-9; t0 += estep) {
    const sinT = Math.sin(t0);
    const cosT = Math.cos(t0);
    const ns = Math.max(16, Math.ceil((TAU * br * Math.abs(sinT)) / o.hatchSpacing));
    let run: Point[] = [];
    for (let s = 0; s <= ns; s++) {
      const ss = (s / ns) * TAU;
      const dir = Math.cos(ss);
      const dir2 = Math.sin(ss);
      const N: Vec3 = {
        x: bA.x * cosT + (bU.x * dir + bV.x * dir2) * sinT,
        y: bA.y * cosT + (bU.y * dir + bV.y * dir2) * sinT,
        z: bA.z * cosT + (bU.z * dir + bV.z * dir2) * sinT,
      };
      if (!sampleAndEmit(ctx, N, 0.12, run)) { pushRun(lines, run, 'hatch'); run = []; }
    }
    pushRun(lines, run, 'hatch');
  }
}

/** Stipple (shadow / texture dots), gated by tone. */
export function renderStipple(ctx: BodyCtx): void {
  const { scene, b, bx, by, br, occluded, surface, toneAt } = ctx;
  const { o, lines } = scene;
  if (!(o.stipple > 0)) return;
  const sr = makeRandom(b.bodySeed + 707);
  const cell = Math.max(2.2, o.hatchSpacing * 0.7);
  for (let sy = by - br; sy <= by + br; sy += cell) {
    for (let sx = bx - br; sx <= bx + br; sx += cell) {
      const jx = sx + (sr() - 0.5) * cell;
      const jy = sy + (sr() - 0.5) * cell;
      const dx = jx - bx;
      const dy = jy - by;
      const r2 = dx * dx + dy * dy;
      if (r2 > br * br) continue;
      if (occluded(jx, jy)) continue;
      const z = Math.sqrt(br * br - r2);
      const N: Vec3 = { x: dx / br, y: dy / br, z: z / br };
      let prob: number;
      if (b.bodyType === 'star') {
        prob = clamp01(0.35 + 0.5 * (1 - N.z)) * o.stipple;
      } else if (b.bodyType === 'lava') {
        // Embers cluster along the glowing fissures; the crust gets only a
        // light scatter so it reads as texture, not noise.
        const onFissure = Math.abs(surface(N).n) < o.lavaFissureWidth * 1.6;
        prob = onFissure ? o.lavaGlow : toneAt(N) * o.stipple * 0.3;
      } else {
        prob = toneAt(N) * o.stipple;
      }
      if (sr() < prob) {
        const rr = o.penWidth * 0.55;
        lines.push({ points: dot4(jx, jy, rr), layer: 'stipple' });
      }
    }
  }
}

/** Limb: a bold silhouette built from concentric single-pen passes. */
export function renderLimb(ctx: BodyCtx): void {
  const { scene, bx, by, br, occluded } = ctx;
  const { o, lines } = scene;
  const limbPasses = Math.max(2, Math.round(o.penWidth > 0 ? 3 : 2));
  for (let k = 0; k < limbPasses; k++) {
    const rr = br - k * o.penWidth * 0.9;
    if (rr < 2) break;
    let run: Point[] = [];
    const n = 110;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * TAU;
      const sx = bx + Math.cos(t) * rr;
      const sy = by + Math.sin(t) * rr;
      if (occluded(sx, sy)) {
        pushRun(lines, run, 'limb', 'bold');
        run = [];
        continue;
      }
      run.push({ x: sx, y: sy });
    }
    pushRun(lines, run, 'limb', 'bold');
  }
}
