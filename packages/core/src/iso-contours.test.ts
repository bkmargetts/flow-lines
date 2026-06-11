import { describe, expect, it } from 'vitest';
import { traceIsoContours } from './iso-contours.js';
import { GrayscaleImage } from './image.js';

function makeRaster(
  width: number,
  height: number,
  fn: (x: number, y: number) => number
): GrayscaleImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = fn(x, y);
    }
  }
  return { width, height, data };
}

describe('traceIsoContours', () => {
  it('returns nothing for a raster that never crosses the iso level', () => {
    const flat = makeRaster(40, 40, () => 0.2);
    expect(traceIsoContours(flat, 0.5)).toEqual([]);
  });

  it('traces a radial field as one closed loop at the right radius', () => {
    // Cone centered at (30, 30): value 1 at the center falling to 0 at
    // distance 25, so the 0.5 contour is a circle of radius 12.5
    const cone = makeRaster(60, 60, (x, y) => {
      const r = Math.hypot(x - 30, y - 30);
      return Math.max(0, 1 - r / 25);
    });

    const polys = traceIsoContours(cone, 0.5);
    expect(polys.length).toBe(1);

    const loop = polys[0];
    expect(loop.length).toBeGreaterThan(20);

    // Chained into a closed loop
    const first = loop[0];
    const last = loop[loop.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(1.5);

    for (const p of loop) {
      expect(Math.hypot(p.x - 30, p.y - 30)).toBeGreaterThan(11.5);
      expect(Math.hypot(p.x - 30, p.y - 30)).toBeLessThan(13.5);
    }
  });

  it('separates disjoint regions into separate polylines', () => {
    const twoBumps = makeRaster(80, 40, (x, y) => {
      const a = Math.max(0, 1 - Math.hypot(x - 20, y - 20) / 10);
      const b = Math.max(0, 1 - Math.hypot(x - 60, y - 20) / 10);
      return Math.max(a, b);
    });

    const polys = traceIsoContours(twoBumps, 0.5);
    expect(polys.length).toBe(2);

    // One loop around each bump
    const centers = polys.map((poly) => {
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      return cx;
    });
    centers.sort((a, b) => a - b);
    expect(centers[0]).toBeCloseTo(20, 0);
    expect(centers[1]).toBeCloseTo(60, 0);
  });
});
