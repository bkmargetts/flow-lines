import { describe, it, expect } from 'vitest';
import { generateTangles, type TanglesOptions } from './tangles/index.js';
import { growHoses } from './tangles/centerline.js';
import { findHoseCrossings } from './tangles/crossings.js';
import { solveHoseWeave } from './tangles/weave.js';
import { finalizeOpen, sampleAtOpen } from './tangles/strand.js';

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
