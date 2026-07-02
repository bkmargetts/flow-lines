import { describe, it, expect } from 'vitest';
import { applySketch } from './sketch.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

const line = (pts: [number, number][], meta: Partial<FlowLine> = {}): FlowLine => ({
  points: pts.map(([x, y]) => ({ x, y })),
  ...meta,
});

/** A long horizontal stroke sampled every 2px — plenty of arc for breaks/overshoot. */
const longLine = (y: number, meta: Partial<FlowLine> = {}): FlowLine =>
  line(
    Array.from({ length: 201 }, (_, i) => [10 + i * 2, y] as [number, number]),
    meta
  );

const result = (lines: FlowLine[]): FlowLinesResult => ({
  width: 600,
  height: 400,
  seed: 7,
  lines,
});

const pathLength = (points: Point[]): number => {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
};

describe('applySketch', () => {
  it('is the identity at zero intensity (same object)', () => {
    const input = result([longLine(50)]);
    expect(applySketch(input, { intensity: 0 })).toBe(input);
    expect(applySketch(input, { intensity: -1 })).toBe(input);
  });

  it('is deterministic per seed and options', () => {
    const input = result([longLine(50), longLine(120), line([[20, 200], [90, 260]])]);
    const a = applySketch(input, { intensity: 0.6, seed: 3 });
    const b = applySketch(input, { intensity: 0.6, seed: 3 });
    const c = applySketch(input, { intensity: 0.6, seed: 4 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('overshoots open ends, lengthening strokes beyond the wobble-only output', () => {
    const input = result(Array.from({ length: 8 }, (_, i) => longLine(20 + i * 40)));
    const opts = { intensity: 0.5, passes: 1, breaks: 0, taper: 0 };
    const total = (r: FlowLinesResult) =>
      r.lines.reduce((sum, l) => sum + pathLength(l.points), 0);
    const plain = applySketch(input, { ...opts, overshoot: 0 });
    const shot = applySketch(input, { ...opts, overshoot: 1 });
    expect(shot.lines.length).toBe(input.lines.length);
    expect(total(shot)).toBeGreaterThan(total(plain));
  });

  it('leaves short marks without overshoot', () => {
    const short = line([[100, 100], [104, 100]]);
    const input = result([short]);
    const out = applySketch(input, {
      intensity: 0.5,
      passes: 1,
      breaks: 0,
      taper: 0,
      overshoot: 1,
    });
    // Too short for the min-length gate: same endpoints modulo wobble amplitude
    expect(out.lines.length).toBe(1);
    expect(out.lines[0].points.length).toBe(short.points.length);
  });

  it('breaks long strokes into pen-lift fragments', () => {
    const input = result([longLine(50)]);
    const out = applySketch(input, {
      intensity: 0.5,
      passes: 1,
      breaks: 1,
      overshoot: 0,
      taper: 0,
    });
    expect(out.lines.length).toBeGreaterThan(1);
    const total = out.lines.reduce((sum, l) => sum + pathLength(l.points), 0);
    expect(total).toBeLessThan(pathLength(input.lines[0].points));
    for (const l of out.lines) expect(pathLength(l.points)).toBeGreaterThanOrEqual(6);
  });

  it('multiplies lines by the pass count', () => {
    const input = result([longLine(50), longLine(120)]);
    const out = applySketch(input, { intensity: 0.5, passes: 3, breaks: 0 });
    expect(out.lines.length).toBe(6);
  });

  it('keeps bold-pen and steady-layer lines to a single calm pass', () => {
    const input = result([
      longLine(50, { pen: 'bold' }),
      longLine(120, { layer: 'border' }),
      longLine(200),
    ]);
    const out = applySketch(input, {
      intensity: 0.8,
      passes: 3,
      breaks: 1,
      steadyLayers: ['border'],
    });
    const bold = out.lines.filter((l) => l.pen === 'bold');
    const border = out.lines.filter((l) => l.layer === 'border');
    expect(bold.length).toBe(1);
    expect(border.length).toBe(1);
    // Steady lines are never broken or overshot: point count is preserved
    expect(bold[0].points.length).toBe(input.lines[0].points.length);
    expect(border[0].points.length).toBe(input.lines[1].points.length);
    // The plain line still gets the full treatment
    expect(out.lines.length).toBeGreaterThan(3);
  });

  it('degrades passes to honour maxLines', () => {
    const input = result(Array.from({ length: 10 }, (_, i) => longLine(20 + i * 30)));
    const out = applySketch(input, { intensity: 0.5, passes: 4, breaks: 0, maxLines: 20 });
    expect(out.lines.length).toBeLessThanOrEqual(20);
  });

  it('scales overshoot with the scale factor', () => {
    // Several lines so the per-end overshoot coin flips average out
    const input = result(Array.from({ length: 8 }, (_, i) => longLine(20 + i * 40)));
    const inputLen = input.lines.reduce((sum, l) => sum + pathLength(l.points), 0);
    const opts = { intensity: 0.5, passes: 1, breaks: 0, taper: 0, overshoot: 1 };
    const grow = (r: FlowLinesResult) =>
      r.lines.reduce((sum, l) => sum + pathLength(l.points), 0) - inputLen;
    const g1 = grow(applySketch(input, { ...opts, scale: 1 }));
    const g2 = grow(applySketch(input, { ...opts, scale: 2 }));
    expect(g2).toBeGreaterThan(g1 * 1.5);
  });

  it('clips the sketched output to clipRect', () => {
    const input = result([longLine(50)]);
    const out = applySketch(input, {
      intensity: 0.8,
      overshoot: 1,
      clipRect: { x0: 20, y0: 0, x1: 380, y1: 400 },
    });
    for (const l of out.lines) {
      for (const p of l.points) {
        expect(p.x).toBeGreaterThanOrEqual(20 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(380 + 1e-6);
      }
    }
  });

  it('preserves pen and layer metadata on every output line', () => {
    const input = result([longLine(50, { pen: 'fine', layer: 'present' })]);
    const out = applySketch(input, { intensity: 0.6, breaks: 1 });
    expect(out.lines.length).toBeGreaterThan(0);
    for (const l of out.lines) {
      expect(l.pen).toBe('fine');
      expect(l.layer).toBe('present');
    }
  });
});
