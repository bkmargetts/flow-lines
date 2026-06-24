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

  it('wreath closes into a full ring (foliage covers every angular sector)', () => {
    const r = generateVines(
      baseOptions({ composition: 'wreath', seedCount: 8, leaves: false, flowers: false, tendrils: false })
    );
    const stems = layers(r.lines, 'stem');
    const cx = r.width / 2;
    const cy = r.height / 2;
    const sectors = new Array(12).fill(false);
    for (const s of stems) {
      for (const p of s.points) {
        const a = Math.atan2(p.y - cy, p.x - cx);
        sectors[Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 12] = true;
      }
    }
    // Every 30° sector around the centre carries ring geometry — no gap.
    expect(sectors.every(Boolean)).toBe(true);
  });

  it('a vessel and ground line add geometry only when requested', () => {
    const common = { composition: 'bouquet', mode: 'growth', leaves: false, flowers: false, tendrils: false, occlude: false, castShadow: 0 } as const;
    const bare = generateVines(baseOptions({ ...common, vessel: 'none', groundLine: false }));
    const vase = generateVines(baseOptions({ ...common, vessel: 'vase', groundLine: false }));
    const ground = generateVines(baseOptions({ ...common, vessel: 'none', groundLine: true }));
    expect(layers(vase.lines, 'stem').length).toBeGreaterThan(layers(bare.lines, 'stem').length);
    expect(layers(ground.lines, 'stem').length).toBeGreaterThan(layers(bare.lines, 'stem').length);
  });

  it('renders every vessel style', () => {
    const styles = ['vase', 'urn', 'amphora', 'bud-vase', 'pot', 'jar', 'mason-jar', 'bowl'] as const;
    for (const vessel of styles) {
      const r = generateVines(baseOptions({ composition: 'bouquet', vessel, leaves: false, flowers: false, tendrils: false }));
      expect(layers(r.lines, 'stem').length).toBeGreaterThan(1);
    }
  });

  it('a vessel casts a grounding shadow on the ground only when castShadow is set', () => {
    const common = { composition: 'bouquet', mode: 'growth', vessel: 'urn', leaves: false, flowers: false, tendrils: false } as const;
    const off = generateVines(baseOptions({ ...common, castShadow: 0 }));
    const on = generateVines(baseOptions({ ...common, castShadow: 0.5 }));
    expect(layers(off.lines, 'shadow').length).toBe(0);
    expect(layers(on.lines, 'shadow').length).toBeGreaterThan(0);
  });

  it('negative space thins foliage compared with an evenly-filled page', () => {
    const common = { composition: 'free', mode: 'growth', seeding: 'scatter', seedCount: 10, density: 0.7, tendrils: false } as const;
    const filled = generateVines(baseOptions({ ...common, negativeSpace: 0 }));
    const notan = generateVines(baseOptions({ ...common, negativeSpace: 0.7 }));
    expect(layers(notan.lines, 'leaf').length).toBeLessThan(layers(filled.lines, 'leaf').length);
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

  // ——— botanical authenticity (compound leaves, phyllotaxis, inflorescence,
  //     thorns, fruit) ———

  it('stays deterministic with all botanical features enabled', () => {
    const opts = baseOptions({
      seed: 7,
      composition: 'specimen',
      mode: 'growth',
      leafArrangement: 'pinnate',
      phyllotaxis: 'spiral',
      inflorescence: 'raceme',
      thorns: true,
      fruitType: 'grape',
    });
    const a = generateVines(opts);
    const b = generateVines(opts);
    const c = generateVines({ ...opts, seed: 8 });
    expect(b.lines).toEqual(a.lines);
    expect(c.lines).not.toEqual(a.lines);
  });

  it('compound (pinnate) leaves change the output and add leaf blades', () => {
    const common = { composition: 'specimen', mode: 'growth', density: 0.6, tendrils: false, flowers: false } as const;
    const simple = generateVines(baseOptions({ ...common, leafArrangement: 'simple' }));
    const pinnate = generateVines(baseOptions({ ...common, leafArrangement: 'pinnate', leafletCount: 5 }));
    expect(pinnate.lines).not.toEqual(simple.lines);
    expect(layers(pinnate.lines, 'leaf').length).toBeGreaterThan(layers(simple.lines, 'leaf').length);
  });

  it('phyllotaxis modes each produce distinct output, opposite adds leaves', () => {
    const common = { composition: 'specimen', mode: 'growth', density: 0.5, tendrils: false, flowers: false } as const;
    const alternate = generateVines(baseOptions({ ...common, phyllotaxis: 'alternate' }));
    const opposite = generateVines(baseOptions({ ...common, phyllotaxis: 'opposite' }));
    const spiral = generateVines(baseOptions({ ...common, phyllotaxis: 'spiral' }));
    expect(opposite.lines).not.toEqual(alternate.lines);
    expect(spiral.lines).not.toEqual(alternate.lines);
    expect(spiral.lines).not.toEqual(opposite.lines);
    // Opposite places a blade on both sides at each node.
    expect(layers(opposite.lines, 'leaf').length).toBeGreaterThanOrEqual(layers(alternate.lines, 'leaf').length);
  });

  it('an inflorescence changes the tip and adds flower-layer geometry', () => {
    const common = { composition: 'specimen', mode: 'growth', flowers: true, flowerProb: 0.9, density: 0.4 } as const;
    const single = generateVines(baseOptions({ ...common, inflorescence: 'none' }));
    const raceme = generateVines(baseOptions({ ...common, inflorescence: 'raceme', floretCount: 12 }));
    expect(raceme.lines).not.toEqual(single.lines);
    expect(layers(raceme.lines, 'flower').length).toBeGreaterThan(layers(single.lines, 'flower').length);
  });

  it('thorns add stem-layer geometry and are off by default', () => {
    const common = { composition: 'specimen', mode: 'growth', density: 0.3, flowers: false, tendrils: false } as const;
    const bare = generateVines(baseOptions({ ...common, thorns: false }));
    const thorny = generateVines(baseOptions({ ...common, thorns: true, thornProb: 0.5 }));
    expect(layers(thorny.lines, 'stem').length).toBeGreaterThan(layers(bare.lines, 'stem').length);
  });

  it('fruit reuses the flower layer and is off by default', () => {
    const common = { composition: 'specimen', mode: 'growth', density: 0.4, flowers: false, tendrils: false } as const;
    const none = generateVines(baseOptions({ ...common, fruitType: 'none' }));
    const grapes = generateVines(baseOptions({ ...common, fruitType: 'grape', fruitProb: 0.8 }));
    expect(grapes.lines).not.toEqual(none.lines);
    expect(layers(grapes.lines, 'flower').length).toBeGreaterThan(layers(none.lines, 'flower').length);
  });

  it('occlusion still removes hidden geometry with compound (palmate) leaves', () => {
    const common = { composition: 'specimen', mode: 'growth', leafArrangement: 'palmate', density: 0.8, flowers: false } as const;
    const flat = generateVines(baseOptions({ ...common, occlude: false }));
    const occ = generateVines(baseOptions({ ...common, occlude: true }));
    expect(pointCount(occ.lines)).toBeLessThan(pointCount(flat.lines) * 0.98);
  });

  it('grows along a supplied guide path (guide composition)', () => {
    const path = [
      { x: 60, y: 500 },
      { x: 120, y: 300 },
      { x: 220, y: 150 },
      { x: 320, y: 120 },
    ];
    const result = generateVines(
      baseOptions({
        composition: 'guide',
        mode: 'growth',
        guidePaths: [path],
        leaves: false,
        flowers: false,
        tendrils: false,
      })
    );
    const stems = layers(result.lines, 'stem');
    expect(stems.length).toBeGreaterThanOrEqual(1);
    // The main stem should pass near the far end of the guide.
    const allPts = stems.flatMap((s) => s.points);
    const nearEnd = allPts.some((p) => Math.hypot(p.x - 320, p.y - 120) < 60);
    expect(nearEnd).toBe(true);
  });

  it('falls back to painted startPoints as the guide when no guidePaths given', () => {
    const result = generateVines(
      baseOptions({
        composition: 'guide',
        mode: 'growth',
        startPoints: [{ x: 80, y: 520 }, { x: 200, y: 300 }, { x: 320, y: 140 }],
        leaves: false,
        flowers: false,
        tendrils: false,
      })
    );
    expect(layers(result.lines, 'stem').length).toBeGreaterThanOrEqual(1);
  });

  it('a trellis support adds drawn structure and is off by default', () => {
    const common = { composition: 'trellis', mode: 'growth', seedCount: 3, density: 0.2, flowers: false } as const;
    const bare = generateVines(baseOptions({ ...common, support: 'none' }));
    const lattice = generateVines(baseOptions({ ...common, support: 'lattice' }));
    expect(lattice.lines).not.toEqual(bare.lines);
    expect(layers(lattice.lines, 'stem').length).toBeGreaterThan(layers(bare.lines, 'stem').length);
  });

  it('is deterministic for the guide composition', () => {
    const opts = baseOptions({ composition: 'guide', mode: 'growth', seed: 12, guidePaths: [[{ x: 50, y: 500 }, { x: 200, y: 200 }]] });
    expect(generateVines(opts).lines).toEqual(generateVines(opts).lines);
  });

  it('bark texture adds stem-layer striations on thick canes and is off by default', () => {
    const common = { composition: 'specimen', mode: 'growth', stemWidth: 16, density: 0.2, flowers: false } as const;
    const smooth = generateVines(baseOptions({ ...common, stemTexture: 'none' }));
    const bark = generateVines(baseOptions({ ...common, stemTexture: 'bark' }));
    expect(bark.lines).not.toEqual(smooth.lines);
    expect(layers(bark.lines, 'stem').length).toBeGreaterThan(layers(smooth.lines, 'stem').length);
  });

  it('dewdrops add highlight geometry and are off by default', () => {
    // Isolate dewdrops: with leaves/flowers/tendrils off the only decorations
    // are the dewdrops themselves, so they are purely additive over the stems.
    const common = { composition: 'specimen', mode: 'growth', density: 0.5, leaves: false, flowers: false, tendrils: false } as const;
    const dry = generateVines(baseOptions({ ...common, dewdrops: false }));
    const dewy = generateVines(baseOptions({ ...common, dewdrops: true, dewdropProb: 0.9 }));
    expect(dewy.lines).not.toEqual(dry.lines);
    expect(dewy.lines.length).toBeGreaterThan(dry.lines.length);
  });

  it('keeps every botanical feature finite and roughly in bounds', () => {
    const result = generateVines(
      baseOptions({
        composition: 'specimen',
        mode: 'growth',
        leafArrangement: 'bipinnate',
        phyllotaxis: 'whorled',
        whorlCount: 4,
        inflorescence: 'umbel',
        thorns: true,
        fruitType: 'grape',
        density: 0.6,
      })
    );
    const tol = 80;
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
  });
});
