import { describe, it, expect } from 'vitest';
import { buildTangleScene, generateTangles, type TanglesOptions } from './tangles/index.js';
import { growHoses } from './tangles/centerline.js';
import { findHoseCrossings } from './tangles/crossings.js';
import { solveHoseWeave } from './tangles/weave.js';
import { finalizeOpen, sampleAtOpen, type TangleStrand } from './tangles/strand.js';
import {
  beyondTip,
  endShapeOf,
  findIntrusions,
  findUnexplainedGaps,
  inEndCap,
} from './tangles/occlude.js';
import { arcAt, type ArcTable } from './tangles/depth.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import type { Mark } from './tangles/hose.js';
import type { Point } from './flow-lines.js';

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

  // `findUnexplainedGaps` asks the same BodyIndex that did the erasing
  // whether the erasing was justified, so it is blind to a body that does not
  // match the ink — which is exactly how open cuff ends used to lose whole
  // stretches of a neighbouring duct. Here the silhouette is rebuilt from the
  // shapes `hose.ts` and `lace.ts` draw (a band that stops flat at the last
  // vertex, plus the mouth ellipse / aglet capsule) and the erasure is judged
  // against THAT. Anything longer than the short-run floor is ink deleted from
  // open paper, the artifact this module exists to avoid.
  for (const [name, over] of [
    ['web every end cuffed', { seed: 1, cuffChance: 1, count: 16 }],
    ['web dense, every end cuffed', { seed: 137, cuffChance: 1, count: 24 }],
    ['web defaults', { seed: 42 }],
    ['web lace, every end aglet', { seed: 42, material: 'lace' as const, cuffChance: 1 }],
  ] as const) {
    it(`erases no visible ink the drawing cannot explain (${name})`, () => {
      const scene = buildTangleScene(web(over));
      const { strands, marks, marksBefore, occOpts, ends } = scene;
      const grow = occOpts.gap + occOpts.inflatePx;
      const shapes = strands.map((s, k) =>
        endShapeOf(s, ends[k].cuffStart, ends[k].cuffEnd, occOpts, grow)
      );

      // Kept ink lies exactly on a survivor segment: survivors are
      // sub-polylines of the original geometry.
      const cell = 8;
      const grid = new Map<string, number[][]>();
      for (const m of marks) {
        for (let i = 1; i < m.points.length; i++) {
          const a = m.points[i - 1];
          const b = m.points[i];
          for (let cy = Math.floor(Math.min(a.y, b.y) / cell); cy <= Math.floor(Math.max(a.y, b.y) / cell); cy++) {
            for (let cx = Math.floor(Math.min(a.x, b.x) / cell); cx <= Math.floor(Math.max(a.x, b.x) / cell); cx++) {
              const key = `${m.strand}|${m.layer}|${cx},${cy}`;
              let arr = grid.get(key);
              if (!arr) grid.set(key, (arr = []));
              arr.push([a.x, a.y, b.x, b.y]);
            }
          }
        }
      }
      const alive = (p: Point, k: number, layer: string): boolean => {
        const arr = grid.get(`${k}|${layer}|${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`);
        if (!arr) return false;
        for (const s of arr) {
          const vx = s[2] - s[0];
          const vy = s[3] - s[1];
          const l2 = vx * vx + vy * vy;
          const t =
            l2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - s[0]) * vx + (p.y - s[1]) * vy) / l2)) : 0;
          const dx = s[0] + vx * t - p.x;
          const dy = s[1] + vy * t - p.y;
          if (dx * dx + dy * dy < 0.09) return true;
        }
        return false;
      };

      const covers = (k: number, x: number, y: number): boolean => {
        const s = strands[k];
        const lim = s.r + grow;
        for (let i = 0; i + 1 < s.pts.length; i++) {
          const ax = s.pts[i].x;
          const ay = s.pts[i].y;
          const vx = s.pts[i + 1].x - ax;
          const vy = s.pts[i + 1].y - ay;
          const l2 = vx * vx + vy * vy;
          const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)) : 0;
          const dx = ax + vx * t - x;
          const dy = ay + vy * t - y;
          if (dx * dx + dy * dy >= lim * lim) continue;
          if (i === 0 && beyondTip(shapes[k].start, x, y, grow)) continue;
          if (i + 2 === s.pts.length && beyondTip(shapes[k].end, x, y, grow)) continue;
          return true;
        }
        return shapes[k].caps.some((c) => inEndCap(c.shape, x, y));
      };

      // Longest contiguous stretch of erased ink standing on open paper.
      let worst = 0;
      let at = '';
      for (const m of marksBefore) {
        // Contact-shadow ticks drop whole by design — a half tick reads as
        // dirt, not as a mark.
        if (m.layer === 'shadow') continue;
        let run = 0;
        let prev: Point | null = null;
        for (let i = 0; i < m.points.length; i++) {
          const p = m.points[i];
          let bad = !alive(p, m.strand, m.layer);
          if (bad) {
            for (let k = 0; k < strands.length && bad; k++) {
              if (k === m.strand) continue;
              if (covers(k, p.x, p.y)) bad = false;
            }
          }
          if (bad) {
            // A separate pass of the same strand — its band, or its own end
            // hardware (a lace can curl back under its own aglet) — as long as
            // it is far enough along the strand to be a genuinely different
            // pass rather than the tube's own outline.
            const s = strands[m.strand];
            for (let j = 0; j < s.pts.length && bad; j++) {
              if (Math.abs(s.arc[j] - m.arcs[i]) < 5 * s.r) continue;
              if (Math.hypot(s.pts[j].x - p.x, s.pts[j].y - p.y) < s.r + grow) bad = false;
            }
            for (const c of shapes[m.strand].caps) {
              if (!bad) break;
              const endArc = c.at === 'start' ? 0 : s.len;
              if (Math.abs(endArc - m.arcs[i]) < 5 * s.r) continue;
              if (inEndCap(c.shape, p.x, p.y)) bad = false;
            }
          }
          if (!bad) {
            run = 0;
            prev = null;
            continue;
          }
          if (prev) run += Math.hypot(p.x - prev.x, p.y - prev.y);
          prev = p;
          if (run > worst) {
            worst = run;
            at = `(${p.x.toFixed(0)},${p.y.toFixed(0)}) ${m.layer}`;
          }
        }
      }
      // The only ink legitimately removed from open paper is a fragment too
      // short to read as a line (`occludeMarks`' 1.5-pen-width floor). A round
      // cap on a hose end used to leave stretches of 20-45px here.
      const floor = 1.5 * web(over).penWidth!;
      expect({ name, worst: worst <= floor + 0.5, at }).toEqual({ name, worst: true, at });
    }, 120000);
  }

  it('stops a hose flat at its tip, and covers only the mouth it draws', () => {
    const scene = buildTangleScene(web({ seed: 1, cuffChance: 1 }));
    const k = scene.ends.findIndex((e) => e.cuffEnd);
    expect(k).toBeGreaterThanOrEqual(0);
    const s = scene.strands[k];
    const shape = endShapeOf(s, false, true, scene.occOpts, 0);
    const tip = shape.end;
    const nx = -tip.ty;
    const ny = tip.tx;
    const at = (along: number, across: number) => ({
      x: tip.x + tip.tx * along + nx * across,
      y: tip.y + tip.ty * along + ny * across,
    });
    const inCap = (p: Point) => shape.caps.some((c) => inEndCap(c.shape, p.x, p.y));

    // On the axis the mouth reaches CUFF_OPEN * r, and no further.
    expect(inCap(at(0.3 * s.r, 0))).toBe(true);
    expect(inCap(at(0.4 * s.r, 0))).toBe(false);
    // Out at the mouth's widest the ellipse has closed back to the tip — this
    // is the crescent a round cap used to bite out of whatever passes behind.
    expect(inCap(at(0.3 * s.r, 0.9 * s.r))).toBe(false);
    // And the tube itself has stopped.
    const flank = at(0.2 * s.r, 0.9 * s.r);
    expect(beyondTip(tip, flank.x, flank.y, 0)).toBe(true);
  });

  it('gives a lace aglet the capsule it draws', () => {
    const scene = buildTangleScene(web({ seed: 42, material: 'lace', cuffChance: 1 }));
    const k = scene.ends.findIndex((e) => e.cuffEnd);
    expect(k).toBeGreaterThanOrEqual(0);
    const s = scene.strands[k];
    const shape = endShapeOf(s, false, true, { ...scene.occOpts, lace: true }, 0);
    const tip = shape.end;
    const at = (along: number, across: number) => ({
      x: tip.x + tip.tx * along + -tip.ty * across,
      y: tip.y + tip.ty * along + tip.tx * across,
    });
    const inCap = (p: { x: number; y: number }) =>
      shape.caps.some((c) => inEndCap(c.shape, p.x, p.y));
    // Reaches the aglet's full length on the axis, at its own half-width.
    expect(inCap(at(4 * s.r, 0))).toBe(true);
    expect(inCap(at(5.2 * s.r, 0))).toBe(false);
    expect(inCap(at(2 * s.r, 0.7 * s.r))).toBe(true);
    expect(inCap(at(2 * s.r, 0.9 * s.r))).toBe(false);
  });

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
