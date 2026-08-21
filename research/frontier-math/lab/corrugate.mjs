// CONVEX INTEGRATION — corrugation in the sense of Nash-Kuiper, in the explicit
// form of Borrelli-Jabrane-Lazarus-Thibert (PNAS 2012, the flat-torus embedding).
//
// One corrugation step takes a curve gamma and returns a curve with the SAME
// image-to-within-O(1/N) but with speed multiplied pointwise by r(s) >= 1:
//
//   gamma_N(s) = gamma(0) + \int_0^s r|gamma'| [ cos(a cos(2 pi N u)) T
//                                              + sin(a cos(2 pi N u)) N ] du
//
// The amplitude a(s) is fixed by the exact condition
//
//   J_0(a) = 1/r          (J_0 = Bessel of the first kind, order 0)
//
// because  <cos(a cos t)>_t = J_0(a)  and  <sin(a cos t)>_t = 0, so the
// oscillating integrand has mean exactly gamma'. That is the whole trick: the
// curve gains length in the wiggle while its average direction is unchanged.
//
// Iterating with geometrically increasing N gives a C^1 limit with ripples at
// every scale — the mechanism by which Nash and Kuiper embed a long curve in a
// small box, and by which a flat torus embeds C^1-isometrically in R^3.
// Here the length surplus is the only input; every scale of the hierarchy is a
// consequence of it.

/** J_0 via  (1/pi) \int_0^pi cos(a sin t) dt  — Simpson, plenty accurate here. */
export function besselJ0(a) {
  const M = 240; let s = 0;
  for (let i = 0; i <= M; i++) {
    const t = (Math.PI * i) / M;
    const w = i === 0 || i === M ? 1 : i % 2 ? 4 : 2;
    s += w * Math.cos(a * Math.sin(t));
  }
  return (s * (Math.PI / M) / 3) / Math.PI;
}

/** Invert J_0(a) = 1/r on the first decreasing branch a in [0, j_0,1). */
export function amplitudeFor(r) {
  if (r <= 1) return 0;
  const target = 1 / r;
  let lo = 0, hi = 2.404825557695773;                  // first zero of J_0
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (besselJ0(mid) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v) => Math.hypot(v.x, v.y);

/** Resample a closed polyline to n points, uniformly in arclength. */
export function resample(pts, n) {
  const cl = [...pts, pts[0]];
  const acc = [0];
  for (let i = 1; i < cl.length; i++) acc.push(acc[i - 1] + len(sub(cl[i], cl[i - 1])));
  const L = acc[acc.length - 1];
  const out = []; let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (L * i) / n;
    while (j < acc.length - 2 && acc[j + 1] < d) j++;
    const t = (d - acc[j]) / Math.max(1e-12, acc[j + 1] - acc[j]);
    out.push({ x: cl[j].x + (cl[j + 1].x - cl[j].x) * t, y: cl[j].y + (cl[j + 1].y - cl[j].y) * t });
  }
  return out;
}

/**
 * One corrugation. `stretch(s)` is the pointwise speed multiplier, s in [0,1).
 * Returns a closed curve of length  \int r |gamma'|, with an affine correction
 * removing the O(1/N) closure defect.
 */
export function corrugate(pts, N, stretch) {
  const n = pts.length;
  const cl = [...pts, pts[0]];
  const tang = [], speed = [];
  for (let i = 0; i < n; i++) {
    const v = sub(cl[i + 1], cl[i]);
    const l = Math.max(1e-12, len(v));
    tang.push({ x: v.x / l, y: v.y / l });
    speed.push(l);
  }
  const out = [{ ...pts[0] }];
  for (let i = 0; i < n; i++) {
    const s = i / n;
    const r = Math.max(1, stretch(s));
    const a = amplitudeFor(r);
    const th = a * Math.cos(2 * Math.PI * N * s);
    const c = Math.cos(th), sn = Math.sin(th);
    const T = tang[i], Nrm = { x: -T.y, y: T.x };
    const step = r * speed[i];
    const p = out[out.length - 1];
    out.push({ x: p.x + step * (c * T.x + sn * Nrm.x), y: p.y + step * (c * T.y + sn * Nrm.y) });
  }
  // affine correction: distribute the closure defect uniformly in arclength
  const drift = sub(out[n], out[0]);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out[i] = { x: out[i].x - drift.x * t, y: out[i].y - drift.y * t };
  }
  out.pop();
  return out;
}

export function curveLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length; i++) L += len(sub(pts[(i + 1) % pts.length], pts[i]));
  return L;
}

/** Nested corrugations: K stages, total stretch R, frequencies N0 * ratio^k. */
export function corrugationTower(base, { stages = 4, totalStretch = 3, N0 = 5, ratio = 4, stretchField = null, samplesPerWave = 26 }) {
  const per = Math.pow(totalStretch, 1 / stages);
  let cur = base, history = [];
  for (let k = 0; k < stages; k++) {
    const N = Math.round(N0 * Math.pow(ratio, k));
    cur = resample(cur, Math.max(cur.length, N * samplesPerWave));
    const f = stretchField
      ? (s) => 1 + (per - 1) * stretchField(s, k)
      : () => per;
    cur = corrugate(cur, N, f);
    history.push({ k, N, pts: cur, length: curveLength(cur) });
  }
  return { curve: cur, history };
}
