import { describe, it, expect } from 'vitest';
import { generateConwayExposure, type ConwayExposureOptions } from './conway/index.js';

const base: ConwayExposureOptions = {
  width: 600,
  height: 600,
  seed: 7,
  generations: 300,
  cellSize: 6,
};

const layersOf = (r: { lines: { layer?: string }[] }) =>
  new Set(r.lines.map((l) => l.layer));

describe('conway exposure render styles', () => {
  it('tags marks with present/ghost/trail layers', () => {
    const r = generateConwayExposure(base);
    const layers = layersOf(r);
    expect(layers.has('present')).toBe(true);
    // a 300-gen run has both faint trails and mid ghosts somewhere
    expect(layers.has('trail') || layers.has('ghost')).toBe(true);
  });

  it('renders contour style as continuous polylines', () => {
    const r = generateConwayExposure({ ...base, style: 'contour' });
    expect(r.lines.length).toBeGreaterThan(0);
    // contours are long chained polylines, not 2-point dashes
    const longest = Math.max(...r.lines.map((l) => l.points.length));
    expect(longest).toBeGreaterThan(6);
    expect(layersOf(r).has('present')).toBe(true);
  });

  it('renders tracked streaks as continuous trail strokes', () => {
    const r = generateConwayExposure({ ...base, style: 'streaks' });
    const trails = r.lines.filter((l) => l.layer === 'trail');
    // the R-pentomino emits gliders by gen 300, so at least one mover track
    expect(trails.length).toBeGreaterThan(0);
    expect(Math.max(...trails.map((l) => l.points.length))).toBeGreaterThan(4);
  });

  it('renders slipstream style as continuous flow streamlines', () => {
    const r = generateConwayExposure({ ...base, style: 'slipstream' });
    expect(r.lines.length).toBeGreaterThan(0);
    // streamlines are long chained polylines, not 2-point dashes
    const longest = Math.max(...r.lines.map((l) => l.points.length));
    expect(longest).toBeGreaterThan(6);
    expect(layersOf(r).has('present')).toBe(true);
    // history flows as fine streamlines tagged trail/ghost
    expect(layersOf(r).has('trail') || layersOf(r).has('ghost')).toBe(true);
  });

  it('renders embers style as a scattered stipple field', () => {
    // Skip endpoint chaining so the raw stipple ticks survive intact.
    const r = generateConwayExposure({ ...base, style: 'embers', optimize: false });
    const history = r.lines.filter((l) => l.layer !== 'present');
    // many small marks, each a 2-point tick
    expect(history.length).toBeGreaterThan(20);
    expect(history.every((l) => l.points.length === 2)).toBe(true);
    expect(layersOf(r).has('present')).toBe(true);
  });

  it('denser stipple draws more dots', () => {
    const sparse = generateConwayExposure({ ...base, style: 'embers', stippleDensity: 3, optimize: false });
    const dense = generateConwayExposure({ ...base, style: 'embers', stippleDensity: 12, optimize: false });
    const history = (r: { lines: { layer?: string }[] }) =>
      r.lines.filter((l) => l.layer !== 'present').length;
    expect(history(dense)).toBeGreaterThan(history(sparse));
  });

  it('renders weave style as band layers plus the present', () => {
    const r = generateConwayExposure({ ...base, style: 'weave' });
    const layers = layersOf(r);
    expect(layers.has('present')).toBe(true);
    expect(layers.has('band-00')).toBe(true);
    expect(layers.has('band-01')).toBe(true);
    expect(layers.has('band-02')).toBe(true);
    expect(layers.has('band-03')).toBe(false);
    // no ghost/trail pens — the grating carries the whole history
    expect(layers.has('ghost')).toBe(false);
    expect(layers.has('trail')).toBe(false);
  });

  it('weave ink count sets the number of band layers', () => {
    const r = generateConwayExposure({ ...base, style: 'weave', weaveInks: 2 });
    const layers = layersOf(r);
    expect(layers.has('band-00')).toBe(true);
    expect(layers.has('band-01')).toBe(true);
    expect(layers.has('band-02')).toBe(false);
  });

  it('weave with all disturbances at zero is a perfect ruling with coincident inks', () => {
    // Full coverage and no halo: the feather stop-jitter is per-ruling+ink by
    // design, so byte-identical ink geometry only holds with clipping off.
    const r = generateConwayExposure({
      ...base,
      style: 'weave',
      weaveForm: 'grating',
      weaveCoverage: 1,
      haloRadius: 0,
      weaveSeparation: 0,
      weaveVernier: 0,
      weaveBend: 0,
      weavePitchSwell: 0,
      weaveWobble: 0,
      wobble: 0,
      optimize: false,
    });
    const bands = r.lines.filter((l) => l.layer?.startsWith('band-'));
    expect(bands.length).toBeGreaterThan(0);
    // Every ruling is collinear: max perpendicular deviation from its chord ~0.
    for (const line of bands) {
      const a = line.points[0];
      const b = line.points[line.points.length - 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (const p of line.points) {
        const dev = Math.abs(((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len);
        expect(dev).toBeLessThan(1e-6);
      }
    }
    // The inks are byte-identical rulings — calm paper keeps them registered.
    const geom = (k: string) =>
      JSON.stringify(r.lines.filter((l) => l.layer === k).map((l) => l.points));
    expect(geom('band-00')).toBe(geom('band-01'));
  });

  it('weave disturbs the ruling near the trails', () => {
    const r = generateConwayExposure({
      ...base,
      style: 'weave',
      weaveForm: 'grating',
      weaveCoverage: 1,
      weaveWobble: 0,
      wobble: 0,
      optimize: false,
    });
    const bands = r.lines.filter((l) => l.layer?.startsWith('band-'));
    let maxDev = 0;
    for (const line of bands) {
      const a = line.points[0];
      const b = line.points[line.points.length - 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (const p of line.points) {
        const dev = Math.abs(((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len);
        if (dev > maxDev) maxDev = dev;
      }
    }
    expect(maxDev).toBeGreaterThan(0.5);
  });

  it('weave coverage scales the calm field monotonically', () => {
    const bandLength = (cov: number): number => {
      const r = generateConwayExposure({
        ...base,
        style: 'weave',
        weaveForm: 'grating',
        weaveCoverage: cov,
        optimize: false,
      });
      let len = 0;
      for (const l of r.lines) {
        if (!l.layer?.startsWith('band-')) continue;
        for (let i = 1; i < l.points.length; i++) {
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
      }
      return len;
    };
    const a0 = bandLength(0);
    const a05 = bandLength(0.5);
    const a1 = bandLength(1);
    expect(a0).toBeLessThan(a05);
    expect(a05).toBeLessThan(a1);
    expect(a0).toBeGreaterThan(0); // trails still recruit ink from blank paper
  });

  it('weave holds the grating off the present on a smooth halo', () => {
    const r = generateConwayExposure({
      ...base,
      style: 'weave',
      weaveForm: 'grating',
      weaveCoverage: 1,
      weaveSeparation: 0,
      weaveVernier: 0,
      weaveBend: 0,
      weavePitchSwell: 0,
      weaveWobble: 0,
      wobble: 0,
      optimize: false,
    });
    const cell = base.cellSize!;
    // Spatial hash of every present-layer point (silhouette, hatch, residue
    // squares); the reserved-paper radius keeps band points clear of all of it.
    const grid = new Map<string, { x: number; y: number }[]>();
    const gridKey = (x: number, y: number): string => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    for (const l of r.lines) {
      if (l.layer !== 'present') continue;
      for (const p of l.points) {
        const key = gridKey(p.x, p.y);
        const arr = grid.get(key) ?? [];
        arr.push(p);
        grid.set(key, arr);
      }
    }
    let minDist = Infinity;
    for (const l of r.lines) {
      if (!l.layer?.startsWith('band-')) continue;
      for (const p of l.points) {
        const gx = Math.floor(p.x / cell);
        const gy = Math.floor(p.y / cell);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const arr = grid.get(`${gx + dx},${gy + dy}`);
            if (!arr) continue;
            for (const q of arr) {
              const d = Math.hypot(p.x - q.x, p.y - q.y);
              if (d < minDist) minDist = d;
            }
          }
        }
      }
    }
    expect(minDist).toBeGreaterThan(cell * 0.15);
  });

  it('weave rings form emits organic loop geometry', () => {
    // Halo clipping off: the property under test is the ring geometry itself,
    // and at this small fixture the halos chop every loop into open arcs.
    const r = generateConwayExposure({
      ...base,
      style: 'weave',
      weaveForm: 'rings',
      haloRadius: 0,
      optimize: false,
    });
    const bands = r.lines.filter((l) => l.layer?.startsWith('band-'));
    expect(bands.length).toBeGreaterThan(0);
    // At least one ripple survives as a long near-closed loop.
    const loopy = bands.some((l) => {
      if (l.points.length < 16) return false;
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y) < 2 * base.cellSize!;
    });
    expect(loopy).toBe(true);
  });

  it('is deterministic per style', () => {
    for (const style of ['marks', 'contour', 'streaks', 'slipstream', 'embers', 'weave'] as const) {
      const a = generateConwayExposure({ ...base, style });
      const b = generateConwayExposure({ ...base, style });
      expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    }
    // The weave default is rings; pin the grating form explicitly too.
    const a = generateConwayExposure({ ...base, style: 'weave', weaveForm: 'grating' });
    const b = generateConwayExposure({ ...base, style: 'weave', weaveForm: 'grating' });
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
  });

  it('holds history off the present with a halo (fewer marks at larger halo)', () => {
    const tight = generateConwayExposure({ ...base, style: 'marks', haloRadius: 0 });
    const wide = generateConwayExposure({ ...base, style: 'marks', haloRadius: base.cellSize! * 2.5 });
    const history = (r: { lines: { layer?: string }[] }) =>
      r.lines.filter((l) => l.layer !== 'present').length;
    expect(history(wide)).toBeLessThanOrEqual(history(tight));
  });
});
