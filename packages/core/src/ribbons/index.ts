import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig, type SketchStyle } from '../sketch-styles.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { optimizePlot } from '../optimize.js';
import { buildWeaveMorph } from './morph.js';
import { buildLattice } from './lattice.js';
import { shapeStrands } from './warp.js';
import { findCrossings } from './crossings.js';
import { solveWeave } from './weave.js';
import { bandProfile, buildBandMarks, type Mark, type RibbonStyle } from './band.js';

export type { RibbonStyle } from './band.js';
import { buildOccluders, contactShadows, occludeMarks } from './occlude.js';

/**
 * Ribbon weave / knotwork: flowing ribbons that interlace over/under across
 * the page with proper occlusion at crossings, drawn as curved 3D bands in
 * pen and ink. The whole module hangs on one idea: a master `order` slider
 * (0 = free tangle, 1 = strict knot lattice) that morphs a single weave
 * continuously. There is ONE canonical construction — the Celtic lattice
 * (lattice.ts) — at every order value; flow energy warps and meanders it
 * (warp.ts) without re-rolling it, crossings are re-detected geometrically
 * (crossings.ts), the weave rule is solved as an alternation constraint
 * graph seeded by the Celtic parity (weave.ts), bands get edges / rungs /
 * shade (band.ts), and hidden lines are removed per crossing with a reserved
 * paper gap plus contact shadows (occlude.ts).
 *
 * Everything is single-pen stroked polylines, deterministic per seed — tone
 * is stroke density, never fills. Mirrors the City / Landscape / Planet
 * generators: heavy algorithm here in core, a thin web wrapper feeds it.
 */

export type RibbonEdgeMode = 'closed' | 'bleed';

export interface RibbonWeaveOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** THE slider: 0 = free-flowing tangle, 1 = strict knot lattice. */
  order?: number;

  /** 'band': constant-width woven band. 'silk': flat-ribbon treatment —
   *  width follows travel direction, edge-hugging cross-contour arcs,
   *  oblique shade hatch. */
  style?: RibbonStyle;

  // Structure
  /** Lattice pitch, px. */
  cell?: number;
  /** Ribbon width, px (clamped to 0.44 × cell). */
  bandWidth?: number;
  /** 0..1 knot-break density; 0 = pure plait. */
  breaks?: number;
  /** 'closed' turns strands around at the frame; 'bleed' runs them off-page. */
  edge?: RibbonEdgeMode;
  /** 0..1 ceiling on the loose-warp family. */
  meander?: number;

  // Marks
  /** 0..1 cross-tick density (0 = off). */
  rungs?: number;
  /** 0..1 bow on the cross ticks — the surface-curvature cue. */
  rungCurve?: number;
  /** 0..1 shadow-side hatch strength. */
  shading?: number;
  /** 0..1 contact-shadow strength at under-crossings. */
  shadowHatch?: number;
  /** Light direction, radians (default upper-left). */
  lightAngle?: number;
  /** Reserved-paper clearance at crossings, px. */
  gap?: number;
  /** 0..1 probability a strand carries a twist pair (band flip). */
  twists?: number;

  // Ink
  /** 1..3 named layer groups for multi-ink plotting. */
  inkGroups?: number;

  // Pen / finishing
  penWidth?: number;
  wobble?: number;
  sketch?: number;
  sketchStyle?: SketchStyle;
  /** Chain strokes and order them to cut pen travel (default true). */
  optimize?: boolean;
}

const DEFAULTS: Required<Omit<RibbonWeaveOptions, 'width' | 'height' | 'margin' | 'seed'>> = {
  order: 0.5,
  style: 'band',
  cell: 48,
  bandWidth: 14,
  breaks: 0.25,
  edge: 'closed',
  meander: 1,
  rungs: 0.5,
  rungCurve: 0.6,
  shading: 0.55,
  shadowHatch: 0.7,
  lightAngle: -2.35,
  gap: 2.2,
  twists: 0,
  inkGroups: 1,
  penWidth: 1.35,
  wobble: 0.8,
  sketch: 0,
  sketchStyle: 'loose',
  optimize: true,
};

const MAX_CROSSINGS = 4000;

/**
 * Generate a woven-ribbon drawing. Returns plain stroked polylines tagged by
 * layer (`edge` / `rung` / `shade` / `shadow`, prefixed `g0-`…`g2-` when
 * `inkGroups > 1`), deterministic per seed.
 */
export function generateRibbonWeave(options: RibbonWeaveOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  const morph = buildWeaveMorph(o.order, o.meander);
  const cell = Math.max(12, o.cell);
  const bandWidth = Math.max(3, Math.min(o.bandWidth, 0.44 * cell));
  const gap = Math.max(o.gap, 1.5 * o.penWidth);

  // The occlusion margin must cover the finish pass's peak displacement
  // (wobble amplitude + whole-stroke misregistration), or the hand pass
  // bends erased strokes back into the reserved gaps.
  const sketchCfg = o.sketch > 0.01 ? getSketchStyleConfig(o.sketchStyle, o.sketch) : null;
  const finishReach = sketchCfg
    ? sketchCfg.amplitude + sketchCfg.jitter
    : o.wobble * morph.wobbleScale * 1.6;
  const inflatePx = 1.0 + finishReach;

  // 1. One canonical structure, then flow-energy shaping.
  const lattice = buildLattice(
    { x0, y0, x1, y1, cell, breaks: o.breaks, bleed: o.edge === 'bleed', bandWidth, seed },
    morph
  );
  const strands = shapeStrands(lattice.strands, { cell, bandWidth, seed }, morph);

  // 2. Crossings + the weave.
  const crossings = findCrossings(strands, bandWidth, MAX_CROSSINGS);
  const weave = solveWeave(strands, crossings, lattice);

  // 3. Band marks.
  const bandOpts = {
    style: o.style,
    bandWidth,
    rungs: o.rungs,
    rungCurve: o.rungCurve,
    shading: o.shading,
    shadowHatch: o.shadowHatch,
    lightAngle: o.lightAngle,
    twists: o.twists,
    penWidth: o.penWidth,
    cell,
    seed,
  };
  const crossingArcsByStrand: number[][] = strands.map(() => []);
  for (const c of crossings) {
    crossingArcsByStrand[c.a.strand].push(c.a.arc);
    crossingArcsByStrand[c.b.strand].push(c.b.arc);
  }
  const shadeNoise = createNoise(subSeed(seed, 7));
  const drapeNoise = createNoise(subSeed(seed, 8));
  const profiles = strands.map((s, k) =>
    bandProfile(s, k, crossingArcsByStrand[k], bandOpts, drapeNoise)
  );
  let marks: Mark[] = [];
  for (let k = 0; k < strands.length; k++) {
    marks.push(
      ...buildBandMarks(strands[k], k, profiles[k].profile, profiles[k].rungPhase, shadeNoise, bandOpts)
    );
  }

  // 4. Hidden-line removal + contact shadows.
  const occOpts = {
    bandWidth,
    gap,
    inflatePx,
    penWidth: o.penWidth,
    shadowHatch: o.shadowHatch,
  };
  const occluders = buildOccluders(
    strands,
    profiles.map((p) => p.profile),
    crossings,
    weave.aOnTop,
    occOpts
  );
  marks.push(
    ...contactShadows(strands, profiles.map((p) => p.profile), crossings, weave.aOnTop, occOpts)
  );
  marks = occludeMarks(marks, strands, occluders, occOpts);

  // 5. Plain stroked polylines, layer-tagged for multi-pen export.
  const groups = Math.max(1, Math.min(3, Math.round(o.inkGroups)));
  const lines: FlowLine[] = marks.map((m) => ({
    points: m.points,
    layer: groups > 1 ? `g${m.strand % groups}-${m.layer}` : m.layer,
  }));

  // 6. Hand finish (order-scaled — at order 1 with the knob at 0 the weave is
  // truly ruled), then clip and chain.
  let finished: FlowLine[];
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, 6 + p);
      const styled = applyHandDrawnStyle(
        { lines, width, height, seed: pseed },
        { amplitude, wavelength, jitter, seed: pseed }
      ).lines;
      for (const l of styled) acc.push(l);
    }
    finished = acc;
  } else {
    finished = applyHandDrawnStyle(
      { lines, width, height, seed },
      { amplitude: o.wobble * morph.wobbleScale, wavelength: 42, seed: subSeed(seed, 6) }
    ).lines;
  }

  finished = finished.flatMap((l) =>
    clipPolylineToRect(l.points, x0, y0, x1, y1).map((pts) => ({ ...l, points: pts }))
  );

  let result: FlowLinesResult = { lines: finished, width, height, seed };
  if (o.optimize !== false) result = optimizePlot(result);
  return result;
}
