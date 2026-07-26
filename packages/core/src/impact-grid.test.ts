import { describe, it, expect } from 'vitest';
import { generateImpactGrid, type ImpactGridOptions } from './impact-grid/index.js';
import { layoutCells, squareAt } from './impact-grid/layout.js';
import { clipHalfPlane, ringArea, shatterCell } from './impact-grid/shatter.js';
import { concentricFill, hatchConvex } from './impact-grid/hatch.js';
import { makeRandom } from './lib/rng.js';

const BASE: ImpactGridOptions = { width: 300, height: 400, margin: 20, seed: 7, wobble: 0, inkPath: false };

// A path straight down the page centre, used by the impact tests.
const CENTRE_PATH = [
  { x: 150, y: 30 },
  { x: 150, y: 370 },
];

describe('clipHalfPlane / shatter geometry', () => {
  it('chord splits conserve area and produce closed rings inside the parent', () => {
    const square = squareAt({ x: 50, y: 50 }, 20, 0.3);
    const parentArea = ringArea(square);
    const rng = makeRandom(123);
    let fragments = [square];
    for (let cut = 0; cut < 3; cut++) {
      const a = { x: 50 + (2 * rng() - 1) * 10, y: 50 + (2 * rng() - 1) * 10 };
      const alpha = rng() * Math.PI;
      const n = { x: -Math.sin(alpha), y: Math.cos(alpha) };
      fragments = fragments.flatMap((f) => {
        const lo = clipHalfPlane(f, a, n);
        const hi = clipHalfPlane(f, a, { x: -n.x, y: -n.y });
        return [lo, hi].filter((r) => r.length >= 4);
      });
    }
    const total = fragments.reduce((sum, f) => sum + ringArea(f), 0);
    expect(Math.abs(total - parentArea)).toBeLessThan(1e-6);
    for (const frag of fragments) {
      expect(frag[0]).toEqual(frag[frag.length - 1]);
      for (const p of frag) {
        expect(p.x).toBeGreaterThan(50 - 20 * Math.SQRT2 - 1e-9);
        expect(p.x).toBeLessThan(50 + 20 * Math.SQRT2 + 1e-9);
        expect(p.y).toBeGreaterThan(50 - 20 * Math.SQRT2 - 1e-9);
        expect(p.y).toBeLessThan(50 + 20 * Math.SQRT2 + 1e-9);
      }
    }
  });

  it('shatterCell emits closed shards and drops sub-pen-width slivers', () => {
    const square = squareAt({ x: 100, y: 100 }, 15, 0);
    const shards = shatterCell(
      square,
      15,
      {
        f: 0.8,
        ux: 1,
        uy: 0,
        dx: 5,
        dy: 0,
        radius: 80,
        shatter: 1,
        scatter: 0.5,
        debris: 0,
        crush: 0.8,
        sweep: 0.3,
        tx: 0,
        ty: 1,
        channel: 10,
        d: 30,
        penWidth: 1.2,
      },
      makeRandom(9)
    );
    expect(shards.length).toBeGreaterThan(1);
    for (const shard of shards) {
      expect(shard.length).toBeGreaterThanOrEqual(4);
      expect(shard[0]).toEqual(shard[shard.length - 1]);
      // Slivers below the pen's resolving power were culled (shrink is 0.9,
      // so surviving areas sit above 0.81 × the raw floor).
      expect(ringArea(shard)).toBeGreaterThan((2 * 1.2) * (2 * 1.2) * 0.8);
    }
  });

  it('concentricFill rings are closed, nested, and stay inside the polygon', () => {
    const square = squareAt({ x: 0, y: 0 }, 20, 0.2);
    const rings = concentricFill(square, 4, 1.2);
    expect(rings.length).toBeGreaterThan(2);
    let prevMax = Infinity;
    for (const ring of rings) {
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      const max = Math.max(...ring.map((p) => Math.hypot(p.x, p.y)));
      expect(max).toBeLessThan(prevMax);
      expect(max).toBeLessThan(20 * Math.SQRT2);
      prevMax = max;
    }
  });

  it('hatchConvex spans stay inside the polygon and follow the angle', () => {
    const square = squareAt({ x: 0, y: 0 }, 20, 0);
    const spans = hatchConvex(square, Math.PI / 4, 4, 1);
    expect(spans.length).toBeGreaterThan(3);
    for (const [a, b] of spans.map((s) => [s[0], s[1]])) {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const diff = Math.abs(((angle - Math.PI / 4 + Math.PI / 2) % Math.PI) - Math.PI / 2);
      expect(diff).toBeLessThan(1e-9);
      for (const p of [a, b]) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(20 + 1e-9);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(20 + 1e-9);
      }
    }
  });
});

describe('generateImpactGrid', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const opts = { ...BASE, impactPath: CENTRE_PATH };
    const a = generateImpactGrid(opts);
    const b = generateImpactGrid(opts);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    const c = generateImpactGrid({ ...opts, seed: 8 });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
  });

  it('pristine default: closed rings inside the margin, full lattice count', () => {
    const grid = {
      sizeVariation: 0.2,
      positionJitter: 0.1,
      rotationJitter: 0.1,
      gap: 0.15,
    };
    const result = generateImpactGrid({ ...BASE, fill: 0, cellSize: 260 / 14, ...grid });
    const placed = layoutCells({
      width: 300,
      height: 400,
      margin: 20,
      seed: 7,
      layout: 'grid',
      frameDepth: 3,
      cellSize: 260 / 14,
      penWidth: 1.2,
      ...grid,
    });
    expect(result.lines.length).toBe(placed.length);
    const pitch = 260 / 14;
    const cols = Math.floor(260 / pitch);
    const rows = Math.floor(360 / pitch);
    expect(placed.length).toBe(cols * rows);
    for (const line of result.lines) {
      // Rings are densified so the hand wobble can bend the sides.
      expect(line.points.length).toBeGreaterThanOrEqual(5);
      const first = line.points[0];
      const last = line.points[line.points.length - 1];
      expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(1e-9);
      for (const p of line.points) {
        // Jitter can push a corner slightly past the margin; a pitch of slack
        // is the layout's contract.
        expect(p.x).toBeGreaterThan(20 - pitch);
        expect(p.x).toBeLessThan(280 + pitch);
        expect(p.y).toBeGreaterThan(20 - pitch);
        expect(p.y).toBeLessThan(380 + pitch);
      }
    }
  });

  it('frame layout keeps only the border band', () => {
    const depth = 2;
    const all = layoutCells({
      width: 300,
      height: 400,
      margin: 20,
      seed: 7,
      layout: 'grid',
      frameDepth: depth,
      cellSize: 20,
      sizeVariation: 0,
      positionJitter: 0,
      rotationJitter: 0,
      gap: 0.15,
      penWidth: 1.2,
    });
    const band = layoutCells({
      width: 300,
      height: 400,
      margin: 20,
      seed: 7,
      layout: 'frame',
      frameDepth: depth,
      cellSize: 20,
      sizeVariation: 0,
      positionJitter: 0,
      rotationJitter: 0,
      gap: 0.15,
      penWidth: 1.2,
    });
    const cols = Math.floor(260 / 20);
    const rows = Math.floor(360 / 20);
    const interior = (cols - 2 * depth) * (rows - 2 * depth);
    expect(band.length).toBe(cols * rows - interior);
    // Band cells keep the exact index/character they had in the full grid.
    const byIndex = new Map(all.map((s) => [s.index, s]));
    for (const s of band) expect(byIndex.get(s.index)).toEqual(s);
  });

  it('displacement falls off monotonically with distance and dies beyond the radius', () => {
    const radius = 60;
    const common = {
      ...BASE,
      shatter: 0,
      fill: 0,
      impactStrength: 0.7,
      impactRadius: radius,
      positionJitter: 0,
      rotationJitter: 0,
      sizeVariation: 0,
      optimize: false,
    };
    const calm = generateImpactGrid(common);
    const struck = generateImpactGrid({ ...common, impactPath: CENTRE_PATH });
    expect(struck.lines.length).toBe(calm.lines.length);

    // Group displacement magnitude by distance band from the path (x = 150).
    const bands = new Map<number, { sum: number; n: number }>();
    for (let i = 0; i < calm.lines.length; i++) {
      const a = centroid(calm.lines[i].points);
      const b = centroid(struck.lines[i].points);
      const band = Math.floor(Math.abs(a.x - 150) / 15);
      const entry = bands.get(band) ?? { sum: 0, n: 0 };
      entry.sum += Math.hypot(b.x - a.x, b.y - a.y);
      entry.n += 1;
      bands.set(band, entry);
    }
    const means = [...bands.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([band, { sum, n }]) => ({ band, mean: sum / n }));
    for (let i = 1; i < means.length; i++) {
      expect(means[i].mean).toBeLessThanOrEqual(means[i - 1].mean + 1e-6);
    }
    for (const { band, mean } of means) {
      if (band * 15 > radius) expect(mean).toBeLessThan(1e-9);
    }
  });

  it('shatter adds lines; debris removes shards near the path', () => {
    const common = { ...BASE, fill: 0, impactPath: CENTRE_PATH, optimize: false };
    const whole = generateImpactGrid({ ...common, shatter: 0 });
    const broken = generateImpactGrid({ ...common, shatter: 1, debris: 0 });
    expect(broken.lines.length).toBeGreaterThan(whole.lines.length);

    // Debris drops shards outright (same rng stream — acceptance only), so
    // the plot strictly loses lines.
    const dusted = generateImpactGrid({ ...common, shatter: 1, debris: 1 });
    expect(dusted.lines.length).toBeLessThan(broken.lines.length);
  });

  it('crush in place: with no push, scatter, or sweep, rubble stays within its cell', () => {
    const cellSize = 260 / 14;
    const common = {
      ...BASE,
      fill: 0,
      impactPath: CENTRE_PATH,
      impactStrength: 0,
      scatter: 0,
      sweep: 0,
      debris: 0,
      positionJitter: 0,
      rotationJitter: 0,
      sizeVariation: 0,
      optimize: false,
    };
    const calm = generateImpactGrid({ ...common, shatter: 0 });
    const crushed = generateImpactGrid({ ...common, shatter: 1 });
    // Every crushed point lies within a cell radius of some calm square's
    // centroid — nothing flew: the band is rubble in place, not a blast.
    const centres = calm.lines.map((l) => centroid(l.points));
    const bound = cellSize * Math.SQRT2 * 0.51;
    for (const line of crushed.lines) {
      const g = centroid(line.points);
      const near = centres.some((c) => Math.hypot(c.x - g.x, c.y - g.y) < bound);
      expect(near).toBe(true);
    }
  });

  it('cells the line crosses always shatter', () => {
    const common = {
      ...BASE,
      fill: 0,
      impactPath: CENTRE_PATH,
      shatter: 0.5,
      positionJitter: 0,
      rotationJitter: 0,
      sizeVariation: 0,
      gap: 0,
      optimize: false,
    };
    const calm = generateImpactGrid({ ...common, impactPath: undefined });
    const struck = generateImpactGrid(common);
    // Any calm square whose ring straddles x=150 (the path) must not survive
    // intact: no struck line may share its exact centroid AND be a plain
    // 4-corner ring of the same size.
    const struckKeys = new Set(
      struck.lines.map((l) => {
        const g = centroid(l.points);
        return `${g.x.toFixed(3)},${g.y.toFixed(3)},${l.points.length}`;
      })
    );
    let crossed = 0;
    for (const line of calm.lines) {
      const xs = line.points.map((p) => p.x);
      const gy = centroid(line.points).y;
      // Interior rows only: at the path's endpoints the centre-to-path
      // distance picks up a y component and the always-shatter rule
      // (centre within half of the path) deliberately doesn't fire.
      if (gy > 50 && gy < 350 && Math.min(...xs) < 150 && Math.max(...xs) > 150) {
        crossed++;
        const g = centroid(line.points);
        expect(struckKeys.has(`${g.x.toFixed(3)},${g.y.toFixed(3)},${line.points.length}`)).toBe(
          false
        );
      }
    }
    expect(crossed).toBeGreaterThan(5);
  });

  it('fill 0 emits outlines only; fill adds hatch that thickens near the impact', () => {
    const common = { ...BASE, impactPath: CENTRE_PATH, optimize: false };
    const bare = generateImpactGrid({ ...common, fill: 0 });
    for (const line of bare.lines) {
      expect(line.points.length).toBeGreaterThanOrEqual(4);
    }
    const toned = generateImpactGrid({ ...common, fill: 0.4 });
    expect(toned.lines.length).toBeGreaterThan(bare.lines.length);
  });
});

function centroid(points: { x: number; y: number }[]): { x: number; y: number } {
  // Skip the ring-closing duplicate so a symmetric ring's centroid is exact.
  const last = points[points.length - 1];
  const n =
    points.length > 1 && last.x === points[0].x && last.y === points[0].y
      ? points.length - 1
      : points.length;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += points[i].x;
    y += points[i].y;
  }
  return { x: x / n, y: y / n };
}
