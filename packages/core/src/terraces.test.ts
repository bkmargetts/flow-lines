import { describe, it, expect } from 'vitest';
import { generateTerraces, TERRACES_DEFAULT_TEXTURES } from './terraces/index.js';
import { terraceCurves } from './terraces/curves.js';
import { generateLapidary } from './lapidary/index.js';

const BASE = { width: 300, height: 400, margin: 20, seed: 42 } as const;

describe('generateTerraces', () => {
  it('is deterministic for the same seed and options', () => {
    const a = generateTerraces(BASE);
    const b = generateTerraces(BASE);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces different drawings for different seeds', () => {
    const a = generateTerraces({ ...BASE, seed: 42 });
    const b = generateTerraces({ ...BASE, seed: 1337 });
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('keeps every point inside the page, even at extreme fault settings', () => {
    for (const opts of [
      BASE,
      { ...BASE, faults: 6, faultThrow: 2, steppiness: 1, irregularity: 1, bands: 10 },
    ]) {
      const r = generateTerraces(opts);
      expect(r.lines.length).toBeGreaterThan(50);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(BASE.width);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(BASE.height);
        }
      }
    }
  });

  it('treats faults: 0 as a byte-identical no-op on the bed geometry', () => {
    const base = { ...BASE, faults: 0 };
    expect(JSON.stringify(generateTerraces({ ...base }))).toEqual(
      JSON.stringify(generateTerraces(base))
    );
    const faulted = generateTerraces({ ...BASE, faults: 2 });
    expect(JSON.stringify(faulted.lines)).not.toEqual(
      JSON.stringify(generateTerraces(base).lines)
    );
  });

  // The port-parity guardrail: with every terrace knob at its neutral value,
  // the fork must reproduce lapidary's strata mode byte-for-byte — same rng
  // streams, same geometry, same fills, same wobble, same optimize. Delete
  // this test (don't weaken it) the day terrace geometry intentionally
  // diverges from lapidary's.
  it('matches generateLapidary strata byte-for-byte at neutral knobs', () => {
    const shared = {
      ...BASE,
      bands: 6,
      faults: 2,
      irregularity: 0.55,
      baseAngleDeg: 0,
      angleDriftDeg: 14,
      pens: 2,
    } as const;
    // Explicit texture deal (both sides cycle the same list)…
    const dealt = generateTerraces({ ...shared, textures: TERRACES_DEFAULT_TEXTURES });
    const lapDealt = generateLapidary({
      ...shared,
      mode: 'strata',
      textures: TERRACES_DEFAULT_TEXTURES,
    });
    expect(JSON.stringify(dealt)).toEqual(JSON.stringify(lapDealt));
    // …and the seeded shuffle (terraces' [] is lapidary's undefined).
    const shuffled = generateTerraces({ ...shared, textures: [] });
    const lapShuffled = generateLapidary({ ...shared, mode: 'strata' });
    expect(JSON.stringify(shuffled)).toEqual(JSON.stringify(lapShuffled));
  });
});

describe('terraceCurves', () => {
  const RECT = { x0: 20, y0: 20, x1: 580, y1: 780 } as const;
  const GAP = 12;
  const curvesWith = (patch: Partial<Record<string, number>> = {}) =>
    terraceCurves(
      42,
      5,
      RECT.x0,
      RECT.y0,
      RECT.x1,
      RECT.y1,
      patch.irregularity ?? 0.55,
      GAP,
      patch.steppiness ?? 0,
      patch.faults ?? 0,
      patch.faultThrow ?? 1,
      patch.faultIncline ?? 0
    );

  it('keeps the top-down monotonic gap after faulting', () => {
    const curves = curvesWith({ faults: 4, faultThrow: 2, steppiness: 0.7 });
    for (let k = 1; k < curves.length; k++) {
      for (let i = 0; i < curves[k].length; i++) {
        expect(curves[k][i].y).toBeGreaterThanOrEqual(curves[k - 1][i].y + GAP - 1e-9);
      }
    }
  });

  it('commits to piecewise-flat treads at full steppiness', () => {
    // A stepped boundary holds each level flat between its breakpoints; the
    // organic boundary wanders at nearly every sample. Count level changes.
    const transitions = (pts: { y: number }[]): number => {
      let n = 0;
      for (let i = 1; i < pts.length; i++) if (pts[i].y !== pts[i - 1].y) n++;
      return n;
    };
    const stepped = curvesWith({ steppiness: 1 });
    const organic = curvesWith({ steppiness: 0 });
    for (const c of stepped) expect(transitions(c)).toBeLessThan(25);
    expect(organic.some((c) => transitions(c) > 80)).toBe(true);
  });

  it('flattens the throw to a geometric no-op at faultThrow: 0', () => {
    expect(JSON.stringify(curvesWith({ faults: 3, faultThrow: 0 }))).toEqual(
      JSON.stringify(curvesWith({ faults: 0 }))
    );
  });

  it('scales the fault displacement with faultThrow', () => {
    const base = curvesWith({ faults: 0 });
    const maxShift = (throwScale: number): number => {
      const curves = curvesWith({ faults: 1, faultThrow: throwScale });
      let m = 0;
      for (let k = 0; k < curves.length; k++) {
        for (let i = 0; i < curves[k].length; i++) {
          m = Math.max(m, Math.abs(curves[k][i].y - base[k][i].y));
        }
      }
      return m;
    };
    expect(maxShift(2)).toBeGreaterThan(maxShift(0.5));
    expect(maxShift(0.5)).toBeGreaterThan(0);
  });

  it('walks the scarp sideways through the beds with faultIncline', () => {
    // The fault plane's x threshold moves by bandH·slope per curve, so the
    // first displaced sample's x must drift monotonically down the stack —
    // rightward for a positive incline, leftward for a negative one.
    // A steep incline can walk the plane clean off the frame on the deepest
    // beds (no displaced sample there), so probe a moderate tilt and compare
    // the first and last beds the plane still crosses.
    const base = curvesWith({ faults: 0 });
    const jumpX = (incline: number): number[] => {
      const curves = curvesWith({ faults: 1, faultIncline: incline });
      return curves
        .map((c, k) => {
          const i = c.findIndex((p, j) => Math.abs(p.y - base[k][j].y) > 1e-6);
          return i < 0 ? NaN : c[i].x;
        })
        .filter(Number.isFinite);
    };
    const right = jumpX(0.6);
    const left = jumpX(-0.6);
    expect(right.length).toBeGreaterThan(2);
    expect(left.length).toBeGreaterThan(2);
    expect(right.at(-1)! - right[0]).toBeGreaterThan(0);
    expect(left.at(-1)! - left[0]).toBeLessThan(0);
  });
});
