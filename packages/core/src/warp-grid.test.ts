import { describe, it, expect } from 'vitest';
import { generateWarpGrid } from './warp-grid/index.js';
import type { WarpGridOptions } from './warp-grid/index.js';

const BASE: WarpGridOptions = { width: 300, height: 400, margin: 20, seed: 42 };

function totalPoints(r: { lines: { points: unknown[] }[] }): number {
  return r.lines.reduce((acc, l) => acc + l.points.length, 0);
}

describe('generateWarpGrid', () => {
  it('is deterministic per seed', () => {
    const a = generateWarpGrid(BASE);
    const b = generateWarpGrid(BASE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds place different forms', () => {
    const a = generateWarpGrid(BASE);
    const b = generateWarpGrid({ ...BASE, seed: 43 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('stays inside the margin', () => {
    for (const preset of ['dome', 'current', 'vortex', 'relief', 'pinch', 'blaze'] as const) {
      const r = generateWarpGrid({ ...BASE, preset });
      expect(r.lines.length).toBeGreaterThan(0);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(20 - 1e-6);
          expect(p.x).toBeLessThanOrEqual(280 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(20 - 1e-6);
          expect(p.y).toBeLessThanOrEqual(380 + 1e-6);
        }
      }
    }
  });

  it('renders a straight grating with no relief and no deformers', () => {
    const r = generateWarpGrid({
      ...BASE,
      basePattern: 'lines',
      angle: 0,
      relief: 0,
      deformers: 0,
      dropFloor: 0,
      optimize: false,
    });
    expect(r.lines.length).toBeGreaterThan(10);
    // Horizontal base lines: every stroke holds a single y.
    for (const line of r.lines) {
      const y = line.points[0].y;
      for (const p of line.points) expect(Math.abs(p.y - y)).toBeLessThan(1e-6);
    }
  });

  it('deformers actually move the lines', () => {
    const flat = generateWarpGrid({ ...BASE, relief: 0, deformers: 0 });
    const warped = generateWarpGrid(BASE);
    expect(JSON.stringify(flat.lines)).not.toBe(JSON.stringify(warped.lines));
  });

  it('a higher compression floor drops more ink', () => {
    const loose = generateWarpGrid({ ...BASE, dropFloor: 0 });
    const tight = generateWarpGrid({ ...BASE, dropFloor: 0.8 });
    expect(totalPoints(tight)).toBeLessThan(totalPoints(loose));
  });

  it('occlusion hides line runs behind the relief', () => {
    const open = generateWarpGrid({ ...BASE, preset: 'relief', occlude: false });
    const hidden = generateWarpGrid({ ...BASE, preset: 'relief', occlude: true });
    expect(totalPoints(hidden)).toBeLessThan(totalPoints(open));
  });

  it('each knob changes the drawing', () => {
    const base = generateWarpGrid(BASE);
    const knobs: Partial<WarpGridOptions>[] = [
      { spacing: 12 },
      { angle: 70 },
      { strength: 0.2 },
      { relief: 0.15 },
      { scale: 0.5 },
      { basePattern: 'circles' },
      { basePattern: 'rays' },
      { wobble: 1.5 },
    ];
    for (const knob of knobs) {
      const varied = generateWarpGrid({ ...BASE, ...knob });
      expect(JSON.stringify(varied.lines), JSON.stringify(knob)).not.toBe(
        JSON.stringify(base.lines)
      );
    }
  });

  it('waves carry the built-in sine even with no deformers', () => {
    const flat = generateWarpGrid({
      ...BASE,
      basePattern: 'lines',
      relief: 0,
      deformers: 0,
    });
    const wavy = generateWarpGrid({
      ...BASE,
      basePattern: 'waves',
      relief: 0,
      deformers: 0,
    });
    expect(JSON.stringify(wavy.lines)).not.toBe(JSON.stringify(flat.lines));
  });

  it('tags the grid pen layer', () => {
    const r = generateWarpGrid(BASE);
    expect(r.lines.every((l) => l.layer === 'grid' && l.pen === 'fine')).toBe(true);
  });

  it('returns empty on a degenerate page', () => {
    const r = generateWarpGrid({ width: 30, height: 30, margin: 14, seed: 42 });
    expect(r.lines).toEqual([]);
  });
});
