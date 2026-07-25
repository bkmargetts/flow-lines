import { describe, it, expect } from 'vitest';
import { generateSportsBalls, type SportsBallsOptions } from './sports-balls/index.js';
import { placeBalls, BALL_TYPES, type BallType, type BallSpec } from './sports-balls/layout.js';
import { castShadowStrokes } from './sports-balls/shadows.js';
import { SOCCER_EDGES } from './sports-balls/polyhedron.js';
import { compileRegion, heartRegion } from './stickmen/region.js';
import { createNoise } from './noise.js';

const BASE: SportsBallsOptions = { width: 300, height: 400, margin: 20, seed: 7, count: 30 };

function totalLength(lines: { points: { x: number; y: number }[] }[]): number {
  let len = 0;
  for (const l of lines) {
    for (let i = 1; i < l.points.length; i++) {
      len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
    }
  }
  return len;
}

const LAYOUT_BASE = {
  count: 30,
  clustering: 0.35,
  minSeparation: 20,
  ballScale: 40,
  scaleVariance: 0.25,
  trueSizes: 0.5,
  depthGrade: 0.15,
  mix: {} as Partial<Record<BallType, number>>,
  x0: 20,
  y0: 20,
  x1: 280,
  y1: 380,
};

describe('generateSportsBalls', () => {
  it('is deterministic per seed', () => {
    const a = generateSportsBalls(BASE);
    const b = generateSportsBalls(BASE);
    expect(a).toEqual(b);
  });

  it('emits more ink as the count rises', () => {
    const sparse = generateSportsBalls({ ...BASE, count: 10 });
    const dense = generateSportsBalls({ ...BASE, count: 80 });
    expect(totalLength(dense.lines)).toBeGreaterThan(totalLength(sparse.lines));
  });

  it('keeps every point finite and near the page', () => {
    const res = generateSportsBalls({ ...BASE, count: 60, shading: 0.8 });
    for (const line of res.lines) {
      for (const p of line.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThan(-50);
        expect(p.x).toBeLessThan(350);
        expect(p.y).toBeGreaterThan(-50);
        expect(p.y).toBeLessThan(450);
      }
    }
  });

  it('removes hidden ink when occlusion is on', () => {
    const opts = { ...BASE, count: 60, minSeparation: 4 };
    const on = generateSportsBalls({ ...opts, occlude: true });
    const off = generateSportsBalls({ ...opts, occlude: false });
    expect(totalLength(on.lines)).toBeLessThan(totalLength(off.lines));
  });

  it('adds ink when shading rises', () => {
    const flat = generateSportsBalls({ ...BASE, shading: 0 });
    const shaded = generateSportsBalls({ ...BASE, shading: 0.8 });
    expect(totalLength(shaded.lines)).toBeGreaterThan(totalLength(flat.lines));
  });

  it('renders each ball type distinctly', () => {
    const one = (type: BallType): string =>
      JSON.stringify(
        generateSportsBalls({ ...BASE, count: 8, ballScale: 70, mix: { [type]: 1 } }).lines
      );
    const outputs = BALL_TYPES.map(one);
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        expect(outputs[i]).not.toBe(outputs[j]);
      }
    }
  });

  it('produces a non-trivial drawing (golden guard)', () => {
    const res = generateSportsBalls({ ...BASE, seed: 42 });
    expect(JSON.stringify(res).length).toBeGreaterThan(500);
  });
});

describe('placeBalls', () => {
  const noise = createNoise(1);

  it('changing the mix never moves, resizes, or re-orients a ball', () => {
    // trueSizes 0 — with real-world sizing on, a ball's radius legitimately
    // follows its type, so re-typing must be allowed to resize.
    const base = { ...LAYOUT_BASE, trueSizes: 0 };
    const all = placeBalls({ ...base, mix: {} }, noise, 7);
    const some = placeBalls({ ...base, mix: { tennis: 1, soccer: 3 } }, noise, 7);
    expect(some.length).toBe(all.length);
    const key = (s: { x: number; y: number; r: number; rotG: number[] }): string =>
      JSON.stringify([s.x, s.y, s.r, s.rotG]);
    expect(some.map(key).sort()).toEqual(all.map(key).sort());
    for (const s of some) expect(['tennis', 'soccer']).toContain(s.type);
  });

  it('an all-off mix falls back to every type', () => {
    const specs = placeBalls(
      { ...LAYOUT_BASE, count: 120, mix: { soccer: 0, tennis: 0 } },
      noise,
      7
    );
    const seen = new Set(specs.map((s) => s.type));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('keeps the exact count in a degenerate sliver region', () => {
    const region = compileRegion(
      { kind: 'rect', cx: 0.5, cy: 0.5, w: 0.002, h: 0.002 },
      { x0: 20, y0: 20, x1: 280, y1: 380 }
    );
    const specs = placeBalls({ ...LAYOUT_BASE, count: 12, region }, noise, 7);
    expect(specs.length).toBe(12);
    for (const s of specs) {
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
    }
  });

  it('confines centres to a heart region', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(heartRegion(0.5, 0.5, 0.4, 0.4), frame);
    const specs = placeBalls({ ...LAYOUT_BASE, count: 60, region }, noise, 7);
    expect(specs.length).toBe(60);
    for (const s of specs) {
      expect(region!.contains(s.x, s.y)).toBe(true);
    }
  });

  it('never overdraws one ball outline with another, even in a crammed region', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(
      { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.125, ry: 0.125 },
      frame
    );
    // depthGrade 0: grading rescales radii after placement (bounded, but it
    // would blur the exact threshold this test pins).
    const specs = placeBalls(
      { ...LAYOUT_BASE, count: 200, minSeparation: 20, depthGrade: 0, region },
      noise,
      42
    );
    expect(specs.length).toBe(200);
    // Two circles stay within a pen width of each other everywhere iff
    // centre distance + radius difference is tiny — no pair may.
    for (let i = 0; i < specs.length; i++) {
      for (let j = i + 1; j < specs.length; j++) {
        const d = Math.hypot(specs[i].x - specs[j].x, specs[i].y - specs[j].y);
        expect(d + Math.abs(specs[i].r - specs[j].r)).toBeGreaterThanOrEqual(1.9);
      }
    }
  });

  it('holds whole balls inside the shape by default, centres-only when soft', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(
      { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.25 },
      frame
    );
    const opts = { ...LAYOUT_BASE, count: 60, depthGrade: 0.3, region };
    // Probe the same 12 rim points placement enforces.
    const rimOut = (s: { x: number; y: number; r: number }): number => {
      let out = 0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        if (!region!.contains(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r)) out++;
      }
      return out;
    };
    const crisp = placeBalls(opts, noise, 7);
    for (const s of crisp) expect(rimOut(s)).toBe(0);
    const soft = placeBalls({ ...opts, softEdge: true }, noise, 7);
    for (const s of soft) expect(region!.contains(s.x, s.y)).toBe(true);
    expect(soft.reduce((n, s) => n + rimOut(s), 0)).toBeGreaterThan(0);
  });

  it('places the exact count when the ball is larger than the shape', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(
      { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.04, ry: 0.04 },
      frame
    );
    const specs = placeBalls(
      { ...LAYOUT_BASE, count: 10, ballScale: 120, trueSizes: 0, scaleVariance: 0, region },
      noise,
      7
    );
    expect(specs.length).toBe(10);
    for (const s of specs) {
      expect(Number.isFinite(s.x)).toBe(true);
      expect(region!.contains(s.x, s.y)).toBe(true);
    }
  });

  it('grades size by depth', () => {
    const specs = placeBalls(
      { ...LAYOUT_BASE, count: 80, scaleVariance: 0, trueSizes: 0, depthGrade: 0.5 },
      noise,
      7
    );
    // Back-to-front sorted: the nearest ball should be larger than the farthest.
    expect(specs[specs.length - 1].r).toBeGreaterThan(specs[0].r);
  });
});

describe('spin', () => {
  it('spin changes orientation but never placement', () => {
    // wobble 0: the hand finish varies with stroke order, and spin changes
    // how many seam runs survive the silhouette gate.
    // optimize off: plot ordering is a global nearest-neighbour pass, so the
    // extra seam strokes a spin produces would also reshuffle the (unchanged)
    // outline circles, and this asserts on their order.
    const spun = generateSportsBalls({ ...BASE, spin: 1, wobble: 0, optimize: false });
    const upright = generateSportsBalls({ ...BASE, spin: 0, wobble: 0, optimize: false });
    expect(JSON.stringify(spun.lines)).not.toBe(JSON.stringify(upright.lines));
    // Outlines are orientation-free, so the set of outline circles must match.
    const outlines = (res: typeof spun): string =>
      JSON.stringify(res.lines.filter((l) => l.layer === 'outline'));
    expect(outlines(spun)).toBe(outlines(upright));
  });
});

describe('cast shadows', () => {
  const spec = (x: number, y: number, r: number): BallSpec => ({
    x,
    y,
    r,
    type: 'pingpong',
    rotG: [0, 0, 0],
    depth: y,
  });
  const OPTS = { castShadows: 0.8, lightAngle: Math.PI * 1.75, penWidth: 1.4 };

  it('hatches the farther ball where a nearer one crosses it', () => {
    // Depth-sorted back-to-front: the receiver (higher on page) comes first.
    const specs = [spec(100, 80, 40), spec(100, 130, 40)];
    const strokes = castShadowStrokes(specs, 0, OPTS);
    expect(strokes.length).toBeGreaterThan(0);
    // Every shadow point sits on the receiver, outside the caster.
    for (const s of strokes) {
      for (const p of s.points) {
        expect(Math.hypot(p.x - 100, p.y - 80)).toBeLessThanOrEqual(40);
        expect(Math.hypot(p.x - 100, p.y - 130)).toBeGreaterThan(40);
      }
    }
  });

  it('casts nothing between separated balls, and nothing at 0', () => {
    const apart = [spec(60, 80, 30), spec(240, 300, 30)];
    expect(castShadowStrokes(apart, 0, OPTS)).toEqual([]);
    const overlapping = [spec(100, 80, 40), spec(100, 130, 40)];
    expect(castShadowStrokes(overlapping, 0, { ...OPTS, castShadows: 0 })).toEqual([]);
  });

  it('adds ink to a dense pile end-to-end', () => {
    const opts = { ...BASE, count: 60, minSeparation: 4 };
    const off = generateSportsBalls({ ...opts, castShadows: 0 });
    const on = generateSportsBalls({ ...opts, castShadows: 0.8 });
    expect(totalLength(on.lines)).toBeGreaterThan(totalLength(off.lines));
  });
});

describe('soccer polyhedron', () => {
  it('is a truncated icosahedron: 90 unit edges over 60 vertices, one length', () => {
    expect(SOCCER_EDGES.length).toBe(90);
    const verts = new Set<string>();
    let minLen = Infinity;
    let maxLen = -Infinity;
    for (const [a, b] of SOCCER_EDGES) {
      for (const v of [a, b]) {
        expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 6);
        verts.add(`${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`);
      }
      const len = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      minLen = Math.min(minLen, len);
      maxLen = Math.max(maxLen, len);
    }
    expect(verts.size).toBe(60);
    // All panel edges of a truncated icosahedron share one edge length.
    expect(maxLen - minLen).toBeLessThan(1e-6);
  });
});
