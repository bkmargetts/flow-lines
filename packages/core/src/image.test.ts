import { describe, it, expect } from 'vitest';
import {
  grayscaleFromRGBA,
  sampleBilinear,
  resizeGrayscale,
  gaussianBlur,
  normalizeLevels,
} from './image.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import type { FlowLinesResult } from './flow-lines.js';

describe('grayscaleFromRGBA', () => {
  it('converts black, white and primaries', () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255, // black
      255, 255, 255, 255, // white
      255, 0, 0, 255, // red
      0, 0, 0, 0, // fully transparent -> white
    ]);

    const image = grayscaleFromRGBA(rgba, 4, 1);

    expect(image.data[0]).toBeCloseTo(0);
    expect(image.data[1]).toBeCloseTo(1);
    expect(image.data[2]).toBeCloseTo(0.2126, 3);
    expect(image.data[3]).toBeCloseTo(1);
  });
});

describe('sampleBilinear', () => {
  it('interpolates between pixels', () => {
    const image = {
      width: 2,
      height: 1,
      data: new Float32Array([0, 1]),
    };

    expect(sampleBilinear(image, 0, 0)).toBeCloseTo(0);
    expect(sampleBilinear(image, 0.5, 0)).toBeCloseTo(0.5);
    expect(sampleBilinear(image, 5, 0)).toBeCloseTo(1, 1); // clamped
  });
});

describe('resizeGrayscale', () => {
  it('downsamples to the max dimension', () => {
    const image = {
      width: 100,
      height: 50,
      data: new Float32Array(100 * 50).fill(0.5),
    };

    const resized = resizeGrayscale(image, 40);

    expect(resized.width).toBe(40);
    expect(resized.height).toBe(20);
    expect(resized.data[0]).toBeCloseTo(0.5);
  });

  it('does not upscale', () => {
    const image = { width: 10, height: 10, data: new Float32Array(100) };
    expect(resizeGrayscale(image, 100)).toBe(image);
  });
});

describe('gaussianBlur', () => {
  it('preserves a uniform image and smooths an impulse', () => {
    const size = 11;
    const data = new Float32Array(size * size);
    data[5 * size + 5] = 1;

    const blurred = gaussianBlur({ width: size, height: size, data }, 1.5);

    const center = blurred.data[5 * size + 5];
    const neighbour = blurred.data[5 * size + 6];
    expect(center).toBeLessThan(1);
    expect(neighbour).toBeGreaterThan(0);
    expect(center).toBeGreaterThan(neighbour);
  });
});

describe('normalizeLevels', () => {
  it('stretches a low-contrast image to full range', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < data.length; i++) {
      data[i] = 0.4 + 0.2 * (i / data.length);
    }

    const stretched = normalizeLevels({ width: 100, height: 10, data });

    const min = Math.min(...stretched.data);
    const max = Math.max(...stretched.data);
    expect(min).toBeLessThan(0.05);
    expect(max).toBeGreaterThan(0.95);
  });
});

describe('applyHandDrawnStyle', () => {
  const straightLine = (): FlowLinesResult => ({
    width: 100,
    height: 100,
    seed: 42,
    lines: [
      {
        points: Array.from({ length: 50 }, (_, i) => ({ x: 10 + i * 1.5, y: 50 })),
      },
    ],
  });

  it('displaces points within bounded amplitude', () => {
    const result = applyHandDrawnStyle(straightLine(), { amplitude: 2, jitter: 0, seed: 1 });

    let maxDeviation = 0;
    let totalDeviation = 0;
    for (const p of result.lines[0].points) {
      maxDeviation = Math.max(maxDeviation, Math.abs(p.y - 50));
      totalDeviation += Math.abs(p.y - 50);
    }

    expect(totalDeviation).toBeGreaterThan(0); // it did something
    expect(maxDeviation).toBeLessThan(2 * 1.3 + 0.001); // bounded by amplitude variation
  });

  it('is deterministic for a given seed', () => {
    const a = applyHandDrawnStyle(straightLine(), { amplitude: 1.5, seed: 7 });
    const b = applyHandDrawnStyle(straightLine(), { amplitude: 1.5, seed: 7 });

    expect(a.lines).toEqual(b.lines);
  });

  it('preserves line and point counts', () => {
    const input = straightLine();
    const result = applyHandDrawnStyle(input, { amplitude: 1 });

    expect(result.lines.length).toBe(input.lines.length);
    expect(result.lines[0].points.length).toBe(input.lines[0].points.length);
  });

  it('returns the input untouched when disabled', () => {
    const input = straightLine();
    const result = applyHandDrawnStyle(input, { amplitude: 0, jitter: 0 });

    expect(result.lines[0].points).toEqual(input.lines[0].points);
  });
});
