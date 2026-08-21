// THE TROPICAL CAUSTIC OF A CONVEX DOMAIN
//
// Kalinin & Shkolnikov (tropical curves in sandpiles, 2016-2020);
// Mikhalkin & Shkolnikov, "Wave fronts and caustics in the tropical plane"
// (arXiv:2310.17269); Shkolnikov, "Planar tropical caustics: trivalency and
// convexity" (arXiv:2503.11137, 2025).
//
// WHERE IT COMES FROM. Fill a large lattice polygon with the maximal stable
// sandpile state (3 grains on every site), drop ONE more grain, and relax. The
// set of sites that changed converges, after rescaling, to a tropical curve —
// a piecewise-linear graph with rational-slope edges and integer weights
// obeying a balancing condition at every vertex. For a convex domain that
// limit is canonical, and it is this:
//
//     F_Phi(x) = min_{v in Z^2 \ 0} ( h_Phi(v) - <v,x> ),   h_Phi(v) = sup_{y in Phi} <v,y>
//
// K_Phi = the corner locus (non-differentiability set) of F_Phi.
//
// F is a minimum of AFFINE functions, one per integer covector, so it is
// concave piecewise linear and its corner locus is the edge set of a power
// (Laguerre) diagram — exactly computable, no simulation needed.
//
// Two facts worth knowing before looking at a picture:
//  * v = 0 must be excluded: h(0) - 0 = 0 and every other term is >= 0 on Phi,
//    so including it would make F identically zero.
//  * Non-primitive v = k*u never wins strictly inside Phi, since
//    h(ku) - <ku,x> = k(h(u) - <u,x>) and that bracket is >= 0 there.
//    Only PRIMITIVE integer vectors appear — which is why the branchings carry
//    Farey / Stern-Brocot combinatorics.
//
// The caustic is finite iff Phi is a polygon with rational-slope sides. For a
// disk it is an infinite tree whose branches accumulate on the boundary; N (the
// covector cutoff) is therefore a level-of-detail dial, not an approximation
// error — raising it refines near the edge and leaves the drawn part alone.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };

/** Support function of a convex polygon, h(v) = max over vertices of <v, y>. */
export function supportFn(poly) {
  return (vx, vy) => {
    let m = -Infinity;
    for (const p of poly) { const d = vx * p[0] + vy * p[1]; if (d > m) m = d; }
    return m;
  };
}

/** Primitive integer covectors with |v|_inf <= N, ordered by length. */
export function covectors(N) {
  const out = [];
  for (let a = -N; a <= N; a++) {
    for (let b = -N; b <= N; b++) {
      if (a === 0 && b === 0) continue;
      if (gcd(a, b) !== 1) continue;          // non-primitive never wins inside
      out.push([a, b, Math.hypot(a, b)]);
    }
  }
  out.sort((p, q) => p[2] - q[2]);
  return out;
}

/** Clip a convex polygon by the half-plane  ax + by <= c. */
function clipHalf(poly, a, b, c) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
    if (dp <= 1e-12) out.push(p);
    if ((dp > 1e-12 && dq < -1e-12) || (dp < -1e-12 && dq > 1e-12)) {
      const t = dp / (dp - dq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

export const polyArea = (P) => {
  let a = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
};

/**
 * The caustic: cell(v) = { x in Phi : h(v)-<v,x> <= h(w)-<w,x> for all w },
 * i.e. Phi clipped by <w-v, x> <= h(w)-h(v). Collect every cell edge that is
 * not on the boundary of Phi.
 */
export function tropicalCaustic(poly, N, { minCellArea = 1e-9 } = {}) {
  const h = supportFn(poly);
  const V = covectors(N);
  const hv = V.map(([a, b]) => h(a, b));
  const cells = [];
  const domainArea = polyArea(poly);
  for (let i = 0; i < V.length; i++) {
    let cell = poly;
    const [vx, vy] = V[i];
    for (let j = 0; j < V.length && cell.length >= 3; j++) {
      if (j === i) continue;
      const [wx, wy] = V[j];
      cell = clipHalf(cell, wx - vx, wy - vy, hv[j] - hv[i]);
    }
    if (cell.length >= 3 && polyArea(cell) > minCellArea * domainArea) {
      cells.push({ v: V[i], cell });
    }
  }
  // dedupe: an interior edge is shared by exactly two cells; a boundary edge by one
  const key = (p, q) => {
    const r = (z) => Math.round(z * 1e7) / 1e7;
    const A = [r(p[0]), r(p[1])].join(','), B = [r(q[0]), r(q[1])].join(',');
    return A < B ? A + '|' + B : B + '|' + A;
  };
  const count = new Map();
  for (const { cell } of cells) {
    for (let i = 0; i < cell.length; i++) {
      const p = cell[i], q = cell[(i + 1) % cell.length];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9) continue;
      const k = key(p, q);
      const e = count.get(k);
      if (e) e.n++; else count.set(k, { n: 1, p, q });
    }
  }
  const edges = [];
  for (const { n, p, q } of count.values()) if (n >= 2) edges.push([p, q]);
  return { edges, cells };
}

/** Convex shapes to feed it. */
export const shapes = {
  square: (s = 1) => [[0, 0], [s, 0], [s, s], [0, s]],
  disk: (r = 1, n = 256, cx = 0, cy = 0) =>
    Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
    }),
  ellipse: (a, b, n = 256, rot = 0) =>
    Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      const x = a * Math.cos(t), y = b * Math.sin(t);
      return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
    }),
  ngon: (k, r = 1, rot = 0) =>
    Array.from({ length: k }, (_, i) => {
      const t = rot + (2 * Math.PI * i) / k;
      return [r * Math.cos(t), r * Math.sin(t)];
    }),
};

/**
 * TROPICAL WAVE FRONTS.  F is concave, so its superlevel set
 *     { F >= c } = intersect over v of { <v,x> <= h(v) - c }
 * is a convex polygon whose edge normals are INTEGER covectors. Offsetting Phi
 * inward through increasing c gives a family of nested polygons whose edges
 * shrink and vanish one at a time; each vanishing is a trivalent vertex of the
 * caustic, and the corners trace the caustic out. (Mikhalkin-Shkolnikov, "Wave
 * fronts and caustics in the tropical plane".)
 *
 * The point: a Euclidean inward offset of a disk is just a smaller disk. The
 * TROPICAL offset is a lattice polygon that must keep re-choosing which integer
 * normals it can afford, so it changes combinatorial type over and over on the
 * way in. Every one of those changes is a branch of the tree.
 */
export function waveFronts(poly, N, levels, { box = 4 } = {}) {
  const h = supportFn(poly);
  const V = covectors(N);
  const hv = V.map(([a, b]) => h(a, b));
  const fronts = [];
  for (const c of levels) {
    let P = [[-box, -box], [box, -box], [box, box], [-box, box]];
    for (let k = 0; k < V.length && P.length >= 3; k++) {
      P = clipHalf(P, V[k][0], V[k][1], hv[k] - c);
    }
    if (P.length >= 3) fronts.push({ c, poly: P });
  }
  return fronts;
}

/** Largest c for which the front is still non-empty (the tropical inradius). */
export function tropicalInradius(poly, N) {
  let lo = 0, hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const f = waveFronts(poly, N, [mid]);
    if (f.length && polyArea(f[0].poly) > 1e-12) lo = mid; else hi = mid;
  }
  return lo;
}
