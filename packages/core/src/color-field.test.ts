import { describe, it, expect } from 'vitest';
import {
  generateColorField,
  accentLayerName,
  type AccentSpec,
  type ColorFieldOptions,
} from './color-field.js';
import { bandLayerName, type MaskShape } from './overlapped-lines.js';

function baseOptions(overrides: Partial<ColorFieldOptions> = {}): ColorFieldOptions {
  return {
    width: 400,
    height: 600,
    margin: 20,
    angleDeg: 0,
    spacingPx: 6,
    inkCount: 4,
    seed: 42,
    ...overrides,
  };
}

/** Total inked length on a given band layer whose segment midpoints satisfy `pred`. */
function bandLength(
  lines: { layer?: string; points: { x: number; y: number }[] }[],
  layer: string,
  pred: (x: number, y: number) => boolean = () => true
): number {
  let len = 0;
  for (const l of lines) {
    if (l.layer !== layer) continue;
    for (let i = 1; i < l.points.length; i++) {
      const mx = (l.points[i].x + l.points[i - 1].x) / 2;
      const my = (l.points[i].y + l.points[i - 1].y) / 2;
      if (pred(mx, my)) len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
    }
  }
  return len;
}

describe('generateColorField', () => {
  it('is deterministic per seed', () => {
    const cfg = { gradientNoiseAmpPx: 30, jitterPx: 1, wobbleAmpPx: 3 };
    const a = generateColorField(baseOptions(cfg));
    const b = generateColorField(baseOptions(cfg));
    expect(JSON.stringify(a.lines)).toEqual(JSON.stringify(b.lines));
  });

  it('changes with the seed', () => {
    const a = generateColorField(baseOptions({ seed: 1 }));
    const b = generateColorField(baseOptions({ seed: 2 }));
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('draws many dense lines', () => {
    const r = generateColorField(baseOptions());
    expect(r.lines.length).toBeGreaterThan(20);
  });

  it('tighter spacing yields more lines', () => {
    const wide = generateColorField(baseOptions({ spacingPx: 18 }));
    const tight = generateColorField(baseOptions({ spacingPx: 4 }));
    expect(tight.lines.length).toBeGreaterThan(wide.lines.length);
  });

  it('every line is tagged with an ink band layer within inkCount', () => {
    const inkCount = 4;
    const r = generateColorField(baseOptions({ inkCount }));
    const allowed = new Set(Array.from({ length: inkCount }, (_, i) => bandLayerName(i)));
    for (const line of r.lines) {
      expect(line.layer).toBeDefined();
      expect(allowed.has(line.layer!)).toBe(true);
    }
  });

  it('every ink is present somewhere across the field', () => {
    const inkCount = 4;
    const r = generateColorField(baseOptions({ inkCount }));
    const seen = new Set(r.lines.map((l) => l.layer));
    for (let i = 0; i < inkCount; i++) expect(seen.has(bandLayerName(i))).toBe(true);
  });

  it('each ink is densest at its end of the gradient (no banding, just balance)', () => {
    // Vertical gradient: ink 0 belongs to the top, the last ink to the bottom.
    const inkCount = 4;
    const r = generateColorField(baseOptions({ inkCount, gradientAngleDeg: 0, jitterPx: 0, wobbleAmpPx: 0 }));
    const top = (x: number, y: number) => y < 300;
    const bottom = (x: number, y: number) => y >= 300;
    const first = bandLayerName(0);
    const last = bandLayerName(inkCount - 1);
    expect(bandLength(r.lines, first, top)).toBeGreaterThan(bandLength(r.lines, first, bottom));
    expect(bandLength(r.lines, last, bottom)).toBeGreaterThan(bandLength(r.lines, last, top));
  });

  it('inks coexist and mix (multiple inks share a region)', () => {
    const r = generateColorField(baseOptions({ inkCount: 4 }));
    // Scan horizontal slices; at least one must hold points from ≥2 inks — the
    // optical-mix overlap a banded approach could never produce.
    let maxLayersInSlice = 0;
    for (let y0 = 20; y0 < 580; y0 += 30) {
      const inSlice = new Set<string>();
      for (const l of r.lines) {
        if (!l.layer?.startsWith('band-')) continue;
        if (l.points.some((p) => p.y >= y0 && p.y < y0 + 30)) inSlice.add(l.layer);
      }
      maxLayersInSlice = Math.max(maxLayersInSlice, inSlice.size);
    }
    expect(maxLayersInSlice).toBeGreaterThanOrEqual(2);
  });

  it('a wider blend mixes more inks at once', () => {
    const layersAtMid = (blend: number): number => {
      const r = generateColorField(baseOptions({ inkCount: 5, blend, jitterPx: 0, wobbleAmpPx: 0 }));
      const mid = new Set<string>();
      for (const l of r.lines) {
        if (l.layer?.startsWith('band-') && l.points.some((p) => p.y >= 280 && p.y < 320)) mid.add(l.layer);
      }
      return mid.size;
    };
    expect(layersAtMid(2.2)).toBeGreaterThanOrEqual(layersAtMid(0.8));
  });

  it('radial mode concentrates the first ink near the focal point', () => {
    const inkCount = 4;
    const r = generateColorField(
      baseOptions({ inkCount, gradientMode: 'radial', focalXPct: 0.5, focalYPct: 0.5, jitterPx: 0, wobbleAmpPx: 0 })
    );
    const cx = 200;
    const cy = 300;
    const meanDist = (layer: string): number => {
      let sum = 0;
      let n = 0;
      for (const l of r.lines) {
        if (l.layer !== layer) continue;
        for (const p of l.points) {
          sum += Math.hypot(p.x - cx, p.y - cy);
          n++;
        }
      }
      return n > 0 ? sum / n : Infinity;
    };
    expect(meanDist(bandLayerName(0))).toBeLessThan(meanDist(bandLayerName(inkCount - 1)));
  });

  it('refines dither break ends off the sampling grid (no staircase)', () => {
    // With jitter/wobble off, segment endpoints would land on the coarse `step`
    // sampling grid unless dither breaks are bisection-refined. Assert a healthy
    // fraction of endpoints are clearly off any plausible step grid.
    const margin = 20;
    const r = generateColorField(
      baseOptions({ margin, jitterPx: 0, wobbleAmpPx: 0, gradientNoiseAmpPx: 0 })
    );
    // Vertical lines: endpoints are at a = y - cy; the sample grid step is
    // clamped to [2,8]px. Probe against the finest plausible grid (2px): a
    // refined endpoint should rarely sit within 0.05px of a 2px multiple.
    let offGrid = 0;
    let total = 0;
    for (const l of r.lines) {
      for (const p of [l.points[0], l.points[l.points.length - 1]]) {
        total++;
        const nearest = Math.round(p.y / 2) * 2;
        if (Math.abs(p.y - nearest) > 0.05) offGrid++;
      }
    }
    expect(total).toBeGreaterThan(50);
    expect(offGrid / total).toBeGreaterThan(0.5);
  });

  it('staggers neighbouring lines so breaks do not align into rungs', () => {
    const r = generateColorField(baseOptions({ jitterPx: 0, wobbleAmpPx: 0, gradientNoiseAmpPx: 0 }));
    // Group one ink's segments by their (constant) x into vertical lines.
    const byLine = new Map<number, number[]>();
    for (const l of r.lines) {
      if (l.layer !== bandLayerName(1)) continue;
      const key = Math.round(l.points[0].x);
      const ys = byLine.get(key) ?? byLine.set(key, []).get(key)!;
      ys.push(l.points[0].y, l.points[l.points.length - 1].y);
    }
    const lines = [...byLine.entries()].filter(([, ys]) => ys.length >= 2).sort((a, b) => a[0] - b[0]);
    expect(lines.length).toBeGreaterThan(3);
    // For adjacent line pairs, the mean nearest-neighbour distance between their
    // break-y sets must exceed a small threshold — identical (laddered) breaks
    // would be ~0.
    let pairs = 0;
    let aligned = 0;
    for (let i = 1; i < lines.length; i++) {
      const aYs = lines[i - 1][1];
      const bYs = lines[i][1];
      let sum = 0;
      for (const y of aYs) sum += Math.min(...bYs.map((z) => Math.abs(z - y)));
      const meanDist = sum / aYs.length;
      pairs++;
      if (meanDist < 0.5) aligned++;
    }
    expect(pairs).toBeGreaterThan(0);
    expect(aligned / pairs).toBeLessThan(0.25);
  });

  it('fill drives coverage — more ink at higher fill', () => {
    const totalLength = (fill: number): number => {
      const r = generateColorField(baseOptions({ fill, jitterPx: 0, wobbleAmpPx: 0 }));
      let len = 0;
      for (const l of r.lines)
        for (let i = 1; i < l.points.length; i++)
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
      return len;
    };
    expect(totalLength(0.95)).toBeGreaterThan(totalLength(0.4) * 1.3);
  });

  it('overprint stacks co-dominant inks (more total ink than single-pick)', () => {
    const totalLength = (overprint: boolean): number => {
      const r = generateColorField(baseOptions({ overprint, blend: 2, fill: 1, jitterPx: 0, wobbleAmpPx: 0 }));
      let len = 0;
      for (const l of r.lines)
        for (let i = 1; i < l.points.length; i++)
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
      return len;
    };
    // Overprint draws co-dominant inks on the same lines, so there is strictly
    // more inked length than the one-colour-per-stroke pick.
    expect(totalLength(true)).toBeGreaterThan(totalLength(false));
  });

  it('keeps every field point inside the margin', () => {
    const margin = 20;
    const r = generateColorField(
      baseOptions({ margin, jitterPx: 2, wobbleAmpPx: 4, gradientNoiseAmpPx: 40 })
    );
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(margin - 1e-6);
        expect(p.x).toBeLessThanOrEqual(400 - margin + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(margin - 1e-6);
        expect(p.y).toBeLessThanOrEqual(600 - margin + 1e-6);
      }
    }
  });

  it('drops segments shorter than minSegmentLengthPx', () => {
    const min = 40;
    const r = generateColorField(baseOptions({ minSegmentLengthPx: min }));
    for (const line of r.lines) {
      let len = 0;
      for (let i = 1; i < line.points.length; i++) {
        len += Math.hypot(line.points[i].x - line.points[i - 1].x, line.points[i].y - line.points[i - 1].y);
      }
      expect(len).toBeGreaterThanOrEqual(min - 1e-6);
    }
  });

  it('returns no field lines when the page has no usable area', () => {
    const r = generateColorField(baseOptions({ margin: 400 }));
    expect(r.lines).toHaveLength(0);
  });

  it('clips the field to a rectangle mask', () => {
    const mask: MaskShape[] = [{ type: 'rect', x: 150, y: 200, w: 100, h: 200 }];
    const r = generateColorField(baseOptions({ maskShapes: mask }));
    expect(r.lines.length).toBeGreaterThan(0);
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(150 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(250 + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(200 - 1e-6);
        expect(p.y).toBeLessThanOrEqual(400 + 1e-6);
      }
    }
  });

  describe('geometric accents', () => {
    it('a gap accent reserves clean paper the field breaks around', () => {
      const gap: AccentSpec = {
        type: 'gap',
        orientation: 'horizontal',
        posPct: 0.5,
        startPct: 0,
        lenPct: 1,
        thicknessPx: 30,
      };
      const r = generateColorField(baseOptions({ accents: [gap], jitterPx: 0, wobbleAmpPx: 0 }));
      const gapY0 = 20 + 0.5 * (600 - 40) - 15;
      const gapY1 = gapY0 + 30;
      for (const line of r.lines) {
        if (!line.layer?.startsWith('band-')) continue;
        for (const p of line.points) {
          const inside = p.y > gapY0 + 1e-6 && p.y < gapY1 - 1e-6;
          expect(inside).toBe(false);
        }
      }
    });

    it('a bar accent inks its own pen layer confined to the bar', () => {
      const bar: AccentSpec = {
        type: 'bar',
        orientation: 'vertical',
        posPct: 0.5,
        startPct: 0.1,
        lenPct: 0.4,
        thicknessPx: 12,
        layerIndex: 0,
      };
      const r = generateColorField(baseOptions({ accents: [bar], penWidthPx: 1.2 }));
      const barLines = r.lines.filter((l) => l.layer === accentLayerName(0));
      expect(barLines.length).toBeGreaterThan(1);
      const cx = 20 + 0.5 * (400 - 40);
      const y0 = 20 + 0.1 * (600 - 40);
      const y1 = 20 + 0.5 * (600 - 40);
      for (const l of barLines) {
        expect(l.pen).toBe('bold');
        for (const p of l.points) {
          expect(Math.abs(p.x - cx)).toBeLessThanOrEqual(6 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(y0 - 1e-6);
          expect(p.y).toBeLessThanOrEqual(y1 + 1e-6);
        }
      }
    });
  });
});
