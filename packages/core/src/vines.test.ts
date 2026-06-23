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
        const tol = 60;
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

  it('produces stems for every composition template', () => {
    for (const composition of ['wreath', 'border', 'bouquet', 'trellis'] as const) {
      const r = generateVines(baseOptions({ composition, seedCount: 5 }));
      expect(layers(r.lines, 'stem').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('fill composition grows a connected network inside the shape', () => {
    const r = generateVines(
      baseOptions({ composition: 'fill', fillShape: 'circle', attractorCount: 500, leaves: false, tendrils: false, flowers: false })
    );
    const stems = layers(r.lines, 'stem');
    expect(stems.length).toBeGreaterThan(1);
    // Stem centerlines should stay inside the circular region (with tolerance).
    const cx = r.width / 2;
    const cy = r.height / 2;
    const R = Math.min((r.width - 40) * 0.46, (r.height - 40) * 0.46) + 20;
    for (const s of stems) {
      for (const p of s.points) {
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeLessThanOrEqual(R + 1);
      }
    }
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

  it('occludes overlapping foliage (no see-through)', () => {
    // Regression: sibling leaves must occlude each other — they previously
    // shared a near-equal z and showed through. Creation-order integer z fixes
    // this (each element gets a distinct z), so a covered leaf is cut back.
    const common = {
      composition: 'specimen', mode: 'growth',
      density: 0.95, leafStyle: 'solid', leafSize: 40, leafSpacing: 10, castShadow: 0,
    } as const;
    const occluded = generateVines(baseOptions({ ...common, occlude: true }));
    const flat = generateVines(baseOptions({ ...common, occlude: false }));
    // Occlusion should remove a real amount of covered geometry, not ~nothing.
    expect(pointCount(occluded.lines)).toBeLessThan(pointCount(flat.lines) * 0.9);
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

  it('cast shadows add a shadow layer only when enabled and occluding', () => {
    const common = { composition: 'specimen', mode: 'growth', occlude: true, density: 0.8 } as const;
    const off = generateVines(baseOptions({ ...common, castShadow: 0 }));
    const on = generateVines(baseOptions({ ...common, castShadow: 0.7 }));
    expect(layers(off.lines, 'shadow').length).toBe(0);
    expect(layers(on.lines, 'shadow').length).toBeGreaterThan(0);
  });

  it('density controls how much foliage is placed', () => {
    const sparse = generateVines(baseOptions({ density: 0.1, tendrils: false, flowers: false }));
    const lush = generateVines(baseOptions({ density: 0.95, tendrils: false, flowers: false }));
    expect(layers(lush.lines, 'leaf').length).toBeGreaterThan(layers(sparse.lines, 'leaf').length);
  });

  it('fill-painted grows inside the painted polygon', () => {
    const poly = [
      { x: 120, y: 150 }, { x: 280, y: 150 }, { x: 280, y: 430 }, { x: 120, y: 430 },
    ];
    const r = generateVines(
      baseOptions({ composition: 'fill', fillShape: 'painted', startPoints: poly, attractorCount: 500, leaves: false, tendrils: false, flowers: false })
    );
    const stems = layers(r.lines, 'stem');
    expect(stems.length).toBeGreaterThan(1);
    const tol = 30;
    for (const s of stems) {
      for (const p of s.points) {
        expect(p.x).toBeGreaterThanOrEqual(120 - tol);
        expect(p.x).toBeLessThanOrEqual(280 + tol);
        expect(p.y).toBeGreaterThanOrEqual(150 - tol);
        expect(p.y).toBeLessThanOrEqual(430 + tol);
      }
    }
  });

  it('sketch style changes the overdraw character', () => {
    const fine = generateVines(baseOptions({ sketch: 0.8, sketchStyle: 'fine' }));
    const gestural = generateVines(baseOptions({ sketch: 0.8, sketchStyle: 'gestural' }));
    expect(fine.lines).not.toEqual(gestural.lines);
    expect(fine.lines.length).toBeGreaterThan(gestural.lines.length);
  });

  it('sketchiness multiplies the line count', () => {
    const plain = generateVines(baseOptions({ sketch: 0 }));
    const sketchy = generateVines(baseOptions({ sketch: 0.8 }));
    expect(sketchy.lines.length).toBeGreaterThan(plain.lines.length);
  });

  it('tube shading style adds stem hatching only when not "none"', () => {
    const common = { composition: 'specimen', mode: 'growth', vineFill: 'shaded', stemWidth: 12, shadeDensity: 0.9, leaves: false, tendrils: false, flowers: false } as const;
    const none = generateVines(baseOptions({ ...common, stemShade: 'none' }));
    const along = generateVines(baseOptions({ ...common, stemShade: 'along' }));
    expect(layers(along.lines, 'stem').length).toBeGreaterThan(layers(none.lines, 'stem').length);
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
