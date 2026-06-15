import { describe, it, expect } from 'vitest';
import { generateTexture, type TextureOptions, type TextureStyle } from './texture.js';

const base: TextureOptions = {
  width: 600,
  height: 800,
  margin: 40,
  pxPerMm: 3,
  style: 'hatch',
  spacingMm: 4,
  angleDeg: 45,
  scale: 1,
  jitter: 0.2,
  density: 0.5,
  crossHatch: false,
  seed: 7,
};

const STYLES: TextureStyle[] = ['hatch', 'grid', 'stipple', 'contours', 'shapes'];

function allPoints(lines: { points: { x: number; y: number }[] }[]) {
  return lines.flatMap((l) => l.points);
}

describe('generateTexture', () => {
  it('produces non-empty output for every style', () => {
    for (const style of STYLES) {
      const lines = generateTexture({ ...base, style });
      expect(lines.length, style).toBeGreaterThan(0);
    }
  });

  it('tags every stroke as the texture layer with a plottable polyline', () => {
    for (const style of STYLES) {
      const lines = generateTexture({ ...base, style });
      expect(lines.every((l) => l.layer === 'texture'), style).toBe(true);
      expect(lines.every((l) => l.points.length >= 2), style).toBe(true);
    }
  });

  it('is deterministic per seed', () => {
    for (const style of STYLES) {
      const a = generateTexture({ ...base, style });
      const b = generateTexture({ ...base, style });
      expect(JSON.stringify(a), style).toBe(JSON.stringify(b));
    }
  });

  it('varies with the seed for the randomized styles', () => {
    // grid is a regular lattice with no randomness — intentionally seed-stable.
    for (const style of ['hatch', 'stipple', 'contours', 'shapes'] as TextureStyle[]) {
      const a = generateTexture({ ...base, style });
      const c = generateTexture({ ...base, style, seed: 99 });
      expect(JSON.stringify(a), style).not.toBe(JSON.stringify(c));
    }
  });

  it('keeps every point inside the page margin', () => {
    for (const style of STYLES) {
      const lines = generateTexture({ ...base, style });
      for (const p of allPoints(lines)) {
        // Closed shapes/dots can round a hair past their centre clamp; allow 1px.
        expect(p.x, style).toBeGreaterThanOrEqual(base.margin - 1);
        expect(p.x, style).toBeLessThanOrEqual(base.width - base.margin + 1);
        expect(p.y, style).toBeGreaterThanOrEqual(base.margin - 1);
        expect(p.y, style).toBeLessThanOrEqual(base.height - base.margin + 1);
      }
    }
  });

  it('draws more hatch lines as spacing tightens', () => {
    const wide = generateTexture({ ...base, style: 'hatch', spacingMm: 8, jitter: 0 });
    const tight = generateTexture({ ...base, style: 'hatch', spacingMm: 2, jitter: 0 });
    expect(tight.length).toBeGreaterThan(wide.length);
  });

  it('scatters more stipple dots as density rises', () => {
    const sparse = generateTexture({ ...base, style: 'stipple', density: 0.2 });
    const dense = generateTexture({ ...base, style: 'stipple', density: 0.9 });
    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it('lays more shapes as spacing tightens', () => {
    const wide = generateTexture({
      ...base,
      style: 'shapes',
      spacingMm: 10,
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    const tight = generateTexture({
      ...base,
      style: 'shapes',
      spacingMm: 3,
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    expect(tight.length).toBeGreaterThan(wide.length);
  });

  it('packs shapes closer as overlap rises (same spacing)', () => {
    const none = generateTexture({
      ...base,
      style: 'shapes',
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0 },
    });
    const overlapped = generateTexture({
      ...base,
      style: 'shapes',
      shapes: { kind: 'circle', sizeMm: 4, overlap: 0.6 },
    });
    expect(overlapped.length).toBeGreaterThan(none.length);
  });

  it('adds a perpendicular set with crossHatch', () => {
    const single = generateTexture({ ...base, style: 'hatch', crossHatch: false, jitter: 0 });
    const crossed = generateTexture({ ...base, style: 'hatch', crossHatch: true, jitter: 0 });
    expect(crossed.length).toBeGreaterThan(single.length);
  });

  describe('halo', () => {
    // A drawing stroke straight across the middle of the page.
    const avoid = [{ points: [{ x: 40, y: 400 }, { x: 560, y: 400 }] }];

    it('holds texture a clear-paper sliver off the drawing', () => {
      const haloPx = 6 * base.pxPerMm; // 6mm
      const lines = generateTexture({
        ...base,
        style: 'stipple',
        density: 0.9,
        avoid,
        haloMm: 6,
      });
      for (const p of allPoints(lines)) {
        // No texture point should sit within the halo band of the stroke (y=400).
        const dist = Math.abs(p.y - 400);
        // Only points whose x is over the stroke span are masked; check those.
        if (p.x >= 40 && p.x <= 560) {
          expect(dist).toBeGreaterThan(haloPx - 3);
        }
      }
    });

    it('is a no-op when haloMm is 0', () => {
      const off = generateTexture({ ...base, style: 'stipple', avoid, haloMm: 0 });
      const none = generateTexture({ ...base, style: 'stipple' });
      expect(JSON.stringify(off)).toBe(JSON.stringify(none));
    });
  });
});
