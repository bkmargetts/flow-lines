import { describe, it, expect } from 'vitest';
import {
  generateOverlappedLines,
  bandLayerName,
  pointInMask,
  type MaskShape,
  type OverlappedLinesOptions,
} from './overlapped-lines.js';

function baseOptions(overrides: Partial<OverlappedLinesOptions> = {}): OverlappedLinesOptions {
  return {
    width: 400,
    height: 300,
    margin: 20,
    angleDeg: 0,
    spacingPx: 12,
    colorCount: 2,
    seed: 42,
    ...overrides,
  };
}

describe('generateOverlappedLines', () => {
  it('is deterministic per seed', () => {
    const a = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4 }));
    const b = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4 }));
    expect(JSON.stringify(a.lines)).toEqual(JSON.stringify(b.lines));
  });

  it('changes with the seed when noise is on', () => {
    const a = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4, seed: 1 }));
    const b = generateOverlappedLines(baseOptions({ phaseNoiseAmpPx: 4, seed: 2 }));
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('draws a grating of many parallel lines', () => {
    const r = generateOverlappedLines(baseOptions());
    expect(r.lines.length).toBeGreaterThan(10);
  });

  it('tighter spacing yields more lines', () => {
    const wide = generateOverlappedLines(baseOptions({ spacingPx: 24 }));
    const tight = generateOverlappedLines(baseOptions({ spacingPx: 6 }));
    expect(tight.lines.length).toBeGreaterThan(wide.lines.length);
  });

  it('each ink interleaves as its own band layer within colorCount', () => {
    const colorCount = 3;
    const r = generateOverlappedLines(baseOptions({ colorCount }));
    const allowed = new Set(Array.from({ length: colorCount }, (_, i) => bandLayerName(i)));
    const seen = new Set<string>();
    for (const line of r.lines) {
      expect(line.layer).toBeDefined();
      expect(allowed.has(line.layer!)).toBe(true);
      seen.add(line.layer!);
    }
    // All requested inks actually appear.
    expect(seen.size).toBe(colorCount);
  });

  it('vertical lines (angle 0) run top-to-bottom, not side-to-side', () => {
    const r = generateOverlappedLines(baseOptions({ jitterPx: 0, wobbleAmpPx: 0 }));
    const line = r.lines[0];
    const xs = line.points.map((p) => p.x);
    const ys = line.points.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(spanY).toBeGreaterThan(spanX);
  });

  it('keeps every point inside the margin', () => {
    const margin = 20;
    const r = generateOverlappedLines(
      baseOptions({ margin, jitterPx: 2, wobbleAmpPx: 4, phaseNoiseAmpPx: 6, phaseDriftAcrossPx: 6 })
    );
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(margin);
        expect(p.x).toBeLessThanOrEqual(400 - margin);
        expect(p.y).toBeGreaterThanOrEqual(margin);
        expect(p.y).toBeLessThanOrEqual(300 - margin);
      }
    }
  });

  it('returns no lines when the page has no usable area', () => {
    const r = generateOverlappedLines(baseOptions({ margin: 200 }));
    expect(r.lines).toHaveLength(0);
    expect(r.width).toBe(400);
    expect(r.height).toBe(300);
  });

  it('edge smoothing relaxes the offset toward the block edges', () => {
    // Along-drift bends a colour-1 line away from its grid, most at the ends.
    // Edge smoothing must pull the endpoints back toward the line's centre.
    const cfg = { phaseDriftAlongPx: 8, colorCount: 2, jitterPx: 0, wobbleAmpPx: 0 } as const;
    const endDev = (edgeSmoothPx: number): number => {
      const r = generateOverlappedLines(baseOptions({ ...cfg, edgeSmoothPx }));
      const line = r.lines.find((l) => l.layer === bandLayerName(1) && l.points.length > 5)!;
      expect(line).toBeDefined();
      const mid = line.points[Math.floor(line.points.length / 2)].x;
      return Math.abs(line.points[0].x - mid);
    };
    const sharp = endDev(0);
    const smoothed = endDev(60);
    expect(sharp).toBeGreaterThan(1);
    expect(smoothed).toBeLessThan(sharp);
  });

  it('clips the pattern to a rectangle mask', () => {
    const mask: MaskShape[] = [{ type: 'rect', x: 150, y: 100, w: 100, h: 80 }];
    const r = generateOverlappedLines(baseOptions({ maskShapes: mask }));
    expect(r.lines.length).toBeGreaterThan(0);
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(150 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(250 + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(100 - 1e-6);
        expect(p.y).toBeLessThanOrEqual(180 + 1e-6);
      }
    }
  });

  it('refines mask crossings to the boundary (no stair-stepping)', () => {
    // Vertical lines (angle 0) clipped to a rect: their ends should land on the
    // rect's top/bottom edge to sub-pixel precision, not quantised to the
    // ~2-8px sampling step.
    const mask: MaskShape[] = [{ type: 'rect', x: 150, y: 100, w: 100, h: 80 }];
    const r = generateOverlappedLines(
      baseOptions({ maskShapes: mask, jitterPx: 0, wobbleAmpPx: 0, phaseNoiseAmpPx: 0 })
    );
    const ys = r.lines.flatMap((l) => l.points.map((p) => p.y));
    expect(Math.min(...ys)).toBeLessThan(100.5);
    expect(Math.max(...ys)).toBeGreaterThan(179.5);
  });

  it('clips the pattern to a drawn-line band mask', () => {
    const band: MaskShape[] = [
      { type: 'band', path: [{ x: 60, y: 150 }, { x: 340, y: 150 }], halfWidthPx: 15 },
    ];
    const r = generateOverlappedLines(baseOptions({ maskShapes: band }));
    expect(r.lines.length).toBeGreaterThan(0);
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(Math.abs(p.y - 150)).toBeLessThanOrEqual(15 + 1e-6);
      }
    }
  });
});

describe('pointInMask', () => {
  it('treats no shapes as the whole page', () => {
    expect(pointInMask(undefined, 10, 10)).toBe(true);
    expect(pointInMask([], 10, 10)).toBe(true);
  });

  it('tests rectangles, ellipses, strips and bands', () => {
    expect(pointInMask([{ type: 'rect', x: 0, y: 0, w: 10, h: 10 }], 5, 5)).toBe(true);
    expect(pointInMask([{ type: 'rect', x: 0, y: 0, w: 10, h: 10 }], 15, 5)).toBe(false);

    const ell: MaskShape[] = [{ type: 'ellipse', cx: 0, cy: 0, rx: 10, ry: 5 }];
    expect(pointInMask(ell, 0, 0)).toBe(true);
    expect(pointInMask(ell, 9, 0)).toBe(true);
    expect(pointInMask(ell, 0, 9)).toBe(false);

    // Vertical strips: 10px wide, 10px gap → x in [0,10) on, [10,20) off.
    const strips: MaskShape[] = [{ type: 'strips', angleDeg: 0, widthPx: 10, gapPx: 10 }];
    expect(pointInMask(strips, 5, 999)).toBe(true);
    expect(pointInMask(strips, 15, 999)).toBe(false);

    const band: MaskShape[] = [
      { type: 'band', path: [{ x: 0, y: 0 }, { x: 100, y: 0 }], halfWidthPx: 5 },
    ];
    expect(pointInMask(band, 50, 3)).toBe(true);
    expect(pointInMask(band, 50, 8)).toBe(false);
  });

  it('is the union of multiple shapes', () => {
    const shapes: MaskShape[] = [
      { type: 'rect', x: 0, y: 0, w: 10, h: 10 },
      { type: 'rect', x: 100, y: 100, w: 10, h: 10 },
    ];
    expect(pointInMask(shapes, 5, 5)).toBe(true);
    expect(pointInMask(shapes, 105, 105)).toBe(true);
    expect(pointInMask(shapes, 50, 50)).toBe(false);
  });
});
