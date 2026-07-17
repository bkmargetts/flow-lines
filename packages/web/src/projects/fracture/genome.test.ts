import { describe, it, expect } from 'vitest';
import { randomFractureGenome } from './Controls';

/** The randomise-all genome must stay inside every slider's range and leave
 *  the seed, preset and pen/ink aesthetic prefs alone. */
describe('randomFractureGenome', () => {
  const ROLLS = 50;

  it('never touches seed, preset, or the aesthetic prefs', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomFractureGenome(Math.random) as Record<string, unknown>;
      for (const key of [
        'seed',
        'preset',
        'strokeColor',
        'penWidthMm',
        'multiInk',
        'primaryColor',
        'fineColor',
        'plateColor',
      ]) {
        expect(g).not.toHaveProperty(key);
      }
    }
  });

  it('keeps every rolled knob inside its slider bounds', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomFractureGenome(Math.random);
      expect(g.generations).toBeGreaterThanOrEqual(1);
      expect(g.generations).toBeLessThanOrEqual(4);
      expect(Number.isInteger(g.generations)).toBe(true);
      expect(g.crackDensity).toBeGreaterThanOrEqual(0);
      expect(g.crackDensity).toBeLessThanOrEqual(1);
      expect(g.straightness).toBeGreaterThanOrEqual(0);
      expect(g.straightness).toBeLessThanOrEqual(1);
      expect(g.anisotropy).toBeGreaterThanOrEqual(0);
      expect(g.anisotropy).toBeLessThanOrEqual(1);
      expect(g.anisotropyAngleDeg).toBeGreaterThanOrEqual(0);
      expect(g.anisotropyAngleDeg).toBeLessThanOrEqual(180);
      expect(g.anisotropyAngleDeg! % 5).toBe(0);
      expect(g.stressScale).toBeGreaterThanOrEqual(0.1);
      expect(g.stressScale).toBeLessThanOrEqual(0.8);
      expect(g.jitter).toBeGreaterThanOrEqual(0);
      expect(g.jitter).toBeLessThanOrEqual(1);
      expect(g.arrestThreshold).toBeGreaterThanOrEqual(0);
      expect(g.arrestThreshold).toBeLessThanOrEqual(0.6);
      expect(g.edgeNucleation).toBeGreaterThanOrEqual(0);
      expect(g.edgeNucleation).toBeLessThanOrEqual(1);
      expect(typeof g.plateHatch).toBe('boolean');
      expect(g.hatchCoverage).toBeGreaterThanOrEqual(0);
      expect(g.hatchCoverage).toBeLessThanOrEqual(1);
      expect(g.hatchAngleDeg).toBeGreaterThanOrEqual(-90);
      expect(g.hatchAngleDeg).toBeLessThanOrEqual(90);
      expect(g.edgeCurl).toBeGreaterThanOrEqual(0);
      expect(g.edgeCurl).toBeLessThanOrEqual(1);
      expect(g.boldPasses).toBeGreaterThanOrEqual(1);
      expect(g.boldPasses).toBeLessThanOrEqual(6);
      expect(Number.isInteger(g.boldPasses)).toBe(true);
      expect(g.wobble).toBeGreaterThanOrEqual(0);
      expect(g.wobble).toBeLessThanOrEqual(3);
    }
  });
});
