import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect, smoothPolyline } from '../lib/polyline.js';
import { orderPlot } from '../optimize.js';
import { growHoses, kappaMaxFor, type TangleMaterial } from './centerline.js';
import { clampCurvature, separateHoses } from './separate.js';
import { finalizeOpen, type TangleStrand } from './strand.js';
import { findHoseCrossings } from './crossings.js';
import { solveHoseWeave } from './weave.js';
import { buildHoseMarks, type Mark } from './hose.js';
import { buildLaceMarks } from './lace.js';
import {
  buildEndOccluders,
  buildGrazeOccluders,
  buildOccluders,
  contactShadows,
  occludeMarks,
} from './occlude.js';

export type { TangleMaterial } from './centerline.js';

/**
 * Tangles: strands of one material worming across the page, passing over
 * and under one another with proper hidden-line removal. Material 'hose'
 * is corrugated flexible duct — stiff arcs, elliptical corrugation rings,
 * cylinder shading, open cuff mouths. Material 'lace' is flat shoelace —
 * floppy crinkle, clean ribbon edges with occasional twist flips, aglet
 * tips. Most strands run off the page edges (the frame clip cuts them
 * mid-run, the bleed reading); some terminate on-page with an open end.
 *
 * The machinery is an open-path, mixed-radius adaptation of the ribbon
 * weave: centerlines grow by noise-steered heading integration with a
 * material curvature cap (so the ±r edge offsets can never fold), a
 * relaxation pass keeps parallel strands a physical distance apart,
 * crossings are detected geometrically, over/under is solved as an
 * alternation constraint graph — then biased so fat strands sometimes just
 * lie on top (a pile, not a basket) — and every crossing reserves a clean
 * sliver of paper around the over strand.
 *
 * Everything is single-pen stroked polylines, deterministic per seed.
 */

export interface TanglesOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** What the tangle is made of: corrugated vent hoses or flat shoelaces. */
  material?: TangleMaterial;
  /** Number of strands. */
  count?: number;
  /** Strand thickness range, px (hose radius; laces render ~45% of it). */
  radiusMin?: number;
  radiusMax?: number;
  /** 0..1 curvature energy — how hard the strands worm. */
  wander?: number;
  /** 0..1 probability a strand end terminates on-page with an open end
   *  (hose cuff mouth / lace aglet). */
  cuffChance?: number;
  /** Extra reserved paper between parallel strands, px. */
  clearance?: number;

  /** 0..1 corrugation ring pitch (pitch ∝ radius; hoses only). */
  ringDensity?: number;
  /** 0..1 ellipse bulge on the rings — the wrap-the-cylinder cue (hoses). */
  ringCurve?: number;
  /** 0..1 twist-flip frequency (laces only). */
  twists?: number;
  /** 0..1 shadow-side longitudinal hatch strength. */
  shading?: number;
  /** Light direction, radians (default upper-left). */
  lightAngle?: number;
  /** 0..1 contact-shadow strength at under-crossings. */
  shadowHatch?: number;
  /** 0..1 fraction of crossings resolved "fatter hose on top" instead of
   *  strict alternation. */
  weaveBias?: number;
  /** Reserved-paper clearance at crossings, px. */
  gap?: number;

  penWidth?: number;
  wobble?: number;
  /** Reorder strokes to cut pen-up travel (default true). */
  optimize?: boolean;
}

const DEFAULTS: Required<Omit<TanglesOptions, 'width' | 'height' | 'margin' | 'seed'>> = {
  material: 'hose',
  count: 7,
  radiusMin: 10,
  radiusMax: 26,
  wander: 0.55,
  cuffChance: 0.25,
  clearance: 6,
  ringDensity: 0.6,
  ringCurve: 0.6,
  twists: 0.5,
  shading: 0.45,
  lightAngle: -2.35,
  shadowHatch: 0.6,
  weaveBias: 0.35,
  gap: 1.2,
  penWidth: 1.35,
  wobble: 0.8,
  optimize: true,
};

const MAX_CROSSINGS = 4000;

/**
 * Generate a tangle drawing. Returns plain stroked polylines tagged by
 * layer (`edge` / `ring` / `shade` / `shadow`), deterministic per seed.
 */
export function generateTangles(options: TanglesOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  // The thickness sliders keep their meaning across materials: a lace is a
  // flat ribbon roughly half as wide as the hose the same setting would give.
  const matScale = o.material === 'lace' ? 0.6 : 1;
  const radiusMin = Math.max(o.material === 'lace' ? 1.5 : 3, Math.min(o.radiusMin, o.radiusMax) * matScale);
  const radiusMax = Math.max(radiusMin, o.radiusMax * matScale);
  const gap = Math.max(o.gap, 0.9 * o.penWidth);

  // The occlusion margin must cover the finish pass's peak displacement
  // (wobble amplitude + whole-stroke misregistration), or the hand pass
  // bends erased strokes back into the reserved gaps. The 0.7 base covers
  // the pen's own half-width; anything more is pure moat — the halo must
  // read as a held-off sliver, not a channel.
  const finishReach = o.wobble * 1.6;
  const inflatePx = 0.7 + finishReach;

  // 1. Grow the centerlines, then relax parallel hoses apart. The pushes can
  // locally re-tighten a bend past the growth cap, so re-clamp and smooth
  // before the tube geometry is built from the normals.
  const grown = growHoses({
    x0,
    y0,
    x1,
    y1,
    material: o.material,
    count: Math.max(1, Math.round(o.count)),
    radiusMin,
    radiusMax,
    wander: o.wander,
    cuffChance: o.cuffChance,
    clearance: o.clearance,
    pad: finishReach,
    seed,
  });
  const paths = grown.map((g) => g.pts);
  const radii = grown.map((g) => g.r);
  separateHoses(paths, radii, o.clearance, 6);
  const strands: TangleStrand[] = grown.map((g, k) => {
    clampCurvature(paths[k], kappaMaxFor(o.material, g.r), 4);
    return finalizeOpen(smoothPolyline(paths[k], 1), g.r);
  });

  // 2. Crossings + the weave (with the fat-duct-lies-on-top bias).
  const crossings = findHoseCrossings(strands, MAX_CROSSINGS);
  const weave = solveHoseWeave(strands, crossings, o.weaveBias, seed);

  // 3. Material marks: corrugated tubes or flat twisting laces.
  const shadeNoise = createNoise(subSeed(seed, 7));
  let marks: Mark[] = [];
  if (o.material === 'lace') {
    const crossingArcsByStrand: number[][] = strands.map(() => []);
    for (const c of crossings) {
      crossingArcsByStrand[c.a.strand].push(c.a.arc);
      crossingArcsByStrand[c.b.strand].push(c.b.arc);
    }
    const laceOpts = { twists: o.twists, shading: o.shading, penWidth: o.penWidth, seed };
    for (let k = 0; k < strands.length; k++) {
      marks.push(
        ...buildLaceMarks(
          strands[k],
          k,
          grown[k].cuffStart,
          grown[k].cuffEnd,
          crossingArcsByStrand[k],
          grown[k].foldArcs,
          shadeNoise,
          laceOpts
        )
      );
    }
  } else {
    const markOpts = {
      ringDensity: o.ringDensity,
      ringCurve: o.ringCurve,
      shading: o.shading,
      lightAngle: o.lightAngle,
      penWidth: o.penWidth,
      seed,
    };
    for (let k = 0; k < strands.length; k++) {
      marks.push(
        ...buildHoseMarks(strands[k], k, grown[k].cuffStart, grown[k].cuffEnd, shadeNoise, markOpts)
      );
    }
  }

  // 4. Hidden-line removal + contact shadows.
  const endReach = (r: number) => (o.material === 'lace' ? 0.6 * r : 1.5 * r);
  const endZones: [number, number][][] = strands.map((s, k) => {
    const zones: [number, number][] = [];
    if (grown[k].cuffStart) zones.push([0, endReach(s.r)]);
    if (grown[k].cuffEnd) zones.push([s.len - endReach(s.r), s.len]);
    return zones;
  });
  const occOpts = {
    gap,
    inflatePx,
    penWidth: o.penWidth,
    shadowHatch: o.shadowHatch,
    lace: o.material === 'lace',
    endZones,
  };
  const occluders = buildOccluders(strands, crossings, weave.aOnTop, occOpts);
  buildGrazeOccluders(strands, crossings, weave.aOnTop, occluders, occOpts);
  buildEndOccluders(strands, grown, occluders, occOpts);
  marks.push(...contactShadows(strands, crossings, weave.aOnTop, occOpts));
  marks = occludeMarks(marks, strands, occluders, occOpts);

  // 5. Plain stroked polylines, layer-tagged for multi-pen export.
  const lines: FlowLine[] = marks.map((m) => ({ points: m.points, layer: m.layer }));

  // 6. Hand finish, then clip and reorder. Occlusion ran before the wobble
  // and every reserved gap was inflated by its reach.
  const finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    { amplitude: o.wobble, wavelength: 42, seed: subSeed(seed, 6) }
  ).lines.flatMap((l) =>
    clipPolylineToRect(l.points, x0, y0, x1, y1).map((pts) => ({ ...l, points: pts }))
  );

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Reorder only — rings and cuff ellipses are discrete shapes; chaining
  // would fuse them into the edges and soften every ring end-cap.
  return o.optimize !== false ? orderPlot(result) : result;
}
