// THE TROPICAL SANDPILE  (Kalinin & Shkolnikov, C. R. Acad. Sci. 354 (2016);
// "Sandpile solitons via smoothing of superharmonic functions", CMP 378 (2020).)
//
// Fill a lattice polygon with the MAXIMAL STABLE STATE — 3 grains on every site,
// one short of toppling everywhere, so the whole domain is poised. Add a single
// extra grain at each of k chosen points and relax by the abelian toppling rule
// (a site with >= 4 grains sends one grain to each neighbour; grains reaching
// the boundary leave).
//
// THEOREM. The relaxation agrees with the maximal stable state almost
// everywhere. The set where it does NOT — the deviation locus — converges,
// after rescaling, to a TROPICAL CURVE passing through the k points: a
// piecewise-linear graph whose edges have rational slopes and integer weights,
// balanced at every vertex. Among all tropical curves through those points it
// is the one minimising tropical symplectic area — a tropical Steiner problem.
//
// So the drawing is not a visualisation of the sandpile. The sandpile is a
// machine that solves a variational problem in tropical geometry, and the
// drawing is its answer. Nothing here is tuned: the slopes are forced to be
// rational, the junctions are forced to balance, and the routing is forced to
// be minimal.
//
// The relaxation is ABELIAN — the final state is independent of toppling order —
// so the result is exactly deterministic given the domain and the points.

export const MAX_STABLE = 3;

/**
 * @param inside (x,y) => boolean — the lattice domain; outside acts as sink.
 * @param points [[x,y],...] lattice sites receiving one extra grain.
 */
export function relax(W, H, inside, points, { maxTopples = 4e9 } = {}) {
  const st = new Int8Array(W * H);
  const dom = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (inside(x, y)) { dom[y * W + x] = 1; st[y * W + x] = MAX_STABLE; }
    }
  }
  const queue = new Int32Array(W * H * 4);
  let qh = 0, qt = 0;
  const inQ = new Uint8Array(W * H);
  const push = (i) => { if (!inQ[i]) { inQ[i] = 1; queue[qt++] = i; if (qt === queue.length) qt = 0; } };
  for (const [px, py] of points) {
    const i = py * W + px;
    if (!dom[i]) continue;
    st[i] += 1;
    if (st[i] > MAX_STABLE) push(i);
  }
  let topples = 0;
  while (qh !== qt) {
    const i = queue[qh++]; if (qh === queue.length) qh = 0;
    inQ[i] = 0;
    if (!dom[i] || st[i] <= MAX_STABLE) continue;
    const n = st[i] >> 2;                 // topple as many times as possible at once
    st[i] -= 4 * n;
    topples += n;
    if (topples > maxTopples) throw new Error('toppling budget exceeded');
    const x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || !dom[j]) continue;     // off-domain: the grain leaves
      st[j] += n;
      if (st[j] > MAX_STABLE) push(j);
    }
    if (st[i] > MAX_STABLE) push(i);
  }
  // deviation locus: where the relaxed state differs from the maximal stable one
  const dev = new Uint8Array(W * H);
  let count = 0;
  for (let i = 0; i < W * H; i++) if (dom[i] && st[i] !== MAX_STABLE) { dev[i] = 1; count++; }
  return { state: st, dom, dev, count, topples, W, H };
}

export const domains = {
  rect: (W, H, m = 2) => (x, y) => x >= m && y >= m && x < W - m && y < H - m,
  disk: (W, H, m = 2) => {
    const cx = (W - 1) / 2, cy = (H - 1) / 2, r = Math.min(cx, cy) - m;
    return (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  },
  ngon: (W, H, k, rot = 0, m = 2) => {
    const cx = (W - 1) / 2, cy = (H - 1) / 2, r = Math.min(cx, cy) - m;
    const V = Array.from({ length: k }, (_, i) => {
      const t = rot + (2 * Math.PI * i) / k;
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
    });
    return (x, y) => {
      for (let i = 0; i < k; i++) {
        const a = V[i], b = V[(i + 1) % k];
        if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
      }
      return true;
    };
  },
};
