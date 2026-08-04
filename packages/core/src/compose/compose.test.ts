import { describe, it, expect } from 'vitest';
import type { FlowLine, Point } from '../flow-lines.js';
import { holdOffLines } from './hold-off.js';
import { buildCoverageMask, morphMask, clipLinesToMask, traceMaskOutline } from './mask.js';
import { transformLines, echoLines } from './transform.js';
import { pointInPolygon } from '../lib/polyline.js';

const hline = (y: number, x1 = 0, x2 = 200, extra: Partial<FlowLine> = {}): FlowLine => ({
  points: [
    { x: x1, y },
    { x: x2, y },
  ],
  ...extra,
});

const vline = (x: number, y1 = 0, y2 = 200): FlowLine => ({
  points: [
    { x, y: y1 },
    { x, y: y2 },
  ],
});

/** A horizontal band of hatch lines spanning x∈[60,140], y∈[80,120]. */
function hatchBand(): FlowLine[] {
  const lines: FlowLine[] = [];
  for (let y = 80; y <= 120; y += 4) lines.push(hline(y, 60, 140));
  return lines;
}

describe('holdOffLines', () => {
  it('splits a crossing line into two fragments', () => {
    const out = holdOffLines([hline(100, 10, 200)], [vline(105)], 5);
    expect(out.length).toBe(2);
    // The gap straddles the crossing point.
    const [left, right] = out;
    expect(Math.max(...left.points.map((p) => p.x))).toBeLessThan(105);
    expect(Math.min(...right.points.map((p) => p.x))).toBeGreaterThan(105);
  });

  it('drops fragments shorter than the dust floor', () => {
    // Two verticals close together leave only a sliver between them — dust.
    const out = holdOffLines([hline(100, 95, 115)], [vline(100), vline(110)], 4);
    for (const line of out) {
      const xs = line.points.map((p) => p.x);
      expect(Math.min(...xs) > 110 || Math.max(...xs) < 100).toBe(true);
    }
  });

  it('passes lines through untouched when there is nothing to avoid', () => {
    const lines = [hline(50)];
    expect(holdOffLines(lines, [], 5)).toBe(lines);
    expect(holdOffLines(lines, [vline(100)], 0)).toBe(lines);
  });

  it('preserves line metadata on trimmed fragments', () => {
    const out = holdOffLines(
      [hline(100, 10, 200, { pen: 'fine', layer: 'texture' })],
      [vline(105)],
      5
    );
    expect(out.length).toBeGreaterThan(0);
    for (const line of out) {
      expect(line.pen).toBe('fine');
      expect(line.layer).toBe('texture');
    }
  });

  it('is deterministic', () => {
    const a = holdOffLines([hline(100, 10, 200)], [vline(105)], 5);
    const b = holdOffLines([hline(100, 10, 200)], [vline(105)], 5);
    expect(a).toEqual(b);
  });
});

describe('buildCoverageMask / clipLinesToMask', () => {
  it('covers the hatched band and not the empty paper', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    expect(mask.inside(100, 100)).toBe(true);
    expect(mask.inside(20, 20)).toBe(false);
    expect(mask.inside(100, 180)).toBe(false);
  });

  it('treats out-of-bounds points as uncovered', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    expect(mask.inside(-50, 100)).toBe(false);
    expect(mask.inside(100, 1e5)).toBe(false);
  });

  it('clips a probe line to the runs inside the band', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    const out = clipLinesToMask([hline(100, 0, 200)], mask, { mode: 'inside' });
    expect(out.length).toBe(1);
    const xs = out[0].points.map((p) => p.x);
    // Kept run spans the band (plus the merge radius), not the whole page.
    expect(Math.min(...xs)).toBeGreaterThan(30);
    expect(Math.max(...xs)).toBeLessThan(170);
    expect(Math.min(...xs)).toBeLessThan(70);
    expect(Math.max(...xs)).toBeGreaterThan(130);
  });

  it('clips outside to the two runs flanking the band', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    const out = clipLinesToMask([hline(100, 0, 200)], mask, { mode: 'outside' });
    expect(out.length).toBe(2);
  });

  it('keeps inside/outside complementary at the same crossing', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    const probe = [hline(100, 0, 200)];
    const inside = clipLinesToMask(probe, mask, { mode: 'inside' });
    const outside = clipLinesToMask(probe, mask, { mode: 'outside' });
    const insideMin = Math.min(...inside[0].points.map((p) => p.x));
    const leftOutsideMax = Math.max(...outside[0].points.map((p) => p.x));
    // Bisection refines both cut ends to the same boundary (within a cell).
    expect(Math.abs(insideMin - leftOutsideMax)).toBeLessThan(mask.cellPx + 1);
  });

  it('morphMask grows and shrinks the kept span monotonically', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    const spanOf = (m: typeof mask): number => {
      const out = clipLinesToMask([hline(100, 0, 200)], m, { mode: 'inside' });
      const xs = out.flatMap((l) => l.points.map((p) => p.x));
      return Math.max(...xs) - Math.min(...xs);
    };
    const base = spanOf(mask);
    const grown = spanOf(morphMask(mask, 12));
    const shrunk = spanOf(morphMask(mask, -12));
    expect(grown).toBeGreaterThan(base);
    expect(shrunk).toBeLessThan(base);
  });

  it('feather warps the cut edge deterministically', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    // Several parallel probes: a crisp clip cuts them all at (nearly) the same
    // x; feather makes the cut wander line to line.
    const probes = [hline(96, 0, 200), hline(100, 0, 200), hline(104, 0, 200)];
    const cuts = (feather: number): number[] =>
      clipLinesToMask(probes, mask, { mode: 'inside', featherPx: feather, featherSeed: 7 }).map(
        (l) => Math.min(...l.points.map((p) => p.x))
      );
    const crisp = cuts(0);
    const feathered = cuts(6);
    const spread = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
    expect(spread(feathered)).toBeGreaterThan(spread(crisp));
    // Deterministic per seed.
    expect(cuts(6)).toEqual(cuts(6));
  });

  it('drops dust fragments below minKeepPx', () => {
    const mask = buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 });
    const out = clipLinesToMask([hline(100, 0, 200)], mask, {
      mode: 'inside',
      minKeepPx: 500,
    });
    expect(out.length).toBe(0);
  });

  it('degrades to a coarser cell instead of exceeding the raster cap', () => {
    const mask = buildCoverageMask([hline(100, 0, 100)], 100_000, 100_000, { radiusPx: 3 });
    expect((mask.cols + 1) * (mask.rows + 1)).toBeLessThanOrEqual(4_000_000);
    expect(mask.inside(50, 100)).toBe(true);
  });
});

describe('traceMaskOutline', () => {
  it('traces a loop encircling a stamped dot', () => {
    const dot: FlowLine = { points: [{ x: 100, y: 100 }] };
    const mask = buildCoverageMask([dot], 200, 200, { radiusPx: 12 });
    const loops = traceMaskOutline(mask);
    expect(loops.length).toBeGreaterThanOrEqual(1);
    const ring = loops[0];
    expect(pointInPolygon(ring, 100, 100)).toBe(true);
    expect(pointInPolygon(ring, 20, 20)).toBe(false);
    // The ring sits near the stamp radius.
    for (const p of ring) {
      const d = Math.hypot(p.x - 100, p.y - 100);
      expect(d).toBeGreaterThan(4);
      expect(d).toBeLessThan(30);
    }
  });

  it('drops loops shorter than minLoopPx', () => {
    const dot: FlowLine = { points: [{ x: 100, y: 100 }] };
    const mask = buildCoverageMask([dot], 200, 200, { radiusPx: 12 });
    expect(traceMaskOutline(mask, { minLoopPx: 10_000 }).length).toBe(0);
  });
});

describe('transformLines / echoLines', () => {
  const square: FlowLine[] = [
    {
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
      ],
      pen: 'fine',
    },
  ];

  it('returns the input untouched for identity options', () => {
    expect(transformLines(square, {})).toBe(square);
    expect(transformLines(square, { rotateDeg: 0, scale: 1 })).toBe(square);
  });

  it('translates exactly', () => {
    const out = transformLines(square, { translateXPx: 5, translateYPx: -3 });
    expect(out[0].points[0]).toEqual({ x: 15, y: 7 });
    expect(out[0].points[1]).toEqual({ x: 25, y: 7 });
    // Fresh allocation — the input is never mutated.
    expect(square[0].points[0]).toEqual({ x: 10, y: 10 });
  });

  it('rotates 90° about the origin exactly', () => {
    const out = transformLines([{ points: [{ x: 10, y: 0 }] }], { rotateDeg: 90 });
    expect(out[0].points[0].x).toBeCloseTo(0, 10);
    expect(out[0].points[0].y).toBeCloseTo(10, 10);
  });

  it('scales about a custom origin', () => {
    const out = transformLines([{ points: [{ x: 110, y: 100 }] }], {
      scale: 2,
      originX: 100,
      originY: 100,
    });
    expect(out[0].points[0]).toEqual({ x: 120, y: 100 });
  });

  it('preserves pen metadata through transform', () => {
    const out = transformLines(square, { translateXPx: 1 });
    expect(out[0].pen).toBe('fine');
  });

  it('echoes with compounding deltas on the same pens', () => {
    const out = echoLines(square, { copies: 3, translateXPx: 5, translateYPx: 0 });
    expect(out.length).toBe(3);
    expect(out[0].points[0].x).toBe(10); // original
    expect(out[1].points[0].x).toBe(15); // 1×Δ
    expect(out[2].points[0].x).toBe(20); // 2×Δ
    expect(out.every((l) => l.pen === 'fine')).toBe(true);
  });

  it('compounds echo scale geometrically', () => {
    const out = echoLines([{ points: [{ x: 8, y: 0 }] }], { copies: 3, scale: 0.5 });
    expect(out[1].points[0].x).toBeCloseTo(4, 10);
    expect(out[2].points[0].x).toBeCloseTo(2, 10);
  });

  it('is inert for one copy or an identity delta', () => {
    expect(echoLines(square, { copies: 1, translateXPx: 5 })).toBe(square);
    expect(echoLines(square, { copies: 4 })).toBe(square);
  });
});

describe('determinism across the compose surface', () => {
  it('mask + clip + outline are identical across runs', () => {
    const run = (): { clipped: FlowLine[]; loops: Point[][] } => {
      const mask = morphMask(buildCoverageMask(hatchBand(), 200, 200, { radiusPx: 6 }), 4);
      return {
        clipped: clipLinesToMask([hline(100, 0, 200)], mask, {
          mode: 'inside',
          featherPx: 3,
          featherSeed: 42,
        }),
        loops: traceMaskOutline(mask),
      };
    };
    expect(run()).toEqual(run());
  });
});
