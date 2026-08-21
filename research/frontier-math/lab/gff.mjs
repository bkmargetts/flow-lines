// IMAGINARY GEOMETRY — flow lines of the Gaussian free field.
// (Miller & Sheffield, "Imaginary geometry I–IV", 2012–2017.)
//
// This is the exact frontier answer to "what is past Perlin noise".
// A flow field is  dz/dt = e^{i theta(z)}.  Everyone drives theta with
// smooth value noise. Instead drive it with the GAUSSIAN FREE FIELD:
//
//      theta(z) = h(z)/chi + theta_0 ,      h = the 2D GFF
//
// The GFF is the Gaussian field with covariance (-Delta)^{-1}, i.e.
//      E[h(x)h(y)] = -(1/2 pi) log|x-y| + O(1).
// Two consequences that no noise field can have:
//
//  1. LOG-CORRELATED, hence EXACTLY SCALE INVARIANT. There is no octave, no
//     blob size, no characteristic wavelength. Simplex noise always has a
//     visible feature scale; the GFF has structure at every scale at once.
//
//  2. FLOW LINES MERGE, AS A THEOREM. h is a distribution, not a function, so
//     the ODE has no classical solution — yet Miller-Sheffield show the flow
//     lines exist, that two flow lines of the SAME angle started at different
//     points MERGE and never separate again, and that flow lines of DIFFERENT
//     angles cross exactly once. Smooth fields cannot do this: their integral
//     curves comb, never merging. The branching tree in the drawing is not a
//     rule anyone wrote — it is forced by the roughness of the field.
//
// The individual flow line is an SLE_kappa curve, kappa = 4/chi'^2 with
// chi = 2/sqrt(kappa) - sqrt(kappa)/2. chi is the one dial: small chi means a
// wild curve (large kappa), large chi means a nearly straight one.
import { rng, gauss } from './lab.mjs';

/* ---- in-place iterative radix-2 complex FFT ---- */
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let l = 2; l <= n; l <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / l;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += l) {
      let cr = 1, ci = 0;
      for (let k = 0; k < l / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + l / 2] * cr - im[i + k + l / 2] * ci;
        const vi = re[i + k + l / 2] * ci + im[i + k + l / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + l / 2] = ur - vr; im[i + k + l / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function fft2(re, im, N, inverse) {
  const rr = new Float64Array(N), ii = new Float64Array(N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) { rr[x] = re[y * N + x]; ii[x] = im[y * N + x]; }
    fft(rr, ii, inverse);
    for (let x = 0; x < N; x++) { re[y * N + x] = rr[x]; im[y * N + x] = ii[x]; }
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { rr[y] = re[y * N + x]; ii[y] = im[y * N + x]; }
    fft(rr, ii, inverse);
    for (let y = 0; y < N; y++) { re[y * N + x] = rr[y]; im[y * N + x] = ii[y]; }
  }
}

/**
 * Exact discrete Gaussian free field on the N x N torus:
 * white noise divided by sqrt of the lattice Laplacian spectrum.
 * lambda(k) = 4 sin^2(pi k1/N) + 4 sin^2(pi k2/N),  zero mode dropped.
 * `rough` in [0,1] tilts the spectral exponent: 1 = the true GFF (1/|k|),
 * lower values give a smoother, more conventional field — the dial that
 * interpolates from noise-art to imaginary geometry.
 */
export function sampleGFF(N, seed, { rough = 1 } = {}) {
  if (N < 2 || (N & (N - 1)) !== 0) {
    throw new Error(`sampleGFF: N must be a power of two (got ${N}) — the FFT is radix-2`);
  }
  const r = rng(seed);
  const re = new Float64Array(N * N), im = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) re[i] = gauss(r);
  fft2(re, im, N, false);
  for (let ky = 0; ky < N; ky++) {
    for (let kx = 0; kx < N; kx++) {
      const i = ky * N + kx;
      if (kx === 0 && ky === 0) { re[i] = 0; im[i] = 0; continue; }
      const s1 = Math.sin(Math.PI * kx / N), s2 = Math.sin(Math.PI * ky / N);
      const lam = 4 * (s1 * s1 + s2 * s2);
      const f = Math.pow(lam, -0.5 * rough);
      re[i] *= f; im[i] *= f;
    }
  }
  fft2(re, im, N, true);
  // standardise: the overall scale is absorbed into chi
  let m = 0; for (let i = 0; i < N * N; i++) m += re[i]; m /= N * N;
  let v = 0; for (let i = 0; i < N * N; i++) { const d = re[i] - m; v += d * d; }
  const sd = Math.sqrt(v / (N * N));
  const h = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = (re[i] - m) / sd;
  return { h, N };
}

/** Empirical covariance vs distance — should decay like -(1/2pi) log r. */
export function covarianceProfile({ h, N }, dists = [1, 2, 4, 8, 16, 32, 64, 128]) {
  const out = [];
  for (const d of dists) {
    let s = 0, c = 0;
    for (let y = 0; y < N; y += 3) for (let x = 0; x < N; x += 3) {
      s += h[y * N + x] * h[y * N + ((x + d) % N)]; c++;
    }
    out.push({ d, cov: s / c });
  }
  return out;
}

const bilinear = (h, N, x, y) => {
  const xf = Math.floor(x), yf = Math.floor(y);
  const tx = x - xf, ty = y - yf;
  const x0 = ((xf % N) + N) % N, y0 = ((yf % N) + N) % N;
  const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
  return (h[y0 * N + x0] * (1 - tx) + h[y0 * N + x1] * tx) * (1 - ty)
       + (h[y1 * N + x0] * (1 - tx) + h[y1 * N + x1] * tx) * ty;
};

/**
 * Trace flow lines of e^{i(h/chi + theta)}. Lines that meet an already-drawn
 * line MERGE — the trace stops, because in imaginary geometry two flow lines
 * of the same angle, once they meet, never separate. The result is a tree.
 */
export function flowLines(field, {
  chi = 1.2, theta = -Math.PI / 2, seeds = [], step = 0.6, maxSteps = 6000,
  mergeRadius = 1.6, W, H, mergeEnabled = true, mergeAfter = 12,
}) {
  const { h, N } = field;
  const gw = Math.ceil(W / mergeRadius), gh = Math.ceil(H / mergeRadius);
  const occ = new Int32Array(gw * gh).fill(-1);
  const lines = [];
  seeds.forEach((s0, id) => {
    let x = s0.x, y = s0.y;
    const pts = [{ x, y }];
    for (let i = 0; i < maxSteps; i++) {
      const a = bilinear(h, N, (x / W) * N, (y / H) * N) / chi + theta;
      x += step * Math.cos(a); y += step * Math.sin(a);
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const gi = ((y / mergeRadius) | 0) * gw + ((x / mergeRadius) | 0);
      // don't let a line merge before it has left its seed's neighbourhood
      if (mergeEnabled && i >= mergeAfter && occ[gi] >= 0 && occ[gi] !== id) { pts.push({ x, y }); break; }
      occ[gi] = id;
      pts.push({ x, y });
    }
    if (pts.length > 4) lines.push({ points: pts, id });
  });
  return lines;
}

/**
 * Add a deterministic HARMONIC function to the field.
 *
 * This is the composition control, and it is native to the theory rather than a
 * hack: in imaginary geometry one studies h + alpha*arg(z - p), and the flow
 * lines near such a point spiral into or out of it (a conical/spiral
 * singularity of the underlying metric). Because the added function is
 * harmonic, it changes the field's MEAN behaviour — where the tree goes — while
 * leaving the log-correlated fluctuation, and hence the merging theorem and the
 * scale invariance, completely intact.
 *
 * sources: [{x, y, winding, strength}] in page coordinates.
 *   winding  — coefficient of arg(z-p): swirls the flow around p
 *   strength — coefficient of log|z-p|: draws flow lines in or pushes them out
 * drift: [ax, ay] — a linear term, the global "wind".
 */
export function addHarmonic(field, { sources = [], drift = [0, 0], gain = 1, W, H }) {
  const { h, N } = field;
  const out = new Float64Array(N * N);
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const px = ((ix + 0.5) / N) * W, py = ((iy + 0.5) / N) * H;
      let u = drift[0] * (px / W) + drift[1] * (py / H);
      for (const s of sources) {
        const dx = px - s.x, dy = py - s.y;
        const r2 = dx * dx + dy * dy + 1e-6;
        if (s.winding) u += s.winding * Math.atan2(dy, dx);
        if (s.strength) u += s.strength * 0.5 * Math.log(r2);
      }
      out[iy * N + ix] = h[iy * N + ix] + gain * u;
    }
  }
  return { h: out, N };
}
