import { describe, it, expect } from 'vitest';
import { generateOverlappedLines, bandLayerName, type OverlappedLinesOptions } from './overlapped-lines.js';

/** A single horizontal centreline across the middle of a 400×300 page. */
function baseOptions(overrides: Partial<OverlappedLinesOptions> = {}): OverlappedLinesOptions {
  return {
    width: 400,
    height: 300,
    margin: 20,
    paths: [
      [
        { x: 40, y: 150 },
        { x: 360, y: 150 },
      ],
    ],
    maxThicknessPx: 40,
    minThicknessPx: 8,
    passSpacingPx: 2,
    colorCount: 2,
    seed: 42,
    ...overrides,
  };
}

describe('generateOverlappedLines', () => {
  it('is deterministic per seed', () => {
    const a = generateOverlappedLines(baseOptions());
    const b = generateOverlappedLines(baseOptions());
    expect(JSON.stringify(a.lines)).toEqual(JSON.stringify(b.lines));
  });

  it('changes with the seed', () => {
    const a = generateOverlappedLines(baseOptions({ seed: 1 }));
    const b = generateOverlappedLines(baseOptions({ seed: 2 }));
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('emits overlapping passes (more than one stroke for one centreline)', () => {
    const r = generateOverlappedLines(baseOptions());
    expect(r.lines.length).toBeGreaterThan(1);
  });

  it('tags every stroke with a band layer within colorCount', () => {
    const colorCount = 3;
    const r = generateOverlappedLines(baseOptions({ colorCount }));
    const allowed = new Set(Array.from({ length: colorCount }, (_, i) => bandLayerName(i)));
    expect(r.lines.length).toBeGreaterThan(0);
    for (const line of r.lines) {
      expect(line.layer).toBeDefined();
      expect(allowed.has(line.layer!)).toBe(true);
    }
  });

  it('thicker bands produce more strokes', () => {
    const thin = generateOverlappedLines(baseOptions({ maxThicknessPx: 10 }));
    const thick = generateOverlappedLines(baseOptions({ maxThicknessPx: 80 }));
    expect(thick.lines.length).toBeGreaterThan(thin.lines.length);
  });

  it('keeps every point inside the margin', () => {
    const margin = 20;
    const r = generateOverlappedLines(baseOptions({ margin, jitterPx: 2, wobbleAmpPx: 4 }));
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(margin);
        expect(p.x).toBeLessThanOrEqual(400 - margin);
        expect(p.y).toBeGreaterThanOrEqual(margin);
        expect(p.y).toBeLessThanOrEqual(300 - margin);
      }
    }
  });

  it('returns no lines for an empty path set', () => {
    const r = generateOverlappedLines(baseOptions({ paths: [] }));
    expect(r.lines).toHaveLength(0);
    expect(r.width).toBe(400);
    expect(r.height).toBe(300);
  });
});
