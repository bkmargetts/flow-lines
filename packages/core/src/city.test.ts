import { describe, expect, it } from 'vitest';
import { generateCity } from './city/index.js';

const BASE = { width: 630, height: 891, margin: 30, seed: 42 } as const;

describe('city generator', () => {
  it('is deterministic per seed', () => {
    const a = generateCity({ ...BASE, order: 0.4 });
    const b = generateCity({ ...BASE, order: 0.4 });
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
  });

  it('draws a substantial city', () => {
    expect(generateCity(BASE).lines.length).toBeGreaterThan(500);
  });

  it('keeps every stroke inside the margin box', () => {
    const res = generateCity({ ...BASE, order: 0.1 });
    for (const ln of res.lines) {
      for (const p of ln.points) {
        expect(p.x).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
        expect(p.x).toBeLessThanOrEqual(BASE.width - BASE.margin + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
        expect(p.y).toBeLessThanOrEqual(BASE.height - BASE.margin + 1e-6);
      }
    }
  });

  it('is truly ruled at order 1 with wobble off: front corner edges are exactly vertical', () => {
    const res = generateCity({ ...BASE, order: 1, wobble: 0, sketch: 0 });
    // The near corner verticals are the bold 'edge' lines.
    const verticals = res.lines.filter((l) => l.layer === 'edge' && l.pen === 'bold' && l.points.length > 2);
    expect(verticals.length).toBeGreaterThan(10);
    for (const ln of verticals) {
      for (const p of ln.points) expect(Math.abs(p.x - ln.points[0].x)).toBeLessThan(1e-6);
    }
  });

  it('window marks follow the windows knob', () => {
    const on = generateCity({ ...BASE, windows: 0.8 });
    const off = generateCity({ ...BASE, windows: 0 });
    expect(on.lines.filter((l) => l.layer === 'window').length).toBeGreaterThan(200);
    expect(off.lines.filter((l) => l.layer === 'window').length).toBe(0);
  });

  it('explicit style "towers" is byte-identical to the default (the compat contract)', () => {
    const a = generateCity({ ...BASE, order: 0.35 });
    const b = generateCity({ ...BASE, order: 0.35, style: 'towers' });
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
  });

  it('old town is deterministic and reads differently from towers', () => {
    const a = generateCity({ ...BASE, style: 'old-town' });
    const b = generateCity({ ...BASE, style: 'old-town' });
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    expect(a.lines.length).toBeGreaterThan(300);
    const towers = generateCity(BASE);
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(towers.lines));
  });

  it('old town at order 1 with wobble off draws sloped gable roof lines', () => {
    const res = generateCity({ ...BASE, style: 'old-town', order: 1, wobble: 0, sketch: 0 });
    // Gable slope edges are neither horizontal nor the iso ±0.5 roof slope.
    const sloped = res.lines.filter((l) => {
      if (l.layer !== 'roof' || l.points.length < 2) return false;
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      const dx = Math.abs(b.x - a.x);
      if (dx < 1) return false;
      const slope = Math.abs((b.y - a.y) / dx);
      return slope > 0.05 && Math.abs(slope - 0.5) > 0.05;
    });
    expect(sloped.length).toBeGreaterThan(10);
  });

  it('morphs the same city rather than re-rolling: nearby orders stay similar in size', () => {
    const a = generateCity({ ...BASE, order: 0.5 });
    const b = generateCity({ ...BASE, order: 0.52 });
    const ratio = b.lines.length / a.lines.length;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });
});
