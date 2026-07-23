import { describe, it, expect } from 'vitest';
import { generateCoral, simulateCoral } from './coral/index.js';
import type { CoralSimParams } from './coral/index.js';
import { createNoise } from './noise.js';
import { makeRandom } from './lib/rng.js';
import { polylineLength } from './lib/spatial.js';
import type { Point } from './flow-lines.js';

function circle(cx: number, cy: number, r: number, edgeLen: number): Point[] {
  const n = Math.max(12, Math.round((2 * Math.PI * r) / edgeLen));
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

const EDGE = 3;
const SIM: CoralSimParams = {
  x0: 20,
  y0: 20,
  x1: 280,
  y1: 380,
  edgeLen: EDGE,
  repulsionRadius: 18,
  attraction: 0.35,
  alignment: 0.25,
  repulsion: 0.8,
  maxStep: EDGE * 0.45,
  growth: 0.6,
  maxNodes: 1200,
  iterations: 200,
  snapshots: 10,
  noiseScale: 50,
  patchiness: 0.45,
  curvatureBias: 0.5,
  jitter: 0.25,
  boundaryPad: 14,
  seedLoops: [circle(150, 200, 40, EDGE)],
  closed: true,
};

function loopPerimeter(loops: Point[][]): number {
  let total = 0;
  for (const loop of loops) {
    if (loop.length < 2) continue;
    total += polylineLength([...loop, loop[0]]);
  }
  return total;
}

describe('simulateCoral', () => {
  it('grows the curve and buckles it', () => {
    const sim = simulateCoral(SIM, createNoise(42), makeRandom(42));
    const seedPerimeter = loopPerimeter(SIM.seedLoops);
    const finalPerimeter = loopPerimeter(sim.loops);
    // Loose thresholds — these pin the behaviour, not the tuning.
    expect(finalPerimeter).toBeGreaterThan(seedPerimeter * 3);
    // History perimeters grow monotonically-ish: last ring beats first.
    expect(sim.rings.length).toBeGreaterThan(0);
    const first = loopPerimeter(sim.rings[0].loops);
    const last = loopPerimeter(sim.rings[sim.rings.length - 1].loops);
    expect(last).toBeGreaterThan(first);
  });

  it('respects the node cap', () => {
    const sim = simulateCoral(SIM, createNoise(42), makeRandom(42));
    let nodes = 0;
    for (const loop of sim.loops) nodes += loop.length;
    // Spacing splits may overshoot the cap slightly; growth must stop there.
    expect(nodes).toBeLessThanOrEqual(SIM.maxNodes * 1.15);
  });

  it('keeps node spacing within the resample bounds', () => {
    const sim = simulateCoral(SIM, createNoise(42), makeRandom(42));
    for (const loop of sim.loops) {
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % n];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        expect(len).toBeLessThan(EDGE * 1.7);
        expect(len).toBeGreaterThan(EDGE * 0.02);
      }
    }
  });

  it('stays inside the rect (soft wall)', () => {
    const sim = simulateCoral({ ...SIM, iterations: 400, maxNodes: 2400 }, createNoise(7), makeRandom(7));
    for (const loop of sim.loops) {
      for (const p of loop) {
        expect(p.x).toBeGreaterThan(SIM.x0 - EDGE * 2);
        expect(p.x).toBeLessThan(SIM.x1 + EDGE * 2);
        expect(p.y).toBeGreaterThan(SIM.y0 - EDGE * 2);
        expect(p.y).toBeLessThan(SIM.y1 + EDGE * 2);
      }
    }
  });

  it('grows longer at a higher growth rate', () => {
    const slow = simulateCoral({ ...SIM, growth: 0.15, maxNodes: 5000 }, createNoise(42), makeRandom(42));
    const fast = simulateCoral({ ...SIM, growth: 0.9, maxNodes: 5000 }, createNoise(42), makeRandom(42));
    expect(loopPerimeter(fast.loops)).toBeGreaterThan(loopPerimeter(slow.loops));
  });

  it('records the requested number of rings in order', () => {
    const sim = simulateCoral(SIM, createNoise(42), makeRandom(42));
    expect(sim.rings.length).toBe(SIM.snapshots);
    for (let i = 1; i < sim.rings.length; i++) {
      expect(sim.rings[i].iter).toBeGreaterThan(sim.rings[i - 1].iter);
    }
  });

  it('pins the endpoints of an open curve', () => {
    const line: Point[] = [];
    for (let i = 0; i <= 60; i++) line.push({ x: 40 + i * 3.5, y: 200 });
    const sim = simulateCoral(
      { ...SIM, seedLoops: [line], closed: false },
      createNoise(42),
      makeRandom(42)
    );
    expect(sim.loops).toHaveLength(1);
    const final = sim.loops[0];
    expect(final[0]).toEqual(line[0]);
    expect(final[final.length - 1]).toEqual(line[line.length - 1]);
  });
});

describe('generateCoral', () => {
  it('is deterministic per seed', () => {
    const a = generateCoral({ width: 300, height: 400, margin: 20, seed: 42, iterations: 120 });
    const b = generateCoral({ width: 300, height: 400, margin: 20, seed: 42, iterations: 120 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds grow different organisms', () => {
    const a = generateCoral({ width: 300, height: 400, margin: 20, seed: 42, iterations: 120 });
    const b = generateCoral({ width: 300, height: 400, margin: 20, seed: 43, iterations: 120 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('stays on the page (wobble included)', () => {
    const r = generateCoral({ width: 300, height: 400, margin: 20, seed: 7 });
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
    const r = generateCoral({ width: 300, height: 400, margin: 20, seed: 42 });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.has('edge')).toBe(true);
    expect(layers.has('ring')).toBe(true);
    expect(layers.has('relic')).toBe(true);
  });

  it('draws only the silhouette when rings are off', () => {
    const r = generateCoral({ width: 300, height: 400, margin: 20, seed: 42, rings: 0 });
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.every((l) => l.layer === 'edge' && l.pen === 'bold')).toBe(true);
  });

  it('renders the open maze preset', () => {
    const r = generateCoral({
      width: 300,
      height: 400,
      margin: 20,
      seed: 42,
      preset: 'maze',
      iterations: 250,
      maxNodes: 1500,
    });
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.some((l) => l.layer === 'edge')).toBe(true);
  });
});
