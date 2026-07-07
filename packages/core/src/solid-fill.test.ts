import { describe, it, expect } from 'vitest';
import { imageToPenInk } from './pen-ink/index.js';
import { GrayscaleImage } from './image.js';
import type { FlowLine, Point } from './flow-lines.js';

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

/** White page with a dark disk (normalized center/radius) */
function diskImage(radius: number, cx = 0.5, cy = 0.5): GrayscaleImage {
  return makeImage(120, 120, (u, v) => (Math.hypot(u - cx, v - cy) < radius ? 0.05 : 1));
}

const SIZE = 240;

const baseOptions = {
  width: SIZE,
  seed: 42,
  wobble: 0,
  drawOutlines: false,
  contourHalo: 0,
  normalizeContrast: false,
  optimize: false,
  valueBands: 2,
  solidBlacks: true,
  hatchAngle: 0,
} as const;

const fillLinesOf = (lines: FlowLine[]): FlowLine[] => lines.filter((l) => l.layer === 'fill');

describe('solid black fill', () => {
  it('fills the darkest band and keeps every fill point inside it', () => {
    const result = imageToPenInk(diskImage(0.3), baseOptions);
    const fill = fillLinesOf(result.lines);

    expect(fill.length).toBeGreaterThan(0);

    // The value plan is blurred before banding, so allow the band edge a
    // little smear beyond the photographic disk
    const r = 0.3 * SIZE;
    const limit = r * 1.2 + 4;
    for (const line of fill) {
      for (const p of line.points) {
        expect(Math.hypot(p.x - SIZE / 2, p.y - SIZE / 2)).toBeLessThan(limit);
      }
    }
  });

  it('keeps hatch strokes out of the solid region', () => {
    const result = imageToPenInk(diskImage(0.3), baseOptions);
    const hatch = result.lines.filter((l) => l.layer !== 'fill' && l.pen !== 'bold');

    // Hatch may exist near the band edge; the interior belongs to the fill
    const core = 0.3 * SIZE * 0.6;
    for (const line of hatch) {
      for (const p of line.points) {
        expect(Math.hypot(p.x - SIZE / 2, p.y - SIZE / 2)).toBeGreaterThan(core);
      }
    }
  });

  it('leaves no gap wider than two pass spacings between fill rows', () => {
    const spacing = 1.4;
    const result = imageToPenInk(diskImage(0.3), { ...baseOptions, fillSpacing: spacing });
    const fill = fillLinesOf(result.lines);

    // With hatchAngle 0 the serpentine rows are horizontal: collect the
    // y of every long horizontal segment crossing the disk center column
    const rows = new Set<number>();
    for (const line of fill) {
      for (let i = 1; i < line.points.length; i++) {
        const a = line.points[i - 1];
        const b = line.points[i];
        if (Math.abs(a.y - b.y) < 0.01 && Math.abs(a.x - b.x) > spacing) {
          if (Math.min(a.x, b.x) < SIZE / 2 && Math.max(a.x, b.x) > SIZE / 2) {
            rows.add(Math.round(a.y * 4) / 4);
          }
        }
      }
    }
    const ys = [...rows].sort((a, b) => a - b);
    expect(ys.length).toBeGreaterThan(10);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeLessThanOrEqual(spacing * 2 + 1e-6);
    }
  });

  it('joins rows into serpentines — pen lifts stay O(regions), not O(rows)', () => {
    // Two well-separated disks
    const image = makeImage(160, 120, (u, v) =>
      Math.hypot(u - 0.27, v - 0.5) < 0.16 || Math.hypot(u - 0.73, v - 0.5) < 0.16 ? 0.05 : 1
    );
    const result = imageToPenInk(image, { ...baseOptions, width: 320 });
    const fill = fillLinesOf(result.lines);

    // Each disk spans ~45 rows at the default spacing; without serpentine
    // joining that would be ~90 separate strokes. Boundary passes and the
    // occasional unjoined short row leave a small constant per region.
    expect(fill.length).toBeGreaterThan(0);
    expect(fill.length).toBeLessThanOrEqual(16);
  });

  it('is deterministic per seed', () => {
    const a = imageToPenInk(diskImage(0.3), baseOptions);
    const b = imageToPenInk(diskImage(0.3), baseOptions);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('stays inert when solidBlacks is off', () => {
    const result = imageToPenInk(diskImage(0.3), { ...baseOptions, solidBlacks: false });
    expect(fillLinesOf(result.lines)).toHaveLength(0);
  });

  it('requires a value plan: no fill without valueBands >= 2', () => {
    const result = imageToPenInk(diskImage(0.3), { ...baseOptions, valueBands: 0 });
    expect(fillLinesOf(result.lines)).toHaveLength(0);
  });

  it('leaves tiny dark flecks to hatch', () => {
    const result = imageToPenInk(diskImage(0.035), baseOptions);
    expect(fillLinesOf(result.lines)).toHaveLength(0);

    // The fleck still gets marks — just hatch, not fill
    const near: Point[] = [];
    for (const line of result.lines) {
      for (const p of line.points) {
        if (Math.hypot(p.x - SIZE / 2, p.y - SIZE / 2) < 0.1 * SIZE) near.push(p);
      }
    }
    expect(near.length).toBeGreaterThan(0);
  });
});
