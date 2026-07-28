import { describe, it, expect } from 'vitest';
import { generateShardRain, type ShardRainOptions } from './shard-rain/index.js';
import { placeImpacts, pointDamage } from './impact-grid/point-impacts.js';
import { makeRegion } from './impact-grid/layout.js';

// 300×400 page, margin 20: the default plate (paneScale 0.42) spans
// x ≈ 95..205 with its underside starting around y ≈ 98 before the drop.
const BASE: ShardRainOptions = {
  width: 300,
  height: 400,
  margin: 20,
  seed: 7,
  wobble: 0,
};

const FLOOR_Y = 380;
const PANE_BOTTOM0 = 20 + 360 * 0.03 + Math.min(260 * 0.42 * 0.62, 360 * 0.3);

const FULL_REGION = makeRegion('full', 300, 400, 20);

const PLACE_ARGS = {
  count: 8,
  radiusBase: 50,
  radiusVariation: 0.5,
  energy: 0.6,
  region: FULL_REGION,
  seed: 7,
  cellSize: 18,
  width: 300,
  height: 400,
  margin: 20,
};

const maxY = (r: { lines: { points: { y: number }[] }[] }) =>
  Math.max(...r.lines.flatMap((l) => l.points.map((p) => p.y)));

describe('placeImpacts', () => {
  it('scatters the requested number of sites inside the region, spread out', () => {
    const impacts = placeImpacts(PLACE_ARGS);
    expect(impacts).toHaveLength(8);
    for (const imp of impacts) {
      expect(FULL_REGION.contains(imp.x, imp.y)).toBe(true);
      expect(imp.radius).toBeGreaterThan(0);
      expect(imp.strength).toBeGreaterThan(0);
      expect(imp.reach).toBeGreaterThan(imp.radius);
    }
    // Blue-noise placement: no two strikes collapse onto the same spot.
    let minPair = Infinity;
    for (let i = 0; i < impacts.length; i++) {
      for (let j = i + 1; j < impacts.length; j++) {
        minPair = Math.min(
          minPair,
          Math.hypot(impacts[i].x - impacts[j].x, impacts[i].y - impacts[j].y)
        );
      }
    }
    expect(minPair).toBeGreaterThan(PLACE_ARGS.cellSize);
  });

  it('decimates a dense drawn scribble to a few separated sites', () => {
    // 200 near-duplicate drag points around one spot: one site, not 200.
    const points = Array.from({ length: 200 }, (_, i) => ({
      x: 150 + Math.sin(i) * 3,
      y: 200 + Math.cos(i) * 3,
    }));
    const impacts = placeImpacts({ ...PLACE_ARGS, points });
    expect(impacts).toHaveLength(1);
    const line = Array.from({ length: 100 }, (_, i) => ({ x: 40 + i * 2.2, y: 200 }));
    const spaced = placeImpacts({ ...PLACE_ARGS, points: line });
    expect(spaced.length).toBeGreaterThan(1);
    for (let i = 1; i < spaced.length; i++) {
      expect(spaced[i].x).toBeGreaterThan(spaced[i - 1].x);
    }
  });

  it('caps the site count however many points are drawn', () => {
    const points = Array.from({ length: 500 }, (_, i) => ({
      x: 25 + (i * 97) % 250,
      y: 25 + (i * 61) % 350,
    }));
    const impacts = placeImpacts({ ...PLACE_ARGS, points, cellSize: 2, radiusBase: 4 });
    expect(impacts.length).toBeLessThanOrEqual(24);
  });
});

describe('pointDamage', () => {
  it('damage falls off with distance and dies beyond reach', () => {
    const imp = { x: 0, y: 0, radius: 50, strength: 0.8, reach: 120 };
    const near = pointDamage(imp, 5, 0, 1, 0.8);
    const mid = pointDamage(imp, 40, 0, 1, 0.8);
    const far = pointDamage(imp, 150, 0, 1, 0.8);
    expect(near.D).toBeGreaterThan(mid.D);
    expect(mid.D).toBeGreaterThan(far.D);
    expect(far.D).toBe(0);
    expect(far.zone).toBe('intact');
  });

  it('shatter 0 never breaks anything', () => {
    const imp = { x: 0, y: 0, radius: 50, strength: 1, reach: 120 };
    expect(pointDamage(imp, 0, 0, 10, 0).zone).toBe('intact');
  });

  it('a direct hit always lets go', () => {
    const imp = { x: 0, y: 0, radius: 50, strength: 0.3, reach: 120 };
    const hit = pointDamage(imp, 4, 0, 10, 0.5);
    expect(hit.zone === 'cascade' || hit.zone === 'dust').toBe(true);
  });
});

describe('generateShardRain (the drop)', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = generateShardRain({ ...BASE });
    const b = generateShardRain({ ...BASE });
    expect(a).toEqual(b);
    const c = generateShardRain({ ...BASE, seed: 8 });
    expect(JSON.stringify(c.lines)).not.toEqual(JSON.stringify(a.lines));
  });

  it('no pins ⇒ the pristine plate floats untouched near the top', () => {
    const r = generateShardRain({ ...BASE, impacts: 0, fillStyle: 'none' });
    expect(r.lines.length).toBeGreaterThan(0);
    // Nothing below the plate's underside — no crater, no rain, no pile.
    expect(maxY(r)).toBeLessThan(PANE_BOTTOM0 + 6);
  });

  it('the moment knob scrubs the fall — later moments reach lower', () => {
    const common: ShardRainOptions = { ...BASE, fillStyle: 'none', debris: 0 };
    const early = generateShardRain({ ...common, moment: 0.05 });
    const mid = generateShardRain({ ...common, moment: 0.6 });
    const late = generateShardRain({ ...common, moment: 1 });
    expect(maxY(mid)).toBeGreaterThan(maxY(early));
    // At moment 1 the rubble has reached the floor.
    expect(maxY(late)).toBeGreaterThan(FLOOR_Y - 12);
  });

  it('the plate comes to rest ON the pin it is dropped onto', () => {
    // One drawn pin under the plate's footprint: the plate falls to it, so
    // marks now reach below where the floating plate ended.
    const r = generateShardRain({
      ...BASE,
      impactPoints: [{ x: 150, y: 180 }],
      moment: 0,
      fillStyle: 'none',
    });
    const pristine = generateShardRain({ ...BASE, impacts: 0, fillStyle: 'none' });
    expect(maxY(r)).toBeGreaterThan(maxY(pristine) + 40);
  });

  it('a pin in the fall re-shatters the falling shards', () => {
    // Pin A catches the plate; pin B hangs in the rain's path. With
    // pulverising off, breaking falling shards again can only add
    // outlines: strictly more lines than the single-pin drop.
    const common: ShardRainOptions = {
      ...BASE,
      fillStyle: 'none',
      debris: 0,
      scatter: 0.2,
      moment: 0.9,
    };
    const once = generateShardRain({ ...common, impactPoints: [{ x: 150, y: 150 }] });
    const twice = generateShardRain({
      ...common,
      impactPoints: [
        { x: 150, y: 150 },
        { x: 150, y: 260 },
      ],
    });
    expect(twice.lines.length).toBeGreaterThan(once.lines.length);
  });

  it('emits exactly the requested ink layers, plus path only when marked', () => {
    const r = generateShardRain({ ...BASE, impacts: 6, inks: 3, energy: 0.9, inkMode: 'damage' });
    const layers = new Set(r.lines.map((l) => l.layer));
    expect(layers.has('path')).toBe(false);
    for (const layer of layers) expect(layer).toMatch(/^ink-[0-2]$/);
    expect(layers.has('ink-0')).toBe(true);
    const marked = generateShardRain({ ...BASE, impacts: 6, markImpacts: true });
    expect(new Set(marked.lines.map((l) => l.layer)).has('path')).toBe(true);
  });

  it('damage ink mode: the hot ink falls, the calm ink stays on the plate', () => {
    const r = generateShardRain({ ...BASE, impacts: 5, inks: 2, inkMode: 'damage', moment: 0.7, fillStyle: 'none' });
    const meanY = (layer: string) => {
      const pts = r.lines.filter((l) => l.layer === layer).flatMap((l) => l.points);
      return pts.reduce((s, p) => s + p.y, 0) / pts.length;
    };
    // The destroyed material (last ink) rains below the calm plate.
    expect(meanY('ink-1')).toBeGreaterThan(meanY('ink-0'));
  });

  it('fill marks add lines over the bare outlines', () => {
    const bare = generateShardRain({ ...BASE, impacts: 3, fillStyle: 'none' });
    const filled = generateShardRain({ ...BASE, impacts: 3, fillStyle: 'texture', fill: 1 });
    expect(filled.lines.length).toBeGreaterThan(bare.lines.length);
  });
});
