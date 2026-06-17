import { describe, it, expect } from 'vitest';
import {
  generateLenia,
  stepLenia,
  makeRingKernel,
  growthFn,
  ORBIUM,
} from './lenia.js';

/** Pull every point of every line flat, for bounds/equality checks */
function allPoints(lines: { points: { x: number; y: number }[] }[]) {
  return lines.flatMap((l) => l.points);
}

describe('growthFn', () => {
  it('peaks at μ and is symmetric around it', () => {
    const mu = 0.15;
    const sigma = 0.02;
    expect(growthFn(mu, mu, sigma)).toBeCloseTo(1, 6);
    // Symmetric: equal offsets either side of μ give the same growth.
    expect(growthFn(mu + 0.03, mu, sigma)).toBeCloseTo(growthFn(mu - 0.03, mu, sigma), 6);
    // Far from μ the growth saturates toward −1.
    expect(growthFn(mu + 0.5, mu, sigma)).toBeCloseTo(-1, 4);
  });
});

describe('makeRingKernel', () => {
  it('is normalised (Σw = 1) and confined to the radius', () => {
    const k = makeRingKernel(13, [1]);
    expect(k.taps).toBeGreaterThan(0);
    let sum = 0;
    for (let i = 0; i < k.taps; i++) {
      sum += k.w[i];
      expect(Math.hypot(k.dx[i], k.dy[i])).toBeLessThan(13);
    }
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('stepLenia', () => {
  it('keeps the state within [0, 1]', () => {
    const cols = 48;
    const rows = 48;
    const n = cols * rows;
    let a = new Float32Array(n);
    let aNext = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.random();
    const kernel = makeRingKernel(13, [1]);
    for (let s = 0; s < 20; s++) {
      stepLenia(a, aNext, cols, rows, kernel, 0.15, 0.017, 0.1);
      [a, aNext] = [aNext, a];
    }
    for (let i = 0; i < n; i++) {
      expect(a[i]).toBeGreaterThanOrEqual(0);
      expect(a[i]).toBeLessThanOrEqual(1);
    }
  });

  it('lets a seeded Orbium glide (its centre of mass moves)', () => {
    const cols = 64;
    const rows = 64;
    const n = cols * rows;
    let a = new Float32Array(n);
    let aNext = new Float32Array(n);
    // Stamp Orbium near the centre.
    const ox = 22;
    const oy = 22;
    for (let r = 0; r < ORBIUM.length; r++) {
      for (let c = 0; c < ORBIUM[r].length; c++) {
        a[(oy + r) * cols + (ox + c)] = ORBIUM[r][c];
      }
    }
    const kernel = makeRingKernel(13, [1]);
    const centreOfMass = (g: Float32Array) => {
      let sx = 0;
      let sy = 0;
      let m = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = g[y * cols + x];
          sx += v * x;
          sy += v * y;
          m += v;
        }
      }
      return { x: sx / m, y: sy / m, mass: m };
    };
    const before = centreOfMass(a);
    for (let s = 0; s < 200; s++) {
      stepLenia(a, aNext, cols, rows, kernel, 0.15, 0.015, 0.1);
      [a, aNext] = [aNext, a];
    }
    const after = centreOfMass(a);
    // The creature survived (didn't die out)...
    expect(after.mass).toBeGreaterThan(before.mass * 0.3);
    // ...and travelled a meaningful distance across the grid.
    const travel = Math.hypot(after.x - before.x, after.y - before.y);
    expect(travel).toBeGreaterThan(2);
  });
});

describe('generateLenia', () => {
  // Small grid / short run keeps the suite fast.
  const base = {
    width: 600,
    height: 600,
    seed: 7,
    gridCols: 80,
    steps: 140,
    preset: 'cells' as const,
  };

  it('is deterministic for the same options and seed', () => {
    const a = generateLenia(base);
    const b = generateLenia(base);
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    expect(a.lines.length).toBeGreaterThan(0);
  });

  it('produces different compositions for different seeds', () => {
    const a = generateLenia({ ...base, seed: 1 });
    const b = generateLenia({ ...base, seed: 2 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('produces different compositions for different presets', () => {
    const a = generateLenia({ ...base, preset: 'cells' });
    const b = generateLenia({ ...base, preset: 'rings' });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('honours explicit μ / σ overrides', () => {
    const preset = generateLenia(base);
    const overridden = generateLenia({ ...base, mu: 0.26, sigma: 0.036 });
    expect(JSON.stringify(preset.lines)).not.toBe(JSON.stringify(overridden.lines));
  });

  it('keeps every mark inside the page margin', () => {
    const margin = 40;
    const r = generateLenia({ ...base, margin });
    for (const p of allPoints(r.lines)) {
      expect(p.x).toBeGreaterThanOrEqual(margin - 5);
      expect(p.x).toBeLessThanOrEqual(base.width - margin + 5);
      expect(p.y).toBeGreaterThanOrEqual(margin - 5);
      expect(p.y).toBeLessThanOrEqual(base.height - margin + 5);
    }
  });

  it('reports the requested page size and seed', () => {
    const r = generateLenia(base);
    expect(r.width).toBe(600);
    expect(r.height).toBe(600);
    expect(r.seed).toBe(7);
  });

  it('returns an empty-but-valid result when the grid cannot fit', () => {
    const r = generateLenia({ ...base, margin: 299 });
    expect(r.lines).toEqual([]);
    expect(r.width).toBe(600);
  });

  it('tags strokes with core / mid / rim layers', () => {
    const r = generateLenia(base);
    const layers = new Set(r.lines.map((l) => l.layer));
    expect([...layers].every((l) => l === 'core' || l === 'mid' || l === 'rim')).toBe(true);
  });

  it('draws bold core marks for every style', () => {
    for (const style of ['contour', 'hatch', 'dual'] as const) {
      const r = generateLenia({ ...base, style, steps: 120 });
      expect(r.lines.some((l) => l.pen === 'bold')).toBe(true);
    }
  });

  it('renders the Orbium glider with a long-exposure trail', () => {
    const r = generateLenia({
      width: 600,
      height: 600,
      seed: 3,
      gridCols: 72,
      steps: 200,
      preset: 'orbium',
    });
    expect(r.lines.length).toBeGreaterThan(0);
  });

  describe('art style', () => {
    it('toggling art style changes the composition', () => {
      const art = generateLenia({ ...base, artStyle: true });
      const faithful = generateLenia({ ...base, artStyle: false });
      expect(JSON.stringify(art.lines)).not.toBe(JSON.stringify(faithful.lines));
    });

    it('value-band posterization changes the output', () => {
      const banded = generateLenia({ ...base, valueBands: 4 });
      const continuous = generateLenia({ ...base, valueBands: 0 });
      expect(JSON.stringify(banded.lines)).not.toBe(JSON.stringify(continuous.lines));
    });
  });
});
