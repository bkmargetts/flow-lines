import { describe, it, expect } from 'vitest';
import { computePlotStats, formatDuration, formatDistance } from './plot-stats';
import type { FlowLinesResult } from '@flow-lines/core';

function result(lines: { x: number; y: number }[][]): FlowLinesResult {
  return { lines: lines.map((points) => ({ points })), width: 100, height: 100, seed: 1 };
}

describe('computePlotStats', () => {
  it('measures drawn length in mm, not px', () => {
    // One 100px horizontal stroke at 10px/mm is 10mm drawn.
    const stats = computePlotStats(result([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]), 10);
    expect(stats.drawnMm).toBeCloseTo(10);
    expect(stats.strokes).toBe(1);
  });

  it('counts pen-up travel between strokes but not before the first', () => {
    const stats = computePlotStats(
      result([
        [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        [{ x: 30, y: 0 }, { x: 40, y: 0 }],
      ]),
      1
    );
    // 20mm drawn total, and one 20mm hop from (10,0) to (30,0).
    expect(stats.drawnMm).toBeCloseTo(20);
    expect(stats.travelMm).toBeCloseTo(20);
  });

  it('reports less travel for a well-ordered plot than a badly-ordered one', () => {
    const near = result([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 2, y: 0 }, { x: 3, y: 0 }],
    ]);
    const far = result([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 99, y: 99 }, { x: 100, y: 99 }],
    ]);
    expect(computePlotStats(near, 1).travelMm).toBeLessThan(computePlotStats(far, 1).travelMm);
  });

  it('gives a longer estimate for more ink', () => {
    const short = computePlotStats(result([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]), 1);
    const long = computePlotStats(result([[{ x: 0, y: 0 }, { x: 1000, y: 0 }]]), 1);
    expect(long.seconds).toBeGreaterThan(short.seconds);
  });

  it('survives empty input and a zero pxPerMm without NaN', () => {
    const empty = computePlotStats(result([]), 0);
    expect(empty.strokes).toBe(0);
    expect(Number.isFinite(empty.drawnMm)).toBe(true);
    expect(Number.isFinite(empty.seconds)).toBe(true);
  });
});

describe('formatting', () => {
  it('formats durations by magnitude', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(510)).toBe('8m 30s');
    expect(formatDuration(8100)).toBe('2h 15m');
    expect(formatDuration(0)).toBe('—');
  });

  it('switches from mm to m when long', () => {
    expect(formatDistance(250)).toBe('250mm');
    expect(formatDistance(2500)).toBe('2.5m');
    expect(formatDistance(0)).toBe('—');
  });
});
