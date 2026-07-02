/**
 * Shared seeded-randomness helpers — internal to core (not part of the public
 * API). Every generator draws its scalar randomness from the same LCG so a
 * seed means the same thing everywhere; the bodies here were lifted verbatim
 * from the per-module copies and must never change behaviour (the golden
 * suite pins every generator's output per seed).
 */

/** Deterministic LCG: a [0, 1) stream from an integer seed — the repo-standard
 *  scalar RNG (SimplexNoise seeds its permutation with the same recurrence). */
export function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** The default seed when the caller didn't pass one: random but small enough
 *  to read, type, and share. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1000000);
}

/** Derive a per-panel/per-pass sub-seed: deterministic, cheap, and spread far
 *  enough apart that adjacent panels don't correlate. */
export function subSeed(seed: number, index: number): number {
  return seed + index * 9301 + 7;
}
