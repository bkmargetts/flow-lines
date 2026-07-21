import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { clamp } from '../lib/math.js';
import { MarblingOp } from './ops.js';
import {
  Ring,
  PointBudget,
  makeCircleRing,
  applyOpToRing,
  ringOutOfReach,
  MARBLING_POINT_CAP,
  MARBLING_RING_CAP,
} from './rings.js';
import { MarblingPattern, RecipeParams, buildOps } from './recipe.js';

export { applyDrop, applyTine, applyVortex, opInfluenceRadius } from './ops.js';
export type { MarblingOp } from './ops.js';
export { MARBLING_POINT_CAP, MARBLING_RING_CAP } from './rings.js';
export type { MarblingPattern } from './recipe.js';

/**
 * Marbling — mathematical paper marbling (suminagashi / ebru), rendered as
 * plottable single-pen strokes.
 *
 * The bath is a stack of closed ink rings. Every classical gesture is an
 * exact closed-form plane map (see `ops.ts`): drops push all earlier ink
 * outward and add their own nested rings, then rake/comb strokes shear the
 * whole bath with distance falloff. Because the maps are exact and rings
 * refine adaptively through them (`rings.ts`), the result is thousands of
 * fine nested contours — the swirling feathered patterns of real marbled
 * paper — with no simulation and full per-seed determinism.
 *
 * Ink: drops cycle through `inkGroups` pens; every stroke is tagged
 * `ink-<group>` for per-pen SVG export (`inkLayerName`).
 */
export interface MarblingOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls drop placement/sizes, comb slant, vortex centres */
  seed?: number;
  /** Named classical pattern (default 'nonpareil') */
  pattern?: MarblingPattern;
  /**
   * Reference min dimension in px — clamps the dimension feature sizes
   * (drop radius, comb spacing, falloff) derive from so the pattern keeps
   * its tuned physical scale on sheets larger than the tuning anchor;
   * drop counts still ride the real page. Same contract as fracture's.
   */
  refMinDim?: number;

  // ---- Bath ----
  /** Ink drops (default preset; stone throws more) */
  drops?: number;
  /** Mean drop radius in px (default sizingDim/13) */
  dropRadius?: number;
  /** Per-drop radius jitter, 0..1 (default 0.35) */
  dropRadiusJitter?: number;
  /** Nested rings per drop, 1..6 (default 3) — the ink's echo bands */
  ringsPerDrop?: number;
  /** Pens the drops cycle through, 1..4 (default 1) */
  inkGroups?: number;

  // ---- Rake ----
  /** Comb tooth spacing in px (default sizingDim/45) */
  combSpacing?: number;
  /** Rake strength, 0..1 → streaks up to ~10 tooth-spacings long (default preset) */
  combStrength?: number;
  /** Rake falloff λ in px at the base tooth spacing (default combSpacing/3 —
   *  λ well under the spacing is what turns a comb pass into sheared
   *  streaks; λ ≥ spacing translates the bath near-uniformly) */
  falloff?: number;
  /** Wavy-comb amplitude, 0..1 — bouquet's swing (default preset) */
  wavy?: number;
  /** Vortex twist, 0..1 → centre twist up to ~8 rad (default preset) */
  vortexStrength?: number;

  // ---- Fidelity / plot ----
  /** Max segment length in px after deformation (default 1.6, min 0.75) */
  detail?: number;
  /** Total point cap across all rings (default MARBLING_POINT_CAP) */
  pointCap?: number;
  /** Hand-drawn wobble amplitude in px (default 0 — marbled rings are
   *  already organic, and wobble on dense near-tangent contours opens
   *  crossing artifacts; the knob exists for a hand-pulled look) */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

/** Pen-layer name for an ink group — mirrors bandLayerName/accentLayerName. */
export function inkLayerName(group: number): string {
  return `ink-${group}`;
}

/**
 * Pattern presets. `stone` is the un-raked pebble field; `nonpareil` the
 * classic fine parallel scallops; `feather` (chevron) folds a nonpareil
 * base into barbs; `bouquet` swings the comb sideways as it pulls;
 * `vortex` stirs a stone base into spirals.
 */
export const MARBLING_PRESETS: Record<
  MarblingPattern,
  { drops: number; combStrength: number; wavy: number; vortexStrength: number }
> = {
  stone: { drops: 70, combStrength: 0, wavy: 0, vortexStrength: 0 },
  nonpareil: { drops: 85, combStrength: 0.55, wavy: 0, vortexStrength: 0 },
  feather: { drops: 75, combStrength: 0.6, wavy: 0, vortexStrength: 0 },
  bouquet: { drops: 75, combStrength: 0.55, wavy: 0.6, vortexStrength: 0 },
  vortex: { drops: 60, combStrength: 0, wavy: 0, vortexStrength: 0.7 },
};

/**
 * Render a marbled bath as plottable single-pen strokes.
 */
export function generateMarbling(options: MarblingOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = randomSeed(),
    pattern = 'nonpareil',
    dropRadiusJitter = 0.35,
    optimize = true,
  } = options;

  const p = MARBLING_PRESETS[pattern] ?? MARBLING_PRESETS.nonpareil;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  const empty = (): FlowLinesResult => ({ lines: [], width, height, seed });
  if (innerW < 16 || innerH < 16) return empty();
  const minDim = Math.min(innerW, innerH);
  // Feature sizes anchor at refMinDim on oversized sheets (identity wherever
  // minDim is smaller); drop counts keep the real dimensions.
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);

  const ringsPerDrop = clamp(Math.round(options.ringsPerDrop ?? 3), 1, 6);
  const inkGroups = clamp(Math.round(options.inkGroups ?? 1), 1, 4);
  const requestedDrops = Math.max(1, Math.round(options.drops ?? p.drops));
  const drops = Math.min(requestedDrops, Math.floor(MARBLING_RING_CAP / ringsPerDrop));
  const dropRadius = Math.max(2, options.dropRadius ?? sizingDim / 11);
  const combSpacing = Math.max(2, options.combSpacing ?? sizingDim / 45);
  const combStrength = clamp(options.combStrength ?? p.combStrength, 0, 1);
  const falloff = Math.max(0.5, options.falloff ?? combSpacing / 3);
  const wavy = clamp(options.wavy ?? p.wavy, 0, 1);
  const vortexStrength = clamp(options.vortexStrength ?? p.vortexStrength, 0, 1);
  const detail = Math.max(0.75, options.detail ?? 1.6);
  const pointCap = Math.max(1000, options.pointCap ?? MARBLING_POINT_CAP);

  const recipe: RecipeParams = {
    pattern,
    x0,
    y0,
    x1,
    y1,
    drops,
    dropRadius,
    dropRadiusJitter: clamp(dropRadiusJitter, 0, 1),
    inkGroups,
    combSpacing,
    // Anchored in tooth-spacing units: full strength drags a streak ~10
    // spacings long — page-relative z just shoves the bath off the sheet.
    combZ: combStrength * combSpacing * 10,
    falloff,
    wavy,
    wavyPeriod: sizingDim / 3,
    vortexTwist: vortexStrength * 8,
    vortexLambda: sizingDim / 4,
  };

  const { drops: dropSpecs, strokes } = buildOps(recipe, makeRandom(subSeed(seed, 0)));

  const budget: PointBudget = { points: 0, cap: pointCap };
  const rings: Ring[] = [];
  // Skip threshold: an op that can't move a ring by 1/50 px leaves it alone.
  const MIN_DISP = 0.02;

  const applyToBath = (op: MarblingOp): void => {
    for (const ring of rings) {
      if (ringOutOfReach(ring, op, MIN_DISP)) continue;
      applyOpToRing(ring, op, detail, budget);
    }
  };

  for (const drop of dropSpecs) {
    applyToBath({ kind: 'drop', cx: drop.cx, cy: drop.cy, r: drop.r });
    // The drop's own ink: nested echo rings, outermost at the drop radius.
    for (let k = 0; k < ringsPerDrop; k++) {
      const r = drop.r * (1 - (0.55 * k) / ringsPerDrop);
      rings.push(makeCircleRing(drop.cx, drop.cy, r, drop.group, detail, budget));
    }
  }
  for (const op of strokes) applyToBath(op);

  const lines: FlowLine[] = [];
  for (const ring of rings) {
    if (ring.pts.length < 3) continue;
    const closed = [...ring.pts, ring.pts[0]];
    for (const run of clipPolylineToRect(closed, x0, y0, x1, y1)) {
      lines.push({ points: run, pen: 'fine', layer: inkLayerName(ring.group) });
    }
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  const wobble = options.wobble ?? 0;
  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      wavelength: Math.max(24, detail * 15),
      seed: subSeed(seed, 11),
    });
  }

  if (optimize) result = optimizePlot(result);

  return result;
}
