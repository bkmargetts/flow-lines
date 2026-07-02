/**
 * Shared scalar math micro-helpers — internal to core (not part of the public
 * API). Lifted verbatim from the per-module copies; identical arithmetic, so
 * consolidation cannot change output (the golden suite pins it).
 */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
