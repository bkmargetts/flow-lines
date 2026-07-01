import { describe, it, expect } from 'vitest';
import { applySketch, getSketchStyleConfig, type SketchStyle } from './sketch-styles.js';
import type { FlowLinesResult } from './flow-lines.js';

const base = (): FlowLinesResult => ({
  width: 400,
  height: 300,
  seed: 11,
  lines: [
    { points: [{ x: 10, y: 10 }, { x: 100, y: 12 }, { x: 200, y: 8 }] },
    { points: [{ x: 20, y: 60 }, { x: 120, y: 62 }, { x: 220, y: 58 }] },
  ],
});

const flatten = (r: FlowLinesResult) =>
  r.lines.flatMap((l) => l.points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`));

describe('applySketch', () => {
  it('is an identity below the intensity threshold', () => {
    const r = base();
    expect(applySketch(r, 'loose', 0)).toBe(r);
    expect(applySketch(r, 'loose', 0.01)).toBe(r);
  });

  it('multiplies the line count by the style pass count', () => {
    const r = base();
    for (const style of ['loose', 'fine', 'gestural', 'scratchy'] as SketchStyle[]) {
      const intensity = 1;
      const { passes } = getSketchStyleConfig(style, intensity);
      const out = applySketch(r, style, intensity);
      expect(out.lines.length).toBe(r.lines.length * passes);
    }
  });

  it('is deterministic for the same seed and inputs', () => {
    const a = applySketch(base(), 'scratchy', 0.7);
    const b = applySketch(base(), 'scratchy', 0.7);
    expect(flatten(a)).toEqual(flatten(b));
  });

  it('produces different geometry for different seeds', () => {
    const a = applySketch({ ...base(), seed: 1 }, 'scratchy', 0.7);
    const b = applySketch({ ...base(), seed: 2 }, 'scratchy', 0.7);
    expect(flatten(a)).not.toEqual(flatten(b));
  });

  it('does not touch the input when a lineCap would be exceeded', () => {
    const r = base();
    const { passes } = getSketchStyleConfig('fine', 1);
    // Cap just below what one full sketch would produce.
    const out = applySketch(r, 'fine', 1, { lineCap: r.lines.length * passes });
    expect(out).toBe(r);
  });

  it('applies the sketch when the lineCap has headroom', () => {
    const r = base();
    const { passes } = getSketchStyleConfig('fine', 1);
    const out = applySketch(r, 'fine', 1, { lineCap: r.lines.length * passes + 1 });
    expect(out.lines.length).toBe(r.lines.length * passes);
  });
});
