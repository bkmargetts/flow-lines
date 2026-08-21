import { describe, it, expect } from 'vitest';
import { randomArcticGenome } from './Controls';

/** The randomise-all genome must stay inside every slider's range and leave
 *  the seed, preset and pen/ink aesthetic prefs alone. */
describe('randomArcticGenome', () => {
  const ROLLS = 50;

  it('never touches seed, preset, or the aesthetic prefs', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomArcticGenome(Math.random) as Record<string, unknown>;
      for (const key of [
        'seed',
        'preset',
        'strokeColor',
        'penWidthMm',
        'multiInk',
        'northColor',
        'southColor',
        'eastColor',
        'westColor',
      ]) {
        expect(g).not.toHaveProperty(key);
      }
    }
  });

  it('keeps every rolled knob inside its slider bounds', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomArcticGenome(Math.random);
      expect(g.order).toBeGreaterThanOrEqual(10);
      expect(g.order).toBeLessThanOrEqual(240);
      expect(Number.isInteger(g.order)).toBe(true);
      expect(['one', 'horizontals', 'all', 'outline']).toContain(g.marks);
      expect(typeof g.upright).toBe('boolean');
      expect(g.wobble).toBeGreaterThanOrEqual(0);
      expect(g.wobble).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the outline strategy at an order a fine nib can still resolve', () => {
    // Every domino gets an outline, so 'outline' at a high order collapses into
    // grey mush on paper. The genome must hold it lower than the spine looks.
    for (let i = 0; i < 200; i++) {
      const g = randomArcticGenome(Math.random);
      if (g.marks === 'outline') expect(g.order).toBeLessThanOrEqual(90);
    }
  });
});
