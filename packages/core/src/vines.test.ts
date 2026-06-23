import { describe, it, expect } from 'vitest';
import { generateVines, type VinesOptions, type VineSeeding } from './vines.js';
import type { FlowLine } from './flow-lines.js';

function baseOptions(overrides: Partial<VinesOptions> = {}): VinesOptions {
  return {
    width: 400,
    height: 600,
    margin: 20,
    seed: 42,
    seeding: 'scatter',
    seedCount: 5,
    ...overrides,
  };
}

function layers(lines: FlowLine[], layer: string): FlowLine[] {
  return lines.filter((l) => l.layer === layer);
}

describe('generateVines', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = generateVines(baseOptions({ seed: 7 }));
    const b = generateVines(baseOptions({ seed: 7 }));
    const c = generateVines(baseOptions({ seed: 8 }));
    expect(b.lines).toEqual(a.lines);
    expect(c.lines).not.toEqual(a.lines);
  });

  it('keeps stems within the page in both modes for every seeding', () => {
    const seedings: VineSeeding[] = ['scatter', 'edges', 'point', 'painted'];
    for (const mode of ['growth', 'colonization'] as const) {
      for (const seeding of seedings) {
        const result = generateVines(
          baseOptions({
            mode,
            seeding,
            startPoints: [
              { x: 200, y: 500 },
              { x: 120, y: 450 },
            ],
          })
        );
        const stems = layers(result.lines, 'stem');
        expect(stems.length).toBeGreaterThanOrEqual(1);
        for (const stem of stems) {
          for (const p of stem.points) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(result.width);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(result.height);
          }
        }
      }
    }
  });

  it('emits each decoration only when its toggle is on', () => {
    const on = generateVines(
      baseOptions({ leaves: true, tendrils: true, flowers: true, tendrilProb: 1, flowerProb: 1 })
    );
    expect(layers(on.lines, 'leaf').length).toBeGreaterThan(0);
    expect(layers(on.lines, 'tendril').length).toBeGreaterThan(0);
    expect(layers(on.lines, 'flower').length).toBeGreaterThan(0);

    const off = generateVines(
      baseOptions({ leaves: false, tendrils: false, flowers: false })
    );
    expect(layers(off.lines, 'leaf').length).toBe(0);
    expect(layers(off.lines, 'tendril').length).toBe(0);
    expect(layers(off.lines, 'flower').length).toBe(0);
    // Stems still grow with all decorations off.
    expect(layers(off.lines, 'stem').length).toBeGreaterThanOrEqual(1);
  });

  it('grows more stems as branch probability rises', () => {
    const sparse = generateVines(
      baseOptions({ mode: 'growth', branchProb: 0, leaves: false, tendrils: false, flowers: false })
    );
    const busy = generateVines(
      baseOptions({ mode: 'growth', branchProb: 0.2, maxDepth: 5, leaves: false, tendrils: false, flowers: false })
    );
    expect(layers(busy.lines, 'stem').length).toBeGreaterThan(
      layers(sparse.lines, 'stem').length
    );
  });

  it('colonization produces a connected branching network', () => {
    const result = generateVines(
      baseOptions({
        mode: 'colonization',
        seeding: 'point',
        startPoints: [{ x: 200, y: 300 }],
        attractorCount: 400,
        leaves: false,
        tendrils: false,
        flowers: false,
      })
    );
    expect(layers(result.lines, 'stem').length).toBeGreaterThan(1);
  });
});
