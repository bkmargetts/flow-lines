// ARCTIC — limit shapes of random stepped surfaces.
//
// State: a plane partition  pi[i][j] in [0,c], weakly decreasing in i and j.
// Uniform measure on these <-> uniform lozenge tiling of the a,b,c hexagon
// (equivalently a boxed plane partition / dimer model on the honeycomb).
//
// We draw the INTEGER LEVEL CURVES of the stepped surface. These are not
// resampled contours: level k is exactly the boundary of {pi >= k}, a
// combinatorial monotone staircase, and the family {k=1..c} is exactly the
// non-intersecting-lattice-path ensemble of the dimer model.
//
// Theorem (Cohn-Larsen-Propp 1998): as a,b,c -> infinity the surface has a
// deterministic limit shape, and the boundary between its frozen facets and
// its rough "liquid" region is the ELLIPSE INSCRIBED IN THE HEXAGON, tangent
// to all six sides. Nothing in the sampler knows about an ellipse.
//
// Weight q^volume (Kenyon-Okounkov) deforms the limit shape off the ellipse.
import { rng } from './lab.mjs';

export function samplePlanePartition({ a, b, c, seed = 1, sweeps = 4000, q = 1 }) {
  const r = rng(seed);
  const pi = new Int32Array(a * b);           // start at the minimal surface
  const at = (i, j) => (i < 0 || j < 0 ? c : i >= a || j >= b ? 0 : pi[i * b + j]);
  const logq = Math.log(q);
  const n = a * b;
  for (let s = 0; s < sweeps; s++) {
    for (let t = 0; t < n; t++) {
      const i = (r() * a) | 0, j = (r() * b) | 0;
      const d = r() < 0.5 ? 1 : -1;
      const v = pi[i * b + j] + d;
      if (v < 0 || v > c) continue;
      if (v > Math.min(at(i - 1, j), at(i, j - 1))) continue;
      if (v < Math.max(at(i + 1, j), at(i, j + 1))) continue;
      if (q !== 1 && r() >= Math.exp(d * logq)) continue;  // Metropolis on q^volume
      pi[i * b + j] = v;
    }
  }
  return { pi, a, b, c, get: (i, j) => pi[i * b + j] };
}

/** Integer level curves of the stepped surface, lifted to 3D and iso-projected. */
export function levelCurves(pp, { scale = 12, ox = 0, oy = 0 } = {}) {
  const { a, b, c, get } = pp;
  const C = Math.sqrt(3) / 2;
  const proj = (x, y, z) => ({ x: ox + scale * (x - y) * C, y: oy + scale * ((x + y) / 2 - z) });
  const lines = [];
  for (let k = 1; k <= c; k++) {
    // lambda(i) = #{ j : pi[i][j] >= k } — weakly decreasing, so the boundary
    // of { pi >= k } is a monotone staircase.
    const lam = new Int32Array(a);
    for (let i = 0; i < a; i++) { let m = 0; while (m < b && get(i, m) >= k) m++; lam[i] = m; }
    const pts = [proj(0, lam[0], k)];
    for (let i = 0; i < a; i++) {
      pts.push(proj(i + 1, lam[i], k));
      const next = i + 1 < a ? lam[i + 1] : 0;
      if (next !== lam[i]) pts.push(proj(i + 1, next, k));
    }
    if (pts.length > 1) lines.push({ points: pts, level: k });
  }
  return lines;
}

/** The hexagon boundary, for reference. */
export function hexOutline({ a, b, c }, { scale = 12, ox = 0, oy = 0 } = {}) {
  const C = Math.sqrt(3) / 2;
  const proj = (x, y, z) => ({ x: ox + scale * (x - y) * C, y: oy + scale * ((x + y) / 2 - z) });
  const v = [
    proj(0, 0, c), proj(a, 0, c), proj(a, 0, 0), proj(a, b, 0), proj(0, b, 0), proj(0, b, c),
  ];
  return [{ points: [...v, v[0]] }];
}
