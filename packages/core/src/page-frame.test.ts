import { describe, it, expect } from 'vitest';
import { pageBorder } from './page-frame.js';

describe('pageBorder', () => {
  const base = { width: 400, height: 300, marginPx: 20 };

  it('draws four straight two-point edges with sharp corners', () => {
    const lines = pageBorder(base);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line.points).toHaveLength(2);
      expect(line.pen).toBe('bold');
      expect(line.layer).toBe('border');
    }
  });

  it('is unchanged when the corner radius is zero or absent', () => {
    expect(pageBorder({ ...base, cornerRadiusPx: 0 })).toEqual(pageBorder(base));
  });

  it('rounds corners into edges plus arc polylines when a radius is given', () => {
    const lines = pageBorder({ ...base, cornerRadiusPx: 15 });
    // 4 straight edges + 4 corner arcs.
    expect(lines).toHaveLength(8);
    const edges = lines.filter((l) => l.points.length === 2);
    const arcs = lines.filter((l) => l.points.length > 2);
    expect(edges).toHaveLength(4);
    expect(arcs).toHaveLength(4);
  });

  it('keeps every point inside the inset rectangle', () => {
    const inset = base.marginPx;
    const lines = pageBorder({ ...base, cornerRadiusPx: 40 });
    for (const line of lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(inset - 1e-6);
        expect(p.x).toBeLessThanOrEqual(base.width - inset + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(inset - 1e-6);
        expect(p.y).toBeLessThanOrEqual(base.height - inset + 1e-6);
      }
    }
  });

  it('clamps the radius to half the shorter side so arcs never overlap', () => {
    // Inset box is 360 x 260; half the shorter side is 130.
    const huge = pageBorder({ ...base, cornerRadiusPx: 10000 });
    const clamped = pageBorder({ ...base, cornerRadiusPx: 130 });
    expect(huge).toEqual(clamped);
  });

  it('returns nothing when the inset collapses the box', () => {
    expect(pageBorder({ width: 40, height: 40, marginPx: 25 })).toEqual([]);
  });
});
