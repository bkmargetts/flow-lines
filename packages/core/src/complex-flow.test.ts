import { describe, it, expect } from 'vitest';
import { generateComplexFlow, type ComplexFlowOptions, type SingularityLayout } from './complex-flow.js';
import { toSVGLayers } from './svg.js';

const base: ComplexFlowOptions = {
  width: 400,
  height: 400,
  seed: 42,
  zeroCount: 3,
  poleCount: 2,
  zeroLayout: 'ring',
  poleLayout: 'ring',
  singularitySpread: 0.7,
  planeScale: 1,
  fieldRotation: 0,
  seedCount: 200,
  seedLayout: 'multiRing',
  stepsPerDir: 120,
  stepLength: 2,
  stepJitter: 0.5,
  wobble: 0,
  speedClampMax: 1e3,
  minLineLength: 8,
  margin: 20,
  layerCount: 5,
  layerBy: 'seedBand',
};

describe('generateComplexFlow', () => {
  it('produces streamlines and echoes dimensions/seed', () => {
    const r = generateComplexFlow(base);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.width).toBe(400);
    expect(r.height).toBe(400);
    expect(r.seed).toBe(42);
  });

  it('is deterministic for the same seed', () => {
    const a = generateComplexFlow(base);
    const b = generateComplexFlow(base);
    expect(a.lines.length).toBe(b.lines.length);
    expect(a.lines[0].points).toEqual(b.lines[0].points);
  });

  it('differs for different seeds', () => {
    const a = generateComplexFlow({ ...base, seedLayout: 'random', seed: 111 });
    const b = generateComplexFlow({ ...base, seedLayout: 'random', seed: 222 });
    expect(a.lines[0].points[0]).not.toEqual(b.lines[0].points[0]);
  });

  it('keeps every point inside the margin', () => {
    const m = 40;
    const r = generateComplexFlow({ ...base, margin: m, wobble: 0 });
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(m);
        expect(p.x).toBeLessThanOrEqual(400 - m);
        expect(p.y).toBeGreaterThanOrEqual(m);
        expect(p.y).toBeLessThanOrEqual(400 - m);
      }
    }
  });

  it('traces bidirectionally — the seed lands in the interior of the streamline', () => {
    // One zero at the origin: f(z)=z → radial flow, so forward and backward both
    // advance. Seed off-centre so neither half is empty.
    const r = generateComplexFlow({
      ...base,
      zeroCount: 1,
      zeroLayout: 'grid', // a single grid point sits at the origin
      poleCount: 0,
      seedCount: 4, // quartered grid → seeds sit off the centred zero
      seedLayout: 'grid',
      stepJitter: 0,
      wobble: 0,
      minLineLength: 1,
    });
    const pts = r.lines[0].points;
    const n = pts.length;
    // The seed join sits in the middle of the array; both halves contributing
    // means n > 2 and the two endpoints are distinct extremes of the streamline.
    expect(n).toBeGreaterThan(2);
    expect(pts[0]).not.toEqual(pts[n - 1]);
  });

  it('produces no NaN/Infinity even with a seed near a pole', () => {
    const r = generateComplexFlow({
      ...base,
      zeroCount: 0,
      poleCount: 1,
      poleLayout: 'grid', // pole at origin == canvas centre
      seedLayout: 'grid',
      seedCount: 50,
      minLineLength: 0,
    });
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('steps at constant speed when jitter and wobble are off', () => {
    const r = generateComplexFlow({
      ...base,
      stepJitter: 0,
      wobble: 0,
      seedCount: 30,
    });
    const line = r.lines.find((l) => l.points.length > 5)!;
    const pts = line.points;
    // Interior segments (skip the seed-join in the middle and the clipped ends).
    for (let i = 2; i < pts.length - 2; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      expect(d).toBeGreaterThan(base.stepLength - 0.5);
      expect(d).toBeLessThan(base.stepLength + 0.5);
    }
  });

  it('assigns colour bands within layerCount', () => {
    const r = generateComplexFlow({ ...base, layerCount: 4, layerBy: 'seedBand' });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.size).toBeGreaterThan(1);
    for (const layer of layers) {
      expect(['band-00', 'band-01', 'band-02', 'band-03']).toContain(layer);
    }
  });

  it('runs for every singularity layout', () => {
    const layouts: SingularityLayout[] = ['ring', 'grid', 'parabola', 'random'];
    for (const layout of layouts) {
      const r = generateComplexFlow({ ...base, zeroLayout: layout, poleLayout: layout });
      expect(r.lines.length).toBeGreaterThan(0);
    }
  });

  it('honours manual pixel singularities', () => {
    const withManual = generateComplexFlow({
      ...base,
      zeroCount: 0,
      poleCount: 0,
      manualZerosPx: [{ x: 150, y: 150 }],
      manualPolesPx: [{ x: 250, y: 250 }],
      seedLayout: 'random',
    });
    const without = generateComplexFlow({
      ...base,
      zeroCount: 0,
      poleCount: 0,
      seedLayout: 'random',
    });
    // With no singularities at all the field is constant (straight lines); the
    // manual pair bends it, so the geometry must differ.
    expect(withManual.lines[0].points).not.toEqual(without.lines[0].points);
  });

  it('exports one ascending-ordered SVG per band layer', () => {
    const r = generateComplexFlow({ ...base, layerCount: 3 });
    const palette: Record<string, string> = {
      'band-00': '#d7263d',
      'band-01': '#ffd23f',
      'band-02': '#1b998b',
    };
    const svgs = toSVGLayers(r, { layerColors: palette });
    const order = svgs.map((s) => s.layer);
    expect(order).toEqual([...order].sort());
  });
});
