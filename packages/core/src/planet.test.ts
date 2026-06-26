import { describe, it, expect } from 'vitest';
import { generatePlanet, type PlanetOptions } from './planet.js';
import type { FlowLine } from './flow-lines.js';

function baseOptions(overrides: Partial<PlanetOptions> = {}): PlanetOptions {
  return {
    width: 600,
    height: 600,
    margin: 20,
    seed: 7,
    radiusFrac: 0.7,
    // lighter than defaults to keep the test suite fast
    hatchSpacing: 10,
    crossHatchLayers: 2,
    octaves: 3,
    wobble: 0,
    ...overrides,
  };
}

const layer = (lines: FlowLine[], name: string): FlowLine[] => lines.filter((l) => l.layer === name);
const center = { x: 300, y: 300 };
const R = 0.7 * (300 - 20); // radiusFrac * usableR

describe('generatePlanet', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = generatePlanet(baseOptions({ seed: 11 }));
    const b = generatePlanet(baseOptions({ seed: 11 }));
    const c = generatePlanet(baseOptions({ seed: 12 }));
    expect(b.lines).toEqual(a.lines);
    expect(c.lines).not.toEqual(a.lines);
  });

  it('produces finite, in-bounds geometry', () => {
    // Small disk so the (legitimately large) rings still land on the sheet.
    const r = generatePlanet(baseOptions({ radiusFrac: 0.4, rings: true, starfield: true, craters: true, planetType: 'moon' }));
    const tol = 40;
    for (const ln of r.lines) {
      for (const p of ln.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(-tol);
        expect(p.x).toBeLessThanOrEqual(r.width + tol);
        expect(p.y).toBeGreaterThanOrEqual(-tol);
        expect(p.y).toBeLessThanOrEqual(r.height + tol);
      }
    }
  });

  it('keeps all hatch and stipple marks inside the disk', () => {
    const r = generatePlanet(baseOptions({ planetType: 'moon', stipple: 0.6 }));
    const marks = [...layer(r.lines, 'hatch'), ...layer(r.lines, 'stipple')];
    expect(marks.length).toBeGreaterThan(0);
    for (const ln of marks) {
      for (const p of ln.points) {
        const d = Math.hypot(p.x - center.x, p.y - center.y);
        expect(d).toBeLessThanOrEqual(R + 1.0);
      }
    }
  });

  it('draws the limb as a closed circle of radius R', () => {
    const r = generatePlanet(baseOptions());
    const limb = layer(r.lines, 'limb');
    expect(limb.length).toBeGreaterThanOrEqual(2);
    // The outermost pass should sit on radius R and close on itself.
    let outer = limb[0];
    let outerR = 0;
    for (const ln of limb) {
      const rr = Math.hypot(ln.points[0].x - center.x, ln.points[0].y - center.y);
      if (rr > outerR) {
        outerR = rr;
        outer = ln;
      }
    }
    expect(Math.abs(outerR - R)).toBeLessThan(1);
    for (const p of outer.points) {
      expect(Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - R)).toBeLessThan(1);
    }
    const first = outer.points[0];
    const last = outer.points[outer.points.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(2);
  });

  it('hatches the shadow side more densely, and the light angle moves it', () => {
    const count = (lines: FlowLine[], side: (x: number) => boolean): number =>
      layer(lines, 'hatch').reduce(
        (n, l) => n + l.points.filter((p) => side(p.x)).length,
        0
      );
    // Pure-lighting tone (no albedo) so the test is about form shading only.
    const lit = generatePlanet(
      baseOptions({ planetType: 'barren', lightAngle: 0, lightElevation: 20, albedoWeight: 0, lightWeight: 1 })
    );
    const left = count(lit.lines, (x) => x < center.x - 10);
    const right = count(lit.lines, (x) => x > center.x + 10);
    expect(left).toBeGreaterThan(right); // light from +x ⇒ shadow on the left

    const flipped = generatePlanet(
      baseOptions({ planetType: 'barren', lightAngle: 180, lightElevation: 20, albedoWeight: 0, lightWeight: 1 })
    );
    const left2 = count(flipped.lines, (x) => x < center.x - 10);
    const right2 = count(flipped.lines, (x) => x > center.x + 10);
    expect(right2).toBeGreaterThan(left2);
  });

  it('occludes rings behind the disk (open arcs, not closed loops)', () => {
    const r = generatePlanet(baseOptions({ planetType: 'ringed', rings: true, bands: true }));
    const ringLines = layer(r.lines, 'ring');
    expect(ringLines.length).toBeGreaterThan(0);
    // At least one band is cut by the planet ⇒ it survives as an open arc.
    const open = ringLines.some((l) => {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y) > R * 0.3;
    });
    expect(open).toBe(true);
  });

  it('keeps the starfield clear of the disk', () => {
    const r = generatePlanet(baseOptions({ starfield: true, starCount: 200 }));
    const stars = layer(r.lines, 'star');
    expect(stars.length).toBeGreaterThan(0);
    for (const ln of stars) {
      for (const p of ln.points) {
        expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeGreaterThan(R);
      }
    }
  });

  it('emits ring / star / atmosphere layers only when toggled on', () => {
    const off = generatePlanet(baseOptions());
    expect(layer(off.lines, 'ring')).toHaveLength(0);
    expect(layer(off.lines, 'star')).toHaveLength(0);
    expect(layer(off.lines, 'atmosphere')).toHaveLength(0);

    expect(layer(generatePlanet(baseOptions({ rings: true })).lines, 'ring').length).toBeGreaterThan(0);
    expect(layer(generatePlanet(baseOptions({ starfield: true })).lines, 'star').length).toBeGreaterThan(0);
    expect(layer(generatePlanet(baseOptions({ atmosphere: 2 })).lines, 'atmosphere').length).toBeGreaterThan(0);
  });

  it('draws a companion moon beside the planet when enabled', () => {
    const r = generatePlanet(baseOptions({ moon: true, moonAngle: 0, moonDist: 1.9, moonRadiusFrac: 0.3 }));
    // Some limb strokes sit out near the moon centre, far from the primary disk.
    const farLimb = layer(r.lines, 'limb').some((l) =>
      l.points.some((p) => p.x - center.x > R * 1.2)
    );
    expect(farLimb).toBe(true);
  });
});
