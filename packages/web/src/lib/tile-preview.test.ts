import { describe, it, expect } from 'vitest';
import {
  computeTiling,
  getPaperSize,
  pageMetrics,
  BASE_PX_PER_MM,
  type FlowLinesResult,
  type TilingOptions,
} from '@flow-lines/core';
import { buildAssembledPreview, buildSheetsPreview } from './tile-preview';

const page = pageMetrics(getPaperSize('a3'), 'portrait', BASE_PX_PER_MM);

const opts = (over: Partial<TilingOptions> = {}): TilingOptions => ({
  sheet: getPaperSize('a5'),
  sheetOrientation: 'portrait',
  marginMm: 10,
  perSheetMargin: true,
  overlapMm: 0,
  ...over,
});

const result: FlowLinesResult = {
  lines: [
    {
      points: [
        { x: 0, y: 0 },
        { x: page.widthPx, y: page.heightPx },
      ],
      pen: 'fine',
    },
  ],
  width: page.widthPx,
  height: page.heightPx,
  seed: 1,
};

describe('buildSheetsPreview', () => {
  it('lays every sheet out as its own nested page with gutters between', () => {
    const layout = computeTiling(page, opts());
    const prev = buildSheetsPreview(result, page, layout, opts(), {}, '#faf9f6');
    // One paper rect and one nested <svg> per sheet.
    expect(prev.svg.match(/<rect /g)?.length).toBe(layout.tiles.length);
    expect(prev.svg.match(/<svg x="/g)?.length).toBe(layout.tiles.length);
    const tw = layout.tiles[0].widthPx;
    const th = layout.tiles[0].heightPx;
    expect(prev.width).toBeGreaterThan(layout.cols * tw);
    expect(prev.height).toBeGreaterThan(layout.rows * th);
    // The outer document is a plain px space (no physical mm units).
    expect(prev.svg).not.toContain('mm"');
  });

  it('a single-sheet layout renders one page with no gutter', () => {
    // The sheet must exceed artwork + 2×margin for the layout to collapse to
    // one page — an A3 artwork doesn't fit an A3 sheet once margins inset it.
    const single = opts({ sheet: getPaperSize('a2') });
    const layout = computeTiling(page, single);
    expect(layout.single).toBe(true);
    const prev = buildSheetsPreview(result, page, layout, single, {}, '#fff');
    expect(prev.width).toBe(layout.tiles[0].widthPx);
    expect(prev.height).toBe(layout.tiles[0].heightPx);
  });

  it('is deterministic', () => {
    const layout = computeTiling(page, opts({ overlapMm: 5, registrationMarks: true }));
    const o = opts({ overlapMm: 5, registrationMarks: true });
    const a = buildSheetsPreview(result, page, layout, o, { strokeColor: '#123' }, '#fff');
    const b = buildSheetsPreview(result, page, layout, o, { strokeColor: '#123' }, '#fff');
    expect(a.svg).toBe(b.svg);
  });
});

describe('buildAssembledPreview', () => {
  it('composes the sheets edge-to-edge at the assembled size', () => {
    const o = opts({ assembly: 'fit' });
    const layout = computeTiling(page, o);
    const prev = buildAssembledPreview(result, page, layout, o, {}, '#fff');
    const tw = layout.tiles[0].widthPx;
    const th = layout.tiles[0].heightPx;
    // No gutters: the total expected sheet, sheets at their taped positions.
    expect(prev.width).toBe(layout.cols * tw);
    expect(prev.height).toBe(layout.rows * th);
    expect(prev.svg.match(/<rect /g)?.length).toBe(layout.tiles.length);
    expect(prev.svg.match(/<svg x="/g)?.length).toBe(layout.tiles.length);
  });

  it('overlays dashed cut lines on neighbour edges only', () => {
    const o = opts({ assembly: 'fit' });
    const layout = computeTiling(page, o);
    const prev = buildAssembledPreview(result, page, layout, o, {}, '#fff');
    const cutEdges = layout.tiles.reduce(
      (n, t) =>
        n +
        (t.col > 0 ? 1 : 0) +
        (t.col < layout.cols - 1 ? 1 : 0) +
        (t.row > 0 ? 1 : 0) +
        (t.row < layout.rows - 1 ? 1 : 0),
      0
    );
    expect(cutEdges).toBeGreaterThan(0);
    expect(prev.svg.match(/stroke-dasharray/g)?.length).toBe(cutEdges);
  });

  it('draws no cut lines without a per-sheet margin (nothing to cut)', () => {
    const o = opts({ perSheetMargin: false });
    const layout = computeTiling(page, o);
    const prev = buildAssembledPreview(result, page, layout, o, {}, '#fff');
    expect(prev.svg).not.toContain('stroke-dasharray');
  });

  it('is deterministic and narrower than the guttered sheets view', () => {
    const o = opts({ assembly: 'fit' });
    const layout = computeTiling(page, o);
    const a = buildAssembledPreview(result, page, layout, o, {}, '#fff');
    const b = buildAssembledPreview(result, page, layout, o, {}, '#fff');
    expect(a).toEqual(b);
    const sheets = buildSheetsPreview(result, page, layout, o, {}, '#fff');
    expect(sheets.width).toBeGreaterThan(a.width);
  });
});
