import { describe, it, expect } from 'vitest';
import { generateRibbonWeave } from './ribbons/index.js';
import { buildWeaveMorph } from './ribbons/morph.js';
import { buildLattice } from './ribbons/lattice.js';
import { shapeStrands } from './ribbons/warp.js';
import { findCrossings } from './ribbons/crossings.js';
import { solveWeave } from './ribbons/weave.js';

const BASE = { width: 300, height: 400, margin: 20, seed: 42 } as const;

/** The shaping pipeline up to crossings + weave, mirroring the generator. */
function weaveInternals(order: number, breaks: number, seed = 42) {
  const morph = buildWeaveMorph(order, 1);
  const lattice = buildLattice(
    { x0: 20, y0: 20, x1: 280, y1: 380, cell: 48, breaks, bleed: false, bandWidth: 14, seed },
    morph
  );
  const strands = shapeStrands(lattice.strands, { cell: 48, bandWidth: 14, seed }, morph);
  const crossings = findCrossings(strands, 14, 4000);
  const weave = solveWeave(strands, crossings, lattice);
  return { strands, crossings, weave };
}

describe('generateRibbonWeave', () => {
  it('is deterministic for the same seed and options', () => {
    const a = generateRibbonWeave({ ...BASE, order: 0.5 });
    const b = generateRibbonWeave({ ...BASE, order: 0.5 });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces different drawings for different seeds', () => {
    const a = generateRibbonWeave({ ...BASE, seed: 42 });
    const b = generateRibbonWeave({ ...BASE, seed: 1337 });
    expect(JSON.stringify(a.lines)).not.toEqual(JSON.stringify(b.lines));
  });

  it('keeps every point inside the margin box', () => {
    for (const edge of ['closed', 'bleed'] as const) {
      const r = generateRibbonWeave({ ...BASE, order: 0.3, edge });
      expect(r.lines.length).toBeGreaterThan(50);
      for (const line of r.lines) {
        for (const p of line.points) {
          expect(p.x).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
          expect(p.x).toBeLessThanOrEqual(BASE.width - BASE.margin + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(BASE.margin - 1e-6);
          expect(p.y).toBeLessThanOrEqual(BASE.height - BASE.margin + 1e-6);
        }
      }
    }
  });

  it('tags marks with the expected layers, and ink groups when asked', () => {
    const r = generateRibbonWeave({ ...BASE, twists: 1 });
    const layers = new Set(r.lines.map((l) => l.layer));
    for (const expected of ['edge', 'rung', 'shade', 'shadow']) {
      expect(layers.has(expected)).toBe(true);
    }
    const grouped = generateRibbonWeave({ ...BASE, inkGroups: 2 });
    const groupLayers = new Set(grouped.lines.map((l) => l.layer));
    expect([...groupLayers].every((l) => /^g[01]-/.test(l as string))).toBe(true);
  });

  it('morphs rather than re-rolls: adjacent order values stay similar', () => {
    const a = generateRibbonWeave({ ...BASE, order: 0.5 });
    const b = generateRibbonWeave({ ...BASE, order: 0.52 });
    const ratio = b.lines.length / a.lines.length;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });
});

describe('the weave rule', () => {
  it('achieves strict over/under alternation on the pure plait', () => {
    const { strands, crossings, weave } = weaveInternals(1, 0);
    expect(crossings.length).toBeGreaterThan(20);
    expect(weave.violations).toBe(0);

    // Explicit alternation check: along every strand, over/under flips at
    // each consecutive crossing (including the wrap — the loops are closed).
    const occ: { arc: number; over: boolean }[][] = strands.map(() => []);
    for (const c of crossings) {
      occ[c.a.strand].push({ arc: c.a.arc, over: weave.aOnTop[c.id] });
      occ[c.b.strand].push({ arc: c.b.arc, over: !weave.aOnTop[c.id] });
    }
    for (const list of occ) {
      list.sort((p, q) => p.arc - q.arc);
      for (let i = 0; i < list.length; i++) {
        const next = list[(i + 1) % list.length];
        expect(list[i].over).not.toBe(next.over);
      }
    }
  });

  it('reserves clean paper on the under strand at every crossing', () => {
    const r = generateRibbonWeave({
      ...BASE,
      order: 1,
      breaks: 0,
      wobble: 0,
      rungs: 0,
      shading: 0,
      shadowHatch: 0,
      optimize: false,
    });
    const { crossings } = weaveInternals(1, 0);
    // At each crossing the over band (width 14) covers a disk around the
    // crossing point; every surviving line point there belongs to the over
    // strand's own band, whose edges stay ≥ bandWidth/2 - eps away. Nothing
    // may render closer than the reserved-gap radius.
    const reserved = 3; // < gap (2.2) + half pen — conservative floor
    for (const c of crossings.slice(0, 40)) {
      for (const line of r.lines) {
        for (const p of line.points) {
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          expect(d).toBeGreaterThan(reserved);
        }
      }
    }
  });
});
