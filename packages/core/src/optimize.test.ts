import { describe, it, expect } from 'vitest';
import { optimizePlot, measurePenTravel } from './optimize.js';
import { imageToPenInk } from './pen-ink.js';
import type { FlowLinesResult } from './flow-lines.js';

const line = (pts: [number, number][], pen?: 'fine' | 'bold') => ({
  points: pts.map(([x, y]) => ({ x, y })),
  ...(pen ? { pen } : {}),
});

const result = (lines: FlowLinesResult['lines']): FlowLinesResult => ({
  width: 100,
  height: 100,
  seed: 1,
  lines,
});

describe('optimizePlot', () => {
  it('chains strokes whose endpoints nearly touch', () => {
    const input = result([
      line([
        [10, 50],
        [40, 50],
      ]),
      line([
        [41, 50],
        [70, 50],
      ]),
      line([
        [71, 50.5],
        [95, 50],
      ]),
    ]);

    const out = optimizePlot(input, { mergeTolerance: 1.5 });

    expect(out.lines.length).toBe(1);
    expect(out.lines[0].points.length).toBe(6);
  });

  it('does not chain across the merge tolerance', () => {
    const input = result([
      line([
        [10, 50],
        [40, 50],
      ]),
      line([
        [50, 50],
        [80, 50],
      ]),
    ]);

    const out = optimizePlot(input, { mergeTolerance: 1.5 });
    expect(out.lines.length).toBe(2);
  });

  it('does not chain strokes from different pens', () => {
    const input = result([
      line(
        [
          [10, 50],
          [40, 50],
        ],
        'fine'
      ),
      line(
        [
          [41, 50],
          [70, 50],
        ],
        'bold'
      ),
    ]);

    const out = optimizePlot(input, { mergeTolerance: 1.5 });
    expect(out.lines.length).toBe(2);
  });

  it('reduces pen-up travel by reordering', () => {
    // Strokes in pathological order: alternating between far corners
    const lines = [];
    for (let i = 0; i < 20; i++) {
      const x = i % 2 === 0 ? 5 : 80;
      lines.push(
        line([
          [x, i * 4],
          [x + 12, i * 4],
        ])
      );
    }

    const input = result(lines);
    const before = measurePenTravel(input);
    const after = measurePenTravel(optimizePlot(input, { mergeTolerance: 0 }));

    expect(after).toBeLessThan(before * 0.5);
    expect(optimizePlot(input, { mergeTolerance: 0 }).lines.length).toBe(20);
  });

  it('lowers pen-up travel of a full render', () => {
    const image = {
      width: 80,
      height: 80,
      data: new Float32Array(80 * 80).fill(0.3),
    };

    const raw = imageToPenInk(image, { width: 200, seed: 7, optimize: false });
    const optimized = imageToPenInk(image, { width: 200, seed: 7, optimize: true });

    expect(measurePenTravel(optimized)).toBeLessThan(measurePenTravel(raw) * 0.6);
  });
});
