import { describe, it, expect } from 'vitest';
import { generateImpactGrid, type ImpactGridOptions } from './impact-grid/index.js';
import { layoutCells, makeRegion, rectAt, squareAt } from './impact-grid/layout.js';
import { clipHalfPlane, ringArea, shatterCell } from './impact-grid/shatter.js';
import { concentricFill, hatchConvex } from './impact-grid/hatch.js';
import { makeCracks } from './impact-grid/cracks.js';
import { preparePath } from './impact-grid/impact.js';
import { makeRandom } from './lib/rng.js';

// The lattice-geometry tests below pin the 'grid' layout explicitly — the
// module's default is the multi-scale 'mosaic'.
const BASE: ImpactGridOptions = {
  width: 300,
  height: 400,
  margin: 20,
  seed: 7,
  wobble: 0,
  inkPath: false,
  region: 'full',
  layout: 'grid',
};

// A path straight down the page centre, used by the impact tests.
const CENTRE_PATH = [
  { x: 150, y: 30 },
  { x: 150, y: 370 },
];

const FULL_REGION = makeRegion('full', 300, 400, 20);

const GRID_ARGS = {
  width: 300,
  height: 400,
  margin: 20,
  seed: 7,
  layout: 'grid' as const,
  frameDepth: 3,
  cellSize: 20,
  sizeVariation: 0,
  positionJitter: 0,
  rotationJitter: 0,
  gap: 0.15,
  granularity: 0.6,
  penWidth: 1.2,
  region: FULL_REGION,
};

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
        side: 1,
        rx: 1,
        ry: 0,
        channel: 10,
        d: 30,
        dust: false,
        cone: 0,
        penWidth: 1.2,
      },
      makeRandom(9)
    );
    expect(shards.length).toBeGreaterThan(1);
    for (const { ring } of shards) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(ringArea(ring)).toBeGreaterThan((2 * 1.2) * (2 * 1.2) * 0.8);
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

describe('regions and the pane', () => {
  it('disc region keeps only cells inside the circle; band spans the width', () => {
    const disc = layoutCells({ ...GRID_ARGS, region: makeRegion('disc', 300, 400, 20) });
    const r = Math.min(260, 360) * 0.4;
    expect(disc.length).toBeGreaterThan(10);
    for (const c of disc) {
      expect(Math.hypot(c.centre.x - 150, c.centre.y - 200)).toBeLessThanOrEqual(r);
    }
    const band = layoutCells({ ...GRID_ARGS, region: makeRegion('band', 300, 400, 20) });
    const ys = band.map((c) => c.centre.y);
    const xs = band.map((c) => c.centre.x);
    expect(Math.min(...ys)).toBeGreaterThan(20 + 360 * 0.29 - 1e-9);
    expect(Math.max(...ys)).toBeLessThan(380 - 360 * 0.29 + 1e-9);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(200);
  });

  it('mosaic layout mixes scales: big panels beside small patches', () => {
    const cells = layoutCells({ ...GRID_ARGS, layout: 'mosaic', granularity: 0.8 });
    expect(cells.length).toBeGreaterThan(30);
    const areas = cells.map((c) => c.hx * c.hy).sort((a, b) => a - b);
    const small = areas[Math.floor(areas.length * 0.1)];
    const big = areas[Math.floor(areas.length * 0.95)];
    // A genuine multi-scale patchwork: the top panels dwarf the small ones.
    expect(big / small).toBeGreaterThan(6);
    for (const c of cells) {
      expect(FULL_REGION.contains(c.centre.x, c.centre.y)).toBe(true);
    }
  });

  it('epicentre lands on the fast segment of the gesture, not the deepest point', () => {
    // A slow careful pass (2px steps) across the upper slab with one violent
    // flick (32px gaps) near x=60..120, y=100 — far from the region centre.
    const path: { x: number; y: number }[] = [];
    for (let x = 30; x <= 60; x += 2) path.push({ x, y: 100 });
    for (let x = 60; x <= 120; x += 32) path.push({ x, y: 100 });
    for (let x = 120; x <= 270; x += 2) path.push({ x, y: 100 });
    const field = preparePath(path, 80, FULL_REGION, 260)!;
    expect(field.epicentre).not.toBeNull();
    expect(Math.abs(field.epicentre!.y - 100)).toBeLessThan(10);
    expect(field.epicentre!.x).toBeGreaterThan(50);
    expect(field.epicentre!.x).toBeLessThan(135);
  });

  it('crack lines run collinearly across neighbouring cells — one pane', () => {
    const region = FULL_REGION;
    const epi = { x: 100, y: 100, speed: 1 };
    const cracks = makeCracks(epi, 200, region, 7);
    // Two cells side by side with the epicentre inside the left one: radials
    // leave A rightward into B; the shared chords must cut both collinearly.
    const cellA = rectAt({ x: 100, y: 100 }, 20, 20, 0);
    const cellB = rectAt({ x: 140, y: 100 }, 20, 20, 0);
    const facetsA = cracks.facet(cellA);
    const facetsB = cracks.facet(cellB);
    expect(facetsA.length).toBeGreaterThan(1);
    expect(facetsB.length).toBeGreaterThan(1);

    const interiorEdges = (facets: { x: number; y: number }[][], ring: { x: number; y: number }[]) => {
      const onBorder = (p: { x: number; y: number }) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i];
          const b = ring[i + 1];
          const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (Math.abs(cross / len) < 0.01) return true;
        }
        return false;
      };
      const edges: [{ x: number; y: number }, { x: number; y: number }][] = [];
      for (const f of facets) {
        for (let i = 0; i < f.length - 1; i++) {
          if (!onBorder(f[i]) || !onBorder(f[i + 1])) {
            if (Math.hypot(f[i + 1].x - f[i].x, f[i + 1].y - f[i].y) > 6) edges.push([f[i], f[i + 1]]);
          }
        }
      }
      return edges;
    };
    const edgesA = interiorEdges(facetsA, cellA);
    const edgesB = interiorEdges(facetsB, cellB);
    expect(edgesA.length).toBeGreaterThan(0);
    expect(edgesB.length).toBeGreaterThan(0);
    // Some interior cut in A lines up with one in B: both endpoints of the
    // B edge within a pen width of A's cut line.
    let continuous = false;
    for (const [a1, a2] of edgesA) {
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const len = Math.hypot(dx, dy);
      for (const [b1, b2] of edgesB) {
        const d1 = Math.abs(dx * (b1.y - a1.y) - dy * (b1.x - a1.x)) / len;
        const d2 = Math.abs(dx * (b2.y - a1.y) - dy * (b2.x - a1.x)) / len;
        if (d1 < 1.2 && d2 < 1.2) {
          continuous = true;
          break;
        }
      }
      if (continuous) break;
    }
    expect(continuous).toBe(true);
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

  it('pristine default: closed rings inside the region, full lattice count', () => {
    const grid = {
      sizeVariation: 0.2,
      positionJitter: 0.1,
      rotationJitter: 0.1,
      gap: 0.15,
    };
    const result = generateImpactGrid({ ...BASE, fill: 0, cellSize: 260 / 14, ...grid });
    const placed = layoutCells({
      ...GRID_ARGS,
      cellSize: 260 / 14,
      ...grid,
    });
    expect(result.lines.length).toBe(placed.length);
    const pitch = 260 / 14;
    for (const line of result.lines) {
      expect(line.points.length).toBeGreaterThanOrEqual(5);
      const first = line.points[0];
      const last = line.points[line.points.length - 1];
      expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(1e-9);
      for (const p of line.points) {
        expect(p.x).toBeGreaterThan(20 - pitch);
        expect(p.x).toBeLessThan(280 + pitch);
        expect(p.y).toBeGreaterThan(20 - pitch);
        expect(p.y).toBeLessThan(380 + pitch);
      }
    }
  });

  it('frame layout keeps only the border band', () => {
    const depth = 2;
    const all = layoutCells({ ...GRID_ARGS, frameDepth: depth, layout: 'grid' });
    const band = layoutCells({ ...GRID_ARGS, frameDepth: depth, layout: 'frame' });
    const cols = Math.floor(260 / 20);
    const rows = Math.floor(360 / 20);
    const interior = (cols - 2 * depth) * (rows - 2 * depth);
    expect(band.length).toBe(cols * rows - interior);
    const byIndex = new Map(all.map((s) => [s.index, s]));
    for (const s of band) expect(byIndex.get(s.index)).toEqual(s);
  });

  it('displacement falls off monotonically with distance and dies beyond the radius', () => {
    const radius = 60;
    const common = {
      ...BASE,
      shatter: 0,
      fill: 0,
      paneStress: 0,
      drift: 0,
      occlude: false,
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

  it('crush in place: with no push, scatter, or sweep, rubble stays near its cell', () => {
    const cellSize = 260 / 16;
    const common = {
      ...BASE,
      fill: 0,
      impactPath: CENTRE_PATH,
      impactStrength: 0,
      scatter: 0,
      sweep: 0,
      drift: 0,
      debris: 0,
      positionJitter: 0,
      rotationJitter: 0,
      sizeVariation: 0,
      optimize: false,
    };
    const calm = generateImpactGrid({ ...common, shatter: 0, paneStress: 0 });
    const crushed = generateImpactGrid({ ...common, shatter: 1 });
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
      paneStress: 0,
      positionJitter: 0,
      rotationJitter: 0,
      sizeVariation: 0,
      gap: 0,
      optimize: false,
    };
    const calm = generateImpactGrid({ ...common, impactPath: undefined });
    const struck = generateImpactGrid(common);
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

  it('spreads the mosaic across exactly N ink layers', () => {
    const result = generateImpactGrid({ ...BASE, inks: 5, fill: 1, optimize: false });
    const layers = new Set(result.lines.map((l) => l.layer));
    for (let i = 0; i < 5; i++) expect(layers.has(`ink-${i}`)).toBe(true);
    for (const layer of layers) expect(layer).toMatch(/^ink-[0-4]$/);
  });

  it("damage ink mode orders inks by destruction: the last ink runs hottest", () => {
    const opts = {
      ...BASE,
      impactPath: CENTRE_PATH,
      inks: 3,
      inkMode: 'damage' as const,
      fill: 0,
      optimize: false,
      shatter: 0.3,
      paneStress: 0.6,
    };
    const result = generateImpactGrid(opts);
    // Distance from the path is a proxy for damage; the hottest ink's
    // strokes must sit closer to the strike than ink-0's on average.
    const meanDist = (layer: string) => {
      const ls = result.lines.filter((l) => l.layer === layer);
      expect(ls.length).toBeGreaterThan(0);
      return (
        ls.reduce((sum, l) => sum + Math.abs(centroid(l.points).x - 150), 0) / ls.length
      );
    };
    expect(meanDist('ink-2')).toBeLessThan(meanDist('ink-0'));
  });

  it('fill 0 emits outlines only; fill adds texture that thickens the plot', () => {
    const common = { ...BASE, impactPath: CENTRE_PATH, optimize: false };
    const bare = generateImpactGrid({ ...common, fill: 0 });
    for (const line of bare.lines) {
      // Occlusion may open a ring where a landed shard hides part of it —
      // every stroke must still be drawable.
      expect(line.points.length).toBeGreaterThanOrEqual(2);
    }
    const toned = generateImpactGrid({ ...common, fill: 0.6 });
    expect(toned.lines.length).toBeGreaterThan(bare.lines.length);
  });
});

function centroid(points: { x: number; y: number }[]): { x: number; y: number } {
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
