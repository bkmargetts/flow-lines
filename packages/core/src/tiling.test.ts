import { describe, it, expect } from 'vitest';
import {
  getPaperSize,
  pageMetrics,
  BASE_PX_PER_MM,
} from './paper-sizes.js';
import {
  computeTiling,
  sliceResultIntoTiles,
  tileLabel,
  TILE_MARKS_LAYER,
  type TilingOptions,
} from './tiling.js';
import type { FlowLinesResult, Point } from './flow-lines.js';

const a0 = pageMetrics(getPaperSize('a0'), 'portrait', BASE_PX_PER_MM);

const baseOpts = (over: Partial<TilingOptions> = {}): TilingOptions => ({
  sheet: getPaperSize('a4'),
  sheetOrientation: 'portrait',
  marginMm: 10,
  perSheetMargin: true,
  overlapMm: 0,
  ...over,
});

describe('computeTiling — grid math', () => {
  it('splits A0 across A4 sheets with a 10mm per-sheet margin as 5×5', () => {
    // Printable region per sheet 190×277mm → ceil(841/190)=5, ceil(1189/277)=5.
    const layout = computeTiling(a0, baseOpts());
    expect(layout.cols).toBe(5);
    expect(layout.rows).toBe(5);
    expect(layout.tiles).toHaveLength(25);
    expect(layout.single).toBe(false);
  });

  it('keeps the same grid with a 5mm overlap (stride shrinks, coverage still fits)', () => {
    // Stride 185mm → ceil((841−5)/185)=5 columns.
    const layout = computeTiling(a0, baseOpts({ overlapMm: 5 }));
    expect(layout.cols).toBe(5);
    expect(layout.rows).toBe(5);
    expect(layout.overlapPx).toBeCloseTo(5 * a0.pxPerMm);
  });

  it('collapses to a single centered sheet when the artwork fits', () => {
    const a5 = pageMetrics(getPaperSize('a5'), 'portrait', BASE_PX_PER_MM);
    const layout = computeTiling(a5, baseOpts({ sheet: getPaperSize('a3') }));
    expect(layout.single).toBe(true);
    expect(layout.tiles).toHaveLength(1);
    const t = layout.tiles[0];
    // Whole artwork on the sheet, centered within the printable region.
    expect(t.sourceRect.x).toBe(0);
    expect(t.sourceRect.width).toBeCloseTo(a5.widthPx, 5);
    const rightSlack = t.widthPx - (t.originX + t.sourceRect.width);
    expect(t.originX).toBeCloseTo(rightSlack, 0);
  });

  it('centers the assembly: edge columns carry equal blank paper', () => {
    const layout = computeTiling(a0, baseOpts());
    const first = layout.tiles[0];
    const last = layout.tiles[layout.cols - 1];
    // Blank on tile 0 shows up as an origin pushed right of the margin;
    // blank on the last tile as a source band narrower than the printable span.
    const marginPx = 10 * a0.pxPerMm;
    const slackFirst = first.originX - marginPx;
    const printableRight = last.widthPx - marginPx;
    const slackLast = printableRight - (last.originX + last.sourceRect.width);
    expect(slackFirst).toBeGreaterThan(0);
    expect(slackFirst).toBeCloseTo(slackLast, 6);
  });

  it('adjacent tiles share exactly the overlap and trim lines meet exactly', () => {
    const layout = computeTiling(a0, baseOpts({ overlapMm: 5 }));
    for (let c = 0; c + 1 < layout.cols; c++) {
      const left = layout.tiles[c];
      const right = layout.tiles[c + 1];
      const overlap =
        left.sourceRect.x + left.sourceRect.width - right.sourceRect.x;
      expect(overlap).toBeCloseTo(5 * a0.pxPerMm, 6);
      // Shared trim boundary: computed once, identical on both sides.
      expect(left.trimRect.x + left.trimRect.width).toBe(right.trimRect.x);
    }
  });

  it('with zero overlap the trim edge is the butt joint', () => {
    const layout = computeTiling(a0, baseOpts());
    for (let c = 0; c + 1 < layout.cols; c++) {
      const left = layout.tiles[c];
      const right = layout.tiles[c + 1];
      expect(left.sourceRect.x + left.sourceRect.width).toBeCloseTo(
        right.sourceRect.x,
        6
      );
      expect(left.trimRect.x + left.trimRect.width).toBe(right.trimRect.x);
    }
  });

  it('raw edge-to-edge slices when perSheetMargin is off', () => {
    const layout = computeTiling(a0, baseOpts({ perSheetMargin: false }));
    // Printable span = full sheet: ceil(841/210)=5, ceil(1189/297)=5.
    expect(layout.cols).toBe(5);
    expect(layout.rows).toBe(5);
    // Interior tiles print flush to the sheet edge.
    const interior = layout.tiles.find((t) => t.row === 2 && t.col === 2)!;
    expect(interior.originX).toBe(0);
    expect(interior.originY).toBe(0);
    expect(interior.sourceRect.width).toBeCloseTo(210 * a0.pxPerMm, 6);
  });

  it('tile sheets carry true physical dims regardless of a capped artwork density', () => {
    const capped = pageMetrics(getPaperSize('a0'), 'portrait', 4, 2048);
    expect(capped.pxPerMm).toBeLessThan(4);
    const layout = computeTiling(capped, baseOpts());
    const slices = sliceResultIntoTiles(
      { lines: [], width: capped.widthPx, height: capped.heightPx, seed: 1 },
      capped,
      layout,
      baseOpts()
    );
    for (const s of slices) {
      expect(s.physicalWidth).toBe('210mm');
      expect(s.physicalHeight).toBe('297mm');
      expect(s.tile.widthPx).toBe(Math.round(210 * capped.pxPerMm));
    }
  });

  it('throws when margin or overlap consume the sheet', () => {
    expect(() =>
      computeTiling(a0, baseOpts({ sheet: getPaperSize('a6'), marginMm: 60 }))
    ).toThrow(/margin/);
    expect(() => computeTiling(a0, baseOpts({ overlapMm: 200 }))).toThrow(
      /overlap/i
    );
  });

  it('labels tiles row-major, 1-based', () => {
    const layout = computeTiling(a0, baseOpts());
    expect(tileLabel(layout.tiles[0])).toBe('r1c1');
    expect(tileLabel(layout.tiles[layout.cols])).toBe('r2c1');
    expect(tileLabel(layout.tiles[layout.tiles.length - 1])).toBe('r5c5');
  });
});

describe('sliceResultIntoTiles', () => {
  // A synthetic result: one long diagonal plus a border rectangle.
  const makeResult = (): FlowLinesResult => {
    const diag: Point[] = [];
    for (let i = 0; i <= 400; i++) {
      diag.push({
        x: (i / 400) * a0.widthPx,
        y: (i / 400) * a0.heightPx,
      });
    }
    return {
      lines: [
        { points: diag, pen: 'fine', layer: 'L0/fine' },
        {
          points: [
            { x: 10, y: 10 },
            { x: a0.widthPx - 10, y: 10 },
            { x: a0.widthPx - 10, y: a0.heightPx - 10 },
            { x: 10, y: a0.heightPx - 10 },
            { x: 10, y: 10 },
          ],
          pen: 'bold',
          layer: 'L0/bold',
        },
      ],
      width: a0.widthPx,
      height: a0.heightPx,
      seed: 7,
    };
  };

  /** Map a tile-space point back into artwork space. */
  const toArt = (
    p: Point,
    t: { originX: number; originY: number; sourceRect: { x: number; y: number } }
  ): Point => ({
    x: p.x - (t.originX - t.sourceRect.x),
    y: p.y - (t.originY - t.sourceRect.y),
  });

  it('is deterministic and preserves pen/layer', () => {
    const opts = baseOpts({ overlapMm: 5 });
    const layout = computeTiling(a0, opts);
    const a = sliceResultIntoTiles(makeResult(), a0, layout, opts);
    const b = sliceResultIntoTiles(makeResult(), a0, layout, opts);
    expect(a).toEqual(b);
    for (const s of a) {
      for (const line of s.result.lines) {
        expect(['L0/fine', 'L0/bold', TILE_MARKS_LAYER]).toContain(line.layer);
      }
    }
  });

  it('every sliced point maps back inside its tile source band; trim interiors land in exactly one tile', () => {
    const opts = baseOpts({ overlapMm: 5 });
    const layout = computeTiling(a0, opts);
    const slices = sliceResultIntoTiles(makeResult(), a0, layout, opts);
    const eps = 1e-6;
    for (const s of slices) {
      const { sourceRect: src } = s.tile;
      for (const line of s.result.lines) {
        for (const p of line.points) {
          const q = toArt(p, s.tile);
          expect(q.x).toBeGreaterThanOrEqual(src.x - eps);
          expect(q.x).toBeLessThanOrEqual(src.x + src.width + eps);
          expect(q.y).toBeGreaterThanOrEqual(src.y - eps);
          expect(q.y).toBeLessThanOrEqual(src.y + src.height + eps);
        }
      }
    }
    // Points strictly inside a trim rect belong to exactly one tile; points
    // inside an overlap band appear on both neighbours.
    const probe = (x: number, y: number): number =>
      slices.filter((s) => {
        const r = s.tile.sourceRect;
        return (
          x > r.x + 1e-9 &&
          x < r.x + r.width - 1e-9 &&
          y > r.y + 1e-9 &&
          y < r.y + r.height - 1e-9
        );
      }).length;
    const t0 = slices[0].tile;
    const midTrim = {
      x: t0.trimRect.x + t0.trimRect.width / 3,
      y: t0.trimRect.y + t0.trimRect.height / 3,
    };
    expect(probe(midTrim.x, midTrim.y)).toBe(1);
    const bandX = t0.sourceRect.x + t0.sourceRect.width - layout.overlapPx / 2;
    expect(probe(bandX, midTrim.y)).toBe(2);
  });

  it('adds registration ticks only when asked, on their own layer, inside the sheet', () => {
    const plain = sliceResultIntoTiles(
      makeResult(),
      a0,
      computeTiling(a0, baseOpts()),
      baseOpts()
    );
    for (const s of plain) {
      expect(s.result.lines.some((l) => l.layer === TILE_MARKS_LAYER)).toBe(false);
    }
    const opts = baseOpts({ registrationMarks: true, overlapMm: 5 });
    const marked = sliceResultIntoTiles(
      makeResult(),
      a0,
      computeTiling(a0, opts),
      opts
    );
    let ticks = 0;
    for (const s of marked) {
      for (const line of s.result.lines) {
        if (line.layer !== TILE_MARKS_LAYER) continue;
        ticks++;
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(s.tile.widthPx);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(s.tile.heightPx);
        }
      }
    }
    expect(ticks).toBeGreaterThan(0);
  });
});
