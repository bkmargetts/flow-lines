import { describe, it, expect } from 'vitest';
import { generateLandscape, type LandscapeOptions } from './landscape.js';
import { _internals } from './landscape.js';
import type { FlowLine, Point } from './flow-lines.js';

function baseOptions(overrides: Partial<LandscapeOptions> = {}): LandscapeOptions {
  return {
    width: 600,
    height: 700,
    margin: 24,
    seed: 7,
    // lighter than defaults to keep the suite fast
    skyHatchSpacing: 10,
    waterHatchSpacing: 10,
    ridgeHatchSpacing: 8,
    wobble: 0,
    ...overrides,
  };
}

const layer = (lines: FlowLine[], name: string): FlowLine[] => lines.filter((l) => l.layer === name);

describe('generateLandscape', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = generateLandscape(baseOptions({ seed: 11 }));
    const b = generateLandscape(baseOptions({ seed: 11 }));
    const c = generateLandscape(baseOptions({ seed: 12 }));
    expect(b.lines).toEqual(a.lines);
    expect(c.lines).not.toEqual(a.lines);
    expect(a.seed).toBe(11);
  });

  it('produces finite geometry inside the page margin', () => {
    const r = generateLandscape(baseOptions({ hasWater: true, rocks: 3 }));
    const tol = 1.5;
    for (const ln of r.lines) {
      for (const p of ln.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(24 - tol);
        expect(p.x).toBeLessThanOrEqual(600 - 24 + tol);
        expect(p.y).toBeGreaterThanOrEqual(24 - tol);
        expect(p.y).toBeLessThanOrEqual(700 - 24 + tol);
      }
    }
  });

  it('draws a vertical sky, a horizon contour, and water vs. land on demand', () => {
    const coastal = generateLandscape(baseOptions({ hasWater: true }));
    expect(layer(coastal.lines, 'sky').length).toBeGreaterThan(5);
    expect(layer(coastal.lines, 'water').length).toBeGreaterThan(5);
    expect(coastal.lines.some((l) => l.layer === 'horizon')).toBe(true);

    const land = generateLandscape(baseOptions({ hasWater: false, ridgeCount: 4 }));
    expect(layer(land.lines, 'water').length).toBe(0);
    expect(layer(land.lines, 'ridge').length).toBeGreaterThan(10);
  });

  it('holds the sun as clean negative space in the sky band', () => {
    const sunX = 300;
    const sunY = 150;
    const sunR = 50;
    const r = generateLandscape(baseOptions({ sun: true, sunX, sunY, sunRadius: sunR, sunHalo: 0, skyHatchSpacing: 4 }));
    // No sky stroke point should fall inside the sun disk.
    for (const ln of layer(r.lines, 'sky')) {
      for (const p of ln.points) {
        expect(Math.hypot(p.x - sunX, p.y - sunY)).toBeGreaterThan(sunR - 4);
      }
    }
  });
});

describe('clipLineToPolygon (the hatch workhorse)', () => {
  const { clipLineToPolygon, closeRegion, pointInPolygon } = _internals;

  it('returns the single inside interval of a convex square', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    // Horizontal line through y = 5, origin to the left.
    const intervals = clipLineToPolygon(square, { x: -5, y: 5 }, { x: 1, y: 0 });
    expect(intervals.length).toBe(1);
    const [t0, t1] = intervals[0];
    // line enters at x=0 (t=5) and exits at x=10 (t=15) measured from x=-5.
    expect(t0).toBeCloseTo(5, 5);
    expect(t1).toBeCloseTo(15, 5);
  });

  it('yields two intervals across a concave (C-shaped) polygon', () => {
    // A "U" with a notch in the top middle so a horizontal sweep crosses 4 edges.
    const u: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 7, y: 10 },
      { x: 7, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 10 },
      { x: 0, y: 10 },
    ];
    const intervals = clipLineToPolygon(u, { x: -1, y: 7 }, { x: 1, y: 0 });
    expect(intervals.length).toBe(2);
  });

  it('closeRegion builds a polygon whose interior matches point-in-polygon', () => {
    const upper: Point[] = [
      { x: 0, y: 2 },
      { x: 10, y: 2 },
    ];
    const lower: Point[] = [
      { x: 0, y: 8 },
      { x: 10, y: 8 },
    ];
    const poly = closeRegion(upper, lower);
    expect(pointInPolygon(poly, 5, 5)).toBe(true);
    expect(pointInPolygon(poly, 5, 1)).toBe(false);
    expect(pointInPolygon(poly, 5, 9)).toBe(false);
  });
});
