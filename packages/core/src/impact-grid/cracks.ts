import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';
import { clipHalfPlane } from './shatter.js';
import type { RegionSpec } from './layout.js';
import type { Epicentre } from './impact.js';

interface CrackSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface CrackNetwork {
  /** Facet a convex cell ring by every crack line crossing it. The same
   *  global segments cut every cell they pass through, so fracture lines
   *  run continuously across cell boundaries — one pane, not many tiles. */
  facet(ring: Point[]): Point[][];
}

/**
 * The spiderweb a pane grows around a strike: 10..18 radial cracks stepped
 * outward from the epicentre with noise-steered wander, plus a few partial
 * concentric connector arcs. The network is built once per drawing and
 * shared by every cell.
 */
export function makeCracks(
  epi: Epicentre,
  reach: number,
  region: RegionSpec,
  seed: number
): CrackNetwork {
  const rng = makeRandom(subSeed(seed, 7));
  const noise = createNoise(subSeed(seed, 8));
  const segments: CrackSegment[] = [];
  const step = Math.max(3, reach / 40);

  const radials = 10 + Math.floor(rng() * 9);
  for (let i = 0; i < radials; i++) {
    let angle = (i / radials) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / radials);
    const length = reach * (0.45 + 0.55 * rng());
    let x = epi.x;
    let y = epi.y;
    let segX = x;
    let segY = y;
    let travelled = 0;
    let sinceEmit = 0;
    while (travelled < length) {
      angle += 0.35 * noise.noise2D(travelled * 0.02, i * 3.7) * (step / 10);
      x += step * Math.cos(angle);
      y += step * Math.sin(angle);
      travelled += step;
      sinceEmit += 1;
      const left = !region.contains(x, y);
      // Emit chords a few steps long: one clean cut per cell instead of a
      // fan of near-identical lines over-slicing the facets.
      if (sinceEmit >= 3 || travelled >= length || left) {
        segments.push({ ax: segX, ay: segY, bx: x, by: y });
        segX = x;
        segY = y;
        sinceEmit = 0;
      }
      if (left) break;
    }
  }

  const arcs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < arcs; i++) {
    const r = reach * (0.18 + 0.55 * rng());
    const start = rng() * Math.PI * 2;
    const span = Math.PI * (0.35 + 0.75 * rng());
    const steps = Math.max(6, Math.floor((span * r) / (step * 3)));
    let prev: Point | null = null;
    for (let k = 0; k <= steps; k++) {
      const a = start + (k / steps) * span;
      const wobble = 1 + 0.05 * noise.noise2D(a * 2.3, i * 5.1 + 40);
      const p = { x: epi.x + r * wobble * Math.cos(a), y: epi.y + r * wobble * Math.sin(a) };
      if (prev && (region.contains(prev.x, prev.y) || region.contains(p.x, p.y))) {
        segments.push({ ax: prev.x, ay: prev.y, bx: p.x, by: p.y });
      }
      prev = p;
    }
  }

  const facet = (ring: Point[]): Point[][] => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of ring) {
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
    let facets: Point[][] = [ring];
    for (const s of segments) {
      if (Math.max(s.ax, s.bx) < x0 || Math.min(s.ax, s.bx) > x1) continue;
      if (Math.max(s.ay, s.by) < y0 || Math.min(s.ay, s.by) > y1) continue;
      // Cut by the segment's line: the same infinite line cuts neighbouring
      // cells collinearly, which is what makes the crack read as continuous.
      const n = { x: -(s.by - s.ay), y: s.bx - s.ax };
      const len = Math.hypot(n.x, n.y) || 1;
      n.x /= len;
      n.y /= len;
      const a = { x: s.ax, y: s.ay };
      const next: Point[][] = [];
      for (const f of facets) {
        const lo = clipHalfPlane(f, a, n);
        const hi = clipHalfPlane(f, a, { x: -n.x, y: -n.y });
        if (lo.length >= 4 && hi.length >= 4) {
          next.push(lo, hi);
        } else {
          next.push(f);
        }
      }
      facets = next;
      if (facets.length > 24) break;
    }
    return facets;
  };

  return { facet };
}
