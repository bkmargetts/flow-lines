import { describe, it, expect } from 'vitest';
import { generateVines, type VinesOptions, type VineSeeding } from './vines.js';
import type { FlowLine } from './flow-lines.js';

function baseOptions(overrides: Partial<VinesOptions> = {}): VinesOptions {
  return {
    width: 400,
    height: 600,
    margin: 20,
    seed: 42,
    composition: 'free',
    seeding: 'scatter',
    seedCount: 5,
    ...overrides,
  };
}

function layers(lines: FlowLine[], layer: string): FlowLine[] {
  return lines.filter((l) => l.layer === layer);
}

function pointCount(lines: FlowLine[]): number {
  return lines.reduce((n, l) => n + l.points.length, 0);
}

describe('generateVines', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = generateVines(baseOptions({ seed: 7 }));
    const b = generateVines(baseOptions({ seed: 7 }));
    const c = generateVines(baseOptions({ seed: 8 }));
    expect(b.lines).toEqual(a.lines);
    expect(c.lines).not.toEqual(a.lines);
  });

  it('produces finite, roughly in-bounds geometry in both modes for every seeding', () => {
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
        const tol = 40;
        for (const ln of result.lines) {
          for (const p of ln.points) {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
            expect(p.x).toBeGreaterThanOrEqual(-tol);
            expect(p.x).toBeLessThanOrEqual(result.width + tol);
            expect(p.y).toBeGreaterThanOrEqual(-tol);
            expect(p.y).toBeLessThanOrEqual(result.height + tol);
          }
        }
      }
    }
  });

  it('composes a single specimen with a master gesture', () => {
    const result = generateVines(baseOptions({ composition: 'specimen', mode: 'growth' }));
    expect(layers(result.lines, 'stem').length).toBeGreaterThanOrEqual(1);
  });

  it('draws thicker vines as more fill passes (solid)', () => {
    const thin = generateVines(baseOptions({ vineFill: 'solid', stemWidth: 2, leaves: false, tendrils: false, flowers: false }));
    const thick = generateVines(baseOptions({ vineFill: 'solid', stemWidth: 12, leaves: false, tendrils: false, flowers: false }));
    expect(layers(thick.lines, 'stem').length).toBeGreaterThan(layers(thin.lines, 'stem').length);
  });

  it('hidden-line occlusion only removes geometry', () => {
    const common = { mode: 'growth', composition: 'free', seeding: 'scatter', seedCount: 6, leafSize: 40, leafSpacing: 16 } as const;
    const occluded = generateVines(baseOptions({ ...common, occlude: true }));
    const flat = generateVines(baseOptions({ ...common, occlude: false }));
    expect(pointCount(occluded.lines)).toBeLessThanOrEqual(pointCount(flat.lines));
  });

  it('light angle changes the shaded side', () => {
    const common = { composition: 'specimen', mode: 'growth', vineFill: 'shaded', shadeDensity: 0.8, stemWidth: 10 } as const;
    const a = generateVines(baseOptions({ ...common, lightAngle: -135 }));
    const b = generateVines(baseOptions({ ...common, lightAngle: 45 }));
    expect(b.lines).not.toEqual(a.lines);
  });

  it('emits each decoration only when its toggle is on', () => {
    const on = generateVines(
      baseOptions({ leaves: true, veins: true, tendrils: true, flowers: true, tendrilProb: 1, flowerProb: 1 })
    );
    expect(layers(on.lines, 'leaf').length).toBeGreaterThan(0);
    expect(layers(on.lines, 'vein').length).toBeGreaterThan(0);
    expect(layers(on.lines, 'tendril').length).toBeGreaterThan(0);
    expect(layers(on.lines, 'flower').length).toBeGreaterThan(0);

    const off = generateVines(baseOptions({ leaves: false, tendrils: false, flowers: false }));
    expect(layers(off.lines, 'leaf').length).toBe(0);
    expect(layers(off.lines, 'tendril').length).toBe(0);
    expect(layers(off.lines, 'flower').length).toBe(0);
    expect(layers(off.lines, 'stem').length).toBeGreaterThanOrEqual(1);
  });

  it('veins toggle gates the vein layer', () => {
    const withVeins = generateVines(baseOptions({ veins: true, leafStyle: 'veined', tendrils: false, flowers: false }));
    const without = generateVines(baseOptions({ veins: false, leafStyle: 'outline', tendrils: false, flowers: false }));
    expect(layers(withVeins.lines, 'vein').length).toBeGreaterThan(0);
    expect(layers(without.lines, 'vein').length).toBe(0);
  });

  it('solid leaves fill with more lines than outline-only leaves', () => {
    const common = { tendrils: false, flowers: false, leafSize: 30, occlude: false } as const;
    const solid = generateVines(baseOptions({ ...common, leafStyle: 'solid' }));
    const outline = generateVines(baseOptions({ ...common, leafStyle: 'outline' }));
    expect(layers(solid.lines, 'leaf').length).toBeGreaterThan(layers(outline.lines, 'leaf').length);
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
