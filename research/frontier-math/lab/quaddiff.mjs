// TRAJECTORIES OF A QUADRATIC DIFFERENTIAL  Q(z) dz^2
//
// The object: on a Riemann surface, a quadratic differential defines not a
// vector field but a LINE FIELD — a direction defined only up to sign, because
// sqrt(Q) is two-valued. Its integral curves are the horizontal trajectories
//
//        Im \int^z sqrt(Q(w)) dw = const,      equivalently   dz/dt = 1/sqrt(Q(z)).
//
// Why this is different in kind from every flow field: a vector field's
// singularities are sources, sinks and saddles — index +-1, the things noise
// fields make. A quadratic differential's singularities have HALF-INTEGER
// index. At a simple zero of Q exactly THREE trajectories meet at 120 degrees;
// at a simple pole, one. A smooth vector field cannot produce a 3-pronged
// singularity, ever. That trivalent structure is the visual signature, and it
// is forced by the square root.
//
// The distinguished sub-object is the CRITICAL GRAPH: the trajectories that
// actually emanate from the zeros. Generically they run to infinity, but at
// special phases they CONNECT zero to zero and the critical graph snaps shut
// into a finite tree — the Chebotarev continuum, the minimal-capacity
// continuum containing the zeros (Stahl; Gonchar-Rakhmanov;
// Martinez-Finkelshtein-Rakhmanov; Bertola 2025 gives the first systematic
// treatment). Sweeping the phase makes the drawing jump discontinuously at
// those Boutroux phases: a genuine phase transition in the parameter space.
//
// This is Teichmueller theory (Strebel differentials), WKB / Stokes phenomena,
// and the theory of orthogonal polynomials, all being one picture.

import { evenlySpaced } from './evenspace.mjs';

const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cabs = (a) => Math.hypot(a[0], a[1]);

/** Q(z) = prod (z - a_j), returned as a complex pair. */
function evalQ(zeros, z) {
  let q = [1, 0];
  for (const a of zeros) q = cmul(q, [z[0] - a[0], z[1] - a[1]]);
  return q;
}

/** Principal square root of a complex number. */
function csqrt(a) {
  const r = cabs(a);
  if (r === 0) return [0, 0];
  const m = Math.sqrt(r), th = Math.atan2(a[1], a[0]) / 2;
  return [m * Math.cos(th), m * Math.sin(th)];
}

/**
 * Unit direction of the theta-trajectory at z, with the branch of sqrt(Q)
 * chosen CONTINUOUSLY against `prev`. This continuation is the whole trick:
 * the field is only a line field, and carrying the branch by hand is what lets
 * a trajectory run through a region where a vector field would tear.
 */
export function direction(zeros, z, theta, prev) {
  let s = csqrt(evalQ(zeros, z));
  if (prev && s[0] * prev[0] + s[1] * prev[1] < 0) s = [-s[0], -s[1]];
  const branch = s;
  // dz/dt = e^{i theta} / sqrt(Q)
  const d2 = s[0] * s[0] + s[1] * s[1];
  if (d2 < 1e-18) return { dir: [0, 0], branch };
  const inv = [s[0] / d2, -s[1] / d2];
  const e = [Math.cos(theta), Math.sin(theta)];
  const v = cmul(e, inv);
  const L = cabs(v);
  return { dir: L < 1e-15 ? [0, 0] : [v[0] / L, v[1] / L], branch };
}

/** Trace one trajectory from z0 in one direction. */
export function trace(zeros, z0, theta, {
  step = 0.004, maxSteps = 20000, bounds = 2.2, sign = 1, stop = null,
} = {}) {
  let z = [...z0], prev = null;
  const pts = [[...z]];
  for (let i = 0; i < maxSteps; i++) {
    const { dir, branch } = direction(zeros, z, theta, prev);
    prev = branch;
    if (dir[0] === 0 && dir[1] === 0) break;
    // Heun (midpoint) step keeps trajectories from spiralling near the zeros
    const zm = [z[0] + sign * step * dir[0] * 0.5, z[1] + sign * step * dir[1] * 0.5];
    const d2 = direction(zeros, zm, theta, prev).dir;
    z = [z[0] + sign * step * d2[0], z[1] + sign * step * d2[1]];
    if (Math.abs(z[0]) > bounds || Math.abs(z[1]) > bounds) break;
    if (stop && i > 4 && stop(z)) break;
    // closed (Strebel) trajectory: came back to the start
    if (i > 200 && Math.hypot(z[0] - z0[0], z[1] - z0[1]) < step * 1.5) { pts.push([...z]); break; }
    pts.push([...z]);
  }
  return pts;
}

/**
 * The CRITICAL GRAPH: from each simple zero, exactly three trajectories leave,
 * at angles 120 degrees apart. Near a = zero, Q ~ c (z-a) so
 * sqrt(Q) ~ sqrt(c) (z-a)^{1/2} and the trajectory directions solve
 * arg(z-a) = (2/3)(theta - arg(c)/2 + k pi),  k = 0,1,2.
 */
export function criticalGraph(zeros, theta, opts = {}) {
  const eps = opts.eps || 0.006;
  const out = [];
  zeros.forEach((a, j) => {
    // leading coefficient c = prod_{k != j} (a_j - a_k)
    let c = [1, 0];
    zeros.forEach((b, k) => { if (k !== j) c = cmul(c, [a[0] - b[0], a[1] - b[1]]); });
    const argc = Math.atan2(c[1], c[0]);
    for (let k = 0; k < 3; k++) {
      const ang = (2 / 3) * (theta - argc / 2 + k * Math.PI);
      const z0 = [a[0] + eps * Math.cos(ang), a[1] + eps * Math.sin(ang)];
      // The line field carries no orientation, so `sign` may launch the trace
      // back THROUGH the zero and out along a different prong. Decide it
      // analytically: keep the sign whose direction at z0 points away from a.
      const d0 = direction(zeros, z0, theta, null).dir;
      const radial = [Math.cos(ang), Math.sin(ang)];
      const sign = d0[0] * radial[0] + d0[1] * radial[1] >= 0 ? 1 : -1;
      out.push({ pts: trace(zeros, z0, theta, { ...opts, sign }), zero: j, prong: k });
    }
  });
  return out;
}

/** Evenly spaced regular trajectories — the foliation around the critical graph. */
export function foliation(zeros, theta, { bounds = 2.2, dsep = 0.016, step = 0.0035, maxSteps = 9000, seedsN = 24, maxLines = 3000 } = {}) {
  const traceBoth = (z0, stop) => {
    const f = trace(zeros, z0, theta, { step, maxSteps, bounds, sign: 1, stop });
    const b = trace(zeros, z0, theta, { step, maxSteps, bounds, sign: -1, stop });
    return [...b.reverse(), ...f.slice(1)];
  };
  const g = 0.618033988749895;
  const seeds0 = [];
  for (let i = 0; i < seedsN; i++) {
    seeds0.push([((((i + 1) * g) % 1) * 2 - 1) * bounds * 0.9, ((((i + 1) * g * g) % 1) * 2 - 1) * bounds * 0.9]);
  }
  return evenlySpaced({ traceBoth, seeds0, dsep, bounds, maxLines });
}
