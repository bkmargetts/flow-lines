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

  it('is deterministic per style', () => {
    for (const style of ['marks', 'contour', 'streaks', 'slipstream', 'embers'] as const) {
      const a = generateConwayExposure({ ...base, style });
      const b = generateConwayExposure({ ...base, style });
      expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines));
    }
  });

  it('holds history off the present with a halo (fewer marks at larger halo)', () => {
    const tight = generateConwayExposure({ ...base, style: 'marks', haloRadius: 0 });
    const wide = generateConwayExposure({ ...base, style: 'marks', haloRadius: base.cellSize! * 2.5 });
    const history = (r: { lines: { layer?: string }[] }) =>
      r.lines.filter((l) => l.layer !== 'present').length;
    expect(history(wide)).toBeLessThanOrEqual(history(tight));
  });
});
