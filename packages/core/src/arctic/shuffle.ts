import { makeRandom } from '../lib/rng.js';

/**
 * Domino shuffling on the Aztec diamond (Elkies–Kuperberg–Larsen–Propp 1992).
 * EXACT uniform sampling in O(n²) — no Markov chain, no mixing question.
 *
 * AD(n) = unit cells (x, y) with |x + 1/2| + |y + 1/2| <= n, so |AD(n)| = 2n(n+1)
 * cells and n(n+1) dominoes.
 *
 * Direction is fixed by the parity p = (x + y + n) mod 2:
 *   horizontal domino, left cell (x, y):    p === 0 -> N (up)     else S (down)
 *   vertical   domino, bottom cell (x, y):  p === 0 -> E (right)  else W (left)
 * A "bad block" is a 2×2 block whose two parallel dominoes converge; they
 * annihilate. Survivors slide one step, and every vacated 2×2 block is refilled
 * with a diverging pair — horizontal or vertical — by one fair coin.
 *
 * Note the shuffle consumes MORE than log2 of the tiling count: a bad block's
 * contents are destroyed and resampled, so it is not a bijection on tilings,
 * merely measure-preserving. (AD(n) has 2^{n(n+1)/2} tilings, but the coin count
 * exceeds n(n+1)/2 whenever a bad block appears.)
 *
 * Arctic circle theorem (Jockusch–Propp–Shor 1998): the boundary between the
 * four frozen corners and the disordered centre converges to the circle
 * inscribed in the diamond. Nothing in the algorithm mentions a circle — the
 * tone and the boundary in the drawing are both consequences.
 */
export interface Domino {
  /** Left cell for a horizontal domino, bottom cell for a vertical one. */
  x: number;
  y: number;
  /** True for horizontal (covers (x,y) and (x+1,y)). */
  h: boolean;
}

export type DominoClass = 'N' | 'S' | 'E' | 'W';

/** Which of the four classes a domino belongs to, at diamond order `n`. */
export function dominoClass(d: Domino, n: number): DominoClass {
  const p = (((d.x + d.y + n) % 2) + 2) % 2;
  return d.h ? (p === 0 ? 'N' : 'S') : (p === 0 ? 'E' : 'W');
}

const key = (x: number, y: number) => `${x},${y}`;

/** Sample a uniformly random domino tiling of AD(order). */
export function shuffleAztec(order: number, seed: number): Domino[] {
  const rng = makeRandom(seed);
  let dominoes: Domino[] = [];
  for (let n = 1; n <= order; n++) {
    const m = n - 1; // parity of the tiling we currently hold
    const dir = (d: Domino) => dominoClass(d, m);

    // 1. annihilate converging pairs
    const byPos = new Map<string, Domino>();
    for (const d of dominoes) byPos.set(`${d.h ? 'h' : 'v'}:${d.x},${d.y}`, d);
    const dead = new Set<Domino>();
    for (const d of dominoes) {
      const dd = dir(d);
      if (dd === 'N') {
        const up = byPos.get(`h:${d.x},${d.y + 1}`);
        if (up && dir(up) === 'S') {
          dead.add(d);
          dead.add(up);
        }
      } else if (dd === 'E') {
        const right = byPos.get(`v:${d.x + 1},${d.y}`);
        if (right && dir(right) === 'W') {
          dead.add(d);
          dead.add(right);
        }
      }
    }

    // 2. slide the survivors one step
    const moved: Domino[] = [];
    for (const d of dominoes) {
      if (dead.has(d)) continue;
      const dd = dir(d);
      moved.push({
        x: d.x + (dd === 'E' ? 1 : dd === 'W' ? -1 : 0),
        y: d.y + (dd === 'N' ? 1 : dd === 'S' ? -1 : 0),
        h: d.h,
      });
    }

    // 3. refill every vacated 2×2 block with a diverging pair
    const covered = new Set<string>();
    const cover = (d: Domino) => {
      covered.add(key(d.x, d.y));
      covered.add(key(d.x + (d.h ? 1 : 0), d.y + (d.h ? 0 : 1)));
    };
    for (const d of moved) cover(d);
    const inAD = (x: number, y: number) => Math.abs(x + 0.5) + Math.abs(y + 0.5) <= n;
    for (let x = -n; x < n; x++) {
      for (let y = -n; y < n; y++) {
        if ((((x + y + n) % 2) + 2) % 2 !== 1) continue; // block parity
        if (!inAD(x, y) || !inAD(x + 1, y) || !inAD(x, y + 1) || !inAD(x + 1, y + 1)) continue;
        if (
          covered.has(key(x, y)) ||
          covered.has(key(x + 1, y)) ||
          covered.has(key(x, y + 1)) ||
          covered.has(key(x + 1, y + 1))
        ) {
          continue;
        }
        // Diagonal neighbours in the same parity class overlap, so a newly
        // created pair must join the covered set immediately.
        const made: Domino[] =
          rng() < 0.5
            ? [
                { x, y, h: true },
                { x, y: y + 1, h: true },
              ]
            : [
                { x, y, h: false },
                { x: x + 1, y, h: false },
              ];
        moved.push(...made);
        made.forEach(cover);
      }
    }
    dominoes = moved;
  }
  return dominoes;
}

/** True when `dominoes` is a perfect tiling of AD(order) — the sampler's invariant. */
export function isPerfectTiling(dominoes: Domino[], order: number): boolean {
  const seen = new Set<string>();
  for (const d of dominoes) {
    const cells: [number, number][] = [
      [d.x, d.y],
      [d.x + (d.h ? 1 : 0), d.y + (d.h ? 0 : 1)],
    ];
    for (const [x, y] of cells) {
      const k = key(x, y);
      if (seen.has(k)) return false;
      if (Math.abs(x + 0.5) + Math.abs(y + 0.5) > order) return false;
      seen.add(k);
    }
  }
  return seen.size === 2 * order * (order + 1);
}
