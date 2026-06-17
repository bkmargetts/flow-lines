import { describe, it, expect } from 'vitest';
import { generateReactionDiffusion, stepReactionDiffusion } from './reaction-diffusion.js';

/** Pull every point of every line flat, for bounds/equality checks */
function allPoints(lines: { points: { x: number; y: number }[] }[]) {
  return lines.flatMap((l) => l.points);
}

describe('stepReactionDiffusion (Gray–Scott)', () => {
  it('leaves the homogeneous U=1, V=0 state unchanged', () => {
    const cols = 6;
    const rows = 6;
    const n = cols * rows;
    const u = new Float32Array(n).fill(1);
    const v = new Float32Array(n);
    const uNext = new Float32Array(n);
    const vNext = new Float32Array(n);
    // f·(1−U) = 0 at U=1, the reaction U·V² = 0 at V=0, the Laplacian sums to 0
    // on a flat field — so nothing should be created from nothing.
    stepReactionDiffusion(u, v, uNext, vNext, cols, rows, 1.0, 0.5, 0.0545, 0.062, 1);
    for (let i = 0; i < n; i++) {
      expect(uNext[i]).toBeCloseTo(1, 6);
      expect(vNext[i]).toBeCloseTo(0, 6);
    }
  });

  it('lets a V seed grow and diffuse into its neighbours', () => {
    const cols = 9;
    const rows = 9;
    const n = cols * rows;
    let u = new Float32Array(n).fill(1);
    let v = new Float32Array(n);
    let uNext = new Float32Array(n);
    let vNext = new Float32Array(n);
    const centre = 4 * cols + 4;
    const neighbour = 4 * cols + 5;
    v[centre] = 1;
    u[centre] = 0.5;
    expect(v[neighbour]).toBe(0);

    for (let s = 0; s < 30; s++) {
      stepReactionDiffusion(u, v, uNext, vNext, cols, rows, 1.0, 0.5, 0.0545, 0.062, 1);
      [u, uNext] = [uNext, u];
      [v, vNext] = [vNext, v];
    }

    // V has spread off the seed cell.
    expect(v[neighbour]).toBeGreaterThan(0);
    let total = 0;
    for (let i = 0; i < n; i++) total += v[i];
    expect(total).toBeGreaterThan(0);
  });
});

describe('generateReactionDiffusion', () => {
  // Low step count keeps the suite fast — patterns needn't fully mature to
  // assert structural properties.
  const base = {
    width: 600,
    height: 600,
    seed: 7,
    gridCols: 96,
    steps: 400,
    preset: 'coral' as const,
  };

  it('is deterministic for the same options and seed', () => {
    const a = generateReactionDiffusion(base);
    const b = generateReactionDiffusion(base);
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    expect(a.lines.length).toBeGreaterThan(0);
  });

  it('produces different compositions for different seeds', () => {
    const a = generateReactionDiffusion({ ...base, seed: 1 });
    const b = generateReactionDiffusion({ ...base, seed: 2 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('produces different compositions for different presets', () => {
    const a = generateReactionDiffusion({ ...base, preset: 'coral' });
    const b = generateReactionDiffusion({ ...base, preset: 'maze' });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('honours explicit feed/kill overrides', () => {
    const preset = generateReactionDiffusion(base);
    const overridden = generateReactionDiffusion({ ...base, feed: 0.026, kill: 0.051 });
    expect(JSON.stringify(preset.lines)).not.toBe(JSON.stringify(overridden.lines));
  });

  it('keeps every mark inside the page margin', () => {
    const margin = 40;
    const r = generateReactionDiffusion({ ...base, margin });
    for (const p of allPoints(r.lines)) {
      // A little slack for the hand-drawn wobble at the very edge.
      expect(p.x).toBeGreaterThanOrEqual(margin - 5);
      expect(p.x).toBeLessThanOrEqual(base.width - margin + 5);
      expect(p.y).toBeGreaterThanOrEqual(margin - 5);
      expect(p.y).toBeLessThanOrEqual(base.height - margin + 5);
    }
  });

  it('reports the requested page size and seed', () => {
    const r = generateReactionDiffusion(base);
    expect(r.width).toBe(600);
    expect(r.height).toBe(600);
    expect(r.seed).toBe(7);
  });

  it('returns an empty-but-valid result when the grid cannot fit', () => {
    const r = generateReactionDiffusion({ ...base, margin: 299 });
    expect(r.lines).toEqual([]);
    expect(r.width).toBe(600);
  });

  it('draws bold core marks for the contour and hatch styles', () => {
    for (const style of ['contour', 'hatch', 'dual'] as const) {
      const r = generateReactionDiffusion({ ...base, style });
      expect(r.lines.some((l) => l.pen === 'bold')).toBe(true);
    }
  });

  it('tags strokes with core / mid / rim layers', () => {
    const r = generateReactionDiffusion(base);
    const layers = new Set(r.lines.map((l) => l.layer));
    expect([...layers].every((l) => l === 'core' || l === 'mid' || l === 'rim')).toBe(true);
  });

  describe('art style', () => {
    it('is deterministic with the art treatment on', () => {
      const a = generateReactionDiffusion({ ...base, artStyle: true });
      const b = generateReactionDiffusion({ ...base, artStyle: true });
      expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
      expect(a.lines.length).toBeGreaterThan(0);
    });

    it('toggling art style changes the composition', () => {
      const art = generateReactionDiffusion({ ...base, artStyle: true });
      const faithful = generateReactionDiffusion({ ...base, artStyle: false });
      expect(JSON.stringify(art.lines)).not.toBe(JSON.stringify(faithful.lines));
    });

    it('value-band posterization changes the output', () => {
      const banded = generateReactionDiffusion({ ...base, valueBands: 4 });
      const continuous = generateReactionDiffusion({ ...base, valueBands: 0 });
      expect(JSON.stringify(banded.lines)).not.toBe(JSON.stringify(continuous.lines));
    });
  });
});
