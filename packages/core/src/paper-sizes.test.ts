import { describe, it, expect } from 'vitest';
import {
  PAPER_SIZES,
  BASE_PX_PER_MM,
  CUSTOM_PAPER_ID,
  getPaperSize,
  resolvePaperSize,
  orientedDimsMm,
  pageMetrics,
  contentRect,
} from './paper-sizes.js';

describe('paper sizes', () => {
  it('exposes A4 at ISO dimensions', () => {
    const a4 = getPaperSize('a4');
    expect(a4.widthMm).toBe(210);
    expect(a4.heightMm).toBe(297);
  });

  it('throws on an unknown sheet id', () => {
    expect(() => getPaperSize('nope')).toThrow();
  });

  it('swaps width and height for landscape', () => {
    const a4 = getPaperSize('a4');
    expect(orientedDimsMm(a4, 'landscape')).toEqual({ widthMm: 297, heightMm: 210 });
    expect(orientedDimsMm(a4, 'portrait')).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('includes A-series and US sizes', () => {
    const ids = PAPER_SIZES.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['a6', 'a5', 'a4', 'a3', 'letter', 'legal', 'tabloid'])
    );
  });

  it('exposes the large formats at ISO / Arch dimensions', () => {
    expect(getPaperSize('a2')).toMatchObject({ widthMm: 420, heightMm: 594 });
    expect(getPaperSize('a1')).toMatchObject({ widthMm: 594, heightMm: 841 });
    expect(getPaperSize('a0')).toMatchObject({ widthMm: 841, heightMm: 1189 });
    expect(getPaperSize('2a0')).toMatchObject({ widthMm: 1189, heightMm: 1682 });
    expect(getPaperSize('arch-d')).toMatchObject({ widthMm: 609.6, heightMm: 914.4 });
  });
});

describe('resolvePaperSize', () => {
  it('resolves table ids, case-insensitively', () => {
    expect(resolvePaperSize('a0')).toBe(getPaperSize('a0'));
    expect(resolvePaperSize('A3')).toBe(getPaperSize('a3'));
  });

  it('parses a raw WxH millimetre spec', () => {
    const p = resolvePaperSize('1200x900');
    expect(p.id).toBe(CUSTOM_PAPER_ID);
    expect(p.widthMm).toBe(1200);
    expect(p.heightMm).toBe(900);
  });

  it('parses the custom: prefixed form and decimals', () => {
    const p = resolvePaperSize('custom:450.5x600');
    expect(p.id).toBe(CUSTOM_PAPER_ID);
    expect(p.widthMm).toBe(450.5);
    expect(p.heightMm).toBe(600);
  });

  it('clamps custom dimensions to sane bounds', () => {
    expect(resolvePaperSize('5000x2')).toMatchObject({ widthMm: 3000, heightMm: 10 });
  });

  it('throws on malformed specs', () => {
    expect(() => resolvePaperSize('nope')).toThrow();
    expect(() => resolvePaperSize('12xx9')).toThrow();
    expect(() => resolvePaperSize('x900')).toThrow();
  });
});

describe('pageMetrics', () => {
  it('converts mm to px at the reference density with scale 1', () => {
    const m = pageMetrics(getPaperSize('a4'), 'portrait', BASE_PX_PER_MM);
    expect(m.widthPx).toBe(210 * BASE_PX_PER_MM);
    expect(m.heightPx).toBe(297 * BASE_PX_PER_MM);
    expect(m.scale).toBeCloseTo(1);
    expect(m.pxPerMm).toBe(BASE_PX_PER_MM);
  });

  it('lowers density uniformly under a long-edge cap', () => {
    const cap = 520;
    const m = pageMetrics(getPaperSize('a3'), 'portrait', BASE_PX_PER_MM, cap);
    // The long edge is pinned to the cap, aspect is preserved
    expect(Math.max(m.widthPx, m.heightPx)).toBeLessThanOrEqual(cap + 1);
    expect(m.pxPerMm).toBeLessThan(BASE_PX_PER_MM);
    expect(m.scale).toBeLessThan(1);
    expect(m.widthPx / m.heightPx).toBeCloseTo(297 / 420, 2);
  });

  it('keeps physical line density tracking sheet size even when both are capped', () => {
    // Density ∝ pageMm / spacingMm, where spacingMm = spacingPx / pxPerMm.
    // With spacing scaled by `scale`, a larger sheet must fit more lines.
    const cap = 520;
    const spacingRefPx = 10; // a spacing constant at the reference density
    const linesAcross = (id: string): number => {
      const m = pageMetrics(getPaperSize(id), 'portrait', BASE_PX_PER_MM, cap);
      const spacingPx = spacingRefPx * m.scale;
      return m.widthPx / spacingPx;
    };
    // A3 is physically wider than A4, so it carries more lines across despite
    // both being clamped to the same long-edge pixel budget.
    expect(linesAcross('a3')).toBeGreaterThan(linesAcross('a4'));
  });

  it('a 4096 long-edge cap never triggers for the pre-A2 sizes', () => {
    // Regression guard: the web app caps pages at 4096px; the sizes that
    // existed before the large formats must render at exactly the requested
    // density (goldens depend on it).
    const legacy = ['a6', 'a5', 'a4', 'a3', 'letter', 'legal', 'tabloid'];
    for (const id of legacy) {
      for (const pxPerMm of [2, 3, 4]) {
        const m = pageMetrics(getPaperSize(id), 'portrait', pxPerMm, 4096);
        expect(m.pxPerMm).toBe(pxPerMm);
        expect(m.scale).toBeCloseTo(pxPerMm / BASE_PX_PER_MM);
      }
    }
  });
});

describe('contentRect', () => {
  it('fit letterboxes the whole image inside the margin box, centered', () => {
    // 1000×500 page, 0 margin, square image -> 500×500 centered
    const r = contentRect(1000, 500, 0, 1, 'fit');
    expect(r.width).toBeCloseTo(500);
    expect(r.height).toBeCloseTo(500);
    expect(r.x).toBeCloseTo(250);
    expect(r.y).toBeCloseTo(0);
    // Stays within the page on both axes
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('fill covers the margin box, overflowing one axis', () => {
    // 1000×500 page, square image -> 1000×1000, overflowing vertically
    const r = contentRect(1000, 500, 0, 1, 'fill');
    expect(r.width).toBeCloseTo(1000);
    expect(r.height).toBeCloseTo(1000);
    // Centered overflow: top spills above the page
    expect(r.y).toBeCloseTo(-250);
  });

  it('honours the margin as a clear border under fit', () => {
    const margin = 50;
    const r = contentRect(1000, 1000, margin, 1, 'fit');
    expect(r.width).toBeCloseTo(900);
    expect(r.x).toBeCloseTo(50);
  });
});
