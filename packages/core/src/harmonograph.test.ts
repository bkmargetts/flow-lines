import { describe, it, expect } from 'vitest';
import { generateHarmonograph, harmonographLayerName } from './harmonograph/index.js';
import type { HarmonographOptions, HarmonographPreset } from './harmonograph/index.js';

const BASE: HarmonographOptions = { width: 300, height: 400, margin: 20, seed: 42 };

const PRESETS: HarmonographPreset[] = [
  'lissajous',
  'pendulum',
  'rotary',
  'spiro',
  'wheelwork',
  'rosette',
  'engine-turn',
];

function totalPoints(r: { lines: { points: unknown[] }[] }): number {
  return r.lines.reduce((acc, l) => acc + l.points.length, 0);
}

describe('generateHarmonograph', () => {
  it('is deterministic per seed', () => {
    for (const preset of PRESETS) {
      const a = generateHarmonograph({ ...BASE, preset });
      const b = generateHarmonograph({ ...BASE, preset });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('different seeds drift the figure', () => {
    // The undamped presets are exact closed curves — only the seeded modes drift.
    for (const preset of ['pendulum', 'rotary', 'rosette', 'wheelwork'] as const) {
      const a = generateHarmonograph({ ...BASE, preset });
      const b = generateHarmonograph({ ...BASE, preset, seed: 43 });
      expect(JSON.stringify(a.lines), preset).not.toBe(JSON.stringify(b.lines));
    }
  });

  it('every preset stays inside the margin with finite coordinates', () => {
    for (const preset of PRESETS) {
      const r = generateHarmonograph({ ...BASE, preset });
      expect(r.lines.length).toBeGreaterThan(0);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(20 - 1e-6);
          expect(p.x).toBeLessThanOrEqual(280 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(20 - 1e-6);
          expect(p.y).toBeLessThanOrEqual(380 + 1e-6);
        }
      }
    }
  });

  it('zero damping, detune and rotary closes into a Lissajous figure', () => {
    const r = generateHarmonograph({
      ...BASE,
      preset: 'lissajous',
      optimize: false,
    });
    expect(r.lines).toHaveLength(1);
    const pts = r.lines[0].points;
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(0.01);
  });

  it('trochoids close exactly after the wheel order runs out', () => {
    const r = generateHarmonograph({
      ...BASE,
      preset: 'spiro',
      lobes: 7,
      wheelOrder: 3,
      optimize: false,
    });
    expect(r.lines).toHaveLength(1);
    const pts = r.lines[0].points;
    expect(pts[0].x).toBeCloseTo(pts[pts.length - 1].x, 9);
    expect(pts[0].y).toBeCloseTo(pts[pts.length - 1].y, 9);
  });

  it('damping shrinks the late curve', () => {
    const extent = (opts: HarmonographOptions): number => {
      const r = generateHarmonograph({ ...opts, optimize: false });
      const pts = r.lines[0].points;
      // Look only at the last tenth of the trace.
      const tail = pts.slice(Math.floor(pts.length * 0.9));
      let max = 0;
      for (const p of tail) max = Math.max(max, Math.hypot(p.x - 150, p.y - 200));
      return max;
    };
    const calm = extent({ ...BASE, preset: 'pendulum', damping: 0.9 });
    const wild = extent({ ...BASE, preset: 'pendulum', damping: 0.05 });
    expect(calm).toBeLessThan(wild * 0.5);
  });

  it('each knob changes the drawing', () => {
    const knobs: Array<[HarmonographPreset, Partial<HarmonographOptions>]> = [
      ['pendulum', { ratioNum: 5 }],
      ['pendulum', { detune: 0.03 }],
      ['pendulum', { damping: 0.7 }],
      ['pendulum', { rotary: 0.5 }],
      ['pendulum', { periods: 12 }],
      ['pendulum', { wobble: 1.5 }],
      ['pendulum', { scale: 0.5 }],
      ['spiro', { lobes: 11 }],
      ['spiro', { penOffset: 1.3 }],
      ['spiro', { trochoidKind: 'epi' }],
      ['spiro', { nest: 6 }],
      ['rosette', { rings: 12 }],
      ['rosette', { waves: 20 }],
      ['rosette', { waveAmp: 0.2 }],
      ['rosette', { phaseAdvanceDeg: 40 }],
      ['rosette', { innerHole: 0.6 }],
      ['rosette', { waves2: 5 }],
      ['rosette', { envelope: 'edge' }],
    ];
    for (const [preset, knob] of knobs) {
      const base = generateHarmonograph({ ...BASE, preset });
      const varied = generateHarmonograph({ ...BASE, preset, ...knob });
      expect(JSON.stringify(varied.lines), `${preset} ${JSON.stringify(knob)}`).not.toBe(
        JSON.stringify(base.lines)
      );
    }
  });

  it('cycles exactly the requested pen layers', () => {
    for (const preset of ['rotary', 'wheelwork', 'engine-turn'] as const) {
      const r = generateHarmonograph({ ...BASE, preset, inkGroups: 3 });
      const layers = [...new Set(r.lines.map((l) => l.layer))].sort();
      expect(layers, preset).toEqual([0, 1, 2].map(harmonographLayerName));
      expect(r.lines.every((l) => l.pen === 'fine')).toBe(true);
    }
  });

  it('single pen tags everything ink-0', () => {
    const r = generateHarmonograph(BASE);
    expect(r.lines.every((l) => l.layer === harmonographLayerName(0))).toBe(true);
  });

  it('a coarser detail target spends fewer points', () => {
    const fine = generateHarmonograph({ ...BASE, detail: 0.6, optimize: false });
    const coarse = generateHarmonograph({ ...BASE, detail: 3, optimize: false });
    expect(totalPoints(coarse)).toBeLessThan(totalPoints(fine));
  });

  it('respects the point cap under hostile settings', () => {
    const r = generateHarmonograph({
      ...BASE,
      preset: 'engine-turn',
      rings: 120,
      waves: 96,
      detail: 0.4,
      pointCap: 20_000,
      optimize: false,
    });
    // The budget bounds the raw trace (plus per-ring rounding and closure
    // points); decimation then trims well below it.
    expect(totalPoints(r)).toBeLessThanOrEqual(20_000 + 500);
    expect(r.lines.length).toBeGreaterThan(0);
  });

  it('returns empty on a degenerate page', () => {
    const r = generateHarmonograph({ width: 30, height: 30, margin: 14, seed: 42 });
    expect(r.lines).toEqual([]);
  });
});
