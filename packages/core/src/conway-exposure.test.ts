import { describe, it, expect } from 'vitest';
import { generateConwayExposure, stepLife } from './conway-exposure.js';

/** Pull every point of every line flat, for bounds/equality checks */
function allPoints(lines: { points: { x: number; y: number }[] }[]) {
  return lines.flatMap((l) => l.points);
}

describe('stepLife (B3/S23)', () => {
  it('oscillates a blinker with period 2', () => {
    const cols = 5;
    const rows = 5;
    const a = new Uint8Array(cols * rows);
    // Horizontal blinker: (1,2)(2,2)(3,2)
    a[2 * cols + 1] = 1;
    a[2 * cols + 2] = 1;
    a[2 * cols + 3] = 1;

    const b = new Uint8Array(cols * rows);
    stepLife(a, b, cols, rows);
    // Now vertical: (2,1)(2,2)(2,3)
    expect(b[1 * cols + 2]).toBe(1);
    expect(b[2 * cols + 2]).toBe(1);
    expect(b[3 * cols + 2]).toBe(1);
    expect(b[2 * cols + 1]).toBe(0);
    expect(b[2 * cols + 3]).toBe(0);

    const c = new Uint8Array(cols * rows);
    stepLife(b, c, cols, rows);
    // Back to the original horizontal phase
    expect(Array.from(c)).toEqual(Array.from(a));
  });

  it('keeps a 2x2 block stable', () => {
    const cols = 4;
    const rows = 4;
    const a = new Uint8Array(cols * rows);
    a[1 * cols + 1] = 1;
    a[1 * cols + 2] = 1;
    a[2 * cols + 1] = 1;
    a[2 * cols + 2] = 1;
    const b = new Uint8Array(cols * rows);
    stepLife(a, b, cols, rows);
    expect(Array.from(b)).toEqual(Array.from(a));
  });
});

describe('generateConwayExposure', () => {
  const base = { width: 600, height: 600, seed: 7, generations: 60, cellSize: 8 };

  it('is deterministic for the same options and seed', () => {
    const a = generateConwayExposure(base);
    const b = generateConwayExposure(base);
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    expect(a.lines.length).toBeGreaterThan(0);
  });

  it('produces different compositions for different seeds', () => {
    const a = generateConwayExposure({ ...base, seed: 1 });
    const b = generateConwayExposure({ ...base, seed: 2 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('always renders the final living configuration as crisp bold marks', () => {
    const r = generateConwayExposure(base);
    const bold = r.lines.filter((l) => l.pen === 'bold');
    expect(bold.length).toBeGreaterThan(0);
  });

  it('keeps every mark inside the page margin', () => {
    const margin = 40;
    const r = generateConwayExposure({ ...base, margin });
    for (const p of allPoints(r.lines)) {
      // Allow a little slack for the hand-drawn wobble at the very edge.
      expect(p.x).toBeGreaterThanOrEqual(margin - 5);
      expect(p.x).toBeLessThanOrEqual(base.width - margin + 5);
      expect(p.y).toBeGreaterThanOrEqual(margin - 5);
      expect(p.y).toBeLessThanOrEqual(base.height - margin + 5);
    }
  });

  it('reports the requested page size and seed', () => {
    const r = generateConwayExposure(base);
    expect(r.width).toBe(600);
    expect(r.height).toBe(600);
    expect(r.seed).toBe(7);
  });

  it('returns an empty-but-valid result when the grid cannot fit', () => {
    const r = generateConwayExposure({ width: 600, height: 600, cellSize: 8, margin: 299 });
    expect(r.lines).toEqual([]);
    expect(r.width).toBe(600);
  });

  it('does not throw with zero generations (just the seed exposed)', () => {
    const r = generateConwayExposure({ ...base, generations: 0 });
    // The five R-pentomino cells are the final config; all bold.
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.every((l) => l.pen === 'bold')).toBe(true);
  });
});
