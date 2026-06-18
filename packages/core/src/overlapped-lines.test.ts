import { describe, it, expect } from 'vitest';
import { generateOverlappedLines, bandLayerName, type OverlappedLinesOptions } from './overlapped-lines.js';

function baseOptions(overrides: Partial<OverlappedLinesOptions> = {}): OverlappedLinesOptions {
  return {
    width: 400,
    height: 300,
    margin: 20,
    angleDeg: 0,
    spacingPx: 12,
    colorCount: 2,
    seed: 42,
    ...overrides,
  };
}

describe('generateOverlappedLines', () => {
  it('is deterministic per seed', () => {
    const a = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4 }));
    const b = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4 }));
    expect(JSON.stringify(a.lines)).toEqual(JSON.stringify(b.lines));
  });

  it('changes with the seed when noise is on', () => {
    const a = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4, seed: 1 }));
    const b = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4, seed: 2 }));
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('draws a grating of many parallel lines', () => {
    const r = generateOverlappedLines(baseOptions());
    expect(r.lines.length).toBeGreaterThan(10);
  });

  it('tighter spacing yields more lines', () => {
    const wide = generateOverlappedLines(baseOptions({ spacingPx: 24 }));
    const tight = generateOverlappedLines(baseOptions({ spacingPx: 6 }));
    expect(tight.lines.length).toBeGreaterThan(wide.lines.length);
  });

  it('each ink interleaves as its own band layer within colorCount', () => {
    const colorCount = 3;
    const r = generateOverlappedLines(baseOptions({ colorCount }));
    const allowed = new Set(Array.from({ length: colorCount }, (_, i) => bandLayerName(i)));
    const seen = new Set<string>();
    for (const line of r.lines) {
      expect(line.layer).toBeDefined();
      expect(allowed.has(line.layer!)).toBe(true);
      seen.add(line.layer!);
    }
    // All requested inks actually appear.
    expect(seen.size).toBe(colorCount);
  });

  it('vertical lines (angle 0) run top-to-bottom, not side-to-side', () => {
    const r = generateOverlappedLines(baseOptions({ jitterPx: 0, wobbleAmpPx: 0 }));
    const line = r.lines[0];
    const xs = line.points.map((p) => p.x);
    const ys = line.points.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(spanY).toBeGreaterThan(spanX);
  });

  it('keeps every point inside the margin', () => {
    const margin = 20;
    const r = generateOverlappedLines(
      baseOptions({ margin, jitterPx: 2, wobbleAmpPx: 4, phaseNoiseAmpPx: 6, phaseDriftAcrossPx: 6 })
    );
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(margin);
        expect(p.x).toBeLessThanOrEqual(400 - margin);
        expect(p.y).toBeGreaterThanOrEqual(margin);
        expect(p.y).toBeLessThanOrEqual(300 - margin);
      }
    }
  });

  it('returns no lines when the page has no usable area', () => {
    const r = generateOverlappedLines(baseOptions({ margin: 200 }));
    expect(r.lines).toHaveLength(0);
    expect(r.width).toBe(400);
    expect(r.height).toBe(300);
  });
});
