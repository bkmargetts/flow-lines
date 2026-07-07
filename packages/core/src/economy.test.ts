import { describe, it, expect } from 'vitest';
import { budgetStrokes } from './pen-ink/economy.js';
import type { FlowLine, Point } from './flow-lines.js';

const horizontal = (y: number, x0: number, x1: number, step = 4): Point[] => {
  const points: Point[] = [];
  for (let x = x0; x <= x1; x += step) points.push({ x, y });
  return points;
};

const totalLength = (lines: FlowLine[]): number => {
  let length = 0;
  for (const line of lines) {
    for (let i = 1; i < line.points.length; i++) {
      length += Math.hypot(
        line.points[i].x - line.points[i - 1].x,
        line.points[i].y - line.points[i - 1].y
      );
    }
  }
  return length;
};

const base = {
  width: 400,
  height: 400,
  scale: 1,
  strokeWeight: 1,
};

describe('budgetStrokes', () => {
  it('keeps total drawn length within the budget', () => {
    // 20 identical-information lines, budget for ~5 of them
    const lines: FlowLine[] = [];
    for (let i = 0; i < 20; i++) lines.push({ points: horizontal(20 + i * 18, 20, 380) });

    const kept = budgetStrokes(lines, { ...base, budgetPx: 1800, scoreAt: () => 1 });
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(20);
    expect(totalLength(kept)).toBeLessThanOrEqual(1800);
  });

  it('keeps the strokes that say the most', () => {
    // High-information strokes on the left half, low on the right
    const scoreAt = (x: number): number => (x < 200 ? 1 : 0.1);
    const lines: FlowLine[] = [];
    for (let i = 0; i < 10; i++) lines.push({ points: horizontal(20 + i * 36, 20, 180) });
    for (let i = 0; i < 10; i++) lines.push({ points: horizontal(20 + i * 36, 220, 380) });

    const kept = budgetStrokes(lines, { ...base, budgetPx: 800, scoreAt });
    expect(kept.length).toBeGreaterThan(0);
    for (const line of kept) {
      expect(line.points[0].x).toBeLessThan(200);
    }
  });

  it('favors bold contours — the gesture is the contour', () => {
    const lines: FlowLine[] = [
      { points: horizontal(100, 20, 380) },
      { points: horizontal(120, 20, 380), pen: 'bold' },
    ];
    const kept = budgetStrokes(lines, { ...base, budgetPx: 380, scoreAt: () => 1 });
    expect(kept).toHaveLength(1);
    expect(kept[0].pen).toBe('bold');
  });

  it('drops lone filler far from the kept gesture', () => {
    // A cluster of strong strokes plus one equal-scoring stroke far away;
    // the isolated one must not survive on score alone
    const lines: FlowLine[] = [];
    for (let i = 0; i < 6; i++) lines.push({ points: horizontal(40 + i * 8, 20, 200) });
    lines.push({ points: horizontal(380, 250, 390) }); // short, isolated, same score

    const kept = budgetStrokes(lines, { ...base, budgetPx: 900, scoreAt: () => 1 });
    const isolated = kept.filter((l) => l.points[0].y > 300);
    expect(isolated).toHaveLength(0);
  });

  it('thickens long survivors into brush strokes with tapered passes', () => {
    const lines: FlowLine[] = [{ points: horizontal(100, 20, 380) }];
    const kept = budgetStrokes(lines, {
      ...base,
      budgetPx: 10_000,
      scoreAt: () => 1,
      strokeWeight: 3,
    });

    expect(kept).toHaveLength(3); // parent + 2 weight passes
    const parent = kept[0];
    for (const pass of kept.slice(1)) {
      expect(totalLength([pass])).toBeLessThan(totalLength([parent]));
    }
  });

  it('passes solid fill through untouched and is deterministic', () => {
    const fill: FlowLine = { points: horizontal(50, 20, 380), layer: 'fill' };
    const lines: FlowLine[] = [fill, { points: horizontal(100, 20, 380) }];

    const a = budgetStrokes(lines, { ...base, budgetPx: 100, scoreAt: () => 1 });
    expect(a.some((l) => l.layer === 'fill')).toBe(true);

    const b = budgetStrokes(lines, { ...base, budgetPx: 100, scoreAt: () => 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
