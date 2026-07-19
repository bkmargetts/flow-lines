import { describe, it, expect } from 'vitest';
import { generateFracture, simulateFracture, type FractureSimParams } from './fracture/index.js';
import { createNoise } from './noise.js';
import { makeRandom } from './lib/rng.js';
import { polylineLength } from './lib/spatial.js';

const SIM: FractureSimParams = {
  x0: 20,
  y0: 20,
  x1: 280,
  y1: 380,
  generations: 3,
  crackDensity: 0.45,
  stressScale: 0.35,
  straightness: 0.75,
  jitter: 0.5,
  anisotropy: 0,
  anisotropyAngle: Math.PI / 2,
  arrestThreshold: 0.25,
  captureRadius: 6,
  edgeNucleation: 0,
  step: 2,
};

function runSim(params: FractureSimParams, seed: number) {
  return simulateFracture(params, makeRandom(seed), createNoise(seed), createNoise(seed + 8101));
}

describe('simulateFracture', () => {
  it('junctions land near perpendicular (the T-junction screening rule)', () => {
    const sim = runSim(SIM, 42);
    expect(sim.junctions.length).toBeGreaterThan(20);
    const diffs = sim.junctions.map((j) => Math.abs(j.angleDiffDeg - 90));
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const within30 = diffs.filter((d) => d <= 30).length / diffs.length;
    // Loose thresholds — these pin the behaviour, not the tuning.
    expect(mean).toBeLessThan(25);
    expect(within30).toBeGreaterThan(0.6);
  });

  it('grows a hierarchy: primary cracks run longer than the finest generation', () => {
    const sim = runSim(SIM, 42);
    const meanLen = (gen: number) => {
      const cs = sim.cracks.filter((c) => c.generation === gen);
      expect(cs.length).toBeGreaterThan(0);
      return cs.reduce((a, c) => a + polylineLength(c.points), 0) / cs.length;
    };
    expect(meanLen(0)).toBeGreaterThan(meanLen(2));
  });

  it('more generations grow a bigger network', () => {
    const one = runSim({ ...SIM, generations: 1 }, 42);
    const three = runSim({ ...SIM, generations: 3 }, 42);
    expect(three.cracks.length).toBeGreaterThan(one.cracks.length);
  });

  it('keeps every crack inside the frame', () => {
    const sim = runSim(SIM, 1337);
    for (const c of sim.cracks) {
      for (const p of c.points) {
        expect(p.x).toBeGreaterThanOrEqual(SIM.x0 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(SIM.x1 + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(SIM.y0 - 1e-6);
        expect(p.y).toBeLessThanOrEqual(SIM.y1 + 1e-6);
      }
    }
  });
});

describe('generateFracture', () => {
  it('is deterministic per seed', () => {
    const a = generateFracture({ width: 300, height: 400, margin: 20, seed: 42 });
    const b = generateFracture({ width: 300, height: 400, margin: 20, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds draw different networks', () => {
    const a = generateFracture({ width: 300, height: 400, margin: 20, seed: 42 });
    const b = generateFracture({ width: 300, height: 400, margin: 20, seed: 43 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('stays on the page (wobble included)', () => {
    const r = generateFracture({ width: 300, height: 400, margin: 20, seed: 7 });
    expect(r.lines.length).toBeGreaterThan(0);
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(300);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(400);
      }
    }
  });

  it('tags the pen layers', () => {
    const r = generateFracture({ width: 300, height: 400, margin: 20, seed: 42, preset: 'mud' });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.has('crack-primary')).toBe(true);
    expect(layers.has('crack-fine')).toBe(true);
    expect(layers.has('plate')).toBe(true);
  });

  it('crazing preset skips plate hatching', () => {
    const r = generateFracture({ width: 300, height: 400, margin: 20, seed: 42, preset: 'crazing' });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.has('plate')).toBe(false);
  });
});
