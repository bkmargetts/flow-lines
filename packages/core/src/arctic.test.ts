import { describe, it, expect } from 'vitest';
import {
  generateArctic,
  shuffleAztec,
  isPerfectTiling,
  dominoClass,
  ARCTIC_PRESETS,
  type ArcticPreset,
} from './index.js';

const PRESETS = Object.keys(ARCTIC_PRESETS) as ArcticPreset[];

describe('domino shuffling', () => {
  it('produces a perfect tiling of AD(n) at every size', () => {
    for (const order of [1, 2, 3, 8, 30, 90]) {
      const tiling = shuffleAztec(order, 12345);
      expect(isPerfectTiling(tiling, order), `order ${order}`).toBe(true);
      // |AD(n)| = 2n(n+1) cells, so n(n+1) dominoes.
      expect(tiling.length).toBe(order * (order + 1));
    }
  });

  it('is exactly deterministic per seed, and varies with it', () => {
    const a = shuffleAztec(40, 99);
    const b = shuffleAztec(40, 99);
    const c = shuffleAztec(40, 100);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('uses all four domino classes, in balanced proportion', () => {
    const order = 80;
    const counts = { N: 0, S: 0, E: 0, W: 0 };
    for (const d of shuffleAztec(order, 7)) counts[dominoClass(d, order)]++;
    for (const cls of ['N', 'S', 'E', 'W'] as const) {
      expect(counts[cls], `class ${cls}`).toBeGreaterThan(0);
    }
    // By the diamond's symmetry no class should dominate; the arctic circle
    // leaves each one owning roughly a quarter of the tiling.
    const total = order * (order + 1);
    for (const cls of ['N', 'S', 'E', 'W'] as const) {
      expect(counts[cls] / total).toBeGreaterThan(0.15);
      expect(counts[cls] / total).toBeLessThan(0.35);
    }
  });
});

describe('generateArctic', () => {
  it('renders every preset inside the page box', () => {
    for (const preset of PRESETS) {
      const r = generateArctic({ width: 400, height: 400, margin: 20, seed: 3, preset });
      expect(r.lines.length, preset).toBeGreaterThan(20);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y), preset).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(-1);
          expect(p.y).toBeGreaterThanOrEqual(-1);
          expect(p.x).toBeLessThanOrEqual(401);
          expect(p.y).toBeLessThanOrEqual(401);
        }
      }
    }
  });

  it('is deterministic per seed', () => {
    const opts = { width: 300, height: 300, seed: 42, preset: 'dissolve' as const };
    expect(generateArctic(opts)).toEqual(generateArctic(opts));
    expect(generateArctic({ ...opts, seed: 43 })).not.toEqual(generateArctic(opts));
  });

  /**
   * The point of the whole module: inking one domino class makes the FROZEN
   * corner weld into page-length rules while the liquid interior stays broken
   * dashes. If welding stopped working the drawing would lose its tone, so pin
   * the ratio rather than the exact geometry.
   */
  it('welds the frozen corner into runs far longer than the liquid interior', () => {
    const r = generateArctic({
      width: 600,
      height: 600,
      seed: 20260821,
      preset: 'dissolve',
      order: 80,
      wobble: 0,
    });
    const lengths = r.lines
      .map((l) => {
        let d = 0;
        for (let i = 1; i < l.points.length; i++) {
          d += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
        return d;
      })
      .sort((a, b) => a - b);
    const median = lengths[lengths.length >> 1];
    const longest = lengths[lengths.length - 1];
    // One domino spans 2 lattice units, and AD(80) spans about 2*80 of them
    // across a 600px page — so measure the weld in dominoes, not in pixels,
    // and the assertion holds at any order or page size.
    const dominoPx = (2 * 600) / (2 * 80);
    expect(longest / dominoPx).toBeGreaterThan(15);
    // ...while the typical liquid-region dash is a couple of dominoes long.
    expect(median).toBeLessThan(longest / 10);
  });

  it('tags each stroke with its domino class for per-pen export', () => {
    const r = generateArctic({ width: 300, height: 300, seed: 5, preset: 'weave' });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers).toEqual(new Set(['domino-n', 'domino-s', 'domino-e', 'domino-w']));
  });

  it('emits only straight two-point segments when wobble is off', () => {
    const r = generateArctic({ width: 300, height: 300, seed: 5, preset: 'brick', wobble: 0 });
    expect(r.lines.every((l) => l.points.length === 2)).toBe(true);
  });
});
