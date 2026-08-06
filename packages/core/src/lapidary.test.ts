import { describe, it, expect } from 'vitest';
import { generateLapidary, LAPIDARY_PRESETS } from './lapidary/index.js';
import { inkLayerName } from './marbling/index.js';
import type { LapidaryMode } from './lapidary/index.js';

const BASE = { width: 300, height: 400, margin: 20, seed: 42 } as const;
const MODES: LapidaryMode[] = ['agate', 'breccia', 'strata'];

describe('generateLapidary', () => {
  it('is deterministic for the same seed and options', () => {
    for (const mode of MODES) {
      const a = generateLapidary({ ...BASE, mode });
      const b = generateLapidary({ ...BASE, mode });
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    }
  });

  it('produces different drawings for different seeds and modes', () => {
    const a = generateLapidary({ ...BASE, seed: 42 });
    const b = generateLapidary({ ...BASE, seed: 1337 });
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
    const hashes = MODES.map((mode) => JSON.stringify(generateLapidary({ ...BASE, mode }).lines));
    expect(new Set(hashes).size).toBe(MODES.length);
  });

  it('keeps every point inside the page for every mode', () => {
    for (const mode of MODES) {
      const r = generateLapidary({ ...BASE, mode });
      expect(r.lines.length).toBeGreaterThan(50);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(BASE.width);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(BASE.height);
        }
      }
    }
  });

  it('tags strokes only with the configured pen layers', () => {
    const r = generateLapidary({ ...BASE, pens: 3 });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect([...layers].sort()).toEqual([inkLayerName(0), inkLayerName(1), inkLayerName(2)]);
    const mono = generateLapidary({ ...BASE, pens: 1 });
    expect(new Set(mono.lines.map((l) => l.layer))).toEqual(new Set([inkLayerName(0)]));
  });

  it('interleaves pens within a region rather than blocking them', () => {
    // The reference's black/orange field alternates stroke-by-stroke: in a
    // two-pen interleave, both pens must appear all over the sheet, so each
    // pen's share stays near half rather than one pen owning whole regions.
    const r = generateLapidary({ ...BASE, pens: 2, penAssignment: 'interleave', wobble: 0, optimize: false });
    const count0 = r.lines.filter((l) => l.layer === inkLayerName(0)).length;
    const share = count0 / r.lines.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it('reserves a paper seam between adjacent regions (the halo property)', () => {
    // Per-region pens map region → layer, so the seam is measurable as the
    // minimum distance between adjacent regions' point sets. The mask raster
    // quantizes the seam edge at ~cellPx, so assert a conservative fraction
    // of the requested halo — this guards against gross seam bridging, the
    // one defect that destroys the layered-stencil look.
    const haloPx = 8;
    const r = generateLapidary({
      ...BASE,
      mode: 'agate',
      bands: 3,
      pens: 4,
      penAssignment: 'per-region',
      textures: ['lines', 'hatch', 'lines'],
      haloPx,
      wobble: 0,
      optimize: false,
    });
    const byLayer = new Map<string, { x: number; y: number }[]>();
    for (const line of r.lines) {
      const key = line.layer ?? 'default';
      const arr = byLayer.get(key) ?? [];
      for (let i = 0; i < line.points.length; i += 3) arr.push(line.points[i]);
      byLayer.set(key, arr);
    }
    const pairs: [string, string][] = [
      [inkLayerName(0), inkLayerName(1)],
      [inkLayerName(1), inkLayerName(2)],
    ];
    for (const [la, lb] of pairs) {
      const a = byLayer.get(la) ?? [];
      const b = byLayer.get(lb) ?? [];
      expect(a.length).toBeGreaterThan(10);
      expect(b.length).toBeGreaterThan(10);
      let min = Infinity;
      for (const p of a) {
        for (const q of b) {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < min) min = d;
        }
      }
      expect(min).toBeGreaterThanOrEqual(haloPx * 0.45);
    }
  });

  it('wobble stays capped below the seam width', () => {
    // Same geometry with the default wobble on: the maxDisplacement clamp
    // must keep the seam from closing to a sliver.
    const haloPx = 8;
    const opts = {
      ...BASE,
      mode: 'agate' as const,
      bands: 3,
      pens: 4,
      penAssignment: 'per-region' as const,
      textures: ['lines', 'hatch', 'lines'] as ['lines', 'hatch', 'lines'],
      haloPx,
      optimize: false,
    };
    const r = generateLapidary(opts);
    const a: { x: number; y: number }[] = [];
    const b: { x: number; y: number }[] = [];
    for (const line of r.lines) {
      const arr = line.layer === inkLayerName(0) ? a : line.layer === inkLayerName(1) ? b : null;
      if (!arr) continue;
      for (let i = 0; i < line.points.length; i += 3) arr.push(line.points[i]);
    }
    let min = Infinity;
    for (const p of a) {
      for (const q of b) {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < min) min = d;
      }
    }
    // Both sides may each spend haloPx*0.35 of wobble budget.
    expect(min).toBeGreaterThanOrEqual(haloPx * 0.45 - 2 * haloPx * 0.35);
    expect(min).toBeGreaterThan(0.5);
  });

  it('renders every preset with substance', () => {
    for (const [name, preset] of Object.entries(LAPIDARY_PRESETS)) {
      const r = generateLapidary({ ...BASE, ...preset });
      expect(r.lines.length, name).toBeGreaterThan(200);
    }
  });

  it('cycles a short texture list across all bands', () => {
    const r = generateLapidary({ ...BASE, bands: 6, textures: ['lines'] });
    expect(r.lines.length).toBeGreaterThan(100);
  });

  it('respects optimize: false', () => {
    const a = generateLapidary({ ...BASE, optimize: false });
    const b = generateLapidary({ ...BASE, optimize: true });
    expect(a.lines.length).toBeGreaterThanOrEqual(b.lines.length);
  });

  it('returns empty output when the margin swallows the page', () => {
    const r = generateLapidary({ width: 40, height: 40, margin: 15, seed: 42 });
    expect(r.lines).toEqual([]);
  });
});
