import { describe, it, expect } from 'vitest';
import { imageToPenInk } from './pen-ink.js';
import { ImageField } from './image-field.js';
import { GrayscaleImage } from './image.js';

/** Build a synthetic grayscale image from a function of normalized coords */
function makeImage(
  width: number,
  height: number,
  fn: (u: number, v: number) => number
): GrayscaleImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = Math.max(0, Math.min(1, fn(x / (width - 1), y / (height - 1))));
    }
  }
  return { width, height, data };
}

// Left half black, right half white
const halfDark = makeImage(120, 120, (u) => (u < 0.5 ? 0 : 1));

describe('imageToPenInk', () => {
  it('generates strokes for a dark image', () => {
    const image = makeImage(100, 100, () => 0.1);
    const result = imageToPenInk(image, { width: 200, seed: 42, wobble: 0 });

    expect(result.lines.length).toBeGreaterThan(10);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('derives output height from the image aspect ratio', () => {
    const image = makeImage(200, 100, () => 0.5);
    const result = imageToPenInk(image, { width: 400, seed: 1 });

    expect(result.height).toBe(200);
  });

  it('leaves white regions blank', () => {
    const result = imageToPenInk(halfDark, {
      width: 240,
      seed: 7,
      wobble: 0,
      drawOutlines: false,
      normalizeContrast: false,
      margin: 5,
    });

    expect(result.lines.length).toBeGreaterThan(0);

    // All stroke points should be in (or very near) the dark half
    for (const line of result.lines) {
      for (const point of line.points) {
        expect(point.x).toBeLessThan(240 * 0.58);
      }
    }
  });

  it('produces an empty result for a blank white image', () => {
    const image = makeImage(80, 80, () => 1);
    const result = imageToPenInk(image, {
      width: 160,
      seed: 3,
      drawOutlines: false,
      normalizeContrast: false,
    });

    expect(result.lines.length).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const image = makeImage(60, 60, (u, v) => (u + v) / 2);
    const a = imageToPenInk(image, { width: 150, seed: 99 });
    const b = imageToPenInk(image, { width: 150, seed: 99 });

    expect(a.lines).toEqual(b.lines);
  });

  it('adds cross-hatch density in darker areas with more layers', () => {
    const image = makeImage(100, 100, () => 0.05);

    const single = imageToPenInk(image, {
      width: 200,
      seed: 5,
      layers: 1,
      wobble: 0,
      drawOutlines: false,
    });
    const triple = imageToPenInk(image, {
      width: 200,
      seed: 5,
      layers: 3,
      wobble: 0,
      drawOutlines: false,
    });

    const totalLength = (lines: typeof single.lines) =>
      lines.reduce((sum, line) => {
        let len = 0;
        for (let i = 1; i < line.points.length; i++) {
          len += Math.hypot(
            line.points[i].x - line.points[i - 1].x,
            line.points[i].y - line.points[i - 1].y
          );
        }
        return sum + len;
      }, 0);

    expect(totalLength(triple.lines)).toBeGreaterThan(totalLength(single.lines) * 1.5);
  });

  it('respects the margin', () => {
    const image = makeImage(80, 80, () => 0.1);
    const margin = 30;
    const result = imageToPenInk(image, { width: 200, seed: 11, margin, wobble: 0 });

    for (const line of result.lines) {
      for (const point of line.points) {
        expect(point.x).toBeGreaterThanOrEqual(margin - 0.01);
        expect(point.x).toBeLessThanOrEqual(200 - margin + 0.01);
        expect(point.y).toBeGreaterThanOrEqual(margin - 0.01);
        expect(point.y).toBeLessThanOrEqual(result.height - margin + 0.01);
      }
    }
  });
});

describe('ImageField', () => {
  it('reports darkness from the image tone', () => {
    const field = new ImageField(halfDark, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    expect(field.getDarkness(40, 120)).toBeGreaterThan(0.8);
    expect(field.getDarkness(200, 120)).toBeLessThan(0.2);
  });

  it('orients strokes along contours (perpendicular to the gradient)', () => {
    // Horizontal luminance gradient -> gradient points in x -> tangent is vertical
    const ramp = makeImage(120, 120, (u) => u);
    const field = new ImageField(ramp, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    const angle = field.getOrientation(120, 120);
    // Vertical orientation is ±PI/2 (pi-periodic)
    const distFromVertical = Math.abs(Math.abs(angle) - Math.PI / 2);
    expect(distFromVertical).toBeLessThan(0.2);
  });

  it('falls back to the hatch angle in flat regions', () => {
    const flat = makeImage(100, 100, () => 0.5);
    const hatchAngle = -Math.PI / 4;
    const field = new ImageField(flat, {
      width: 200,
      height: 200,
      hatchAngle,
      normalizeContrast: false,
    });

    const angle = field.getOrientation(100, 100);
    expect(Math.abs(angle - hatchAngle)).toBeLessThan(0.1);
  });

  it('detects edges', () => {
    const field = new ImageField(halfDark, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    expect(field.getEdgeStrength(120, 120)).toBeGreaterThan(0.3);
    expect(field.getEdgeStrength(30, 120)).toBeLessThan(0.1);
  });
});
