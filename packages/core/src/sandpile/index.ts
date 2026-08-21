import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { makeRandom, randomSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { relaxSandpile, MAX_STABLE, type SandpileResult } from './sim.js';
import { thin, straightRuns, snapJunctions } from './vectorize.js';

export { relaxSandpile, MAX_STABLE, thin, straightRuns, snapJunctions };
export type { SandpileResult };

/**
 * Sandpile — tropical curves solved by falling sand.
 *
 * Fill a lattice polygon with the maximal stable state (3 grains on every site),
 * drop one more grain at each of k points, and relax. The set of sites that
 * changed converges to a TROPICAL CURVE through those points: straight edges at
 * rational slopes, integer weights, balanced at every junction — and among all
 * tropical curves through the points, the one of minimal tropical symplectic
 * area. A Steiner problem, solved by sand. See `sim.ts`.
 *
 * The drawing is therefore entirely straight segments, and none of its
 * character is authored: the slope alphabet, the trivalent junctions and the
 * nested faceted look all fall out of the toppling rule.
 *
 * Two things worth knowing when tuning:
 *
 *  - Cost is roughly cubic in the lattice side, so `resolution` is the one knob
 *    that can make this slow. The defaults are chosen to stay interactive.
 *  - The number of points controls how fine the network is — and therefore how
 *    SHORT its segments get. At A3, k above roughly 60 starts pushing a large
 *    fraction of segments under 3mm, where the lattice reads as aliasing rather
 *    than as a woodcut. `straightRuns` defaults are set to a plot budget for
 *    this reason; see `vectorize.ts`.
 */
export interface SandpileOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: point placement only — the relaxation itself is deterministic */
  seed?: number;
  /** Named look preset (default 'facet') */
  preset?: SandpilePreset;

  /** Lattice sites across the page. Cost grows ~cubically (default preset) */
  resolution?: number;
  /** How many grains are dropped — the network's fineness (default preset) */
  points?: number;
  /** Domain shape the sand relaxes inside (default preset) */
  domain?: SandpileDomain;
  /** Side count for the 'polygon' domain, 3..12 (default 6) */
  sides?: number;
  /** Rotation of the polygon domain, degrees (default 12) */
  rotationDeg?: number;
  /** Where the grains are dropped (default 'scatter') */
  placement?: SandpilePlacement;
  /** Radius of the 'ring' placement as a fraction of the domain (default 0.6) */
  ringRadius?: number;

  // ---- Extraction ----
  /** Collinearity tolerance in lattice units (default 2 — a plot budget) */
  straightness?: number;
  /** Shortest run kept, in lattice units (default 10 — a plot budget) */
  minSegment?: number;
  /**
   * Endpoints within this many lattice units snap to a shared junction, closing
   * the gaps greedy run-growing leaves behind (default 6). 0 disables it.
   */
  junctionSnap?: number;

  // ---- Render ----
  /** Hand-drawn wobble amplitude in px (default 0.4) */
  wobble?: number;
  /** Reorder strokes to cut pen travel (default true) */
  optimize?: boolean;
}

export type SandpilePreset = 'facet' | 'lattice' | 'crystal' | 'shard';
export type SandpileDomain = 'rectangle' | 'disk' | 'polygon';
export type SandpilePlacement = 'scatter' | 'ring' | 'grid';

/**
 * Look presets.
 * - `facet` — a hexagonal cell with a moderate scatter: the nested faceted
 *   reading, closest to a cut gem.
 * - `lattice` — the square domain, few points: long confident segments and a
 *   deep perspective-box look. The cleanest plot of the four.
 * - `crystal` — a disk with points on a ring, so the network organises around a
 *   centre.
 * - `shard` — a triangle, which forces the sharpest slope changes.
 */
export const SANDPILE_PRESETS: Record<
  SandpilePreset,
  {
    resolution: number;
    points: number;
    domain: SandpileDomain;
    sides: number;
    placement: SandpilePlacement;
  }
> = {
  facet: { resolution: 420, points: 34, domain: 'polygon', sides: 6, placement: 'scatter' },
  lattice: { resolution: 460, points: 14, domain: 'rectangle', sides: 4, placement: 'scatter' },
  crystal: { resolution: 420, points: 28, domain: 'disk', sides: 4, placement: 'ring' },
  shard: { resolution: 420, points: 24, domain: 'polygon', sides: 3, placement: 'scatter' },
};

/** Build the domain membership test on a W×H lattice. */
function makeDomain(
  kind: SandpileDomain,
  W: number,
  H: number,
  sides: number,
  rotationDeg: number
): (x: number, y: number) => boolean {
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const inset = 2;
  if (kind === 'rectangle') {
    return (x, y) => x >= inset && y >= inset && x < W - inset && y < H - inset;
  }
  const rx = cx - inset;
  const ry = cy - inset;
  if (kind === 'disk') {
    return (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  }
  const rot = (rotationDeg * Math.PI) / 180;
  const verts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const t = rot + (2 * Math.PI * i) / sides;
    verts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return (x, y) => {
    for (let i = 0; i < sides; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % sides];
      if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
    }
    return true;
  };
}

/** Place the grains. Rejection-sampled against the domain so every grain lands. */
function placePoints(
  placement: SandpilePlacement,
  count: number,
  W: number,
  H: number,
  inside: (x: number, y: number) => boolean,
  ringRadius: number,
  seed: number
): [number, number][] {
  const rng = makeRandom(seed);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const out: [number, number][] = [];
  if (placement === 'ring') {
    const r = Math.min(cx, cy) * clamp(ringRadius, 0.1, 0.95);
    const phase = rng() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const t = phase + (2 * Math.PI * i) / count;
      const x = Math.round(cx + r * Math.cos(t));
      const y = Math.round(cy + r * Math.sin(t));
      if (inside(x, y)) out.push([x, y]);
    }
    return out;
  }
  if (placement === 'grid') {
    const cols = Math.max(1, Math.round(Math.sqrt(count * (W / H))));
    const rows = Math.max(1, Math.ceil(count / cols));
    for (let r = 0; r < rows && out.length < count; r++) {
      for (let c = 0; c < cols && out.length < count; c++) {
        const x = Math.round(((c + 1) / (cols + 1)) * W);
        const y = Math.round(((r + 1) / (rows + 1)) * H);
        if (inside(x, y)) out.push([x, y]);
      }
    }
    return out;
  }
  let guard = 0;
  while (out.length < count && guard++ < count * 400) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H);
    if (inside(x, y)) out.push([x, y]);
  }
  return out;
}

/** Render the tropical curve a sandpile relaxation solves for. */
export function generateSandpile(options: SandpileOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    preset = 'facet',
    rotationDeg = 12,
    ringRadius = 0.6,
    wobble = 0.4,
    optimize = true,
  } = options;

  const p = SANDPILE_PRESETS[preset] ?? SANDPILE_PRESETS.facet;
  const domainKind = options.domain ?? p.domain;
  const placement = options.placement ?? p.placement;
  const sides = clamp(Math.round(options.sides ?? p.sides), 3, 12);
  const points = clamp(Math.round(options.points ?? p.points), 1, 200);
  // Cost is ~cubic in the lattice side, so this is the knob that can bite.
  const resolution = clamp(Math.round(options.resolution ?? p.resolution), 60, 900);

  // The lattice follows the page's aspect, so the drawing fills the sheet rather
  // than sitting in a square well on a portrait page.
  const boxW = Math.max(1, width - 2 * margin);
  const boxH = Math.max(1, height - 2 * margin);
  const latW = boxW >= boxH ? resolution : Math.max(24, Math.round((resolution * boxW) / boxH));
  const latH = boxH >= boxW ? resolution : Math.max(24, Math.round((resolution * boxH) / boxW));

  const inside = makeDomain(domainKind, latW, latH, sides, rotationDeg);
  const grains = placePoints(placement, points, latW, latH, inside, ringRadius, seed);
  const sim = relaxSandpile({ width: latW, height: latH, inside, points: grains });

  const skeleton = thin(sim.deviation, latW, latH);
  const rawRuns = straightRuns(skeleton, latW, latH, {
    tol: options.straightness,
    minLen: options.minSegment,
  });
  const snap = options.junctionSnap ?? 6;
  const runs = snap > 0 ? snapJunctions(rawRuns, snap) : rawRuns;

  const k = Math.min(boxW / latW, boxH / latH);
  const offX = (width - latW * k) / 2;
  const offY = (height - latH * k) / 2;
  const place = (q: [number, number]): Point => ({ x: q[0] * k + offX, y: q[1] * k + offY });

  const lines: FlowLine[] = runs.map(([a, b]) => ({ points: [place(a), place(b)], layer: 'tropical' }));

  let result: FlowLinesResult = { lines, width, height, seed };
  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      wavelength: 140,
      jitter: wobble * 0.25,
      seed,
    });
  }
  // orderPlot, not optimizePlot: chaining would fuse the tropical curve's
  // separate edges into one path and round-cap the junctions, softening the
  // exact trivalent geometry that is the whole subject. Reordering alone still
  // removes most of the pen-up travel.
  return optimize ? orderPlot(result) : result;
}
