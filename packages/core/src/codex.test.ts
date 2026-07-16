import { describe, it, expect } from 'vitest';
import { generateMachineCodex } from './codex/index.js';
import { makeCtx } from './codex/context.js';
import { DEFAULTS, type ResolvedOptions } from './codex/types.js';
import { synthesize, pitchR, outerR } from './codex/synth.js';
import { toothProfile } from './codex/gears.js';
import { commonTangents, dashPolyline } from './codex/geometry.js';
import { pointInPolygon } from './lib/polyline.js';
import { densify } from './lib/spatial.js';

const BASE = { width: 560, height: 700, margin: 28, seed: 42 } as const;

function machineFor(seed: number, over: Partial<ResolvedOptions> = {}) {
  const o: ResolvedOptions = { ...DEFAULTS, ...BASE, seed, ...over };
  const ctx = makeCtx(o, seed);
  return synthesize(ctx);
}

describe('generateMachineCodex', () => {
  it('is deterministic for the same seed and options', () => {
    const a = generateMachineCodex({ ...BASE });
    const b = generateMachineCodex({ ...BASE });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces different drawings for different seeds', () => {
    const a = generateMachineCodex({ ...BASE, seed: 42 });
    const b = generateMachineCodex({ ...BASE, seed: 1337 });
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('keeps every stroke on the page', () => {
    for (const seed of [7, 42, 1337]) {
      const r = generateMachineCodex({ ...BASE, seed });
      for (const ln of r.lines) {
        for (const p of ln.points) {
          expect(p.x).toBeGreaterThan(-3);
          expect(p.x).toBeLessThan(r.width + 3);
          expect(p.y).toBeGreaterThan(-3);
          expect(p.y).toBeLessThan(r.height + 3);
        }
      }
    }
  });

  it('emits dashed hidden lines as separate short polylines, never one long run', () => {
    const r = generateMachineCodex({ ...BASE, hiddenLines: true, wobble: 0, sketch: 0 });
    const hidden = r.lines.filter((l) => l.layer === 'hidden');
    for (const ln of hidden) {
      let len = 0;
      for (let i = 1; i < ln.points.length; i++) {
        len += Math.hypot(ln.points[i].x - ln.points[i - 1].x, ln.points[i].y - ln.points[i - 1].y);
      }
      expect(len).toBeLessThan(DEFAULTS.penWidth * 3.2 + 0.5);
    }
  });
});

describe('machine synthesis', () => {
  it('meshing gears sit at the exact pitch-tangent centre distance', () => {
    for (const seed of [7, 42, 99, 1337]) {
      const m = machineFor(seed, { complexity: 1 });
      const meshes = m.gears.filter((g) => g.parent !== undefined);
      expect(meshes.length).toBeGreaterThan(0);
      for (const child of meshes) {
        const parent = m.gears.find((g) => g.id === child.parent)!;
        const d = Math.hypot(child.cx - parent.cx, child.cy - parent.cy);
        expect(d).toBeCloseTo((m.module * (parent.teeth + child.teeth)) / 2, 6);
      }
    }
  });

  it('tooth polygons at a mesh interleave without overlapping', () => {
    for (const seed of [7, 42, 99, 1337]) {
      const m = machineFor(seed, { complexity: 1 });
      for (const child of m.gears.filter((g) => g.parent !== undefined)) {
        const parent = m.gears.find((g) => g.id === child.parent)!;
        const parentPoly = toothProfile(parent);
        const childPoly = toothProfile(child);
        // Shrink probe points a hair toward their own centre so an exact
        // tangential touch at the pitch point doesn't count as overlap.
        const inside = (poly: { x: number; y: number }[], pts: { x: number; y: number }[], cx: number, cy: number): number => {
          let n = 0;
          for (const p of densify(pts, 2)) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const r = Math.hypot(dx, dy) || 1;
            const q = { x: cx + dx * ((r - 0.35) / r), y: cy + dy * ((r - 0.35) / r) };
            if (pointInPolygon(poly, q.x, q.y)) n++;
          }
          return n;
        };
        expect(inside(parentPoly, childPoly, child.cx, child.cy)).toBe(0);
        expect(inside(childPoly, parentPoly, parent.cx, parent.cy)).toBe(0);
      }
    }
  });

  it('non-meshing wheels keep real clearance (no near-miss almost-meshes)', () => {
    for (const seed of [7, 42, 1337]) {
      const m = machineFor(seed, { complexity: 1 });
      for (const a of m.gears) {
        for (const b of m.gears) {
          if (a.id >= b.id) continue;
          const coaxial = Math.abs(a.cx - b.cx) < 1e-6 && Math.abs(a.cy - b.cy) < 1e-6;
          const meshed = a.parent === b.id || b.parent === a.id;
          if (coaxial || meshed) continue;
          const gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) - outerR(a) - outerR(b);
          expect(gap).toBeGreaterThan(2);
        }
      }
    }
  });

  it('every shaft gets a bearing and the frame has a ground sill', () => {
    for (const seed of [7, 42]) {
      const m = machineFor(seed);
      expect(m.frame.some((b) => b.kind === 'ground')).toBe(true);
      const shafts = new Set(m.gears.map((g) => `${Math.round(g.cx)},${Math.round(g.cy)}`));
      expect(m.bearings.length).toBeGreaterThanOrEqual(shafts.size);
    }
  });
});

describe('geometry helpers', () => {
  it('common tangent segments touch each circle perpendicular to its radius', () => {
    const A = { cx: 0, cy: 0, r: 40 };
    const B = { cx: 130, cy: 25, r: 18 };
    for (const crossed of [false, true]) {
      const t = commonTangents(A, B, crossed)!;
      expect(t).not.toBeNull();
      for (let i = 0; i < 2; i++) {
        const [p1, p2] = t.segs[i];
        expect(Math.hypot(p1.x - A.cx, p1.y - A.cy)).toBeCloseTo(A.r, 6);
        expect(Math.hypot(p2.x - B.cx, p2.y - B.cy)).toBeCloseTo(B.r, 6);
        // Radius ⊥ tangent line at both touch points.
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const dotA = ((p1.x - A.cx) * dx + (p1.y - A.cy) * dy) / (A.r * len);
        const dotB = ((p2.x - B.cx) * dx + (p2.y - B.cy) * dy) / (B.r * len);
        expect(Math.abs(dotA)).toBeLessThan(1e-6);
        expect(Math.abs(dotB)).toBeLessThan(1e-6);
      }
    }
  });

  it('pitch radius follows module and tooth count', () => {
    expect(pitchR({ teeth: 24, module: 6 })).toBe(72);
    expect(outerR({ teeth: 24, module: 6 })).toBe(78);
  });

  it('dashPolyline splits a line into pen-up dashes of the asked length', () => {
    const dashes = dashPolyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      6,
      4
    );
    expect(dashes.length).toBe(10);
    for (const d of dashes) {
      const len = Math.hypot(d[d.length - 1].x - d[0].x, d[d.length - 1].y - d[0].y);
      expect(len).toBeLessThanOrEqual(6 + 1e-9);
    }
  });
});
