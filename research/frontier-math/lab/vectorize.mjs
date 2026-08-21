// Lattice locus -> plottable polylines.
// The deviation locus is a thin lattice set whose limit edges are STRAIGHT with
// rational slopes, so: thin to one pixel, trace the graph between junctions,
// then Douglas-Peucker. Because the edges really are straight, DP collapses
// each one to exactly two points — the simplification is exact, not lossy.

/** Zhang-Suen thinning. */
export function thin(src, W, H) {
  const a = Uint8Array.from(src);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : a[y * W + x]);
  let changed = true;
  const doomed = [];
  while (changed) {
    changed = false;
    for (const sub of [0, 1]) {
      doomed.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!a[y * W + x]) continue;
          const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1),
                     at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
          const B = p.reduce((s, v) => s + v, 0);
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let i = 0; i < 8; i++) if (p[i] === 0 && p[(i + 1) % 8] === 1) A++;
          if (A !== 1) continue;
          if (sub === 0) {
            if (p[0] * p[2] * p[4] !== 0) continue;
            if (p[2] * p[4] * p[6] !== 0) continue;
          } else {
            if (p[0] * p[2] * p[6] !== 0) continue;
            if (p[0] * p[4] * p[6] !== 0) continue;
          }
          doomed.push(y * W + x);
        }
      }
      for (const i of doomed) a[i] = 0;
      if (doomed.length) changed = true;
    }
  }
  return a;
}

const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Trace a thinned skeleton into polylines between junctions/endpoints. */
export function traceSkeleton(sk, W, H) {
  const deg = new Uint8Array(W * H);
  const nbrs = (x, y) => {
    const o = [];
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && sk[ny * W + nx]) o.push([nx, ny]);
    }
    return o;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sk[y * W + x]) deg[y * W + x] = nbrs(x, y).length;
  const usedEdge = new Set();
  const ek = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const lines = [];
  const walk = (sx, sy, fx, fy) => {
    const pts = [[sx, sy]];
    let px = sx, py = sy, cx = fx, cy = fy;
    for (;;) {
      pts.push([cx, cy]);
      if (deg[cy * W + cx] !== 2) break;
      const nb = nbrs(cx, cy).filter(([nx, ny]) => !(nx === px && ny === py));
      if (nb.length !== 1) break;
      px = cx; py = cy; [cx, cy] = nb[0];
      if (usedEdge.has(ek(py * W + px, cy * W + cx))) break;
      usedEdge.add(ek(py * W + px, cy * W + cx));
    }
    return pts;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!sk[i] || deg[i] === 2) continue;
      for (const [nx, ny] of nbrs(x, y)) {
        const k = ek(i, ny * W + nx);
        if (usedEdge.has(k)) continue;
        usedEdge.add(k);
        lines.push(walk(x, y, nx, ny));
      }
    }
  }
  // leftover pure cycles (every pixel degree 2)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!sk[i] || deg[i] !== 2) continue;
      const nb = nbrs(x, y);
      const k = ek(i, nb[0][1] * W + nb[0][0]);
      if (usedEdge.has(k)) continue;
      usedEdge.add(k);
      lines.push(walk(x, y, nb[0][0], nb[0][1]));
    }
  }
  return lines;
}

/** Douglas-Peucker. On genuinely straight edges this is exact. */
export function simplify(pts, tol = 1.2) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j <= i + 1) continue;
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / L;
      if (d > best) { best = d; bi = k; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([i, bi], [bi, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Grow MAXIMAL STRAIGHT RUNS out of a thinned lattice locus.
 *
 * 8-connected chain tracing fails here: an edge of rational slope p/q renders
 * as a staircase, and every step of the stair reads as a degree-3 junction. But
 * the limit edges are genuinely straight, so the right primitive is not "follow
 * the chain" but "extend while the pixels stay collinear". Each accepted run is
 * one edge of the tropical curve.
 *
 * DEFAULTS ARE A PLOT BUDGET, NOT A FIDELITY SETTING. At A3 with 15mm margins a
 * 701 lattice is 0.38mm per unit, and tol=1.1/minLen=4 puts HALF the segments
 * under 3mm — the regime where a lattice construction stops reading as a
 * woodcut and starts reading as a jaggy circle on graph paper. tol=2.0/minLen=10
 * drops that to 3% with a median segment of 12mm, keeps 86% of the locus, and
 * is visually indistinguishable: the discarded filigree is finer than a 0.3mm
 * nib can render anyway. Lower them only if you are plotting much larger.
 */
export function straightRuns(sk, W, H, { tol = 2.0, minLen = 10 } = {}) {
  const used = new Uint8Array(W * H);
  const px = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sk[y * W + x]) px.push([x, y]);
  const has = (x, y) => x >= 0 && y >= 0 && x < W && y < H && sk[y * W + x] && !used[y * W + x];
  const maxDev = (pts, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let m = 0;
    for (const p of pts) {
      const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L;
      if (d > m) m = d;
    }
    return m;
  };
  const grow = (seed) => {
    let pts = [seed];
    used[seed[1] * W + seed[0]] = 1;
    for (const endIdx of [1, 0]) {                    // extend forward, then back
      for (;;) {
        const tip = endIdx ? pts[pts.length - 1] : pts[0];
        const anchor = endIdx ? pts[0] : pts[pts.length - 1];
        let best = null, bestDev = Infinity;
        for (const [dx, dy] of N8) {
          const nx = tip[0] + dx, ny = tip[1] + dy;
          if (!has(nx, ny)) continue;
          const cand = [nx, ny];
          const dev = maxDev([...pts, cand], anchor, cand);
          if (dev <= tol && dev < bestDev) { bestDev = dev; best = cand; }
        }
        if (!best) break;
        used[best[1] * W + best[0]] = 1;
        if (endIdx) pts.push(best); else pts.unshift(best);
      }
    }
    return pts;
  };
  const runs = [];
  // seed from the extremes first so long edges are claimed before short ones
  for (const p of px) {
    if (used[p[1] * W + p[0]]) continue;
    const r = grow(p);
    if (r.length >= minLen) runs.push([r[0], r[r.length - 1]]);
  }
  return runs;
}
