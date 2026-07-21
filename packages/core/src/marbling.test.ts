import { describe, it, expect } from 'vitest';
import { generateMarbling, inkLayerName, MARBLING_POINT_CAP } from './marbling/index.js';
import { applyDrop, applyTine, applyVortex } from './marbling/ops.js';
import { makeCircleRing, applyOpToRing } from './marbling/rings.js';
import type { MarblingPattern } from './marbling/index.js';

const BASE = { width: 300, height: 400, margin: 20, seed: 42 } as const;
const PATTERNS: MarblingPattern[] = ['stone', 'nonpareil', 'feather', 'bouquet', 'vortex'];

describe('marbling ops', () => {
  it('drop displacement is the exact area-conserving map', () => {
    // A point at distance d from the centre must land at exactly √(d²+r²).
    const op = { cx: 10, cy: -5, r: 7 };
    for (const d of [0.5, 3, 7, 40]) {
      const p = applyDrop(10 + d, -5, op);
      const out = Math.hypot(p.x - 10, p.y + 5);
      expect(out).toBeCloseTo(Math.sqrt(d * d + op.r * op.r), 10);
      expect(p.y).toBeCloseTo(-5, 10);
    }
  });

  it('a point on the drop centre lands on the rim deterministically', () => {
    const p = applyDrop(3, 4, { cx: 3, cy: 4, r: 9 });
    expect(Math.hypot(p.x - 3, p.y - 4)).toBeCloseTo(9, 10);
  });

  it('tine displacement is parallel to the pull and decreases with distance', () => {
    const op = {
      kind: 'tine' as const,
      bx: 0,
      by: 0,
      mx: 1,
      my: 0,
      z: 20,
      lambda: 5,
    };
    let prev = Infinity;
    for (const d of [0, 2, 8, 30]) {
      const p = applyTine(3, d, op);
      expect(p.y).toBeCloseTo(d, 10); // moved along m = +x only
      const disp = p.x - 3;
      expect(disp).toBeGreaterThan(0);
      expect(disp).toBeLessThan(prev);
      prev = disp;
    }
  });

  it('resolves the drop-centre singularity — no chord survives a close landing', () => {
    // A drop landing within ε of a segment sweeps it ~half-way around the
    // rim; failing to refine that sweep leaves a straight chord slashing
    // across the drop — the bug seen in production plots. Budget is huge
    // here: this guards the refinement depth, not the budget.
    const frame = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9, pad: 0 };
    for (const eps of [1, 0.01, 1e-5, 0]) {
      const budget = { points: 0, cap: 1e9 };
      const ring = makeCircleRing(500, 500, 200, 0, 2, budget);
      applyOpToRing(ring, { kind: 'drop', cx: 300 - eps, cy: 500, r: 80 }, 2, budget, frame);
      let longest = 0;
      for (let i = 0; i < ring.pts.length; i++) {
        const a = ring.pts[i];
        const b = ring.pts[(i + 1) % ring.pts.length];
        longest = Math.max(longest, Math.hypot(a.x - b.x, a.y - b.y));
      }
      expect(longest).toBeLessThanOrEqual(2 + 1e-9);
      expect(ring.pts.length).toBeLessThan(5000);
    }
  });

  it('vortex rotates about the centre without changing radius', () => {
    const op = { cx: 5, cy: 5, z: 3, lambda: 10 };
    const p = applyVortex(15, 5, op);
    expect(Math.hypot(p.x - 5, p.y - 5)).toBeCloseTo(10, 10);
    expect(p.x).not.toBeCloseTo(15, 3);
  });
});

describe('generateMarbling', () => {
  it('is deterministic for the same seed and options', () => {
    for (const pattern of PATTERNS) {
      const a = generateMarbling({ ...BASE, pattern });
      const b = generateMarbling({ ...BASE, pattern });
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    }
  });

  it('produces different drawings for different seeds', () => {
    const a = generateMarbling({ ...BASE, seed: 42 });
    const b = generateMarbling({ ...BASE, seed: 1337 });
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('keeps every point inside the margin box', () => {
    for (const pattern of PATTERNS) {
      const r = generateMarbling({ ...BASE, pattern });
      expect(r.lines.length).toBeGreaterThan(20);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
          expect(p.x).toBeLessThanOrEqual(BASE.width - BASE.margin + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
          expect(p.y).toBeLessThanOrEqual(BASE.height - BASE.margin + 1e-6);
        }
      }
    }
  });

  it('honours the point cap under a hostile configuration', () => {
    const r = generateMarbling({
      ...BASE,
      pattern: 'feather',
      drops: 120,
      ringsPerDrop: 6,
      detail: 0.75,
    });
    const total = r.lines.reduce((acc, l) => acc + l.points.length, 0);
    // The soft cap coarsens under pressure; 2× is the hard ceiling.
    expect(total).toBeLessThanOrEqual(MARBLING_POINT_CAP * 2);
  });

  it('degrades hostile settings to uniform grain — never straight chords', () => {
    // Genome-corner roll at web-A4 density: everything maxed. Pre-fix this
    // produced segments up to 932px (half the page). Post-fix the budget
    // machinery re-runs at a measured grain; segments stay bounded.
    const mm = 5.669;
    const r = generateMarbling({
      width: Math.round(210 * mm),
      height: Math.round(297 * mm),
      margin: Math.round(10 * mm),
      seed: 4242,
      refMinDim: 297 * mm,
      pattern: 'nonpareil',
      drops: 120,
      dropRadius: 27 * mm,
      ringsPerDrop: 5,
      dropRadiusJitter: 0.7,
      combSpacing: 8.5 * mm,
      combStrength: 1,
      falloff: 0.6 * mm,
      detail: 0.35 * mm,
    });
    let longest = 0;
    for (const l of r.lines) {
      for (let i = 1; i < l.points.length; i++) {
        longest = Math.max(
          longest,
          Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y)
        );
      }
    }
    expect(longest).toBeLessThan(100);
  });

  it('tags strokes with cycling ink-group layers', () => {
    const r = generateMarbling({ ...BASE, inkGroups: 3 });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect([...layers].sort()).toEqual([inkLayerName(0), inkLayerName(1), inkLayerName(2)]);
    expect(r.lines.every((l) => l.pen === 'fine')).toBe(true);
  });

  it('returns empty output when the margin swallows the page', () => {
    const r = generateMarbling({ width: 40, height: 40, margin: 15, seed: 42 });
    expect(r.lines).toEqual([]);
  });
});
