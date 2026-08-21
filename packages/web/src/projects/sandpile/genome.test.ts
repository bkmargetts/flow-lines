import { describe, it, expect } from 'vitest';
import { randomSandpileGenome } from './Controls';

/** The randomise-all genome must stay inside every slider's range and leave
 *  the seed, preset and pen/ink aesthetic prefs alone. */
describe('randomSandpileGenome', () => {
  const ROLLS = 60;

  it('never touches seed, preset, or the aesthetic prefs', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomSandpileGenome(Math.random) as Record<string, unknown>;
      for (const key of ['seed', 'preset', 'strokeColor', 'penWidthMm']) {
        expect(g).not.toHaveProperty(key);
      }
    }
  });

  it('keeps every rolled knob inside its slider bounds', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomSandpileGenome(Math.random);
      expect(['rectangle', 'disk', 'polygon']).toContain(g.domain);
      expect(['scatter', 'ring', 'grid']).toContain(g.placement);
      expect(g.sides).toBeGreaterThanOrEqual(3);
      expect(g.sides).toBeLessThanOrEqual(12);
      expect(Number.isInteger(g.sides)).toBe(true);
      expect(g.rotationDeg).toBeGreaterThanOrEqual(0);
      expect(g.rotationDeg).toBeLessThanOrEqual(90);
      expect(g.ringRadius).toBeGreaterThanOrEqual(0.1);
      expect(g.ringRadius).toBeLessThanOrEqual(0.95);
      expect(g.points).toBeGreaterThanOrEqual(1);
      expect(g.points).toBeLessThanOrEqual(120);
      expect(Number.isInteger(g.points)).toBe(true);
      expect(g.resolution).toBeGreaterThanOrEqual(120);
      expect(g.resolution).toBeLessThanOrEqual(720);
      expect(g.resolution! % 20).toBe(0);
      expect(g.straightness).toBeGreaterThanOrEqual(1);
      expect(g.straightness).toBeLessThanOrEqual(4);
      expect(g.minSegment).toBeGreaterThanOrEqual(3);
      expect(g.minSegment).toBeLessThanOrEqual(30);
      expect(Number.isInteger(g.minSegment)).toBe(true);
      expect(g.wobble).toBeGreaterThanOrEqual(0);
      expect(g.wobble).toBeLessThanOrEqual(2);
    }
  });

  /**
   * Two caps the genome must respect even though the sliders allow more:
   * relaxation cost grows about cubically in the lattice side, and past roughly
   * 60 grains a large share of the curve's segments fall under 3mm at A3.
   */
  it('stays inside the interactive and plottable envelope', () => {
    for (let i = 0; i < 400; i++) {
      const g = randomSandpileGenome(Math.random);
      expect(g.resolution).toBeLessThanOrEqual(520);
      expect(g.points).toBeLessThanOrEqual(60);
    }
  });
});
