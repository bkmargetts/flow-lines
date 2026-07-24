import { describe, it, expect } from 'vitest';
import { generateHearts, type HeartsOptions } from './hearts/index.js';
import { placeHearts, HEART_STYLES, type HeartStyle } from './hearts/layout.js';
import { heartOutline, hatchPolygon, heartBoundRadius } from './hearts/heart.js';
import { compileRegion, starRegion } from './stickmen/region.js';
import { pointInPolygon } from './lib/polyline.js';
import { createNoise } from './noise.js';

const BASE: HeartsOptions = { width: 300, height: 400, margin: 20, seed: 7, count: 30 };

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
  heartScale: 30,
  scaleVariance: 0.25,
  depthGrade: 0.15,
  plumpness: 0.5,
  plumpVariance: 0.25,
  tilt: 0.35,
  arrows: 0.1,
  boldOutline: 0.3,
  mix: {} as Partial<Record<HeartStyle, number>>,
  x0: 20,
  y0: 20,
  x1: 280,
  y1: 380,
};

describe('generateHearts', () => {
  it('is deterministic per seed', () => {
    const a = generateHearts(BASE);
    const b = generateHearts(BASE);
    expect(a).toEqual(b);
  });

  it('emits more ink as the count rises', () => {
    const sparse = generateHearts({ ...BASE, count: 10 });
    const dense = generateHearts({ ...BASE, count: 80 });
    expect(totalLength(dense.lines)).toBeGreaterThan(totalLength(sparse.lines));
  });

  it('keeps every point finite and near the page', () => {
    const res = generateHearts({ ...BASE, count: 60, shading: 0.8, arrows: 0.5 });
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
    const on = generateHearts({ ...opts, occlude: true });
    const off = generateHearts({ ...opts, occlude: false });
    expect(totalLength(on.lines)).toBeLessThan(totalLength(off.lines));
  });

  it('adds ink when shading rises', () => {
    const flat = generateHearts({ ...BASE, shading: 0 });
    const shaded = generateHearts({ ...BASE, shading: 0.8 });
    expect(totalLength(shaded.lines)).toBeGreaterThan(totalLength(flat.lines));
  });

  it('renders each heart style distinctly', () => {
    const one = (style: HeartStyle): string =>
      JSON.stringify(
        generateHearts({ ...BASE, count: 8, heartScale: 60, arrows: 0, mix: { [style]: 1 } }).lines
      );
    const outputs = HEART_STYLES.map(one);
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        expect(outputs[i]).not.toBe(outputs[j]);
      }
    }
  });

  it('arrows add decor ink', () => {
    const plain = generateHearts({ ...BASE, arrows: 0 });
    const pierced = generateHearts({ ...BASE, arrows: 1 });
    expect(pierced.lines.some((l) => l.layer === 'decor')).toBe(true);
    expect(plain.lines.some((l) => l.layer === 'decor')).toBe(false);
    expect(totalLength(pierced.lines)).toBeGreaterThan(totalLength(plain.lines));
  });

  it('produces a non-trivial drawing (golden guard)', () => {
    const res = generateHearts({ ...BASE, seed: 42 });
    expect(JSON.stringify(res).length).toBeGreaterThan(500);
  });
});

describe('placeHearts', () => {
  const noise = createNoise(1);

  it('changing the mix never moves, resizes, or re-poses a heart', () => {
    const all = placeHearts({ ...LAYOUT_BASE, mix: {} }, noise, 7);
    const some = placeHearts({ ...LAYOUT_BASE, mix: { solid: 1, broken: 3 } }, noise, 7);
    expect(some.length).toBe(all.length);
    const key = (s: { x: number; y: number; r: number; rot: number; plump: number }): string =>
      JSON.stringify([s.x, s.y, s.r, s.rot, s.plump]);
    expect(some.map(key).sort()).toEqual(all.map(key).sort());
    for (const s of some) expect(['solid', 'broken']).toContain(s.style);
  });

  it('changing the decor knobs never moves a heart', () => {
    const plain = placeHearts({ ...LAYOUT_BASE, arrows: 0, boldOutline: 0 }, noise, 7);
    const dressed = placeHearts({ ...LAYOUT_BASE, arrows: 1, boldOutline: 1 }, noise, 7);
    const key = (s: { x: number; y: number; r: number; rot: number; plump: number }): string =>
      JSON.stringify([s.x, s.y, s.r, s.rot, s.plump]);
    expect(dressed.map(key)).toEqual(plain.map(key));
    expect(dressed.every((s) => s.arrow && s.bold)).toBe(true);
  });

  it('an all-off mix falls back to every style', () => {
    const specs = placeHearts({ ...LAYOUT_BASE, count: 120, mix: { outline: 0, solid: 0 } }, noise, 7);
    const seen = new Set(specs.map((s) => s.style));
    expect(seen.size).toBe(HEART_STYLES.length);
  });

  it('keeps the exact count in a degenerate sliver region', () => {
    const region = compileRegion(
      { kind: 'rect', cx: 0.5, cy: 0.5, w: 0.002, h: 0.002 },
      { x0: 20, y0: 20, x1: 280, y1: 380 }
    );
    const specs = placeHearts({ ...LAYOUT_BASE, count: 12, region }, noise, 7);
    expect(specs.length).toBe(12);
    for (const s of specs) {
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
    }
  });

  it('confines centres to a star region', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(starRegion(0.5, 0.5, 0.45, 0.45), frame);
    const specs = placeHearts({ ...LAYOUT_BASE, count: 60, region }, noise, 7);
    expect(specs.length).toBe(60);
    for (const s of specs) {
      expect(region!.contains(s.x, s.y)).toBe(true);
    }
  });

  it('holds whole hearts inside the shape by default, centres-only when soft', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(
      { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.25 },
      frame
    );
    const opts = { ...LAYOUT_BASE, count: 60, depthGrade: 0.3, region };
    // Probe the same 12 bounding-circle points placement enforces.
    const rimOut = (s: { x: number; y: number; r: number; plump: number }): number => {
      const bound = heartBoundRadius(s.r, s.plump);
      let out = 0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        if (!region!.contains(s.x + Math.cos(a) * bound, s.y + Math.sin(a) * bound)) out++;
      }
      return out;
    };
    const crisp = placeHearts(opts, noise, 7);
    for (const s of crisp) expect(rimOut(s)).toBe(0);
    const soft = placeHearts({ ...opts, softEdge: true }, noise, 7);
    for (const s of soft) expect(region!.contains(s.x, s.y)).toBe(true);
    expect(soft.reduce((n, s) => n + rimOut(s), 0)).toBeGreaterThan(0);
  });

  it('places the exact count when the heart is larger than the shape', () => {
    const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
    const region = compileRegion(
      { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.04, ry: 0.04 },
      frame
    );
    const specs = placeHearts(
      { ...LAYOUT_BASE, count: 10, heartScale: 120, scaleVariance: 0, region },
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
    const specs = placeHearts(
      { ...LAYOUT_BASE, count: 80, scaleVariance: 0, depthGrade: 0.5 },
      noise,
      7
    );
    // Back-to-front sorted: the nearest heart should be larger than the farthest.
    expect(specs[specs.length - 1].r).toBeGreaterThan(specs[0].r);
  });
});

describe('heart geometry', () => {
  it('hatch fill stays inside the outline', () => {
    const poly = heartOutline(100, 100, 40, 0.3, 0.5);
    for (const seg of hatchPolygon(poly, -0.6, 4, 0.5)) {
      // Segment endpoints sit ON the boundary; probe the midpoint, which
      // even-odd clipping guarantees is interior.
      const mx = (seg[0].x + seg[1].x) / 2;
      const my = (seg[0].y + seg[1].y) / 2;
      expect(pointInPolygon(poly, mx, my)).toBe(true);
    }
  });

  it('plumpness reshapes the outline within its bounding circle', () => {
    const pointy = heartOutline(0, 0, 40, 0, 0);
    const chubby = heartOutline(0, 0, 40, 0, 1);
    expect(JSON.stringify(pointy)).not.toBe(JSON.stringify(chubby));
    for (const [plump, pts] of [
      [0, pointy],
      [1, chubby],
    ] as const) {
      const bound = heartBoundRadius(40, plump) + 1e-6;
      for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(bound);
    }
    // Pointy hearts stretch taller than chubby ones.
    const depth = (pts: { y: number }[]): number => Math.max(...pts.map((p) => p.y));
    expect(depth(pointy)).toBeGreaterThan(depth(chubby));
  });

  it('plumpness reshapes hearts but never re-rolls their identities', () => {
    // Positions may legitimately shift (the page inset follows the bounding
    // radius, which follows the aspect) — but size, tilt and style must not.
    const noise = createNoise(1);
    const key = (s: { r: number; rot: number; style: string }): string =>
      JSON.stringify([s.r, s.rot, s.style]);
    // depthGrade 0 — grading rescales r from the (legitimately shifted)
    // positions, which would blur the identity this test pins.
    const a = placeHearts({ ...LAYOUT_BASE, plumpness: 0.1, plumpVariance: 0, depthGrade: 0 }, noise, 7);
    const b = placeHearts({ ...LAYOUT_BASE, plumpness: 0.9, plumpVariance: 0, depthGrade: 0 }, noise, 7);
    expect(a.map(key).sort()).toEqual(b.map(key).sort());
  });
});
