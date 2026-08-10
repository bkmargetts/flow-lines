import { describe, it, expect } from 'vitest';
import { generateLapidary, LAPIDARY_PRESETS, VEIN_LAYER } from './lapidary/index.js';
import { buildRegions, TUNING_DIM, type LayoutConfig } from './lapidary/layout.js';
import { inkLayerName } from './marbling/index.js';
import type { LapidaryMode } from './lapidary/index.js';

const BASE = { width: 300, height: 400, margin: 20, seed: 42 } as const;
const MODES: LapidaryMode[] = ['agate', 'breccia', 'strata', 'spiral'];

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

  it('stipple ticks scatter blue-noise-like and lean on the band angle', () => {
    // A jittered lattice still reads as a grid; the dart-throwing scatter
    // must hold its minimum spacing. The blank outer ring isolates one
    // band's scatter (cross-band pairs only clear the halo, not the pitch).
    const r = generateLapidary({
      ...BASE,
      bands: 2,
      field: false,
      textures: ['lines', { kind: 'stipple', spacingScale: 1 }, 'blank'],
      spacingPx: 8,
      baseAngleDeg: 90,
      angleDriftDeg: 0,
      wobble: 0,
      optimize: false,
    });
    const pitch = 8 * 1.3; // spacingPx * KIND_SPACING.stipple, contrast pinned
    // A tick spans 2·pitch·(0.045..0.085) ≈ 0.9-1.8px; the carve can
    // re-densify survivors, so filter on length, not point count.
    const arcLen = (l: (typeof r.lines)[number]): number => {
      let len = 0;
      for (let i = 1; i < l.points.length; i++) {
        len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
      }
      return len;
    };
    const ticks = r.lines.filter((l) => arcLen(l) < 2.5);
    expect(ticks.length).toBeGreaterThan(80);
    const centres = ticks.map((l) => {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    });
    let minD = Infinity;
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const d = Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y);
        if (d < minD) minD = d;
      }
    }
    expect(minD).toBeGreaterThan(pitch * 0.6);
    // Directional ticks: every tick leans within ±25° of the band angle.
    for (const l of ticks) {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      let d = Math.abs(Math.atan2(b.y - a.y, b.x - a.x));
      if (d > Math.PI / 2) d = Math.PI - d;
      expect(Math.abs(Math.PI / 2 - d)).toBeLessThan(0.46);
    }
  });

  it('long tapered strokes carry wobble samples along their whole length', () => {
    // Full-height hatch strokes used to hit the shared 40-point densify cap
    // and starve the hand-drawn pass; samples must sit every few px now.
    const r = generateLapidary({ ...BASE, textures: ['hatch'], wobble: 0, optimize: false });
    const step = Math.max(1, (6 * 260) / TUNING_DIM);
    let checked = 0;
    for (const line of r.lines) {
      let len = 0;
      for (let i = 1; i < line.points.length; i++) {
        len += Math.hypot(
          line.points[i].x - line.points[i - 1].x,
          line.points[i].y - line.points[i - 1].y
        );
      }
      if (len < 100) continue;
      checked++;
      for (let i = 1; i < line.points.length; i++) {
        const gap = Math.hypot(
          line.points[i].x - line.points[i - 1].x,
          line.points[i].y - line.points[i - 1].y
        );
        expect(gap).toBeLessThan(step * 2.5);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('crystal wall-reach is stochastic and lands near a fifth of the rays', () => {
    // The wall-reaching rays used to be a literal every-4th counter cycle.
    // taper 0 keeps tips exactly on their dealt reach so the shares separate.
    const r = generateLapidary({
      width: 300,
      height: 300,
      margin: 20,
      seed: 42,
      bands: 2,
      field: false,
      irregularity: 0,
      textures: ['lines', 'blank', 'crystal'],
      taper: 0,
      wobble: 0,
      optimize: false,
    });
    // Rays densify to many points; chevron tips stay 3-point strokes.
    const rays = r.lines.filter((l) => l.points.length > 3);
    expect(rays.length).toBeGreaterThan(40);
    const far = (l: (typeof rays)[number]): number =>
      Math.max(
        Math.hypot(l.points[0].x - 150, l.points[0].y - 150),
        Math.hypot(l.points[l.points.length - 1].x - 150, l.points[l.points.length - 1].y - 150)
      );
    const maxFar = Math.max(...rays.map(far));
    const wall = rays.filter((l) => far(l) > maxFar * 0.99).length;
    expect(wall / rays.length).toBeGreaterThan(0.1);
    expect(wall / rays.length).toBeLessThan(0.35);
  });

  it('seam tone crowds the hatch rows against the band boundary', () => {
    // Single inked disk (blank ring outside isolates it), circle silhouette,
    // vertical strokes → rows advance horizontally. At full seam-tone
    // strength the row pitch (crossing gaps along a horizontal probe through
    // the centre) must tighten toward the rim, where whole rows sit inside
    // the seam ramp.
    const r = generateLapidary({
      width: 300,
      height: 300,
      margin: 20,
      seed: 42,
      bands: 2,
      field: false,
      irregularity: 0,
      textures: ['lines', 'blank', { kind: 'hatch', spacingScale: 1 }],
      spacingPx: 6,
      baseAngleDeg: 90,
      angleDriftDeg: 0,
      toneShape: 'seam',
      toneStrength: 1,
      taper: 0,
      wobble: 0,
      optimize: false,
    });
    const xs: number[] = [];
    for (const line of r.lines) {
      for (let i = 1; i < line.points.length; i++) {
        const a = line.points[i - 1];
        const b = line.points[i];
        const lo = Math.min(a.y, b.y);
        const hi = Math.max(a.y, b.y);
        if (!(lo < 150 && 150 <= hi)) continue;
        const f = Math.abs(b.y - a.y) < 1e-9 ? 0 : (150 - a.y) / (b.y - a.y);
        xs.push(a.x + (b.x - a.x) * f);
      }
    }
    xs.sort((p, q) => p - q);
    expect(xs.length).toBeGreaterThan(20);
    const span = xs[xs.length - 1] - xs[0];
    let rimSum = 0;
    let rimN = 0;
    let midSum = 0;
    let midN = 0;
    for (let i = 1; i < xs.length; i++) {
      const gap = xs[i] - xs[i - 1];
      const pos = (xs[i - 1] + xs[i]) / 2 - xs[0];
      if (pos < span * 0.07 || pos > span * 0.93) {
        rimSum += gap;
        rimN++;
      } else if (pos > span * 0.3 && pos < span * 0.7) {
        midSum += gap;
        midN++;
      }
    }
    expect(rimN).toBeGreaterThan(1);
    expect(midN).toBeGreaterThan(2);
    expect(rimSum / rimN).toBeLessThan((midSum / midN) * 0.75);
  });

  it('tone strength 0 reproduces the flat fill exactly', () => {
    for (const toneShape of ['seam', 'core', 'light', 'noise'] as const) {
      expect(
        JSON.stringify(generateLapidary({ ...BASE, toneShape, toneStrength: 0 }))
      ).toEqual(JSON.stringify(generateLapidary({ ...BASE, toneShape: 'none' })));
    }
  });

  it('tone shapes are deterministic and distinct', () => {
    const hashes = (['none', 'seam', 'core', 'light', 'noise'] as const).map((toneShape) => {
      const opts = { ...BASE, toneShape, toneStrength: 0.8 };
      const a = generateLapidary(opts);
      expect(JSON.stringify(generateLapidary(opts))).toEqual(JSON.stringify(a));
      expect(a.lines.length).toBeGreaterThan(50);
      return JSON.stringify(a.lines);
    });
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('tone never reshuffles the deal: regions, kinds and angles stay put', () => {
    for (const mode of MODES) {
      const flat = buildRegions({ ...layoutFor(mode, 7, 6), toneShape: 'none', toneStrength: 0 });
      const toned = buildRegions({
        ...layoutFor(mode, 7, 6),
        toneShape: 'light',
        toneStrength: 1,
      });
      expect(toned.regions.map((r) => r.z)).toEqual(flat.regions.map((r) => r.z));
      expect(toned.regions.map((r) => r.tex.kind)).toEqual(flat.regions.map((r) => r.tex.kind));
      expect(toned.regions.map((r) => r.tex.angleRad)).toEqual(
        flat.regions.map((r) => r.tex.angleRad)
      );
      expect(toned.regions.map((r) => r.tex.spacing)).toEqual(
        flat.regions.map((r) => r.tex.spacing)
      );
    }
  });

  it('tone never opens paper inside a hatch band', () => {
    // 'light' at full strength is the worst case: one whole flank of every
    // region sits at the tone floor. Row spacing must stay bounded — probe
    // scanline gaps inside the inked disk.
    const r = generateLapidary({
      width: 300,
      height: 300,
      margin: 20,
      seed: 42,
      bands: 2,
      field: false,
      irregularity: 0,
      textures: ['lines', 'blank', { kind: 'hatch', spacingScale: 1 }],
      baseAngleDeg: 90,
      angleDriftDeg: 0,
      toneShape: 'light',
      toneStrength: 1,
      taper: 0,
      wobble: 0,
      optimize: false,
    });
    // The hatch pitch: spacingPx (260/150) * KIND_SPACING.hatch (0.45).
    const pitch = Math.max(1.2, (260 / 150) * 0.45);
    let maxR = 0;
    for (const line of r.lines) {
      for (const p of line.points) {
        maxR = Math.max(maxR, Math.hypot(p.x - 150, p.y - 150));
      }
    }
    // Vertical rows: crossings along a horizontal probe through the centre.
    const xs: number[] = [];
    for (const line of r.lines) {
      for (let i = 1; i < line.points.length; i++) {
        const a = line.points[i - 1];
        const b = line.points[i];
        const lo = Math.min(a.y, b.y);
        const hi = Math.max(a.y, b.y);
        if (!(lo < 150 && 150 <= hi)) continue;
        const f = Math.abs(b.y - a.y) < 1e-9 ? 0 : (150 - a.y) / (b.y - a.y);
        xs.push(a.x + (b.x - a.x) * f);
      }
    }
    xs.sort((p, q) => p - q);
    expect(xs.length).toBeGreaterThan(20);
    for (let i = 1; i < xs.length; i++) {
      // Interior probe only (skip outside the disk); the floor caps row
      // stepping at 2× pitch — allow dash-gap slack on top.
      if (xs[i - 1] < 150 - maxR * 0.85 || xs[i] > 150 + maxR * 0.85) continue;
      expect(xs[i] - xs[i - 1]).toBeLessThan(pitch * 3.2);
    }
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
    taper: 0.7,
    jitterDeg: 1.5,
    toneShape: 'seam',
    toneStrength: 0.35,
    lightAngleDeg: -120,
    faults: 0,
    spiralForm: 'circular',
    spiralDirection: 'inward',
    spiralJoin: 'cells',
    spiralWidth: 0.55,
    spiralTaper: 0.35,
    spiralPulse: 0.35,
    featureScale: 260 / TUNING_DIM,
  });

  it('outlines add strokes but never trace the background field', () => {
    // Outline strokes are also stamped into the avoid mask, so a lower
    // band's clipped slivers can cancel out the added loops in a raw line
    // count ('bands' clamps to 2 — there is no true solo band). Keeping the
    // lower ring blank isolates the outlines: the only ink that can change
    // is the outline strokes themselves.
    const solo = {
      ...BASE,
      bands: 2,
      field: false,
      // Index 0 belongs to the (absent) field; z=1 is the blank outer ring,
      // z=2 the inked inner ring.
      textures: ['lines', 'blank', 'hatch'] as ['lines', 'blank', 'hatch'],
      wobble: 0,
      optimize: false,
    };
    expect(generateLapidary({ ...solo, outlines: true }).lines.length).toBeGreaterThan(
      generateLapidary(solo).lines.length
    );
    const outlined = generateLapidary({ ...BASE, wobble: 0, optimize: false, outlines: true });
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

  it('mottle plots its two families on their own pens', () => {
    // The noise-texture module's riso weave: with two pens the straight
    // grating takes one ink and the weaving grating the other, instead of
    // the stroke-by-stroke interleave every other texture gets.
    const base = {
      ...BASE,
      bands: 1,
      textures: ['mottle'] as ['mottle'],
      patchiness: 0.9,
      wobble: 0,
      optimize: false,
    };
    const r = generateLapidary({ ...base, pens: 2 });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect([...layers].sort()).toEqual([inkLayerName(0), inkLayerName(1)]);
    const share = r.lines.filter((l) => l.layer === inkLayerName(0)).length / r.lines.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
    // One family stays ruled while the other weaves: their long lines'
    // lateral extents separate by a wide margin.
    const medianSpan = (layer: string): number => {
      const spans = r.lines
        .filter((l) => l.layer === layer && l.points.length > 50)
        .map((l) => {
          const xs = l.points.map((p) => p.x);
          return Math.max(...xs) - Math.min(...xs);
        })
        .sort((a, b) => a - b);
      expect(spans.length).toBeGreaterThan(10);
      return spans[Math.floor(spans.length / 2)];
    };
    const m0 = medianSpan(inkLayerName(0));
    const m1 = medianSpan(inkLayerName(1));
    expect(Math.max(m0, m1)).toBeGreaterThan(Math.min(m0, m1) * 3);
    // One pen folds both families onto it.
    const mono = generateLapidary({ ...base, pens: 1 });
    expect(new Set(mono.lines.map((l) => l.layer))).toEqual(new Set([inkLayerName(0)]));
  });

  it('mottle patchiness deepens the tonal clouds', () => {
    // The weave amount is what patchiness buys: near zero the two
    // families hold an almost even interleave, with amplitude the drift
    // terms slide one family across the other until lines stack and
    // cross. Crowding redistributes ink without changing ink-per-area, so
    // the measurable signal is the share of near-zero gaps between
    // successive scanline crossings (stacked pairs) — a full-page single
    // mottle band keeps the lines exactly vertical. The share saturates
    // once the sweep exceeds a pitch, so assert the low-end contrast, not
    // monotonicity.
    const stackedShare = (patchiness: number): number => {
      const r = generateLapidary({
        ...BASE,
        bands: 1,
        textures: ['mottle'],
        patchiness,
        wobble: 0,
        optimize: false,
      });
      const gaps: number[] = [];
      for (const scanY of [120, 200, 280]) {
        const xs: number[] = [];
        for (const line of r.lines) {
          for (let i = 1; i < line.points.length; i++) {
            const a = line.points[i - 1];
            const b = line.points[i];
            // Half-open straddle: a vertex sitting exactly on the scanline
            // must not be counted by both segments that share it.
            const lo = Math.min(a.y, b.y);
            const hi = Math.max(a.y, b.y);
            if (!(lo < scanY && scanY <= hi)) continue;
            const f = Math.abs(b.y - a.y) < 1e-9 ? 0 : (scanY - a.y) / (b.y - a.y);
            xs.push(a.x + (b.x - a.x) * f);
          }
        }
        xs.sort((p, q) => p - q);
        for (let i = 1; i < xs.length; i++) {
          if (xs[i] > BASE.margin + 10 && xs[i] < BASE.width - BASE.margin - 10) {
            gaps.push(xs[i] - xs[i - 1]);
          }
        }
      }
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      return gaps.filter((g) => g < mean * 0.2).length / gaps.length;
    };
    expect(stackedShare(0.05)).toBeLessThan(0.02);
    expect(stackedShare(0.9)).toBeGreaterThan(0.05);
  });

  it('grain dashes stay short and comb along the band angle', () => {
    const spacingPx = 8;
    const spacing = spacingPx * 0.7; // grain's KIND_SPACING baseline
    const r = generateLapidary({
      ...BASE,
      textures: [{ kind: 'grain', spacingScale: 1 }],
      spacingPx,
      baseAngleDeg: 90,
      angleDriftDeg: 0,
      waviness: 0,
      wobble: 0,
      optimize: false,
    });
    expect(r.lines.length).toBeGreaterThan(100);
    for (const line of r.lines) {
      let len = 0;
      for (let i = 1; i < line.points.length; i++) {
        len += Math.hypot(
          line.points[i].x - line.points[i - 1].x,
          line.points[i].y - line.points[i - 1].y
        );
      }
      // Length cap: spacing * (2.2 + 3.8) plus one step of walk overshoot
      // per side — a dash is a mark, never a streamline.
      expect(len).toBeLessThan(spacing * 8.5);
      // At waviness 0 the bend budget is 0.28 rad: every dash chord stays
      // near the vertical base angle.
      const a = line.points[0];
      const b = line.points[line.points.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < spacing) continue;
      let diff = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2) % Math.PI;
      if (diff > Math.PI / 2) diff = Math.PI - diff;
      expect(diff).toBeLessThan(0.4);
    }
  });

  it('mottle and grain are deterministic and distinct', () => {
    for (const kind of ['mottle', 'grain'] as const) {
      const a = generateLapidary({ ...BASE, textures: [kind] });
      const b = generateLapidary({ ...BASE, textures: [kind] });
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
      expect(a.lines.length).toBeGreaterThan(50);
    }
    expect(JSON.stringify(generateLapidary({ ...BASE, textures: ['mottle'] }).lines)).not.toEqual(
      JSON.stringify(generateLapidary({ ...BASE, textures: ['grain'] }).lines)
    );
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

  describe('spiral arrangement', () => {
    const SPIRAL = { ...BASE, mode: 'spiral' as const };

    it('every spiral knob is deterministic and distinct', () => {
      const variants: Partial<Parameters<typeof generateLapidary>[0]>[] = [
        {},
        { spiralForm: 'rectangular' },
        { spiralDirection: 'outward' },
        { spiralJoin: 'blend' },
        { spiralWidth: 0.2 },
        { spiralTaper: -0.9 },
        { spiralPulse: 1 },
        { shapes: 'angular' },
        { spiralForm: 'rectangular', shapes: 'angular' },
        { spiralForm: 'page' },
      ];
      const hashes = variants.map((v) => {
        const a = generateLapidary({ ...SPIRAL, ...v });
        expect(JSON.stringify(generateLapidary({ ...SPIRAL, ...v }))).toEqual(JSON.stringify(a));
        expect(a.lines.length).toBeGreaterThan(50);
        return JSON.stringify(a.lines);
      });
      expect(new Set(hashes).size).toBe(variants.length);
    });

    it('subdivided cells reserve a paper seam (the halo property)', () => {
      // Per-region pens map cell z → pen, so adjacent cells (which abut at
      // the cuts before the carve) land on different pens and the seam is
      // measurable as the min distance between their point sets.
      const haloPx = 8;
      const r = generateLapidary({
        ...SPIRAL,
        haloPx,
        field: false,
        pens: 4,
        penAssignment: 'per-region',
        textures: ['lines', 'hatch'],
        wobble: 0,
        optimize: false,
      });
      const byLayer = new Map<string, { x: number; y: number }[]>();
      for (const line of r.lines) {
        const arr = byLayer.get(line.layer!) ?? [];
        for (let i = 0; i < line.points.length; i += 3) arr.push(line.points[i]);
        byLayer.set(line.layer!, arr);
      }
      const pairs: [string, string][] = [
        [inkLayerName(1), inkLayerName(2)],
        [inkLayerName(2), inkLayerName(3)],
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

    it('blend join lets abutting cells meet without a seam', () => {
      // Same measurement as above: with the seamless join, adjacent cells'
      // hatch runs both end on the shared cut, so different-pen point sets
      // come far closer than any carved seam would allow.
      const r = generateLapidary({
        ...SPIRAL,
        spiralJoin: 'blend',
        haloPx: 8,
        field: false,
        pens: 4,
        penAssignment: 'per-region',
        textures: ['hatch'],
        wobble: 0,
        optimize: false,
      });
      const byLayer = new Map<string, { x: number; y: number }[]>();
      for (const line of r.lines) {
        const arr = byLayer.get(line.layer!) ?? [];
        for (const p of line.points) arr.push(p);
        byLayer.set(line.layer!, arr);
      }
      const a = byLayer.get(inkLayerName(1)) ?? [];
      const b = byLayer.get(inkLayerName(2)) ?? [];
      expect(a.length).toBeGreaterThan(10);
      expect(b.length).toBeGreaterThan(10);
      let min = Infinity;
      for (const p of a) {
        for (const q of b) {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < min) min = d;
        }
      }
      expect(min).toBeLessThan(3);
    });

    it('blend cells still carve the background field', () => {
      // The field draws last (z = 0), so with identical explicit textures
      // the cells are a byte-identical prefix and the field's strokes are
      // the suffix — which must hold a halo off the seamless ribbon.
      const haloPx = 8;
      const base = {
        ...SPIRAL,
        spiralJoin: 'blend' as const,
        haloPx,
        textures: ['lines', 'hatch'] as ['lines', 'hatch'],
        wobble: 0,
        optimize: false,
      };
      const without = generateLapidary({ ...base, field: false });
      const withField = generateLapidary({ ...base, field: true });
      expect(withField.lines.length).toBeGreaterThan(without.lines.length);
      expect(JSON.stringify(withField.lines.slice(0, without.lines.length))).toEqual(
        JSON.stringify(without.lines)
      );
      const cells: { x: number; y: number }[] = [];
      for (const line of without.lines) {
        for (let i = 0; i < line.points.length; i += 3) cells.push(line.points[i]);
      }
      const fieldLines = withField.lines.slice(without.lines.length);
      let min = Infinity;
      for (const line of fieldLines) {
        for (let i = 0; i < line.points.length; i += 3) {
          const p = line.points[i];
          for (const q of cells) {
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < min) min = d;
          }
        }
      }
      expect(min).toBeGreaterThanOrEqual(haloPx * 0.45);
    });

    it('taper sign moves the ink weight between core and rim', () => {
      const coreShare = (spiralTaper: number): number => {
        const r = generateLapidary({
          ...SPIRAL,
          field: false,
          spiralTaper,
          wobble: 0,
          optimize: false,
        });
        let near = 0;
        let total = 0;
        for (const line of r.lines) {
          for (const p of line.points) {
            total++;
            if (Math.hypot(p.x - 150, p.y - 200) < 70) near++;
          }
        }
        expect(total).toBeGreaterThan(1000);
        return near / total;
      };
      expect(coreShare(-0.9)).toBeGreaterThan(coreShare(0.9) * 1.2);
    });

    it('full width closes the windings and the carve still seams the cells', () => {
      // At spiralWidth 1 the reserved inter-winding paper collapses and the
      // ribbon edges meet their neighbours — the coil covers the page, and
      // the only seams left are the ones the halo carve cuts between cells.
      const haloPx = 8;
      const opts = {
        ...SPIRAL,
        spiralWidth: 1,
        spiralTaper: 0,
        spiralPulse: 0,
        haloPx,
        field: false,
        pens: 4,
        penAssignment: 'per-region' as const,
        textures: ['lines', 'hatch'] as ['lines', 'hatch'],
        wobble: 0,
        optimize: false,
      };
      const full = generateLapidary(opts);
      const slim = generateLapidary({ ...opts, spiralWidth: 0.4 });
      const count = (r: typeof full): number => r.lines.reduce((n, l) => n + l.points.length, 0);
      expect(count(full)).toBeGreaterThan(count(slim) * 1.5);
      const byLayer = new Map<string, { x: number; y: number }[]>();
      for (const line of full.lines) {
        const arr = byLayer.get(line.layer!) ?? [];
        for (let i = 0; i < line.points.length; i += 3) arr.push(line.points[i]);
        byLayer.set(line.layer!, arr);
      }
      const pairs: [string, string][] = [
        [inkLayerName(1), inkLayerName(2)],
        [inkLayerName(2), inkLayerName(3)],
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

    it('page form runs the coil flush to the margin rect, corners included', () => {
      // The page form's boundary table IS the margin rectangle — at high
      // width the coil fills the sheet corner to corner while never
      // spilling past the page.
      const r = generateLapidary({
        ...SPIRAL,
        spiralForm: 'page',
        spiralWidth: 1,
        spiralTaper: 0,
        spiralPulse: 0,
        coverage: 1,
        field: false,
        wobble: 0,
        optimize: false,
      });
      expect(r.lines.length).toBeGreaterThan(100);
      const corners = [
        { x: 20, y: 20 },
        { x: 280, y: 20 },
        { x: 280, y: 380 },
        { x: 20, y: 380 },
      ];
      for (const c of corners) {
        let min = Infinity;
        for (const line of r.lines) {
          for (const p of line.points) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(BASE.width);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(BASE.height);
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (d < min) min = d;
          }
        }
        // The adaptive walk chamfers the extreme tip slightly on a tiny
        // page; 20px on this 260px frame still pins corner-reach.
        expect(min, `corner ${c.x},${c.y}`).toBeLessThan(20);
      }
    });

    it('ribbon width scales the ink budget', () => {
      const points = (spiralWidth: number): number => {
        const r = generateLapidary({
          ...SPIRAL,
          field: false,
          spiralWidth,
          wobble: 0,
          optimize: false,
        });
        return r.lines.reduce((n, l) => n + l.points.length, 0);
      };
      expect(points(0.85)).toBeGreaterThan(points(0.2) * 1.15);
    });

    it('width and taper knobs never reshuffle the cells or their textures', () => {
      const a = buildRegions(layoutFor('spiral', 7, 5)).regions;
      const b = buildRegions({
        ...layoutFor('spiral', 7, 5),
        spiralWidth: 0.2,
        spiralTaper: -1,
        spiralPulse: 1,
      }).regions;
      expect(b.length).toBe(a.length);
      expect(b.map((r) => r.z)).toEqual(a.map((r) => r.z));
      expect(b.map((r) => r.tex.kind)).toEqual(a.map((r) => r.tex.kind));
    });

    it('sheds windings gracefully on hostile geometry', () => {
      const hostile = generateLapidary({
        ...SPIRAL,
        bands: 10,
        haloPx: 14,
        spiralWidth: 0.9,
        spiralPulse: 1,
      });
      expect(hostile.lines.length).toBeGreaterThan(20);
      for (const line of hostile.lines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(BASE.width);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(BASE.height);
        }
      }
      const tiny = generateLapidary({ width: 80, height: 80, margin: 10, seed: 42, mode: 'spiral' });
      for (const line of tiny.lines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(80);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(80);
        }
      }
    });

    it('ignores faults and veins', () => {
      expect(
        JSON.stringify(generateLapidary({ ...SPIRAL, faults: 3, veins: true }))
      ).toEqual(JSON.stringify(generateLapidary(SPIRAL)));
    });
  });
});
