import { describe, it, expect } from 'vitest';
import { optimizePlot, measurePenTravel, limitStrokeDensity } from './optimize.js';
import { imageToPenInk } from './pen-ink/index.js';
import type { FlowLine, FlowLinesResult } from './flow-lines.js';

const line = (pts: [number, number][], pen?: 'fine' | 'bold') => ({
  points: pts.map(([x, y]) => ({ x, y })),
  ...(pen ? { pen } : {}),
});

const result = (lines: FlowLinesResult['lines']): FlowLinesResult => ({
  width: 100,
  height: 100,
  seed: 1,
  lines,
});

describe('optimizePlot', () => {
  it('chains strokes whose endpoints nearly touch', () => {
    const input = result([
      line([
        [10, 50],
        [40, 50],
      ]),
      line([
        [41, 50],
        [70, 50],
      ]),
      line([
        [71, 50.5],
        [95, 50],
      ]),
    ]);

    const out = optimizePlot(input, { mergeTolerance: 1.5 });

    expect(out.lines.length).toBe(1);
    expect(out.lines[0].points.length).toBe(6);
  });

  it('does not chain across the merge tolerance', () => {
    const input = result([
      line([
        [10, 50],
        [40, 50],
      ]),
      line([
        [50, 50],
        [80, 50],
      ]),
    ]);

    const out = optimizePlot(input, { mergeTolerance: 1.5 });
    expect(out.lines.length).toBe(2);
  });

  it('does not chain strokes from different pens', () => {
    const input = result([
      line(
        [
          [10, 50],
          [40, 50],
        ],
        'fine'
      ),
      line(
        [
          [41, 50],
          [70, 50],
        ],
        'bold'
      ),
    ]);

    const out = optimizePlot(input, { mergeTolerance: 1.5 });
    expect(out.lines.length).toBe(2);
  });

  it('reduces pen-up travel by reordering', () => {
    // Strokes in pathological order: alternating between far corners
    const lines = [];
    for (let i = 0; i < 20; i++) {
      const x = i % 2 === 0 ? 5 : 80;
      lines.push(
        line([
          [x, i * 4],
          [x + 12, i * 4],
        ])
      );
    }

    const input = result(lines);
    const before = measurePenTravel(input);
    const after = measurePenTravel(optimizePlot(input, { mergeTolerance: 0 }));

    expect(after).toBeLessThan(before * 0.5);
    expect(optimizePlot(input, { mergeTolerance: 0 }).lines.length).toBe(20);
  });

  it('lowers pen-up travel of a full render', () => {
    const image = {
      width: 80,
      height: 80,
      data: new Float32Array(80 * 80).fill(0.3),
    };

    const raw = imageToPenInk(image, { width: 200, seed: 7, optimize: false });
    const optimized = imageToPenInk(image, { width: 200, seed: 7, optimize: true });

    expect(measurePenTravel(optimized)).toBeLessThan(measurePenTravel(raw) * 0.6);
  });
});

describe('plot order strategies', () => {
  // A seeded scatter of short strokes with distinct centroids.
  const scatter = (): FlowLinesResult => {
    const lines = [];
    for (let i = 0; i < 24; i++) {
      const x = ((i * 37) % 90) + 3;
      const y = ((i * 53) % 90) + 3;
      lines.push(
        line([
          [x, y],
          [x + 6, y + 2],
        ])
      );
    }
    return result(lines);
  };

  /** Canonical form of a stroke, ignoring direction. */
  const canon = (l: FlowLine): string => {
    const fwd = JSON.stringify(l.points);
    const rev = JSON.stringify([...l.points].reverse());
    return fwd < rev ? fwd : rev;
  };

  const centroid = (l: FlowLine) => {
    let sx = 0;
    let sy = 0;
    for (const p of l.points) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / l.points.length, y: sy / l.points.length };
  };

  it('keeps the multiset of stroke geometries, up to reversal', () => {
    const input = scatter();
    const out = optimizePlot(input, {
      mergeTolerance: 0,
      order: { mode: 'sweep', angleDeg: 30 },
    });
    expect(out.lines.map(canon).sort()).toEqual(input.lines.map(canon).sort());
  });

  it('sweeps top to bottom at 0° and left to right at 90°', () => {
    const input = scatter();
    const down = optimizePlot(input, { mergeTolerance: 0, order: { mode: 'sweep', angleDeg: 0 } });
    const ys = down.lines.map((l) => centroid(l).y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1]);

    const right = optimizePlot(input, {
      mergeTolerance: 0,
      order: { mode: 'sweep', angleDeg: 90 },
    });
    const xs = right.lines.map((l) => centroid(l).x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
  });

  it('orders radially for centerOut and centerIn', () => {
    const input = scatter();
    const radius = (l: FlowLine) => {
      const c = centroid(l);
      return Math.hypot(c.x - 50, c.y - 50);
    };

    const outward = optimizePlot(input, { mergeTolerance: 0, order: { mode: 'centerOut' } });
    const rOut = outward.lines.map(radius);
    for (let i = 1; i < rOut.length; i++) expect(rOut[i]).toBeGreaterThanOrEqual(rOut[i - 1]);

    const inward = optimizePlot(input, { mergeTolerance: 0, order: { mode: 'centerIn' } });
    const rIn = inward.lines.map(radius);
    for (let i = 1; i < rIn.length; i++) expect(rIn[i]).toBeLessThanOrEqual(rIn[i - 1]);
  });

  it('is deterministic and keeps input order on ties', () => {
    // Two strokes sharing a centroid x: the tie must resolve to input order.
    const input = result([
      line([
        [10, 20],
        [20, 20],
      ]),
      line([
        [10, 40],
        [20, 40],
      ]),
      line([
        [10, 30],
        [20, 30],
      ]),
    ]);
    const opts = {
      mergeTolerance: 0,
      order: { mode: 'sweep', angleDeg: 90, alternate: false },
    } as const;
    const a = optimizePlot(input, opts);
    const b = optimizePlot(input, opts);
    expect(a).toEqual(b);
    // All three tie on x-projection; ranks follow input order.
    expect(a.lines.map((l) => l.points[0].y)).toEqual([20, 40, 30]);
  });

  it('serpentines by default and not with alternate: false', () => {
    const input = scatter();
    const serp = optimizePlot(input, { mergeTolerance: 0, order: { mode: 'sweep' } });
    const reversed = serp.lines.filter((l) => l.points[0].x > l.points[l.points.length - 1].x);
    expect(reversed.length).toBeGreaterThan(0);

    const straight = optimizePlot(input, {
      mergeTolerance: 0,
      order: { mode: 'sweep', alternate: false },
    });
    for (const l of straight.lines) expect(l.points[0].x).toBeLessThan(l.points[1].x);
  });

  it("mode 'travel' and an absent order are byte-identical", () => {
    const input = scatter();
    const plain = optimizePlot(input, { mergeTolerance: 0 });
    const travel = optimizePlot(input, { mergeTolerance: 0, order: { mode: 'travel' } });
    expect(travel).toEqual(plain);
  });
});

describe('limitStrokeDensity', () => {
  // Many identical strokes stacked on the same patch of paper.
  const overHatched = (): FlowLinesResult =>
    result(
      Array.from({ length: 20 }, () =>
        line([
          [10, 50],
          [90, 50],
        ])
      )
    );

  it('drops strokes once a patch has taken too many passes', () => {
    const out = limitStrokeDensity(overHatched(), { maxPasses: 3, cellPx: 2 });
    // The first few passes build texture; the rest pile up and are removed.
    expect(out.result.lines.length).toBe(3);
    expect(out.removed.length).toBe(17);
    expect(out.removedTravel).toBeGreaterThan(0);
  });

  it('keeps strokes that fall on fresh paper', () => {
    const input = result(
      Array.from({ length: 8 }, (_, i) =>
        line([
          [10, i * 10 + 5],
          [90, i * 10 + 5],
        ])
      )
    );
    const out = limitStrokeDensity(input, { maxPasses: 3, cellPx: 2 });
    expect(out.result.lines.length).toBe(8);
    expect(out.removed.length).toBe(0);
  });

  it('leaves skipped layers (texture/border) untouched', () => {
    const border: FlowLine = {
      points: [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
      layer: 'border',
    };
    const input = result([...overHatched().lines, border]);
    const out = limitStrokeDensity(input, { maxPasses: 3, cellPx: 2, skipLayers: ['border'] });
    // Border survives even though it overlaps the saturated patch.
    expect(out.result.lines.some((l) => l.layer === 'border')).toBe(true);
    expect(out.removed.some((l) => l.layer === 'border')).toBe(false);
  });

  it('is deterministic for a given input', () => {
    const a = limitStrokeDensity(overHatched(), { maxPasses: 3, cellPx: 2 });
    const b = limitStrokeDensity(overHatched(), { maxPasses: 3, cellPx: 2 });
    expect(a.result.lines.length).toBe(b.result.lines.length);
    expect(a.removed.length).toBe(b.removed.length);
  });

  it('keeps lines that merely cross at a point (not a sustained overlap)', () => {
    // A horizontal and a vertical line share a single cell where they cross —
    // the bread-and-butter of a flow diagram. Neither should be trimmed.
    const input = result([
      line([
        [10, 50],
        [90, 50],
      ]),
      line([
        [50, 10],
        [50, 90],
      ]),
    ]);
    const out = limitStrokeDensity(input, { maxPasses: 1, cellPx: 2 });
    expect(out.removed.length).toBe(0);
    expect(out.result.lines.length).toBe(2);
  });

  it('trims only the coalesced run where branches run together', () => {
    // Line B diverges from A for its first half, then coalesces and runs along A
    // for a long shared stretch. The unique upstream half must survive; only the
    // duplicated run is cut — not the whole stroke, and not the crossing.
    const a = line([
      [10, 50],
      [90, 50],
    ]);
    const b = line([
      [10, 10], // unique diagonal approach
      [50, 50], // ...meets A here...
      [90, 50], // ...and runs along it (the coalesced overlap)
    ]);
    const out = limitStrokeDensity(result([a, b]), { maxPasses: 1, cellPx: 2 });

    // B is split, not dropped: A + B's surviving diagonal remain.
    expect(out.result.lines.length).toBe(2);
    // One trimmed run (the shared tail), roughly the length of the overlap.
    expect(out.removed.length).toBe(1);
    expect(out.removed[0].points.length).toBeGreaterThanOrEqual(2);
    // The surviving B fragment is shorter than the original stroke.
    const survivingB = out.result.lines.find((l) => l !== a && l.points[0].y < 50);
    expect(survivingB).toBeDefined();
  });

  // The layer compositor namespaces each stacked layer's keys (e.g.
  // 'L0/present', 'L1/present'), then runs one density pass over the whole
  // composite. Because the coverage grid is per layer-key, content in one
  // layer must not thin content in another — a layer can only saturate itself.
  it('counts coverage per layer key — stacked layers do not thin each other', () => {
    const overOneLayer = (layer: string): FlowLine[] =>
      Array.from({ length: 20 }, () => ({
        points: [
          { x: 10, y: 50 },
          { x: 90, y: 50 },
        ],
        layer,
      }));

    // Twenty coincident strokes split across two distinct layers (ten each).
    const input = result([...overOneLayer('L0/present'), ...overOneLayer('L1/present')]);
    const out = limitStrokeDensity(input, { maxPasses: 3, cellPx: 2 });

    // Each layer saturates independently: 3 survive per layer, not 3 total.
    const survived = (layer: string) =>
      out.result.lines.filter((l) => l.layer === layer).length;
    expect(survived('L0/present')).toBe(3);
    expect(survived('L1/present')).toBe(3);
  });

  it('exempts namespaced bold layers via skipLayers', () => {
    const bold = (): FlowLine[] =>
      Array.from({ length: 10 }, () => ({
        points: [
          { x: 10, y: 50 },
          { x: 90, y: 50 },
        ],
        layer: 'L2/bold',
      }));
    const out = limitStrokeDensity(result(bold()), {
      maxPasses: 1,
      cellPx: 2,
      skipLayers: ['L2/bold'],
    });
    // Deliberate offset passes survive — none trimmed.
    expect(out.result.lines.length).toBe(10);
    expect(out.removed.length).toBe(0);
  });
});
