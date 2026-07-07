import { describe, it, expect } from 'vitest';
import {
  applyLineSwell,
  offsetEmphasisPasses,
  swellPassCount,
  SWELL_THRESHOLDS,
} from './pen-ink/swell.js';
import type { FlowLine, Point } from './flow-lines.js';

const horizontal = (y: number, x0: number, x1: number, step = 2): Point[] => {
  const points: Point[] = [];
  for (let x = x0; x <= x1; x += step) points.push({ x, y });
  return points;
};

const arcLength = (points: Point[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
};

describe('offsetEmphasisPasses', () => {
  it('reproduces the bold-outline recipe: centered offsets, tapered ends', () => {
    const parent = horizontal(50, 0, 100);
    const passes = offsetEmphasisPasses(parent, 3, 1.1, 0.12);

    expect(passes).toHaveLength(2);
    // Offsets are centered around the parent: ±1.1 * 0.5... for passes=3
    // pass 1 offset = 1.1*(1-1) = 0, pass 2 offset = 1.1*(2-1) = 1.1
    const offsets = passes.map((p) => p[0].y - 50);
    expect(Math.abs(offsets[0])).toBeLessThan(0.01);
    expect(Math.abs(Math.abs(offsets[1]) - 1.1)).toBeLessThan(0.01);
    // Trimmed: each pass shorter than the parent
    for (const p of passes) {
      expect(arcLength(p)).toBeLessThan(arcLength(parent));
    }
  });
});

describe('swellPassCount', () => {
  it('is zero in the light and monotonic toward black', () => {
    expect(swellPassCount(0.2, 3)).toBe(0);
    expect(swellPassCount(SWELL_THRESHOLDS[0] - 0.01, 3)).toBe(0);
    let prev = 0;
    for (let d = 0; d <= 1.001; d += 0.05) {
      const c = swellPassCount(d, 3);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
    expect(swellPassCount(1, 3)).toBeCloseTo(3);
    expect(swellPassCount(1, 2)).toBeCloseTo(2);
  });
});

describe('applyLineSwell', () => {
  // A line whose right half crosses shadow
  const darknessAt = (x: number): number => (x >= 50 ? 0.9 : 0.2);
  const options = {
    lineSwell: 1,
    scale: 1,
    darknessAt: (x: number) => darknessAt(x),
  };

  it('emits passes only along the shadow runs', () => {
    const lines: FlowLine[] = [{ points: horizontal(40, 0, 100) }];
    const extra = applyLineSwell(lines, options);

    expect(extra.length).toBe(3); // lineSwell 1 → 3 passes, one run each
    for (const line of extra) {
      for (const p of line.points) {
        // Trims may pull the start slightly, but no pass reaches the light half
        expect(p.x).toBeGreaterThan(48);
      }
    }
  });

  it('alternates offset sides so the line fattens symmetrically', () => {
    const lines: FlowLine[] = [{ points: horizontal(40, 0, 100) }];
    const extra = applyLineSwell(lines, options);
    const sides = extra.map((l) => Math.sign(l.points[0].y - 40));
    expect(sides).toContain(1);
    expect(sides).toContain(-1);
  });

  it('leaves light lines, bold contours, and fill untouched', () => {
    const light: FlowLine[] = [{ points: horizontal(40, 0, 40) }];
    expect(applyLineSwell(light, options)).toHaveLength(0);

    const bold: FlowLine[] = [{ points: horizontal(40, 50, 100), pen: 'bold' }];
    expect(applyLineSwell(bold, options)).toHaveLength(0);

    const fill: FlowLine[] = [{ points: horizontal(40, 50, 100), layer: 'fill' }];
    expect(applyLineSwell(fill, options)).toHaveLength(0);
  });

  it('is inert at lineSwell 0 and deterministic', () => {
    const lines: FlowLine[] = [{ points: horizontal(40, 0, 100) }];
    expect(applyLineSwell(lines, { ...options, lineSwell: 0 })).toHaveLength(0);

    const a = applyLineSwell(lines, options);
    const b = applyLineSwell(lines, options);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('drops runs too short to read as weight', () => {
    // Only a 4px sliver of shadow — below the minimum run
    const sliver = (x: number): number => (x >= 50 && x <= 54 ? 0.9 : 0.2);
    const lines: FlowLine[] = [{ points: horizontal(40, 0, 100) }];
    expect(
      applyLineSwell(lines, { ...options, darknessAt: (x: number) => sliver(x) })
    ).toHaveLength(0);
  });
});
