import { describe, it, expect } from 'vitest';
import { generateMeander, simulateMeander } from './meander/index.js';
import type { MeanderSimParams } from './meander/index.js';
import { createNoise } from './noise.js';
import { polylineLength } from './lib/spatial.js';

const SIM: MeanderSimParams = {
  x0: 20,
  y0: 20,
  x1: 280,
  y1: 380,
  angle: (12 * Math.PI) / 180,
  channelWidth: 6,
  valleyHalf: 75,
  ds: 3.3,
  iterations: 320,
  rate: 0.31,
  lag: 24,
  jitter: 0.35,
  cutoffDist: 8.1,
  snapshots: 20,
  endTaper: 40,
  overhang: 40,
};

function sinuosity(points: { x: number; y: number }[]): number {
  const chord = Math.hypot(
    points[points.length - 1].x - points[0].x,
    points[points.length - 1].y - points[0].y
  );
  return polylineLength(points) / chord;
}

describe('simulateMeander', () => {
  it('grows sinuosity from a nearly straight start', () => {
    const sim = simulateMeander(SIM, createNoise(42));
    expect(sim.traces.length).toBeGreaterThan(0);
    // Loose thresholds — these pin the behaviour, not the tuning.
    expect(sinuosity(sim.traces[0].points)).toBeLessThan(sinuosity(sim.channel));
    expect(sinuosity(sim.channel)).toBeGreaterThan(1.15);
  });

  it('migrates faster at a higher rate', () => {
    const slow = simulateMeander({ ...SIM, rate: 0.12, iterations: 150 }, createNoise(42));
    const fast = simulateMeander({ ...SIM, rate: 0.4, iterations: 150 }, createNoise(42));
    expect(sinuosity(fast.channel)).toBeGreaterThan(sinuosity(slow.channel));
  });

  it('cuts off pinched loops into oxbows', () => {
    const sim = simulateMeander({ ...SIM, iterations: 600, rate: 0.4 }, createNoise(42));
    expect(sim.oxbows.length).toBeGreaterThan(0);
    // A cutoff must actually shorten the channel it left: every oxbow arc's
    // ends nearly touch (that was the pinched neck).
    for (const oxbow of sim.oxbows) {
      const gap = Math.hypot(
        oxbow.points[oxbow.points.length - 1].x - oxbow.points[0].x,
        oxbow.points[oxbow.points.length - 1].y - oxbow.points[0].y
      );
      expect(gap).toBeLessThan(SIM.cutoffDist + 1e-6);
      expect(polylineLength(oxbow.points)).toBeGreaterThan(gap * 2);
    }
  });

  it('stays inside the valley belt', () => {
    const sim = simulateMeander(SIM, createNoise(1337));
    const nrmX = -Math.sin(SIM.angle);
    const nrmY = Math.cos(SIM.angle);
    const cx = (SIM.x0 + SIM.x1) / 2;
    const cy = (SIM.y0 + SIM.y1) / 2;
    for (const p of sim.channel) {
      const v = (p.x - cx) * nrmX + (p.y - cy) * nrmY;
      // The spring is soft, so allow some overshoot beyond the half-width.
      expect(Math.abs(v)).toBeLessThan(SIM.valleyHalf * 1.5);
    }
  });

  it('records the requested number of traces in order', () => {
    const sim = simulateMeander(SIM, createNoise(42));
    expect(sim.traces.length).toBe(SIM.snapshots);
    for (let i = 1; i < sim.traces.length; i++) {
      expect(sim.traces[i].iter).toBeGreaterThan(sim.traces[i - 1].iter);
    }
  });
});

describe('generateMeander', () => {
  it('is deterministic per seed', () => {
    const a = generateMeander({ width: 300, height: 400, margin: 20, seed: 42 });
    const b = generateMeander({ width: 300, height: 400, margin: 20, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds draw different rivers', () => {
    const a = generateMeander({ width: 300, height: 400, margin: 20, seed: 42 });
    const b = generateMeander({ width: 300, height: 400, margin: 20, seed: 43 });
    expect(JSON.stringify(a.lines)).not.toBe(JSON.stringify(b.lines));
  });

  it('stays on the page (wobble included)', () => {
    const r = generateMeander({ width: 300, height: 400, margin: 20, seed: 7 });
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
    const r = generateMeander({ width: 300, height: 400, margin: 20, seed: 42, preset: 'tangle' });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.has('channel')).toBe(true);
    expect(layers.has('trace')).toBe(true);
    expect(layers.has('oxbow')).toBe(true);
  });

  it('holds history clear of the modern channel (reserved paper)', () => {
    const r = generateMeander({
      width: 300,
      height: 400,
      margin: 20,
      seed: 42,
      wobble: 0,
      flowLines: 1,
      optimize: false,
    });
    // With exactly one flow line its offset is zero — it traces the channel
    // centerline, so it probes the cull rule directly: the renderer drops
    // history within 0.75 channel widths of the centerline (the smoothed
    // render centerline deviates a hair from the sim's, hence the slack).
    const centerPts = r.lines
      .filter((l) => l.layer === 'channel' && l.pen === 'fine')
      .flatMap((l) => l.points);
    expect(centerPts.length).toBeGreaterThan(0);
    const w = 260 / 42;
    for (const line of r.lines) {
      if (line.layer !== 'trace' && line.layer !== 'oxbow') continue;
      for (const p of line.points) {
        let minD = Infinity;
        for (const c of centerPts) {
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < minD) minD = d;
        }
        expect(minD).toBeGreaterThan(w * 0.55);
      }
    }
  });

  it('flow lines stay off when set to zero', () => {
    const r = generateMeander({
      width: 300,
      height: 400,
      margin: 20,
      seed: 42,
      flowLines: 0,
      boldPasses: 1,
      optimize: false,
    });
    const channelLines = r.lines.filter((l) => l.layer === 'channel');
    expect(channelLines.every((l) => l.pen === 'bold')).toBe(true);
  });
});
