import { describe, it, expect } from 'vitest';
import {
  SemanticMap,
  SEMANTIC_LABELS,
  semanticId,
  normalizeAdeName,
  adeNameToSemantic,
  type LabelImage,
} from './semantic-map.js';

/** Label raster split horizontally: `top` above the boundary, `bottom` below. */
function splitRaster(
  width: number,
  height: number,
  top: number,
  bottom: number,
  boundary = 0.5
): LabelImage {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = y < height * boundary ? top : bottom;
    }
  }
  return { width, height, data };
}

describe('taxonomy', () => {
  it('keeps stable ids with 0 meaning no data', () => {
    expect(SEMANTIC_LABELS[0]).toBe('unknown');
    expect(semanticId('unknown')).toBe(0);
    expect(semanticId('sky')).toBe(1);
    expect(semanticId('water')).toBe(2);
    expect(semanticId('foliage')).toBe(3);
    expect(semanticId('ground')).toBe(4);
    expect(semanticId('building')).toBe(5);
    expect(semanticId('person')).toBe(6);
    expect(semanticId('object')).toBe(7);
  });

  it('maps ADE20K names onto the taxonomy with object as the default', () => {
    expect(adeNameToSemantic('sky')).toBe('sky');
    expect(adeNameToSemantic('sea')).toBe('water');
    expect(adeNameToSemantic('tree')).toBe('foliage');
    expect(adeNameToSemantic('skyscraper')).toBe('building');
    expect(adeNameToSemantic('person')).toBe('person');
    expect(adeNameToSemantic('pool table')).toBe('object');
  });

  it('normalizes compound checkpoint names', () => {
    expect(normalizeAdeName('Windowpane;Window')).toBe('windowpane');
    expect(adeNameToSemantic('windowpane;window')).toBe('building');
  });
});

describe('SemanticMap', () => {
  it('reports coverage and presence per label', () => {
    const map = new SemanticMap(splitRaster(64, 64, semanticId('sky'), semanticId('water')), 64, 64);

    expect(map.coverage('sky')).toBeCloseTo(0.5, 1);
    expect(map.coverage('water')).toBeCloseTo(0.5, 1);
    expect(map.has('sky')).toBe(true);
    expect(map.has('water')).toBe(true);
    expect(map.has('person')).toBe(false);
  });

  it('answers in canvas coordinates regardless of raster size', () => {
    const map = new SemanticMap(
      splitRaster(32, 32, semanticId('sky'), semanticId('ground')),
      800,
      600
    );

    expect(map.labelAt(400, 60)).toBe('sky');
    expect(map.labelAt(400, 540)).toBe('ground');
    expect(map.confidence(400, 60, 'sky')).toBeGreaterThan(0.9);
    expect(map.confidence(400, 540, 'sky')).toBeLessThan(0.1);
  });

  it('feathers confidence monotonically across a boundary', () => {
    const map = new SemanticMap(
      splitRaster(128, 128, semanticId('sky'), semanticId('water')),
      128,
      128
    );

    let prev = 1;
    for (let y = 16; y <= 112; y += 8) {
      const c = map.confidence(64, y, 'sky');
      expect(c).toBeLessThanOrEqual(prev + 1e-6);
      prev = c;
    }
    // Mid-boundary is genuinely uncertain, not snapped to either side
    const mid = map.confidence(64, 64, 'sky');
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it('majority-vote downsamples instead of averaging ids', () => {
    // 1000px raster forces downsampling; a thin one-row stripe of `person`
    // (id 6) between sky (1) and water (2) must not invent id ~3 (foliage)
    const width = 1000;
    const height = 1000;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const id = y === 500 ? 6 : y < 500 ? 1 : 2;
      data.fill(id, y * width, (y + 1) * width);
    }
    const map = new SemanticMap({ width, height, data }, width, height);

    expect(map.coverage('foliage')).toBe(0);
    expect(map.has('sky')).toBe(true);
    expect(map.has('water')).toBe(true);
  });

  it('treats an all-zero raster as carrying no labels', () => {
    const map = new SemanticMap(
      { width: 16, height: 16, data: new Uint8Array(16 * 16) },
      100,
      100
    );

    for (const label of SEMANTIC_LABELS) {
      if (label === 'unknown') continue;
      expect(map.has(label)).toBe(false);
      expect(map.confidence(50, 50, label)).toBe(0);
    }
    expect(map.labelAt(50, 50)).toBe('unknown');
  });
});
