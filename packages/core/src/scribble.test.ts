import { describe, it, expect } from 'vitest';
import { imageToPenInk } from './pen-ink/index.js';
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

// Vertical tone gradient: white at the top, black at the bottom
const gradient = makeImage(120, 120, (_u, v) => 1 - v);

const SIZE = 240;

const baseOptions = {
  width: SIZE,
  seed: 42,
  wobble: 0,
  drawOutlines: false,
  contourHalo: 0,
  normalizeContrast: false,
  optimize: false,
  scribbleTone: 0.9,
} as const;

describe('scribble tone engine', () => {
  it('lays more ink where the image is darker', () => {
    const result = imageToPenInk(gradient, baseOptions);

    // Drawn length per horizontal band must rise monotonically with tone
    const bands = [0, 0, 0, 0];
    for (const line of result.lines) {
      for (let i = 1; i < line.points.length; i++) {
        const a = line.points[i - 1];
        const b = line.points[i];
        const band = Math.min(3, Math.floor(((a.y + b.y) / 2 / SIZE) * 4));
        bands[band] += Math.hypot(b.x - a.x, b.y - a.y);
      }
    }
    expect(bands[1]).toBeGreaterThan(bands[0]);
    expect(bands[2]).toBeGreaterThan(bands[1]);
    expect(bands[3]).toBeGreaterThan(bands[2]);
  });

  it('lifts the pen above the white cutoff', () => {
    const result = imageToPenInk(gradient, { ...baseOptions, whiteCutoff: 0.15 });
    // Top of the gradient is lighter than the cutoff (allowing for the
    // scribble's oscillation amplitude reaching up from below)
    for (const line of result.lines) {
      for (const p of line.points) {
        expect(p.y).toBeGreaterThan(SIZE * 0.08);
      }
    }
  });

  it('draws far fewer, far longer strokes than hatching', () => {
    const scribble = imageToPenInk(gradient, baseOptions);
    const hatch = imageToPenInk(gradient, { ...baseOptions, scribbleTone: 0 });

    expect(scribble.lines.length).toBeGreaterThan(0);
    expect(scribble.lines.length).toBeLessThan(hatch.lines.length * 0.5);

    const meanLength = (lines: typeof scribble.lines): number => {
      let total = 0;
      let n = 0;
      for (const line of lines) {
        for (let i = 1; i < line.points.length; i++) {
          total += Math.hypot(
            line.points[i].x - line.points[i - 1].x,
            line.points[i].y - line.points[i - 1].y
          );
        }
        n++;
      }
      return total / n;
    };
    expect(meanLength(scribble.lines)).toBeGreaterThan(meanLength(hatch.lines) * 2);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = imageToPenInk(gradient, baseOptions);
    const b = imageToPenInk(gradient, baseOptions);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const c = imageToPenInk(gradient, { ...baseOptions, seed: 7 });
    expect(JSON.stringify(c.lines)).not.toBe(JSON.stringify(a.lines));
  });

  it('stays inert at scribbleTone 0 (hatch engine unchanged)', () => {
    const off = imageToPenInk(gradient, { ...baseOptions, scribbleTone: 0 });
    const unset = imageToPenInk(gradient, {
      width: SIZE,
      seed: 42,
      wobble: 0,
      drawOutlines: false,
      contourHalo: 0,
      normalizeContrast: false,
      optimize: false,
    });
    expect(JSON.stringify(off)).toBe(JSON.stringify(unset));
  });
});
