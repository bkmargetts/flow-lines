import { describe, it, expect } from 'vitest';
import { generateVenation, type VenationOptions } from './venation.js';
import { bandLayerName } from './overlapped-lines.js';

function baseOptions(overrides: Partial<VenationOptions> = {}): VenationOptions {
  return {
    width: 400,
    height: 600,
    margin: 20,
    seed: 42,
    attractorCount: 400,
    region: 'ellipse',
    growthStep: 4,
    attractionDist: 36,
    killDist: 8,
    ...overrides,
  };
}

/** Total inked length across every polyline, px. */
function totalLength(lines: { points: { x: number; y: number }[] }[]): number {
  let len = 0;
  for (const l of lines) {
    for (let i = 1; i < l.points.length; i++) {
      len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
    }
  }
  return len;
}

describe('generateVenation', () => {
  it('is deterministic per seed', () => {
    const a = generateVenation(baseOptions({ directionBias: 0.3 }));
    const b = generateVenation(baseOptions({ directionBias: 0.3 }));
    expect(JSON.stringify(a.lines)).toEqual(JSON.stringify(b.lines));
  });

  it('changes with the seed', () => {
    const a = generateVenation(baseOptions({ seed: 1 }));
    const b = generateVenation(baseOptions({ seed: 2 }));
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('grows a non-trivial network and terminates', () => {
    const r = generateVenation(baseOptions());
    expect(r.lines.length).toBeGreaterThan(10);
  });

  it('keeps every node inside the margin', () => {
    const margin = 20;
    const r = generateVenation(baseOptions({ margin, directionBias: 0.5 }));
    for (const line of r.lines) {
      for (const p of line.points) {
        expect(p.x).toBeGreaterThanOrEqual(margin - 1e-6);
        expect(p.x).toBeLessThanOrEqual(400 - margin + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(margin - 1e-6);
        expect(p.y).toBeLessThanOrEqual(600 - margin + 1e-6);
      }
    }
  });

  it('forms one connected network reachable from a root', () => {
    // optimize off + minBranchLength 0 so the raw tree topology is intact.
    const r = generateVenation(baseOptions({ optimize: false, minBranchLength: 0, rootCount: 1 }));
    expect(r.lines.length).toBeGreaterThan(0);

    // Union-find over rounded endpoints: every polyline shares an endpoint with
    // the network, so all polylines collapse into a single component.
    const key = (p: { x: number; y: number }) => `${Math.round(p.x * 100)}:${Math.round(p.y * 100)}`;
    const parent = new Map<string, string>();
    const find = (k: string): string => {
      let root = k;
      while (parent.get(root) !== root) root = parent.get(root)!;
      while (parent.get(k) !== root) {
        const next = parent.get(k)!;
        parent.set(k, root);
        k = next;
      }
      return root;
    };
    const union = (a: string, b: string) => {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      parent.set(find(a), find(b));
    };
    // Each polyline's points are contiguous; union consecutive points so a line
    // is internally connected, and shared endpoints stitch lines together.
    for (const line of r.lines) {
      for (let i = 1; i < line.points.length; i++) union(key(line.points[i - 1]), key(line.points[i]));
    }
    const roots = new Set<string>();
    for (const line of r.lines) roots.add(find(key(line.points[0])));
    expect(roots.size).toBe(1);
  });

  it('more attractors yield more inked length', () => {
    const sparse = generateVenation(baseOptions({ attractorCount: 150, seed: 7 }));
    const dense = generateVenation(baseOptions({ attractorCount: 600, seed: 7 }));
    expect(totalLength(dense.lines)).toBeGreaterThan(totalLength(sparse.lines));
  });

  it('maps vein depth onto band layers within layerCount', () => {
    const layerCount = 4;
    const r = generateVenation(baseOptions({ layerCount }));
    const allowed = new Set(Array.from({ length: layerCount }, (_, i) => bandLayerName(i)));
    const seen = new Set<string>();
    for (const line of r.lines) {
      expect(line.layer).toBeDefined();
      expect(allowed.has(line.layer!)).toBe(true);
      seen.add(line.layer!);
    }
    // A real tree spans several depths, so more than one band is used.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('tags the trunk band bold when boldTrunk is set', () => {
    const r = generateVenation(baseOptions({ layerCount: 3, boldTrunk: true }));
    const trunk = r.lines.filter((l) => l.layer === bandLayerName(0));
    expect(trunk.length).toBeGreaterThan(0);
    expect(trunk.every((l) => l.pen === 'bold')).toBe(true);
  });

  it('returns nothing when the page has no usable area', () => {
    const r = generateVenation(baseOptions({ margin: 400 }));
    expect(r.lines).toHaveLength(0);
  });
});
