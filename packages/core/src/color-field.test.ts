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
    spacingPx: 8,
    bandCount: 4,
    seed: 42,
    ...overrides,
  };
}

describe('generateColorField', () => {
  it('is deterministic per seed', () => {
    const cfg = { bandWaveAmpPx: 8, featherPx: 14, densityNoiseAmt: 0.3, jitterPx: 1, wobbleAmpPx: 3 };
    const a = generateColorField(baseOptions(cfg));
    const b = generateColorField(baseOptions(cfg));
    expect(JSON.stringify(a.lines)).toEqual(JSON.stringify(b.lines));
  });

  it('changes with the seed when noise is on', () => {
    const cfg = { featherPx: 14, densityNoiseAmt: 0.3 };
    const a = generateColorField(baseOptions({ ...cfg, seed: 1 }));
    const b = generateColorField(baseOptions({ ...cfg, seed: 2 }));
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('draws many dense lines', () => {
    const r = generateColorField(baseOptions());
    expect(r.lines.length).toBeGreaterThan(10);
  });

  it('tighter spacing yields more lines', () => {
    const wide = generateColorField(baseOptions({ spacingPx: 24 }));
    const tight = generateColorField(baseOptions({ spacingPx: 6 }));
    expect(tight.lines.length).toBeGreaterThan(wide.lines.length);
  });

  it('every line is tagged with a band layer within bandCount', () => {
    const bandCount = 4;
    const r = generateColorField(baseOptions({ bandCount }));
    const allowed = new Set(Array.from({ length: bandCount }, (_, i) => bandLayerName(i)));
    for (const line of r.lines) {
      expect(line.layer).toBeDefined();
      expect(allowed.has(line.layer!)).toBe(true);
    }
  });

  it('all bands appear and stack top→bottom (feather off)', () => {
    const bandCount = 4;
    const r = generateColorField(
      baseOptions({ bandCount, featherPx: 0, bandWaveAmpPx: 0, jitterPx: 0, wobbleAmpPx: 0 })
    );
    const seen = new Set(r.lines.map((l) => l.layer));
    for (let i = 0; i < bandCount; i++) expect(seen.has(bandLayerName(i))).toBe(true);

    // Top band owns the smallest y; the last band owns the largest y.
    const yByBand = (layer: string): number[] =>
      r.lines.filter((l) => l.layer === layer).flatMap((l) => l.points.map((p) => p.y));
    const topYs = yByBand(bandLayerName(0));
    const botYs = yByBand(bandLayerName(bandCount - 1));
    expect(Math.min(...topYs)).toBeLessThan(Math.min(...botYs));
    expect(Math.max(...botYs)).toBeGreaterThan(Math.max(...topYs));
  });

  it('adjacent band segments on a line meet at a shared point', () => {
    const r = generateColorField(
      baseOptions({ bandCount: 3, featherPx: 0, bandWaveAmpPx: 0, jitterPx: 0, wobbleAmpPx: 0 })
    );
    // Group segments by their (rounded) constant x — one vertical line.
    const groups = new Map<number, typeof r.lines>();
    for (const l of r.lines) {
      const key = Math.round(l.points[0].x * 10);
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(l);
    }
    let checked = 0;
    for (const segs of groups.values()) {
      if (segs.length < 2) continue;
      const ordered = [...segs].sort((a, b) => a.points[0].y - b.points[0].y);
      for (let i = 1; i < ordered.length; i++) {
        const prevEnd = ordered[i - 1].points[ordered[i - 1].points.length - 1];
        const nextStart = ordered[i].points[0];
        expect(Math.abs(prevEnd.x - nextStart.x)).toBeLessThan(1e-6);
        expect(Math.abs(prevEnd.y - nextStart.y)).toBeLessThan(1e-6);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('keeps every field point inside the margin', () => {
    const margin = 20;
    const r = generateColorField(
      baseOptions({ margin, jitterPx: 2, wobbleAmpPx: 4, bandWaveAmpPx: 10, densityNoiseAmt: 0.5 })
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

  it('a density gradient adds line-length in the lower half', () => {
    const lowerLength = (grad: number): number => {
      const r = generateColorField(baseOptions({ densityGradient: grad, jitterPx: 0, wobbleAmpPx: 0 }));
      let len = 0;
      for (const l of r.lines) {
        for (let i = 1; i < l.points.length; i++) {
          const my = (l.points[i].y + l.points[i - 1].y) / 2;
          if (my > 300) len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
      }
      return len;
    };
    expect(lowerLength(2.5)).toBeGreaterThan(lowerLength(1));
  });

  it('drops segments shorter than minSegmentLengthPx', () => {
    const min = 40;
    const r = generateColorField(baseOptions({ minSegmentLengthPx: min, featherPx: 12 }));
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
        for (const p of line.points) {
          // Field (non-accent) points must not fall inside the gap band.
          if (line.layer?.startsWith('band-')) {
            const inside = p.y > gapY0 + 1e-6 && p.y < gapY1 - 1e-6;
            expect(inside).toBe(false);
          }
        }
      }
      // A vertical line crossing the gap should be split into ≥2 segments.
      const byX = new Map<number, number>();
      for (const l of r.lines) {
        if (!l.layer?.startsWith('band-')) continue;
        const key = Math.round(l.points[0].x);
        byX.set(key, (byX.get(key) ?? 0) + 1);
      }
      expect(Math.max(...byX.values())).toBeGreaterThanOrEqual(2);
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
