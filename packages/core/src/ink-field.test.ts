import { describe, it, expect } from 'vitest';
import { generateInkField, type InkFieldOptions } from './ink-field.js';
import { bandLayerName } from './overlapped-lines.js';
import type { FlowLine } from './flow-lines.js';

const base: InkFieldOptions = {
  width: 400,
  height: 500,
  margin: 20,
  inkCount: 3,
  pitchPx: 4,
  seed: 42,
  penTests: false,
};

const centroid = (l: FlowLine) => {
  let sx = 0;
  let sy = 0;
  for (const p of l.points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / l.points.length, y: sy / l.points.length };
};

/** Canonical form of a stroke, ignoring direction. */
const canon = (l: FlowLine): string => {
  const fwd = JSON.stringify(l.points);
  const rev = JSON.stringify([...l.points].reverse());
  return fwd < rev ? fwd : rev;
};

describe('generateInkField', () => {
  it.each(['ribbon', 'lattice', 'stripes'] as const)('is deterministic per seed (%s)', (style) => {
    const a = generateInkField({ ...base, style });
    const b = generateInkField({ ...base, style });
    expect(a).toEqual(b);
    expect(a.lines.length).toBeGreaterThan(0);
  });

  it.each(['ribbon', 'lattice', 'stripes'] as const)(
    'tags every line with a band layer and stays on the page (%s)',
    (style) => {
      const out = generateInkField({ ...base, style });
      const allowed = new Set([bandLayerName(0), bandLayerName(1), bandLayerName(2)]);
      for (const l of out.lines) {
        expect(allowed.has(l.layer ?? '')).toBe(true);
        for (const p of l.points) {
          expect(p.x).toBeGreaterThanOrEqual(20 - 1e-6);
          expect(p.x).toBeLessThanOrEqual(380 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(20 - 1e-6);
          expect(p.y).toBeLessThanOrEqual(480 + 1e-6);
        }
      }
      // Every ink is present.
      const used = new Set(out.lines.map((l) => l.layer));
      expect(used.size).toBe(3);
    }
  );

  it('ribbon: every ink draws the full band (vernier pitch differential)', () => {
    const out = generateInkField({
      ...base,
      style: 'ribbon',
      bandWidthPx: 80,
      inkPitchDelta: 0.05,
      misregisterPx: 0,
      phaseDrift: 0,
      optimize: false,
    });
    // Each ink's stroke count is near bandWidth/pitch — the full band, not a
    // partition of it (three inks ≈ 3× the coverage of one).
    for (let k = 0; k < 3; k++) {
      const n = out.lines.filter((l) => l.layer === bandLayerName(k)).length;
      expect(n).toBeGreaterThan(80 / 4 - 6);
    }
  });

  it('lattice: a dominant plane reads denser than the base field', () => {
    const out = generateInkField({
      ...base,
      width: 600,
      height: 600,
      style: 'lattice',
      planeCount: 1,
      insetPatches: 0,
      baseDensity: 0.25,
      planeDensity: 0.95,
      optimize: false,
    });
    // The plane's dominant ink must concentrate somewhere: its densest page
    // quadrant carries clearly more of some ink than the sparsest quadrant.
    const perQuadrant = new Map<string, number>();
    for (const l of out.lines) {
      const c = centroid(l);
      const q = `${l.layer}/${c.x < 300 ? 0 : 1}${c.y < 300 ? 0 : 1}`;
      let len = 0;
      for (let i = 1; i < l.points.length; i++) {
        len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
      }
      perQuadrant.set(q, (perQuadrant.get(q) ?? 0) + len);
    }
    const totals = [...perQuadrant.values()];
    expect(Math.max(...totals)).toBeGreaterThan(Math.min(...totals) * 2);
  });

  it('stripes: hard blocks alternate dense and sparse coverage', () => {
    const opts: InkFieldOptions = {
      ...base,
      style: 'stripes',
      stripeCount: 4,
      stripeBlocks: true,
      blockDuty: 0.5,
      optimize: false,
    };
    const on = generateInkField(opts);
    const off = generateInkField({ ...opts, stripeBlocks: false });
    const inkLength = (r: { lines: FlowLine[] }) => {
      let len = 0;
      for (const l of r.lines) {
        for (let i = 1; i < l.points.length; i++) {
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
      }
      return len;
    };
    // Blocks thin the light bands, so total inked length drops meaningfully.
    expect(inkLength(on)).toBeLessThan(inkLength(off) * 0.85);
  });

  it('wearOrder reorders without touching geometry', () => {
    const plain = generateInkField({ ...base, style: 'lattice' });
    const worn = generateInkField({ ...base, style: 'lattice', wearOrder: 'sweep', wearAngleDeg: 0 });
    expect(worn.lines.map(canon).sort()).toEqual(plain.lines.map(canon).sort());
    // Sweep at 0°: centroids march down the page.
    const ys = worn.lines.map((l) => centroid(l).y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
  });

  it('pen tests add one dot swatch per ink', () => {
    const without = generateInkField({ ...base, style: 'stripes' });
    const withDots = generateInkField({ ...base, style: 'stripes', penTests: true });
    expect(withDots.lines.length).toBeGreaterThan(without.lines.length);
    // Dots sit at the bottom-left inside the margin box.
    const extra = withDots.lines.length - without.lines.length;
    expect(extra).toBeGreaterThanOrEqual(3);
  });
});
