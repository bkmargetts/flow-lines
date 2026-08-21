import { describe, it, expect } from 'vitest';
import {
  generateSandpile,
  relaxSandpile,
  thin,
  straightRuns,
  snapJunctions,
  MAX_STABLE,
  SANDPILE_PRESETS,
  type SandpilePreset,
} from './index.js';

const PRESETS = Object.keys(SANDPILE_PRESETS) as SandpilePreset[];

const square = (N: number) => (x: number, y: number) =>
  x >= 2 && y >= 2 && x < N - 2 && y < N - 2;

/** Three grains at fixed relative positions, scaled to the lattice. */
const grains = (N: number): [number, number][] =>
  [
    [0.35, 0.42],
    [0.66, 0.6],
    [0.5, 0.25],
  ].map(([u, v]) => [Math.round(u * N), Math.round(v * N)] as [number, number]);

describe('sandpile relaxation', () => {
  it('leaves a deviation locus that is one-dimensional, not two', () => {
    // The theorem says the changed set converges to a CURVE. So when the grid
    // quadruples its size the locus should roughly double, not quadruple.
    const counts = [101, 201, 401].map((N) => relaxSandpile({
      width: N,
      height: N,
      inside: square(N),
      points: grains(N),
    }).count);
    for (let i = 1; i < counts.length; i++) {
      const growth = counts[i] / counts[i - 1];
      expect(growth, `${counts[i - 1]} -> ${counts[i]}`).toBeGreaterThan(1.4);
      expect(growth, `${counts[i - 1]} -> ${counts[i]}`).toBeLessThan(3);
    }
  });

  /**
   * The sandpile is ABELIAN: the stabilised configuration does not depend on
   * the order topplings are performed in, and therefore not on the order the
   * grains were added. This is the property that makes the drawing exactly
   * reproducible without a seeded tie-break anywhere in the physics.
   */
  it('is abelian — the result is independent of the order grains are dropped', () => {
    const N = 151;
    const pts = grains(N);
    const forward = relaxSandpile({ width: N, height: N, inside: square(N), points: pts });
    const reversed = relaxSandpile({
      width: N,
      height: N,
      inside: square(N),
      points: [...pts].reverse(),
    });
    expect(Array.from(reversed.deviation)).toEqual(Array.from(forward.deviation));
    expect(reversed.topples).toBe(forward.topples);
  });

  it('stabilises — no site is left above the toppling threshold', () => {
    const N = 121;
    const r = relaxSandpile({ width: N, height: N, inside: square(N), points: grains(N) });
    for (let i = 0; i < r.state.length; i++) {
      if (r.domain[i]) expect(r.state[i]).toBeLessThanOrEqual(MAX_STABLE);
    }
    expect(r.topples).toBeGreaterThan(0);
  });

  it('does nothing at all when no grain is added', () => {
    const N = 61;
    const r = relaxSandpile({ width: N, height: N, inside: square(N), points: [] });
    expect(r.count).toBe(0);
    expect(r.topples).toBe(0);
  });
});

describe('straight-run vectorisation', () => {
  /**
   * 8-connected chain tracing shatters a rational-slope staircase into
   * two-point fragments (1779 of them for a curve with ~14 real edges), because
   * every step of the stair has three neighbours. Growing maximal straight runs
   * must recover a count in the tens, not the thousands.
   */
  it('recovers tens of long edges, not thousands of fragments', () => {
    const N = 301;
    const r = relaxSandpile({ width: N, height: N, inside: square(N), points: grains(N) });
    const runs = straightRuns(thin(r.deviation, N, N), N, N);
    expect(runs.length).toBeGreaterThan(3);
    expect(runs.length).toBeLessThan(200);
    const lengths = runs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
    // The longest edges span a real fraction of the domain.
    expect(Math.max(...lengths)).toBeGreaterThan(N / 4);
  });

  it('snaps run endpoints into shared junctions', () => {
    const runs: [[number, number], [number, number]][] = [
      [[0, 0], [50, 0]],
      [[52, 2], [52, 60]],
      [[51, 1], [10, 40]],
    ];
    const snapped = snapJunctions(runs, 6);
    // The three endpoints clustered near (51,1) must now be exactly equal.
    const a = snapped[0][1];
    const b = snapped[1][0];
    const c = snapped[2][0];
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    // Endpoints with nothing nearby are left where they were.
    expect(snapped[0][0]).toEqual([0, 0]);
  });
});

describe('generateSandpile', () => {
  it('renders every preset as straight segments inside the page', () => {
    for (const preset of PRESETS) {
      const r = generateSandpile({
        width: 400,
        height: 500,
        margin: 20,
        seed: 11,
        preset,
        resolution: 160,
        wobble: 0,
      });
      expect(r.lines.length, preset).toBeGreaterThan(3);
      // wobble off => every edge is exactly two points, i.e. dead straight
      expect(r.lines.every((l) => l.points.length === 2), preset).toBe(true);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y), preset).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(-1);
          expect(p.y).toBeGreaterThanOrEqual(-1);
          expect(p.x).toBeLessThanOrEqual(401);
          expect(p.y).toBeLessThanOrEqual(501);
        }
      }
    }
  });

  it('is deterministic per seed, and varies with it', () => {
    const opts = { width: 300, height: 300, seed: 8, resolution: 150, preset: 'facet' as const };
    expect(generateSandpile(opts)).toEqual(generateSandpile(opts));
    expect(generateSandpile({ ...opts, seed: 9 })).not.toEqual(generateSandpile(opts));
  });

  it('fills a non-square page rather than sitting in a square well', () => {
    const r = generateSandpile({
      width: 300,
      height: 900,
      margin: 10,
      seed: 4,
      preset: 'lattice',
      resolution: 150,
      wobble: 0,
    });
    let minY = Infinity;
    let maxY = -Infinity;
    for (const l of r.lines) {
      for (const p of l.points) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    // The lattice follows the page aspect, so the drawing should span most of
    // the tall dimension — not just a 300px-tall square in the middle.
    expect(maxY - minY).toBeGreaterThan(600);
  });

  it('more grains means a finer network', () => {
    const base = { width: 400, height: 400, seed: 6, resolution: 200, preset: 'facet' as const };
    const few = generateSandpile({ ...base, points: 6 });
    const many = generateSandpile({ ...base, points: 40 });
    expect(many.lines.length).toBeGreaterThan(few.lines.length);
  });
});
