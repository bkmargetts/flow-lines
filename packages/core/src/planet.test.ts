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

  it('keeps graticule lines on the front hemisphere inside the disk', () => {
    const r = generatePlanet(baseOptions({ graticule: true, graticuleSpacingDeg: 30 }));
    const g = layer(r.lines, 'graticule');
    expect(g.length).toBeGreaterThan(0);
    for (const ln of g) {
      for (const p of ln.points) {
        expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeLessThanOrEqual(R + 1);
      }
    }
  });

  it('draws gas-giant storms (feature ovals) over banded hatch', () => {
    const r = generatePlanet(baseOptions({ planetType: 'gas-giant', bands: true, storms: 2, stormSize: 1.4 }));
    expect(layer(r.lines, 'hatch').length).toBeGreaterThan(0);
    expect(layer(r.lines, 'feature').length).toBeGreaterThan(0);
  });

  it('traces lava fissures as feature contours', () => {
    const r = generatePlanet(baseOptions({ planetType: 'lava', lavaFissureWidth: 0.18 }));
    expect(layer(r.lines, 'hatch').length).toBeGreaterThan(0);
    expect(layer(r.lines, 'feature').length).toBeGreaterThan(0);
  });

  it('renders engraved title/caption and plate annotation', () => {
    const r = generatePlanet(baseOptions({ title: 'A1', caption: 'B2', plateFrame: true, scaleBar: true }));
    expect(layer(r.lines, 'label').length).toBeGreaterThan(0);
    expect(layer(r.lines, 'annotation').length).toBeGreaterThan(0);
  });

  it('places several bodies within bounds for every multi-body layout', () => {
    for (const lay of ['phases', 'comparison', 'orbital'] as const) {
      const r = generatePlanet(baseOptions({ layout: lay, layoutCount: 5 }));
      expect(layer(r.lines, 'limb').length).toBeGreaterThan(3); // distinct disks
      for (const ln of r.lines) {
        for (const p of ln.points) {
          expect(p.x).toBeGreaterThanOrEqual(-40);
          expect(p.x).toBeLessThanOrEqual(r.width + 40);
          expect(p.y).toBeGreaterThanOrEqual(-40);
          expect(p.y).toBeLessThanOrEqual(r.height + 40);
        }
      }
    }
  });

  it('adds relief marks for mountains and keeps the terminator pass on the disk', () => {
    const mts = generatePlanet(baseOptions({ planetType: 'terrestrial', seaLevel: -0.2, mountains: true }));
    const relief = layer(mts.lines, 'relief');
    expect(relief.length).toBeGreaterThan(0);
    const emph = generatePlanet(baseOptions({ planetType: 'barren', terminatorEmphasis: 1 }));
    for (const ln of layer(emph.lines, 'hatch')) {
      for (const p of ln.points) {
        expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeLessThanOrEqual(R + 1);
      }
    }
  });

  it('keeps a ringed, moon-bearing plate inside the page margin', () => {
    const r = generatePlanet(baseOptions({
      planetType: 'ringed', radiusFrac: 0.7, rings: true, ringOuter: 2.6, ringCount: 6,
      moon: true, moonDist: 2.6, atmosphere: 2,
    }));
    const halfW = r.width / 2 - 20; // margin = 20 in baseOptions
    const halfH = r.height / 2 - 20;
    for (const ln of r.lines) {
      if (ln.layer === 'star' || ln.layer === 'annotation' || ln.layer === 'label') continue;
      for (const p of ln.points) {
        expect(Math.abs(p.x - center.x)).toBeLessThanOrEqual(halfW + 1);
        expect(Math.abs(p.y - center.y)).toBeLessThanOrEqual(halfH + 1);
      }
    }
  });

  it('rings each body of a ringed phase strip', () => {
    const noRing = generatePlanet(baseOptions({ planetType: 'ringed', layout: 'phases', layoutCount: 4, rings: false }));
    const ringed = generatePlanet(baseOptions({ planetType: 'ringed', layout: 'phases', layoutCount: 4, rings: true }));
    expect(layer(noRing.lines, 'ring')).toHaveLength(0);
    // Ring strokes appear across the strip, not just one body.
    const ringXs = new Set(layer(ringed.lines, 'ring').map((l) => Math.round(l.points[0].x / 40)));
    expect(layer(ringed.lines, 'ring').length).toBeGreaterThan(0);
    expect(ringXs.size).toBeGreaterThan(1);
  });

  it('occludes orbit lines behind the central star (broken into arcs)', () => {
    const r = generatePlanet(baseOptions({ layout: 'orbital', layoutCount: 5 }));
    const orbits = layer(r.lines, 'orbit');
    expect(orbits.length).toBeGreaterThan(0);
    // With hidden-line removal at least one orbit is cut into a partial arc
    // (first and last point far apart), not a closed loop.
    const open = orbits.some((l) => {
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y) > 20;
    });
    expect(open).toBe(true);
  });

  it('multiplies strokes for a sketch overdraw', () => {
    const plain = generatePlanet(baseOptions({ planetType: 'terrestrial', sketch: 0 }));
    const sketched = generatePlanet(baseOptions({ planetType: 'terrestrial', sketch: 0.8, sketchStyle: 'scratchy' }));
    expect(sketched.lines.length).toBeGreaterThan(plain.lines.length);
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
