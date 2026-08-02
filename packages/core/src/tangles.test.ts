import { describe, it, expect } from 'vitest';
import { buildTangleScene, generateTangles, type TanglesOptions } from './tangles/index.js';
import { growHoses } from './tangles/centerline.js';
import { findHoseCrossings } from './tangles/crossings.js';
import { solveHoseWeave } from './tangles/weave.js';
import { finalizeOpen, sampleAtOpen, type TangleStrand } from './tangles/strand.js';
import { findIntrusions, findUnexplainedGaps } from './tangles/occlude.js';
import { arcAt, type ArcTable } from './tangles/depth.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import type { Mark } from './tangles/hose.js';

const BASE: TanglesOptions = { width: 300, height: 400, margin: 20, seed: 7 };

function totalLength(lines: { points: { x: number; y: number }[] }[]): number {
  let len = 0;
  for (const l of lines) {
    for (let i = 1; i < l.points.length; i++) {
      len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
    }
  }
  return len;
}

describe('generateTangles', () => {
  it('is deterministic per seed', () => {
    const a = generateTangles(BASE);
    const b = generateTangles(BASE);
    expect(a).toEqual(b);
  });

  it('emits more ink as the count rises', () => {
    const sparse = generateTangles({ ...BASE, count: 2 });
    const dense = generateTangles({ ...BASE, count: 10 });
    expect(totalLength(dense.lines)).toBeGreaterThan(totalLength(sparse.lines));
  });

  it('keeps every point finite and inside the margin frame', () => {
    const res = generateTangles({ ...BASE, count: 10, shading: 0.9 });
    for (const line of res.lines) {
      for (const p of line.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(20);
        expect(p.x).toBeLessThanOrEqual(280);
        expect(p.y).toBeGreaterThanOrEqual(20);
        expect(p.y).toBeLessThanOrEqual(380);
      }
    }
  });

  it('reserves more paper as the crossing gap widens', () => {
    // Occlusion has no off switch — a wider reserved gap must erase more ink.
    const tight = generateTangles({ ...BASE, count: 9, gap: 2, wobble: 0, optimize: false });
    const wide = generateTangles({ ...BASE, count: 9, gap: 9, wobble: 0, optimize: false });
    expect(totalLength(wide.lines)).toBeLessThan(totalLength(tight.lines));
  });

  it('splits edge outlines at crossings', () => {
    // With crossings present there must be more edge runs than the two
    // unbroken outlines every hose starts with.
    const res = generateTangles({ ...BASE, count: 9, wobble: 0, optimize: false });
    const edgeRuns = res.lines.filter((l) => l.layer === 'edge').length;
    expect(edgeRuns).toBeGreaterThan(2 * 9);
  });

  it('draws corrugation rings', () => {
    const res = generateTangles({ ...BASE, wobble: 0, optimize: false });
    const rings = res.lines.filter((l) => l.layer === 'ring');
    expect(rings.length).toBeGreaterThan(20);
  });

  it('mark-layer knobs never re-roll the tube geometry', () => {
    // Same seed, different shading: the edge outlines must be byte-identical
    // (wobble off — the finish pass varies with stroke count; optimize off —
    // reordering shuffles the comparison).
    const flat = generateTangles({ ...BASE, shading: 0, wobble: 0, optimize: false });
    const shaded = generateTangles({ ...BASE, shading: 1, wobble: 0, optimize: false });
    const edges = (res: typeof flat): string =>
      JSON.stringify(res.lines.filter((l) => l.layer === 'edge'));
    expect(edges(flat)).toBe(edges(shaded));
    expect(totalLength(shaded.lines)).toBeGreaterThan(totalLength(flat.lines));
  });

  it('echoes the resolved seed', () => {
    expect(generateTangles(BASE).seed).toBe(7);
    expect(Number.isFinite(generateTangles({ ...BASE, seed: undefined }).seed)).toBe(true);
  });

  it('produces a non-trivial drawing (golden guard)', () => {
    const res = generateTangles({ ...BASE, seed: 42 });
    expect(JSON.stringify(res).length).toBeGreaterThan(500);
  });
});

describe('lace material', () => {
  it('emits no corrugation rings and no cylinder shade', () => {
    const res = generateTangles({ ...BASE, material: 'lace', wobble: 0, optimize: false });
    expect(res.lines.some((l) => l.layer === 'ring')).toBe(false);
    expect(res.lines.some((l) => l.layer === 'shade')).toBe(false);
    expect(res.lines.filter((l) => l.layer === 'edge').length).toBeGreaterThan(0);
  });

  it('differs from hose output at the same seed', () => {
    const hose = generateTangles({ ...BASE, wobble: 0, optimize: false });
    const lace = generateTangles({ ...BASE, material: 'lace', wobble: 0, optimize: false });
    expect(JSON.stringify(lace.lines)).not.toBe(JSON.stringify(hose.lines));
  });

  it('twists reshape the lace edges', () => {
    const flat = generateTangles({ ...BASE, material: 'lace', twists: 0, wobble: 0, optimize: false });
    const twisty = generateTangles({ ...BASE, material: 'lace', twists: 1, wobble: 0, optimize: false });
    expect(JSON.stringify(twisty.lines)).not.toBe(JSON.stringify(flat.lines));
  });

  it('is deterministic per seed', () => {
    const a = generateTangles({ ...BASE, material: 'lace' });
    const b = generateTangles({ ...BASE, material: 'lace' });
    expect(a).toEqual(b);
  });

  it('stays inside the margin frame', () => {
    const res = generateTangles({ ...BASE, material: 'lace', count: 9, cuffChance: 0.6 });
    for (const line of res.lines) {
      for (const pt of line.points) {
        expect(pt.x).toBeGreaterThanOrEqual(20);
        expect(pt.x).toBeLessThanOrEqual(280);
        expect(pt.y).toBeGreaterThanOrEqual(20);
        expect(pt.y).toBeLessThanOrEqual(380);
      }
    }
  });
});

describe('growHoses', () => {
  const GROW = {
    x0: 20,
    y0: 20,
    x1: 280,
    y1: 380,
    material: 'hose' as const,
    count: 6,
    radiusMin: 8,
    radiusMax: 20,
    wander: 0.6,
    clearance: 6,
    pad: 1.3,
    seed: 11,
  };

  it('cuff ends sit well inside the frame; edge exits overshoot it', () => {
    const cuffed = growHoses({ ...GROW, cuffChance: 1 });
    for (const h of cuffed) {
      for (const end of [h.pts[0], h.pts[h.pts.length - 1]]) {
        expect(end.x).toBeGreaterThan(GROW.x0);
        expect(end.x).toBeLessThan(GROW.x1);
        expect(end.y).toBeGreaterThan(GROW.y0);
        expect(end.y).toBeLessThan(GROW.y1);
      }
    }
    const bled = growHoses({ ...GROW, cuffChance: 0 });
    for (const h of bled) {
      for (const end of [h.pts[0], h.pts[h.pts.length - 1]]) {
        const outBy = Math.max(
          GROW.x0 - end.x,
          end.x - GROW.x1,
          GROW.y0 - end.y,
          end.y - GROW.y1
        );
        expect(outBy).toBeGreaterThan(0);
      }
    }
  });

  it('respects the curvature cap relative to each hose radius', () => {
    const hoses = growHoses({ ...GROW, wander: 1, cuffChance: 0.5 });
    for (const h of hoses) {
      // Sampled tangent turn per arc must stay under 1/(BEND_FACTOR·r) with
      // slack for the post-smoothing resample.
      const s = finalizeOpen(h.pts, h.r);
      const dd = Math.max(2, h.r / 2);
      for (let a = dd; a < s.len - dd; a += dd) {
        const t0 = sampleAtOpen(s, a - dd).t;
        const t1 = sampleAtOpen(s, a + dd).t;
        const turn = Math.abs(
          Math.atan2(t0.x * t1.y - t0.y * t1.x, t0.x * t1.x + t0.y * t1.y)
        );
        const kappa = turn / (2 * dd);
        expect(kappa).toBeLessThan(1.35 / (1.8 * h.r));
      }
    }
  });
});

/**
 * X-ray detector, judged by the drawing's own stacking order: a surviving
 * mark point may not sit inside the body of an arc stacked ABOVE it. That is
 * the model's whole contract (`depth.ts`), and it is what the reader sees —
 * two tubes printing through each other. It is deliberately NOT judged
 * against the nearest crossing's winner any more: a global order sometimes
 * has to place a pair against their local crossing (to break a cycle, or
 * because a chain of constraints forces it), and the drawing is still
 * self-consistent when it does.
 */
function xrayHits(
  marks: Mark[],
  strands: TangleStrand[],
  table: ArcTable,
  endZones: [number, number][][]
): number {
  const intrusions = findIntrusions(marks, strands, {
    gap: 0,
    inflatePx: 0,
    penWidth: 2, // inset 1.25px: only points clearly inside the silhouette
    shadowHatch: 0,
    endZones,
  });
  let bad = 0;
  for (const t of intrusions) {
    const over = table.depth[arcAt(table, t.i, t.iArc)];
    const under = table.depth[arcAt(table, t.j, t.jArc)];
    if (over > under) bad++;
  }
  return bad;
}

describe('occlusion', () => {
  // Coverage: hose defaults, lace defaults, every end a cuff/aglet, and
  // the wander-heavy few-strand configs whose wads and self-coils broke
  // the crossing merge, the self exemption, and the repair zoning.
  const CONFIGS: TanglesOptions[] = [
    { ...BASE, seed: 7 },
    { ...BASE, seed: 42, material: 'lace' },
    { ...BASE, seed: 1, cuffChance: 1 },
    { ...BASE, seed: 1337, cuffChance: 1 },
    { width: 420, height: 594, margin: 20, seed: 42, count: 3, wander: 1 },
    { width: 420, height: 594, margin: 20, seed: 1337, count: 2, wander: 1, material: 'lace' },
  ];

  for (const cfg of CONFIGS) {
    it(`leaves no ink printing through a tube stacked above it (${JSON.stringify(cfg)})`, () => {
      const scene = buildTangleScene(cfg);
      const bad = xrayHits(
        scene.marks,
        scene.strands,
        scene.table,
        scene.occOpts.endZones ?? scene.strands.map(() => [])
      );
      expect(bad).toBe(0);
    }, 120000);
  }

  // The web app renders PHYSICAL radii (3..8mm at 3px/mm on A4), so r is
  // 9..24px on a 630x891 sheet — a very different regime from the core
  // defaults, and the one where the r-proportional confetti rules used to
  // discard whole visible stretches of duct. Regression cover for it.
  const WEB_MM = 3;
  const web = (over: Partial<TanglesOptions> = {}): TanglesOptions => ({
    width: 630,
    height: 891,
    margin: 10 * WEB_MM,
    radiusMin: 3 * WEB_MM,
    radiusMax: 8 * WEB_MM,
    clearance: 1.5 * WEB_MM,
    gap: 0.45 * WEB_MM,
    penWidth: 0.4 * WEB_MM,
    wobble: 0.25 * WEB_MM,
    ...over,
  });

  // A line may only stop where a tube stacked above it covers the paper.
  // Under the stacking model this is the exact negation of the erase rule,
  // so it should read ZERO — not a tolerance. What it can still catch is an
  // implementation slip: a survivor run binned by the short-run floor, or a
  // fragment the splitter lost.
  for (const [name, over] of [
    ['web defaults', { seed: 42 }],
    ['web dense', { seed: 1337, count: 16 }],
    ['web every end cuffed', { seed: 1, cuffChance: 1 }],
    ['web lace', { seed: 42, material: 'lace' as const }],
  ] as const) {
    it(`never breaks a line with nothing stacked over it (${name})`, () => {
      const scene = buildTangleScene(web(over));
      const gaps = findUnexplainedGaps(
        scene.marks,
        scene.marksBefore,
        scene.strands,
        scene.table,
        scene.index,
        scene.occOpts
      );
      expect({ name, gaps: gaps.length }).toEqual({ name, gaps: 0 });
    }, 120000);
  }

  it('caps hand-drawn displacement at maxDisplacement', () => {
    const line = {
      points: Array.from({ length: 40 }, (_, i) => ({ x: 10 + i * 5, y: 50 })),
    };
    const input = { lines: [line], width: 300, height: 100, seed: 5 };
    const maxDisplacement = 1.3;
    const out = applyHandDrawnStyle(input, {
      amplitude: 4,
      jitter: 3,
      seed: 5,
      maxDisplacement,
    });
    let peak = 0;
    for (let li = 0; li < out.lines.length; li++) {
      for (let i = 0; i < out.lines[li].points.length; i++) {
        const a = input.lines[li].points[i];
        const b = out.lines[li].points[i];
        peak = Math.max(peak, Math.hypot(b.x - a.x, b.y - a.y));
      }
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(maxDisplacement + 1e-9);
  });
});

describe('weave', () => {
  it('biases fatter hoses on top as weaveBias rises', () => {
    const grown = growHoses({
      x0: 20,
      y0: 20,
      x1: 280,
      y1: 380,
      material: 'hose',
      count: 8,
      radiusMin: 6,
      radiusMax: 18,
      wander: 0.7,
      cuffChance: 0,
      clearance: 4,
      pad: 1,
      seed: 3,
    });
    const strands = grown.map((g) => finalizeOpen(g.pts, g.r));
    const crossings = findHoseCrossings(strands, 4000);
    expect(crossings.length).toBeGreaterThan(3);
    const fatWins = (bias: number): number => {
      const w = solveHoseWeave(strands, crossings, bias, 3);
      let n = 0;
      for (const c of crossings) {
        const over = w.aOnTop[c.id] ? c.a : c.b;
        const under = w.aOnTop[c.id] ? c.b : c.a;
        if (strands[over.strand].r >= strands[under.strand].r) n++;
      }
      return n;
    };
    expect(fatWins(1)).toBeGreaterThanOrEqual(fatWins(0));
    // Full bias: every mixed-radius crossing resolves fat-on-top.
    const w = solveHoseWeave(strands, crossings, 1, 3);
    for (const c of crossings) {
      if (c.a.strand === c.b.strand) continue;
      if (strands[c.a.strand].r === strands[c.b.strand].r) continue;
      const over = w.aOnTop[c.id] ? c.a : c.b;
      const under = w.aOnTop[c.id] ? c.b : c.a;
      expect(strands[over.strand].r).toBeGreaterThan(strands[under.strand].r);
    }
  });
});
