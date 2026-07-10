import { describe, it, expect } from 'vitest';
import type { TextureStyle } from '@flow-lines/core';
import { randomClassicGenome } from './Controls';
import { defaultClassicParams } from './types';

/**
 * The 🎲 Randomize-everything genome: every roll must stay inside the slider
 * bounds the panel shows, only touch knobs the current style exposes, and
 * never override the user's style or ink choices.
 */

const STYLES: TextureStyle[] = ['hatch', 'grid', 'stipple', 'contours', 'shapes', 'dashes'];

// Slider bounds from ClassicControls (min/max per knob).
const BOUNDS: Record<string, [number, number]> = {
  spacingMm: [1, 12],
  angleDeg: [0, 180],
  scale: [0.2, 3],
  jitter: [0, 1],
  density: [0, 1],
};
const DASH_BOUNDS: Record<string, [number, number]> = {
  dashLengthMm: [1, 20],
  gapMm: [0.5, 15],
  wobbleMm: [0, 2],
  curvatureMm: [0, 4],
  sparsity: [0, 0.9],
  flowDeg: [0, 90],
  turbulence: [0, 1],
  gradient: [-1, 1],
};
const SHAPE_BOUNDS: Record<string, [number, number]> = {
  sizeMm: [1, 20],
  overlap: [0, 0.9],
};

describe('randomClassicGenome', () => {
  it('never touches style, colour, or seed', () => {
    for (const style of STYLES) {
      for (let roll = 0; roll < 50; roll++) {
        const g = randomClassicGenome(style, Math.random);
        expect(g).not.toHaveProperty('style');
        expect(g).not.toHaveProperty('color');
        expect(g).not.toHaveProperty('seed');
      }
    }
  });

  it('stays inside the slider bounds on every roll', () => {
    for (const style of STYLES) {
      for (let roll = 0; roll < 50; roll++) {
        const g = randomClassicGenome(style, Math.random) as Record<string, unknown>;
        for (const [key, [lo, hi]] of Object.entries(BOUNDS)) {
          const v = g[key];
          if (typeof v === 'number') {
            expect(v, `${style}.${key}`).toBeGreaterThanOrEqual(lo);
            expect(v, `${style}.${key}`).toBeLessThanOrEqual(hi);
          }
        }
        const dashes = g.dashes as Record<string, number> | undefined;
        if (dashes) {
          for (const [key, [lo, hi]] of Object.entries(DASH_BOUNDS)) {
            expect(dashes[key], `dashes.${key}`).toBeGreaterThanOrEqual(lo);
            expect(dashes[key], `dashes.${key}`).toBeLessThanOrEqual(hi);
          }
        }
        const shapes = g.shapes as Record<string, unknown> | undefined;
        if (shapes) {
          for (const [key, [lo, hi]] of Object.entries(SHAPE_BOUNDS)) {
            expect(shapes[key], `shapes.${key}`).toBeGreaterThanOrEqual(lo);
            expect(shapes[key], `shapes.${key}`).toBeLessThanOrEqual(hi);
          }
          expect(['square', 'circle', 'line']).toContain(shapes.kind);
        }
      }
    }
  });

  it('only rolls knobs the current style shows', () => {
    const g = (style: TextureStyle) => randomClassicGenome(style, Math.random);
    expect(g('grid')).not.toHaveProperty('jitter'); // grid has no jitter slider
    expect(g('grid')).not.toHaveProperty('crossHatch');
    expect(g('contours')).not.toHaveProperty('spacingMm');
    expect(g('contours')).not.toHaveProperty('angleDeg');
    expect(g('stipple')).not.toHaveProperty('angleDeg');
    expect(g('hatch')).toHaveProperty('crossHatch');
    expect(g('hatch')).not.toHaveProperty('dashes');
    expect(g('hatch')).not.toHaveProperty('shapes');
    expect(g('dashes')).toHaveProperty('dashes');
    expect(g('dashes')).not.toHaveProperty('scale'); // no Mark size slider
    expect(g('shapes')).toHaveProperty('shapes');
    expect(g('shapes')).not.toHaveProperty('scale');
  });

  it('rolled sub-objects carry every knob their panel shows', () => {
    const dashes = randomClassicGenome('dashes', Math.random).dashes!;
    for (const key of Object.keys(DASH_BOUNDS)) expect(dashes).toHaveProperty(key);
    // The internal wobble wavelength has no slider and keeps its default.
    expect(dashes).not.toHaveProperty('wobbleWavelengthMm');
    expect(defaultClassicParams.dashes.wobbleWavelengthMm).toBeDefined();
  });
});
