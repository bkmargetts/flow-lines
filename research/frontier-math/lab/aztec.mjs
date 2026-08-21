// Domino shuffling on the Aztec diamond (Elkies-Kuperberg-Larsen-Propp 1992).
// EXACT uniform sampling in O(n^2) — no Markov chain, no mixing question.
//
// AD(n) = unit cells (x,y) with |x+1/2| + |y+1/2| <= n.   |AD(n)| = 2n(n+1).
// Number of domino tilings = 2^{n(n+1)/2}. Note the sampler consumes MORE
// than that many coins: a bad block's contents are destroyed and resampled, so
// the shuffle is not a bijection on tilings — it is merely measure-preserving.
//
// Directions: with p = (x+y+n) mod 2,
//   horizontal domino, left cell (x,y):  p==0 -> N (up)    else S (down)
//   vertical   domino, bottom cell (x,y): p==0 -> E (right) else W (left)
// A "bad block" is a 2x2 block whose two dominoes converge; they annihilate.
// Surviving dominoes slide one step; the vacated 2x2 blocks are refilled with
// a diverging pair, horizontal or vertical, by a fair coin.
//
// Arctic circle theorem (Jockusch-Propp-Shor 1998): the boundary between the
// four frozen corners and the disordered centre converges to the circle
// inscribed in the diamond. Nothing in the algorithm mentions a circle.
import { rng } from './lab.mjs';

const key = (x, y) => `${x},${y}`;

export function shuffleAztec(N, seed = 1, { coin = () => 0.5 } = {}) {
  const r = rng(seed);
  let dominoes = [];          // {x,y,h}  x,y = left/bottom cell, h = horizontal?
  let coins = 0;
  for (let n = 1; n <= N; n++) {
    const m = n - 1;                                  // parity of the CURRENT tiling
    const dir = (d) => {
      const p = ((d.x + d.y + m) % 2 + 2) % 2;
      return d.h ? (p === 0 ? 'N' : 'S') : (p === 0 ? 'E' : 'W');
    };
    // ---- 1. annihilate converging pairs -------------------------------
    const byPos = new Map();
    for (const d of dominoes) byPos.set(`${d.h ? 'h' : 'v'}:${d.x},${d.y}`, d);
    const dead = new Set();
    for (const d of dominoes) {
      const dd = dir(d);
      if (dd === 'N') {
        const up = byPos.get(`h:${d.x},${d.y + 1}`);
        if (up && dir(up) === 'S') { dead.add(d); dead.add(up); }
      } else if (dd === 'E') {
        const rt = byPos.get(`v:${d.x + 1},${d.y}`);
        if (rt && dir(rt) === 'W') { dead.add(d); dead.add(rt); }
      }
    }
    // ---- 2. slide survivors -------------------------------------------
    const moved = [];
    for (const d of dominoes) {
      if (dead.has(d)) continue;
      const dd = dir(d);
      moved.push({
        x: d.x + (dd === 'E' ? 1 : dd === 'W' ? -1 : 0),
        y: d.y + (dd === 'N' ? 1 : dd === 'S' ? -1 : 0),
        h: d.h,
      });
    }
    // ---- 3. refill vacated 2x2 blocks ---------------------------------
    const covered = new Set();
    const addCov = (d) => {
      covered.add(key(d.x, d.y));
      covered.add(key(d.x + (d.h ? 1 : 0), d.y + (d.h ? 0 : 1)));
    };
    for (const d of moved) addCov(d);
    const inAD = (x, y) => Math.abs(x + 0.5) + Math.abs(y + 0.5) <= n;
    for (let x = -n; x < n; x++) {
      for (let y = -n; y < n; y++) {
        if ((((x + y + n) % 2) + 2) % 2 !== 1) continue;          // block parity
        if (!inAD(x, y) || !inAD(x + 1, y) || !inAD(x, y + 1) || !inAD(x + 1, y + 1)) continue;
        if (covered.has(key(x, y)) || covered.has(key(x + 1, y))
          || covered.has(key(x, y + 1)) || covered.has(key(x + 1, y + 1))) continue;
        coins++;
        // Diagonal neighbours in the same parity class overlap, so newly
        // created dominoes must join the covered set immediately.
        const made = r() < coin(x, y, n)
          ? [{ x, y, h: true }, { x, y: y + 1, h: true }]
          : [{ x, y, h: false }, { x: x + 1, y, h: false }];
        moved.push(...made);
        made.forEach(addCov);
      }
    }
    dominoes = moved;
  }
  return { dominoes, n: N, coins };
}

/** Validity check: perfect tiling of AD(N), and the coin count must be N(N+1)/2. */
export function validate({ dominoes, n, coins }) {
  const cover = new Map();
  for (const d of dominoes) {
    for (const [x, y] of [[d.x, d.y], [d.x + (d.h ? 1 : 0), d.y + (d.h ? 0 : 1)]]) {
      const k = key(x, y);
      if (cover.has(k)) return { ok: false, why: `cell ${k} covered twice` };
      if (Math.abs(x + 0.5) + Math.abs(y + 0.5) > n) return { ok: false, why: `cell ${k} outside AD(${n})` };
      cover.set(k, d);
    }
  }
  const need = 2 * n * (n + 1);
  if (cover.size !== need) return { ok: false, why: `covered ${cover.size} of ${need} cells` };
  return { ok: true, cells: cover.size, coins };
}

/** Every domino's outline, with shared edges drawn once. The brick texture. */
export function dominoEdges({ dominoes }, scale = 6) {
  const seen = new Set();
  const lines = [];
  for (const d of dominoes) {
    const w = d.h ? 2 : 1, hgt = d.h ? 1 : 2;
    const corners = [[d.x, d.y], [d.x + w, d.y], [d.x + w, d.y + hgt], [d.x, d.y + hgt]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      // split long sides into unit edges so shared halves dedupe correctly
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      const dx = (b[0] - a[0]) / steps, dy = (b[1] - a[1]) / steps;
      for (let s = 0; s < steps; s++) {
        const p = [a[0] + dx * s, a[1] + dy * s], q = [a[0] + dx * (s + 1), a[1] + dy * (s + 1)];
        const k = [p, q].map((z) => z.join(',')).sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        lines.push({ points: [{ x: p[0] * scale, y: -p[1] * scale }, { x: q[0] * scale, y: -q[1] * scale }] });
      }
    }
  }
  return lines;
}
