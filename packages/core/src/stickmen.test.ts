import { describe, it, expect } from 'vitest';
import { generateStickmen, type StickmenOptions } from './stickmen/index.js';
import { buildLocalSkeleton } from './stickmen/skeleton.js';
import { resolvePose } from './stickmen/poses.js';
import { placeFigures } from './stickmen/layout.js';
import {
  resolveProportions,
  BASE_PROPORTIONS,
  PROP_DRAWS,
  type Proportions,
} from './stickmen/skeleton.js';
import { POSE_DRAWS } from './stickmen/poses.js';
import {
  compileRegion,
  starRegion,
  heartRegion,
  blobRegion,
  type StickmenRegion,
} from './stickmen/region.js';
import { createNoise } from './noise.js';
import { KX, KY } from './city/project.js';

const BASE: StickmenOptions = { width: 300, height: 400, margin: 20, seed: 7, count: 40 };

function totalLength(lines: { points: { x: number; y: number }[] }[]): number {
  let len = 0;
  for (const l of lines) {
    for (let i = 1; i < l.points.length; i++) {
      len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
    }
  }
  return len;
}

describe('generateStickmen', () => {
  it('is deterministic per seed', () => {
    const a = generateStickmen(BASE);
    const b = generateStickmen(BASE);
    expect(a).toEqual(b);
  });

  it('emits more ink as the count rises', () => {
    const few = generateStickmen({ ...BASE, count: 10 });
    const many = generateStickmen({ ...BASE, count: 120 });
    expect(totalLength(many.lines)).toBeGreaterThan(totalLength(few.lines));
  });

  it('keeps every point finite (crowd may overflow the page by design)', () => {
    // Core no longer clips to the page — the ground diamond overflows the sheet
    // on purpose so the web zoom-out can reveal it; the web layer clips. So we
    // assert finiteness (the real NaN-from-FK guard) and a sane overall bound,
    // not strict in-page containment.
    const r = generateStickmen(BASE);
    expect(r.lines.length).toBeGreaterThan(0);
    for (const l of r.lines) {
      for (const p of l.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Math.abs(p.x)).toBeLessThan(5000);
        expect(Math.abs(p.y)).toBeLessThan(5000);
      }
    }
  });

  it('removes hidden ink when occlusion is on (overlapping crowd)', () => {
    const crowd: StickmenOptions = { ...BASE, count: 90, spread: 0.5, minSeparation: 0 };
    const on = generateStickmen({ ...crowd, occlude: true });
    const off = generateStickmen({ ...crowd, occlude: false });
    expect(totalLength(on.lines)).toBeLessThan(totalLength(off.lines));
  });

  it('serializes to non-trivial output (golden guard)', () => {
    expect(JSON.stringify(generateStickmen(BASE)).length).toBeGreaterThan(500);
  });
});

describe('placement regions', () => {
  const frame = { x0: 20, y0: 20, x1: 280, y1: 380 };
  const layoutBase = {
    count: 60,
    spread: 1,
    clustering: 0.35,
    minSeparation: 6,
    facing: 'random' as const,
    facingAngle: 0,
    facingJitter: 0,
    figureScale: 30,
    scaleVariance: 0.25,
    depthGrade: 0,
    boxW: frame.x1 - frame.x0,
    boxH: frame.y1 - frame.y0,
  };

  /** Page position of a spec's ground anchor under the identity projection. */
  const anchorPage = (s: { u0: number; v0: number }) => ({
    x: (s.u0 - s.v0) * KX,
    y: (s.u0 + s.v0) * KY,
  });

  it('confines every anchor to a triangle polygon (hard constraint)', () => {
    const triangle: StickmenRegion = {
      kind: 'polygon',
      points: [
        { x: 0.5, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
    };
    const region = compileRegion(triangle, frame)!;
    const specs = placeFigures({ ...layoutBase, region }, createNoise(1), 42);
    expect(specs.length).toBe(layoutBase.count);
    for (const s of specs) {
      const p = anchorPage(s);
      expect(region.contains(p.x, p.y)).toBe(true);
    }
  });

  it('keeps anchors out of a ring hole', () => {
    const ring: StickmenRegion = { kind: 'ring', cx: 0.5, cy: 0.5, rOuter: 0.45, rInner: 0.25 };
    const region = compileRegion(ring, frame)!;
    const specs = placeFigures({ ...layoutBase, region }, createNoise(1), 42);
    const m = Math.min(layoutBase.boxW, layoutBase.boxH);
    const cx = frame.x0 + 0.5 * layoutBase.boxW;
    const cy = frame.y0 + 0.5 * layoutBase.boxH;
    for (const s of specs) {
      const p = anchorPage(s);
      const d = Math.hypot(p.x - cx, p.y - cy);
      expect(d).toBeGreaterThanOrEqual(0.25 * m - 1e-9);
      expect(d).toBeLessThanOrEqual(0.45 * m + 1e-9);
    }
  });

  it("treats region 'full' exactly like no region", () => {
    const a = generateStickmen(BASE);
    const b = generateStickmen({ ...BASE, region: { kind: 'full' } });
    expect(b).toEqual(a);
  });

  it('is deterministic with a region set', () => {
    const opts: StickmenOptions = {
      ...BASE,
      region: heartRegion(0.5, 0.5, 0.4, 0.4),
    };
    expect(generateStickmen(opts)).toEqual(generateStickmen(opts));
  });

  it('still yields exact count for a degenerate sliver region (fallback path)', () => {
    const sliver: StickmenRegion = { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.004, ry: 0.004 };
    const region = compileRegion(sliver, frame)!;
    const specs = placeFigures({ ...layoutBase, count: 12, region }, createNoise(1), 7);
    expect(specs.length).toBe(12);
    for (const s of specs) {
      expect(Number.isFinite(s.u0)).toBe(true);
      expect(Number.isFinite(s.v0)).toBe(true);
    }
  });

  it('preset builders emit valid polygons', () => {
    for (const r of [
      starRegion(0.5, 0.5, 0.4, 0.4, 0.5, 5),
      heartRegion(0.5, 0.5, 0.4, 0.4),
      blobRegion(99, 0.5, 0.5, 0.4, 0.4, 0.5),
    ]) {
      expect(r.kind).toBe('polygon');
      if (r.kind !== 'polygon') continue;
      expect(r.points.length).toBeGreaterThanOrEqual(8);
      for (const p of r.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
      // The builder's centre must be inside its own shape.
      const compiled = compileRegion(r, frame)!;
      expect(compiled.contains(frame.x0 + 0.5 * (frame.x1 - frame.x0), frame.y0 + 0.5 * (frame.y1 - frame.y0))).toBe(
        true
      );
    }
  });
});

describe('skeleton FK', () => {
  const neutral = new Array(POSE_DRAWS).fill(0.5);

  it('stands with ankles below and under the hips', () => {
    const s = buildLocalSkeleton(resolvePose(neutral, { poseEnergy: 0 }));
    expect(s.ankleL.z).toBeLessThan(s.hipL.z);
    expect(s.ankleR.z).toBeLessThan(s.hipR.z);
    expect(Math.abs(s.ankleL.x - s.hipL.x)).toBeLessThan(0.2);
  });

  it('collapses to a single pose at zero energy, varies with energy', () => {
    const a = resolvePose(new Array(POSE_DRAWS).fill(0.1), { poseEnergy: 0 });
    const b = resolvePose(new Array(POSE_DRAWS).fill(0.9), { poseEnergy: 0 });
    expect(a).toEqual(b); // energy 0 → identical regardless of genome
    const c = resolvePose(new Array(POSE_DRAWS).fill(0.1), { poseEnergy: 1 });
    const d = resolvePose(new Array(POSE_DRAWS).fill(0.9), { poseEnergy: 1 });
    expect(c).not.toEqual(d);
  });
});

describe('proportions', () => {
  it('reproduces the base canon at variance 0', () => {
    for (const g of [
      [0, 0, 0, 0],
      [0.9, 0.1, 0.7, 0.3],
    ]) {
      expect(resolveProportions(g, 0)).toEqual(BASE_PROPORTIONS);
    }
  });

  it('keeps feet grounded and head sane at full variance', () => {
    const neutral = new Array(POSE_DRAWS).fill(0.5);
    const pose = resolvePose(neutral, { poseEnergy: 0 });
    const canonical = buildLocalSkeleton(pose, BASE_PROPORTIONS);
    for (let t = 0; t < 20; t++) {
      const g = new Array(PROP_DRAWS).fill(0).map((_, k) => ((t * 7919 + k * 104729) % 1000) / 1000);
      const p: Proportions = resolveProportions(g, 1);
      const s = buildLocalSkeleton(pose, p);
      // Standing ankle height must match the canon (feet stay on the ground).
      expect(Math.abs(s.ankleL.z - canonical.ankleL.z)).toBeLessThan(0.02);
      expect(Math.abs(s.ankleR.z - canonical.ankleR.z)).toBeLessThan(0.02);
      // Head radius stays within the designed ±15%.
      expect(p.rHead).toBeGreaterThanOrEqual(BASE_PROPORTIONS.rHead * 0.85 - 1e-9);
      expect(p.rHead).toBeLessThanOrEqual(BASE_PROPORTIONS.rHead * 1.15 + 1e-9);
    }
  });
});

describe('pose modes', () => {
  const opts = (mode: 'procedural' | 'library' | 'mixed', poseEnergy = 0.6): StickmenOptions => ({
    ...BASE,
    poseMode: mode,
    poseEnergy,
  });

  it('library and mixed are deterministic', () => {
    expect(generateStickmen(opts('library'))).toEqual(generateStickmen(opts('library')));
    expect(generateStickmen(opts('mixed'))).toEqual(generateStickmen(opts('mixed')));
  });

  it('library output differs from procedural for the same options', () => {
    const a = generateStickmen(opts('procedural'));
    const b = generateStickmen(opts('library'));
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('at zero energy, library still yields distinct archetype stances', () => {
    // Two genomes that pick different archetypes: g[0] near 0 (standing) and
    // g[0] in the walking band (~0.30..0.55 of the CDF).
    const standing = resolvePose([0.05, ...new Array(POSE_DRAWS - 1).fill(0.5)], {
      poseEnergy: 0,
      mode: 'library',
    });
    const walking = resolvePose([0.4, ...new Array(POSE_DRAWS - 1).fill(0.5)], {
      poseEnergy: 0,
      mode: 'library',
    });
    expect(standing).not.toEqual(walking);
    // Walking couples the sides in opposition even at zero energy.
    expect(Math.sign(walking.hipSwingL)).not.toBe(Math.sign(walking.hipSwingR));
    expect(Math.sign(walking.shoulderSwingL)).not.toBe(Math.sign(walking.shoulderSwingR));
    // Procedural still collapses to one stance at zero energy.
    const p1 = resolvePose(new Array(POSE_DRAWS).fill(0.1), { poseEnergy: 0, mode: 'procedural' });
    const p2 = resolvePose(new Array(POSE_DRAWS).fill(0.9), { poseEnergy: 0, mode: 'procedural' });
    expect(p1).toEqual(p2);
  });
});

describe('depth size grading', () => {
  const layoutBase = {
    count: 120,
    spread: 1,
    clustering: 0,
    minSeparation: 0,
    facing: 'random' as const,
    facingAngle: 0,
    facingJitter: 0,
    figureScale: 30,
    scaleVariance: 0,
    boxW: 260,
    boxH: 360,
  };
  // depthGrade set per test below.

  it('makes nearer figures larger and leaves grade 0 untouched', () => {
    const graded = placeFigures({ ...layoutBase, depthGrade: 0.4 }, createNoise(1), 42);
    const flat = placeFigures({ ...layoutBase, depthGrade: 0 }, createNoise(1), 42);
    // specs are depth-sorted back-to-front: compare far vs near quartile.
    const q = Math.floor(graded.length / 4);
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const far = mean(graded.slice(0, q).map((s) => s.H));
    const near = mean(graded.slice(-q).map((s) => s.H));
    expect(near).toBeGreaterThan(far);
    for (const s of flat) expect(s.H).toBe(layoutBase.figureScale);
  });
});
