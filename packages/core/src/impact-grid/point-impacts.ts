import type { Point } from '../flow-lines.js';
import { clamp01 } from '../lib/math.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { smoothstep } from '../lib/spatial.js';
import type { RegionSpec } from './layout.js';

/** One strike of the rain: an invisible point the pane was dropped onto.
 *  Impacts are applied in array order — that order IS the destruction
 *  sequence, later strikes re-fracture what earlier ones left. */
export interface Impact {
  x: number;
  y: number;
  /** Shatter falloff radius, px. */
  radius: number;
  /** 0..1 violence of this strike. */
  strength: number;
  /** How far this strike's crack network radiates, px. */
  reach: number;
}

/** Hard cap on strikes — beyond it a drawing is rubble, not rain. */
export const MAX_IMPACTS = 24;

export interface PlaceOptions {
  /** Raw drawn points (page px). When present they decide where AND how
   *  many strikes land — the `count` knob is ignored. */
  points?: Point[];
  /** Auto-scatter count when nothing is drawn. */
  count: number;
  radiusBase: number;
  /** 0..1 per-impact radius spread. */
  radiusVariation: number;
  /** 0..1 base strength, varied per impact. */
  energy: number;
  /** Where sites may land — only `contains` and `centroid` are consulted,
   *  so callers can pass a lightweight ad-hoc region (the drop corridor). */
  region: Pick<RegionSpec, 'contains' | 'centroid'>;
  seed: number;
  cellSize: number;
  /** Page bounds the auto-scatter samples within. */
  width: number;
  height: number;
  margin: number;
}

/**
 * Place the rain. Drawn points are decimated to a min separation (a dense
 * scribble reads as "hit this area", not "hit 400 times"); otherwise sites
 * are scattered by Mitchell best-candidate blue noise — spread out without
 * reading as a lattice. Deterministic per seed; placement order is the
 * strike order.
 */
export function placeImpacts(o: PlaceOptions): Impact[] {
  const rng = makeRandom(subSeed(o.seed, 601));
  const sites: Point[] = [];
  if (o.points && o.points.length > 0) {
    const minSep = Math.max(0.55 * o.radiusBase, o.cellSize);
    for (const p of o.points) {
      if (sites.length >= MAX_IMPACTS) break;
      let clear = true;
      for (const s of sites) {
        if (Math.hypot(p.x - s.x, p.y - s.y) < minSep) {
          clear = false;
          break;
        }
      }
      if (clear) sites.push({ x: p.x, y: p.y });
    }
  } else {
    const count = Math.min(MAX_IMPACTS, Math.max(0, Math.round(o.count)));
    const x0 = o.margin;
    const y0 = o.margin;
    const x1 = o.width - o.margin;
    const y1 = o.height - o.margin;
    const sample = (): Point => {
      for (let t = 0; t < 40; t++) {
        const p = { x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0) };
        if (o.region.contains(p.x, p.y)) return p;
      }
      // A region too thin to hit by rejection: fall back near its centroid.
      return {
        x: o.region.centroid.x + (2 * rng() - 1) * o.cellSize,
        y: o.region.centroid.y + (2 * rng() - 1) * o.cellSize,
      };
    };
    for (let i = 0; i < count; i++) {
      let best: Point | null = null;
      let bestScore = -1;
      for (let c = 0; c < 10; c++) {
        const p = sample();
        let score = Infinity;
        for (const s of sites) score = Math.min(score, Math.hypot(p.x - s.x, p.y - s.y));
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      if (best) sites.push(best);
    }
  }
  return sites.map((s) => {
    const radius = Math.max(
      o.cellSize * 0.5,
      o.radiusBase * (1 + 0.6 * o.radiusVariation * (2 * rng() - 1))
    );
    const strength = clamp01(o.energy * (0.75 + 0.5 * rng()));
    return { x: s.x, y: s.y, radius, strength, reach: radius * (1.1 + 1.3 * strength) };
  });
}

export type PointZone = 'dust' | 'cascade' | 'cracked' | 'intact';

export interface PointDamage {
  zone: PointZone;
  /** 0..1 damage at the query point. */
  D: number;
  /** Radial unit direction away from the impact. */
  rx: number;
  ry: number;
  /** Distance from the impact, px. */
  d: number;
}

/**
 * Purely radial analog of the impact-grid damage model: a hot core inside
 * the strike radius (shards) wrapped in a wider cracked halo out to `reach`
 * (the spiderweb), with the same zone thresholds so `shatter` means the
 * same thing in both generators.
 */
export function pointDamage(
  imp: Impact,
  cx: number,
  cy: number,
  extent: number,
  shatter: number
): PointDamage {
  const dx = cx - imp.x;
  const dy = cy - imp.y;
  const d = Math.hypot(dx, dy);
  const rx = d > 1e-6 ? dx / d : 1;
  const ry = d > 1e-6 ? dy / d : 0;
  const s = smoothstep(clamp01(1 - d / imp.radius));
  const h = smoothstep(clamp01(1 - d / imp.reach));
  // The halo term is linear in h so the cracked annulus stays wide — a
  // squared halo pinches the spiderweb into a sliver around the core.
  const D = clamp01(imp.strength * (1.05 * s * s + 0.45 * h));
  let zone: PointZone = 'intact';
  if (shatter > 0) {
    const dustT = 0.93 - 0.28 * shatter;
    const cascadeT = 0.66 - 0.26 * shatter;
    const crackT = 0.3 - 0.22 * shatter;
    zone = D > dustT ? 'dust' : D > cascadeT ? 'cascade' : D > crackT ? 'cracked' : 'intact';
    // A fragment the point actually lands on always lets go.
    if (d < extent && zone !== 'dust') zone = 'cascade';
  }
  return { zone, D, rx, ry, d };
}
