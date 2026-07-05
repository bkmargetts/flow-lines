import { describe, it, expect } from 'vitest';
import { generateStickmen, type StickmenOptions } from './stickmen/index.js';
import { buildLocalSkeleton } from './stickmen/skeleton.js';
import { resolvePose } from './stickmen/poses.js';

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

describe('skeleton FK', () => {
  const neutral = new Array(13).fill(0.5);

  it('stands with ankles below and under the hips', () => {
    const s = buildLocalSkeleton(resolvePose(neutral, { poseEnergy: 0 }));
    expect(s.ankleL.z).toBeLessThan(s.hipL.z);
    expect(s.ankleR.z).toBeLessThan(s.hipR.z);
    expect(Math.abs(s.ankleL.x - s.hipL.x)).toBeLessThan(0.2);
  });

  it('collapses to a single pose at zero energy, varies with energy', () => {
    const a = resolvePose(new Array(13).fill(0.1), { poseEnergy: 0 });
    const b = resolvePose(new Array(13).fill(0.9), { poseEnergy: 0 });
    expect(a).toEqual(b); // energy 0 → identical regardless of genome
    const c = resolvePose(new Array(13).fill(0.1), { poseEnergy: 1 });
    const d = resolvePose(new Array(13).fill(0.9), { poseEnergy: 1 });
    expect(c).not.toEqual(d);
  });
});
