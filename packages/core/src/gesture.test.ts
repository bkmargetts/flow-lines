import { describe, it, expect } from 'vitest';
import { generateGesture, type GesturePreset } from './gesture/index.js';

const PRESETS: GesturePreset[] = ['kline', 'sumi', 'hartung', 'tangle'];
const BASE = { width: 300, height: 400, margin: 20 } as const;

describe('gesture generator', () => {
  it('is deterministic per seed', () => {
    const a = generateGesture({ ...BASE, seed: 42 });
    const b = generateGesture({ ...BASE, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds give different drawings', () => {
    const a = generateGesture({ ...BASE, seed: 42 });
    const b = generateGesture({ ...BASE, seed: 43 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('every preset renders real ink at multiple seeds', () => {
    for (const preset of PRESETS) {
      for (const seed of [42, 1337]) {
        const r = generateGesture({ ...BASE, seed, preset });
        expect(r.lines.length, `${preset}/${seed}`).toBeGreaterThan(10);
        const totalPoints = r.lines.reduce((n, l) => n + l.points.length, 0);
        expect(totalPoints, `${preset}/${seed}`).toBeGreaterThan(200);
      }
    }
  });

  it('respects the margin (all points inside the work rect)', () => {
    for (const preset of PRESETS) {
      const r = generateGesture({ ...BASE, seed: 7, preset, wobble: 0 });
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
          expect(p.x).toBeLessThanOrEqual(BASE.width - BASE.margin + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
          expect(p.y).toBeLessThanOrEqual(BASE.height - BASE.margin + 1e-6);
        }
      }
    }
  });

  it('dryness breaks strokes into more, shorter fragments', () => {
    const totalLen = (r: ReturnType<typeof generateGesture>): number =>
      r.lines.reduce(
        (sum, l) =>
          sum +
          l.points.reduce(
            (s, p, i) => (i === 0 ? s : s + Math.hypot(p.x - l.points[i - 1].x, p.y - l.points[i - 1].y)),
            0
          ),
        0
      );
    const wet = generateGesture({ ...BASE, seed: 11, preset: 'kline', dryness: 0, spatter: 0, drips: 0 });
    const dry = generateGesture({ ...BASE, seed: 11, preset: 'kline', dryness: 1, spatter: 0, drips: 0 });
    expect(dry.lines.length).toBeGreaterThan(wet.lines.length);
    expect(totalLen(dry)).toBeLessThan(totalLen(wet));
  });

  it('tags layers for per-pen export', () => {
    const r = generateGesture({ ...BASE, seed: 42, preset: 'sumi', spatter: 1 });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.has('gesture')).toBe(true);
    expect(layers.has('secondary')).toBe(true);
    expect(layers.has('spatter')).toBe(true);
  });

  it('renders nothing when the work rect is degenerate', () => {
    const r = generateGesture({ width: 60, height: 60, margin: 25, seed: 42 });
    expect(r.lines).toEqual([]);
  });
});
