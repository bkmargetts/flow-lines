import { describe, it, expect } from 'vitest';
import { generateLifeTerraces, type LifeTerracesOptions } from './life-terraces/index.js';
import { buildTerraceField } from './life-terraces/field.js';
import { simulate } from './conway/sim.js';
import { makeRandom } from './lib/rng.js';

const base: LifeTerracesOptions = {
  width: 600,
  height: 600,
  seed: 7,
  generations: 260,
  cellSize: 6,
};

const layersOf = (r: { lines: { layer?: string }[] }) => new Set(r.lines.map((l) => l.layer));
const history = (r: { lines: { layer?: string }[] }) =>
  r.lines.filter((l) => l.layer !== 'present');

describe('life terraces', () => {
  it('is deterministic per options', () => {
    for (const opts of [
      base,
      { ...base, outlines: true },
      { ...base, continuous: true },
      { ...base, pens: 3, penAssignment: 'interleave' as const },
    ]) {
      const a = generateLifeTerraces(opts);
      const b = generateLifeTerraces(opts);
      expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    }
  });

  it('different seeds draw different lines', () => {
    const a = generateLifeTerraces(base);
    const b = generateLifeTerraces({ ...base, seed: 8 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('keeps every point finite and on the page at extreme knobs', () => {
    const r = generateLifeTerraces({
      ...base,
      levels: 8,
      seamWidth: 12,
      waviness: 1,
      densityContrast: 1,
      outlines: true,
      pens: 4,
      faults: 4,
      faultThrow: 2,
    });
    expect(r.lines.length).toBeGreaterThan(0);
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        // hand-drawn wobble may push a hair past the grid, never off the page
        expect(p.x).toBeGreaterThanOrEqual(-5);
        expect(p.x).toBeLessThanOrEqual(r.width + 5);
        expect(p.y).toBeGreaterThanOrEqual(-5);
        expect(p.y).toBeLessThanOrEqual(r.height + 5);
      }
    }
  });

  it('tags the present and one ink layer by default', () => {
    const r = generateLifeTerraces(base);
    const layers = layersOf(r);
    expect(layers.has('present')).toBe(true);
    expect(layers.has('ink-0')).toBe(true);
    expect([...layers].every((l) => l === 'present' || l === 'ink-0')).toBe(true);
  });

  it('deals history strokes across pens', () => {
    const r = generateLifeTerraces({ ...base, pens: 3 });
    const layers = layersOf(r);
    expect(layers.has('ink-0')).toBe(true);
    expect(layers.has('ink-1')).toBe(true);
    expect(layers.has('ink-2')).toBe(true);
    // the present always rides its own layer, never an ink group
    expect(r.lines.every((l) => l.layer === 'present' || l.layer?.startsWith('ink-'))).toBe(true);
  });

  it('outlines add bold non-present dashes', () => {
    const plain = generateLifeTerraces({ ...base, faults: 0 });
    const outlined = generateLifeTerraces({ ...base, faults: 0, outlines: true });
    const boldHistory = (r: typeof plain) =>
      r.lines.filter((l) => l.pen === 'bold' && l.layer !== 'present').length;
    expect(boldHistory(plain)).toBe(0);
    expect(boldHistory(outlined)).toBeGreaterThan(0);
  });

  it('faults ink bold scarp lines and shear the drawing', () => {
    const flat = generateLifeTerraces({ ...base, faults: 0 });
    const faulted = generateLifeTerraces({ ...base, faults: 2 });
    const boldHistory = (r: typeof flat) =>
      r.lines.filter((l) => l.pen === 'bold' && l.layer !== 'present').length;
    expect(boldHistory(flat)).toBe(0);
    expect(boldHistory(faulted)).toBeGreaterThan(0);
    expect(JSON.stringify(faulted.lines)).not.toBe(JSON.stringify(flat.lines));
  });

  it('faultThrow 0 is a byte-identical no-op', () => {
    const none = generateLifeTerraces({ ...base, faults: 0 });
    const zeroThrow = generateLifeTerraces({ ...base, faults: 3, faultThrow: 0 });
    expect(JSON.stringify(zeroThrow.lines)).toBe(JSON.stringify(none.lines));
  });

  it('holds history off the present with a halo', () => {
    const tight = generateLifeTerraces({ ...base, haloRadius: 0 });
    const wide = generateLifeTerraces({ ...base, haloRadius: base.cellSize! * 2.5 });
    expect(history(wide).length).toBeLessThanOrEqual(history(tight).length);
  });

  it('tighter spacing draws more laminae', () => {
    const sparse = generateLifeTerraces({ ...base, spacing: 1.4 });
    const dense = generateLifeTerraces({ ...base, spacing: 0.5 });
    expect(history(dense).length).toBeGreaterThan(history(sparse).length);
  });

  it('wider seams reserve more paper (less history ink)', () => {
    const inked = (r: ReturnType<typeof generateLifeTerraces>) => {
      let total = 0;
      for (const l of history(r)) {
        for (let i = 1; i < l.points.length; i++) {
          total += Math.hypot(
            l.points[i].x - l.points[i - 1].x,
            l.points[i].y - l.points[i - 1].y
          );
        }
      }
      return total;
    };
    const thin = generateLifeTerraces({ ...base, seamWidth: 1 });
    const wide = generateLifeTerraces({ ...base, seamWidth: base.cellSize! * 1.5 });
    expect(inked(wide)).toBeLessThan(inked(thin));
  });

  it('keeps each lamina inside its terrace level (the signature constraint)', () => {
    // Rebuild the exact field the generator walked: same grid, same sim, same
    // tone recipe — then assert no history stroke wanders far in field value.
    const opts: LifeTerracesOptions = {
      ...base,
      faults: 0, // the test rebuilds the un-sheared field
      wobble: 0,
      waviness: 0,
      taper: 0,
      continuous: true,
      optimize: false,
    };
    const r = generateLifeTerraces(opts);
    const cellSize = 6;
    const borderGap = 2;
    const frameMargin = borderGap * cellSize; // margin 0
    const cols = Math.floor((600 - 2 * frameMargin) / cellSize);
    const rows = cols;
    const originX = frameMargin + ((600 - 2 * frameMargin) - cols * cellSize) / 2;
    const sim = simulate(cols, rows, 260, 0.96, makeRandom(7), 1, 0.6, null);
    const field = buildTerraceField(sim, 0.45, 1.5, 0.08, 5);

    const levels = 5;
    const bandWidth = (1 - 0.08) / levels;
    for (const line of history(r)) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of line.points) {
        const v = field.sample((p.x - originX) / cellSize - 0.5, (p.y - originX) / cellSize - 0.5);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      // The walk corridor is 0.45 band each side of the spawn value; smoothing
      // adds a hair. A stroke spanning more than ~1.2 bands has escaped its
      // terrace.
      expect(hi - lo).toBeLessThan(bandWidth * 1.2);
    }
  });

  it('returns an empty result when the grid cannot fit', () => {
    const r = generateLifeTerraces({ width: 30, height: 30, cellSize: 10, seed: 1 });
    expect(r.lines).toEqual([]);
    expect(r.width).toBe(30);
  });

  it('survives zero generations', () => {
    const r = generateLifeTerraces({ ...base, generations: 0 });
    // the seed pentomino is the present; little to no history
    expect(Array.isArray(r.lines)).toBe(true);
  });
});
