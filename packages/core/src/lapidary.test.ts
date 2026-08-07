import { describe, it, expect } from 'vitest';
import { generateLapidary, LAPIDARY_PRESETS, VEIN_LAYER } from './lapidary/index.js';
import { buildRegions, TUNING_DIM, type LayoutConfig } from './lapidary/layout.js';
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

  it('field: false drops the background band, leaving the shapes on paper', () => {
    const withField = generateLapidary({ ...BASE, textures: ['lines'] });
    const without = generateLapidary({ ...BASE, textures: ['lines'], field: false });
    expect(without.lines.length).toBeGreaterThan(50);
    expect(without.lines.length).toBeLessThan(withField.lines.length);
    // Without the full-frame band nothing reaches the margin corners.
    const corner = without.lines.some((l) =>
      l.points.some((p) => p.x < BASE.margin + 10 && p.y < BASE.margin + 10)
    );
    expect(corner).toBe(false);
  });

  it('shape languages are deterministic and distinct', () => {
    for (const shapes of ['angular', 'mixed'] as const) {
      const a = generateLapidary({ ...BASE, shapes });
      const b = generateLapidary({ ...BASE, shapes });
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
      expect(a.lines.length).toBeGreaterThan(50);
    }
    const organic = generateLapidary({ ...BASE });
    const angular = generateLapidary({ ...BASE, shapes: 'angular' });
    expect(JSON.stringify(organic.lines)).not.toEqual(JSON.stringify(angular.lines));
    for (const mode of MODES) {
      const r = generateLapidary({ ...BASE, mode, shapes: 'angular' });
      expect(r.lines.length).toBeGreaterThan(50);
    }
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

  it('contour strokes follow the band silhouette', () => {
    // Zero irregularity on a square page makes every ring a circle, and
    // waviness: 0 is the documented way to switch off the contour bands'
    // undulation — so a silhouette-following loop keeps a near-constant
    // distance to the centre along its whole length; straight hatching
    // would sweep the ring's full radial extent.
    const opts = {
      width: 300,
      height: 300,
      margin: 20,
      seed: 42,
      bands: 3,
      field: false,
      irregularity: 0,
      textures: ['contour' as const],
      wobble: 0,
      waviness: 0,
      optimize: false,
    };
    const r = generateLapidary(opts);
    expect(r.lines.length).toBeGreaterThan(20);
    for (const line of r.lines) {
      const radii = line.points.map((p) => Math.hypot(p.x - 150, p.y - 150));
      expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(3);
    }
    expect(JSON.stringify(generateLapidary(opts))).toEqual(JSON.stringify(r));
  });

  it('renders contour in every mode and on the field without throwing', () => {
    for (const mode of MODES) {
      const r = generateLapidary({ ...BASE, mode, textures: ['contour'] });
      expect(r.lines.length).toBeGreaterThan(50);
    }
  });

  it('crystal rays radiate from the band centre', () => {
    const r = generateLapidary({
      width: 300,
      height: 300,
      margin: 20,
      seed: 42,
      bands: 2,
      field: false,
      irregularity: 0,
      textures: ['crystal'],
      wobble: 0,
      optimize: false,
    });
    expect(r.lines.length).toBeGreaterThan(30);
    // Rays point at the centre; chevron tips (the short 3-point strokes)
    // deliberately don't, so the property holds for the large majority.
    let radial = 0;
    for (const line of r.lines) {
      const a = line.points[0];
      const b = line.points[line.points.length - 1];
      const dir = Math.atan2(b.y - a.y, b.x - a.x);
      const toCentre = Math.atan2(150 - a.y, 150 - a.x);
      let diff = Math.abs(dir - toCentre) % Math.PI;
      if (diff > Math.PI / 2) diff = Math.PI - diff;
      if (diff < (15 * Math.PI) / 180) radial++;
    }
    expect(radial / r.lines.length).toBeGreaterThan(0.6);
  });

  it('breccia veins land on the dedicated vein layer and only add strokes', () => {
    const base = { ...BASE, mode: 'breccia' as const, pens: 3, wobble: 0, optimize: false };
    const without = generateLapidary(base);
    const withVeins = generateLapidary({ ...base, veins: true });
    expect(withVeins.lines.length).toBeGreaterThan(without.lines.length);
    // Veins append after the carve: the carved drawing is untouched.
    expect(JSON.stringify(withVeins.lines.slice(0, without.lines.length))).toEqual(
      JSON.stringify(without.lines)
    );
    const veins = withVeins.lines.slice(without.lines.length);
    for (const line of veins) expect(line.layer).toBe(VEIN_LAYER);
    for (const line of veins) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(BASE.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(BASE.height);
      }
    }
  });

  it('strata faults shift the beds without touching faults: 0', () => {
    const base = { ...BASE, mode: 'strata' as const };
    expect(JSON.stringify(generateLapidary({ ...base, faults: 0 }))).toEqual(
      JSON.stringify(generateLapidary(base))
    );
    const faulted = generateLapidary({ ...base, faults: 2 });
    expect(JSON.stringify(faulted.lines)).not.toEqual(
      JSON.stringify(generateLapidary(base).lines)
    );
    expect(JSON.stringify(generateLapidary({ ...base, faults: 2 }))).toEqual(
      JSON.stringify(faulted)
    );
    for (const line of faulted.lines) {
      for (const p of line.points) {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(BASE.height);
      }
    }
  });

  it('scales stipple tick length with the line pitch', () => {
    // Ticks used to be an absolute px length; they must ride the pitch so
    // dots keep their weight on big sheets.
    const medianTick = (spacingPx: number): number => {
      const r = generateLapidary({
        ...BASE,
        textures: ['stipple'],
        spacingPx,
        wobble: 0,
        optimize: false,
      });
      const lens = r.lines
        .map((l) => {
          let len = 0;
          for (let i = 1; i < l.points.length; i++) {
            len += Math.hypot(
              l.points[i].x - l.points[i - 1].x,
              l.points[i].y - l.points[i - 1].y
            );
          }
          return len;
        })
        .sort((a, b) => a - b);
      return lens[Math.floor(lens.length / 2)];
    };
    const at4 = medianTick(4);
    const at12 = medianTick(12);
    expect(at12 / at4).toBeGreaterThan(2);
    expect(at12 / at4).toBeLessThan(4.5);
  });

  // Mirrors generateLapidary's option resolution at BASE geometry.
  const layoutFor = (mode: LayoutConfig['mode'], seed: number, bands: number): LayoutConfig => ({
    seed,
    mode,
    rect: { x0: 20, y0: 20, x1: 280, y1: 380 },
    bands,
    field: true,
    shapes: 'organic',
    irregularity: 0.55,
    coverage: 0.9,
    centerX: 0,
    centerY: 0,
    haloPx: Math.max(1.5, 260 / 110),
    spacingPx: Math.max(1.2, 260 / 150),
    baseAngleDeg: 90,
    angleDriftDeg: 25,
    densityContrast: 0.6,
    waviness: 0.5,
    patchiness: 0.55,
    faults: 0,
    featureScale: 260 / TUNING_DIM,
  });

  it('outlines add strokes but never trace the background field', () => {
    const base = { ...BASE, wobble: 0, optimize: false };
    const plain = generateLapidary(base);
    const outlined = generateLapidary({ ...base, outlines: true });
    expect(outlined.lines.length).toBeGreaterThan(plain.lines.length);
    // The field's silhouette is the margin rect: an outlined field would put
    // a stroke through several of its corners exactly (wobble is off).
    const corners = [
      { x: 20, y: 20 },
      { x: 280, y: 20 },
      { x: 280, y: 380 },
      { x: 20, y: 380 },
    ];
    for (const line of outlined.lines) {
      let hit = 0;
      for (const c of corners) {
        if (line.points.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 1)) hit++;
      }
      expect(hit).toBeLessThan(3);
    }
  });

  it('coverage scales the outermost silhouette', () => {
    const reach = (coverage: number): number => {
      const r = generateLapidary({ ...BASE, field: false, coverage, wobble: 0, optimize: false });
      let max = 0;
      for (const line of r.lines) {
        for (const p of line.points) {
          max = Math.max(max, Math.hypot(p.x - 150, p.y - 200));
        }
      }
      return max;
    };
    expect(reach(0.95)).toBeGreaterThan(reach(0.7));
    expect(reach(0.7)).toBeGreaterThan(reach(0.5));
  });

  it('centre offsets move the composition', () => {
    const centroid = (opts: Partial<Parameters<typeof generateLapidary>[0]>) => {
      const r = generateLapidary({ ...BASE, field: false, wobble: 0, optimize: false, ...opts });
      let x = 0;
      let y = 0;
      let n = 0;
      for (const line of r.lines) {
        for (const p of line.points) {
          x += p.x;
          y += p.y;
          n++;
        }
      }
      return { x: x / n, y: y / n };
    };
    const at0 = centroid({});
    const shifted = centroid({ centerX: 0.3, centerY: -0.3 });
    expect(shifted.x).toBeGreaterThan(at0.x + 5);
    expect(shifted.y).toBeLessThan(at0.y - 5);
  });

  it('refMinDim only binds below the page size', () => {
    const plain = generateLapidary(BASE);
    const unclamped = generateLapidary({ ...BASE, refMinDim: 10_000 });
    expect(JSON.stringify(unclamped)).toEqual(JSON.stringify(plain));
    const clamped = generateLapidary({ ...BASE, refMinDim: 130 });
    expect(JSON.stringify(clamped.lines)).not.toEqual(JSON.stringify(plain.lines));
  });

  it('angle drift 0 keeps every ruled line on the base angle', () => {
    const r = generateLapidary({
      ...BASE,
      textures: ['lines'],
      baseAngleDeg: 90,
      angleDriftDeg: 0,
      wobble: 0,
      optimize: false,
    });
    expect(r.lines.length).toBeGreaterThan(50);
    for (const line of r.lines) {
      for (let i = 1; i < line.points.length; i++) {
        const dx = Math.abs(line.points[i].x - line.points[i - 1].x);
        const dy = Math.abs(line.points[i].y - line.points[i - 1].y);
        expect(dx).toBeLessThan(dy * 0.02 + 0.01);
      }
    }
  });

  it('density contrast spreads the band pitches', () => {
    const flat = generateLapidary({ ...BASE, densityContrast: 0 });
    const spread = generateLapidary({ ...BASE, densityContrast: 1 });
    expect(JSON.stringify(flat.lines)).not.toEqual(JSON.stringify(spread.lines));
  });

  it('ignores veins outside breccia and field in strata', () => {
    for (const mode of ['agate', 'strata'] as const) {
      const off = generateLapidary({ ...BASE, mode, veins: false });
      const on = generateLapidary({ ...BASE, mode, veins: true });
      expect(JSON.stringify(on)).toEqual(JSON.stringify(off));
    }
    const withField = generateLapidary({ ...BASE, mode: 'strata', field: true });
    const without = generateLapidary({ ...BASE, mode: 'strata', field: false });
    expect(JSON.stringify(without)).toEqual(JSON.stringify(withField));
  });

  it('renders per-region pens with fewer regions than pens', () => {
    const r = generateLapidary({ ...BASE, bands: 2, pens: 4, penAssignment: 'per-region' });
    expect(r.lines.length).toBeGreaterThan(20);
    const allowed = new Set([0, 1, 2, 3].map((g) => inkLayerName(g)));
    for (const line of r.lines) expect(allowed.has(line.layer!)).toBe(true);
  });

  it('delivers the requested region count in agate and breccia', () => {
    // Agate used to drop rings whose clamped table collapsed and breccia
    // could exhaust its placement budget — both silently under-delivering
    // on `bands`. The grow-retry / relaxed second phase must close the gap
    // at ordinary settings.
    for (const mode of ['agate', 'breccia'] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const { regions } = buildRegions(layoutFor(mode, seed, 8));
        expect(regions.length, `${mode} seed ${seed}`).toBe(8);
      }
    }
  });

  it('degrades gracefully when the geometry cannot fit the request', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const { regions } = buildRegions({
        ...layoutFor('agate', seed, 10),
        coverage: 0.4,
        haloPx: 12,
      });
      expect(regions.length).toBeGreaterThanOrEqual(2);
      expect(regions.length).toBeLessThanOrEqual(10);
    }
  });
});
