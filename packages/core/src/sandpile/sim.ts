/**
 * The tropical sandpile (Kalinin & Shkolnikov, C. R. Acad. Sci. 354 (2016);
 * "Sandpile solitons via smoothing of superharmonic functions", CMP 378 (2020)).
 *
 * Fill a lattice polygon with the MAXIMAL STABLE STATE — 3 grains on every site,
 * one short of toppling everywhere, so the whole domain is poised. Add a single
 * extra grain at each of k chosen points and relax by the abelian toppling rule:
 * a site holding 4 or more sends one grain to each neighbour, and grains that
 * reach the boundary leave.
 *
 * THEOREM. The relaxation agrees with the maximal stable state almost
 * everywhere. The set where it does NOT — the deviation locus — converges, after
 * rescaling, to a TROPICAL CURVE passing through the k points: a piecewise-
 * linear graph whose edges have rational slopes and integer weights, balanced at
 * every vertex. Among all tropical curves through those points it is the one
 * minimising tropical symplectic area — a tropical Steiner problem.
 *
 * So the drawing is not a picture of a sandpile. The sandpile is a machine that
 * solves a variational problem in tropical geometry, and the drawing is its
 * answer. Nothing here is tuned: the straightness, the rational slopes, the
 * balanced trivalent junctions and the routing are all forced.
 *
 * Relaxation is ABELIAN — the final state does not depend on toppling order — so
 * the result is exactly deterministic given the domain and the points, with no
 * seed entering the physics at all (the seed only places the points).
 */

/** One short of toppling on the square lattice, where the threshold is 4. */
export const MAX_STABLE = 3;

export interface SandpileResult {
  /** Final grain count per site. */
  state: Int8Array;
  /** 1 where the site is inside the lattice domain. */
  domain: Uint8Array;
  /** 1 where the relaxed state differs from the maximal stable state. */
  deviation: Uint8Array;
  /** Number of deviating sites — grows like the lattice side, not its area. */
  count: number;
  /** Total topplings performed. */
  topples: number;
  width: number;
  height: number;
}

export interface SandpileParams {
  width: number;
  height: number;
  /** Membership test for the lattice domain; outside acts as a sink. */
  inside: (x: number, y: number) => boolean;
  /** Lattice sites receiving one extra grain. */
  points: [number, number][];
  /**
   * Hard cap on topplings, so a pathological domain cannot spin forever.
   * Cost is roughly cubic in the lattice side.
   */
  maxTopples?: number;
}

/** Relax the maximal stable state perturbed at `points`. */
export function relaxSandpile(params: SandpileParams): SandpileResult {
  const { width: W, height: H, inside, points, maxTopples = 4e9 } = params;
  const state = new Int8Array(W * H);
  const domain = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (inside(x, y)) {
        domain[y * W + x] = 1;
        state[y * W + x] = MAX_STABLE;
      }
    }
  }

  // A ring buffer of unstable sites. Abelian, so any order gives the same
  // answer; FIFO just keeps the frontier shallow.
  const queue = new Int32Array(W * H + 1);
  const queued = new Uint8Array(W * H);
  let head = 0;
  let tail = 0;
  const cap = queue.length;
  const push = (i: number) => {
    if (queued[i]) return;
    queued[i] = 1;
    queue[tail] = i;
    tail = (tail + 1) % cap;
  };

  for (const [px, py] of points) {
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const i = py * W + px;
    if (!domain[i]) continue;
    state[i] += 1;
    if (state[i] > MAX_STABLE) push(i);
  }

  let topples = 0;
  while (head !== tail) {
    const i = queue[head];
    head = (head + 1) % cap;
    queued[i] = 0;
    if (!domain[i] || state[i] <= MAX_STABLE) continue;
    // Topple as many times as the site can afford in one go.
    const n = state[i] >> 2;
    state[i] -= 4 * n;
    topples += n;
    if (topples > maxTopples) break;
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0 && domain[i - 1]) {
      state[i - 1] += n;
      if (state[i - 1] > MAX_STABLE) push(i - 1);
    }
    if (x < W - 1 && domain[i + 1]) {
      state[i + 1] += n;
      if (state[i + 1] > MAX_STABLE) push(i + 1);
    }
    if (y > 0 && domain[i - W]) {
      state[i - W] += n;
      if (state[i - W] > MAX_STABLE) push(i - W);
    }
    if (y < H - 1 && domain[i + W]) {
      state[i + W] += n;
      if (state[i + W] > MAX_STABLE) push(i + W);
    }
    if (state[i] > MAX_STABLE) push(i);
  }

  const deviation = new Uint8Array(W * H);
  let count = 0;
  for (let i = 0; i < W * H; i++) {
    if (domain[i] && state[i] !== MAX_STABLE) {
      deviation[i] = 1;
      count++;
    }
  }
  return { state, domain, deviation, count, topples, width: W, height: H };
}
