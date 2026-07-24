import { describe, it, expect } from 'vitest';
import type { TextureStyle } from '@flow-lines/core';
import { randomClassicGenome } from './Controls';
import { defaultClassicParams } from './types';

/**
 * The 🎲 Randomize-everything genome: it rolls the style itself, every knob
 * the rolled style exposes, and the frame region — all inside the slider
 * bounds the panel shows — and never overrides the user's ink choice or seed.
 */

const STYLES: TextureStyle[] = [
  'hatch',
  'grid',
  'stipple',
  'contours',
  'shapes',
  'dashes',
  'scribble',
];

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
const SCRIBBLE_BOUNDS: Record<string, [number, number]> = {
  loopSizeMm: [1, 15],
  advance: [0.2, 1.5],
  slant: [-1, 1],
  wobbleMm: [0, 2],
  sparsity: [0, 0.9],
};
const REGION_BOUNDS: Record<string, [number, number]> = {
  coverage: [0.4, 1],
  irregularity: [0, 1],
  offsetX: [-0.5, 0.5],
  offsetY: [-0.5, 0.5],
  patches: [1, 4],
  fade: [0, 1],
  falloff: [0, 1],
};

/** An rng whose first draw forces the style pick, random afterwards — pins
 *  per-style knob sets without depending on luck. The style is the genome's
 *  first draw by design. */
function rngForStyle(style: TextureStyle): () => number {
  let first = true;
  return () => {
    if (first) {
      first = false;
      return (STYLES.indexOf(style) + 0.5) / STYLES.length;
    }
    return Math.random();
  };
}

describe('randomClassicGenome', () => {
  it('rolls a style from the panel list; never touches colour or seed', () => {
    for (let roll = 0; roll < 100; roll++) {
      const g = randomClassicGenome(Math.random);
      expect(STYLES).toContain(g.style);
      expect(g).not.toHaveProperty('color');
      expect(g).not.toHaveProperty('seed');
    }
  });

  it('reaches every style and both frame modes', () => {
    const styles = new Set<TextureStyle>();
    const frames = new Set<string>();
    for (let roll = 0; roll < 500 && (styles.size < STYLES.length || frames.size < 2); roll++) {
      const g = randomClassicGenome(Math.random);
      styles.add(g.style!);
      frames.add(g.region!.frame);
    }
    expect([...styles].sort()).toEqual([...STYLES].sort());
    expect([...frames].sort()).toEqual(['organic', 'rect']);
  });

  it('stays inside the slider bounds on every roll', () => {
    for (let roll = 0; roll < 200; roll++) {
      const g = randomClassicGenome(Math.random) as Record<string, unknown>;
      for (const [key, [lo, hi]] of Object.entries(BOUNDS)) {
        const v = g[key];
        if (typeof v === 'number') {
          expect(v, `${g.style}.${key}`).toBeGreaterThanOrEqual(lo);
          expect(v, `${g.style}.${key}`).toBeLessThanOrEqual(hi);
        }
      }
      const dashes = g.dashes as Record<string, number> | undefined;
      if (dashes) {
        for (const [key, [lo, hi]] of Object.entries(DASH_BOUNDS)) {
          expect(dashes[key], `dashes.${key}`).toBeGreaterThanOrEqual(lo);
          expect(dashes[key], `dashes.${key}`).toBeLessThanOrEqual(hi);
        }
      }
      const scribble = g.scribble as Record<string, number> | undefined;
      if (scribble) {
        for (const [key, [lo, hi]] of Object.entries(SCRIBBLE_BOUNDS)) {
          expect(scribble[key], `scribble.${key}`).toBeGreaterThanOrEqual(lo);
          expect(scribble[key], `scribble.${key}`).toBeLessThanOrEqual(hi);
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
      const region = g.region as Record<string, unknown>;
      expect(['rect', 'organic']).toContain(region.frame);
      for (const [key, [lo, hi]] of Object.entries(REGION_BOUNDS)) {
        expect(region[key], `region.${key}`).toBeGreaterThanOrEqual(lo);
        expect(region[key], `region.${key}`).toBeLessThanOrEqual(hi);
      }
      expect(Number.isInteger(region.patches), 'region.patches is an integer').toBe(true);
    }
  });

  it('only rolls knobs the rolled style shows', () => {
    const g = (style: TextureStyle) => randomClassicGenome(rngForStyle(style));
    expect(g('grid').style).toBe('grid');
    expect(g('grid')).not.toHaveProperty('jitter'); // grid has no jitter slider
    expect(g('grid')).not.toHaveProperty('crossHatch');
    expect(g('contours')).not.toHaveProperty('spacingMm');
    expect(g('contours')).not.toHaveProperty('angleDeg');
    expect(g('stipple')).not.toHaveProperty('angleDeg');
    expect(g('hatch')).toHaveProperty('crossHatch');
    expect(g('hatch')).not.toHaveProperty('dashes');
    expect(g('hatch')).not.toHaveProperty('shapes');
    expect(g('hatch')).not.toHaveProperty('scribble');
    expect(g('dashes')).toHaveProperty('dashes');
    expect(g('dashes')).not.toHaveProperty('scale'); // no Mark size slider
    expect(g('shapes')).toHaveProperty('shapes');
    expect(g('shapes')).not.toHaveProperty('scale');
    expect(g('scribble')).toHaveProperty('scribble');
    expect(g('scribble')).not.toHaveProperty('scale');
    expect(g('scribble')).not.toHaveProperty('dashes');
  });

  it('rolled sub-objects carry every knob their panel shows', () => {
    const dashes = randomClassicGenome(rngForStyle('dashes')).dashes!;
    for (const key of Object.keys(DASH_BOUNDS)) expect(dashes).toHaveProperty(key);
    // The internal wobble wavelength has no slider and keeps its default.
    expect(dashes).not.toHaveProperty('wobbleWavelengthMm');
    expect(defaultClassicParams.dashes.wobbleWavelengthMm).toBeDefined();
    const scribble = randomClassicGenome(rngForStyle('scribble')).scribble!;
    for (const key of Object.keys(SCRIBBLE_BOUNDS)) expect(scribble).toHaveProperty(key);
  });
});
