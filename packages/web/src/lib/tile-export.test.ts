import { describe, it, expect } from 'vitest';
import {
  computeTiling,
  getPaperSize,
  pageMetrics,
  BASE_PX_PER_MM,
  type FlowLinesResult,
  type TilingOptions,
} from '@flow-lines/core';
import { sheetsZipEntries } from './tile-export';

const page = pageMetrics(getPaperSize('a3'), 'portrait', BASE_PX_PER_MM);

const opts = (over: Partial<TilingOptions> = {}): TilingOptions => ({
  sheet: getPaperSize('a5'),
  sheetOrientation: 'portrait',
  marginMm: 10,
  perSheetMargin: true,
  overlapMm: 0,
  ...over,
});

// Two pen layers spanning the whole artwork, so every sheet carries both.
const result: FlowLinesResult = {
  lines: [
    {
      points: [
        { x: 0, y: 0 },
        { x: page.widthPx, y: page.heightPx },
      ],
      pen: 'fine',
      layer: 'L0/fine',
    },
    {
      points: [
        { x: page.widthPx, y: 0 },
        { x: 0, y: page.heightPx },
      ],
      pen: 'bold',
      layer: 'L1/bold',
    },
  ],
  width: page.widthPx,
  height: page.heightPx,
  seed: 1,
};

describe('sheetsZipEntries', () => {
  it('single-pen plots stay flat: one combined SVG per sheet', () => {
    const layout = computeTiling(page, opts());
    const entries = sheetsZipEntries(result, page, layout, opts(), {}, false);
    expect(entries).toHaveLength(layout.tiles.length);
    expect(entries[0].name).toBe('flow-lines-r1c1.svg');
    expect(entries.every((e) => !e.name.includes('/'))).toBe(true);
  });

  it('multi-pen plots get one folder per sheet with one SVG per layer', () => {
    const o = opts({ registrationMarks: true });
    const layout = computeTiling(page, o);
    const entries = sheetsZipEntries(
      result,
      page,
      layout,
      o,
      { layerColors: { 'L0/fine': '#111', 'L1/bold': '#a33' } },
      true
    );
    // Every entry lives in a per-sheet folder with the layer key flattened.
    expect(entries.every((e) => /^r\d+c\d+\/flow-lines-[^/]+\.svg$/.test(e.name))).toBe(true);
    // Both diagonals cross the centre sheet, so it carries both pen layers;
    // a layer with no content on a sheet gets no file there (nothing to plot).
    const centre = entries.filter((e) => e.name.startsWith('r2c2/'));
    const names = centre.map((e) => e.name).sort();
    expect(names).toContain('r2c2/flow-lines-L0-fine.svg');
    expect(names).toContain('r2c2/flow-lines-L1-bold.svg');
    // Trim marks ride along as their own pen file on marked sheets.
    expect(names).toContain('r2c2/flow-lines-tile-marks.svg');
    // Per-sheet physical dims survive into every layer file.
    expect(centre[0].text).toContain('width="148mm"');
  });

  it('is deterministic', () => {
    const o = opts({ registrationMarks: true });
    const layout = computeTiling(page, o);
    const a = sheetsZipEntries(result, page, layout, o, {}, true);
    const b = sheetsZipEntries(result, page, layout, o, {}, true);
    expect(a).toEqual(b);
  });
});
