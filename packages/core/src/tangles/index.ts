import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { clamp } from '../lib/math.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { resampleUniform } from '../lib/spatial.js';
import { clipPolylineToRect, smoothPolyline } from '../lib/polyline.js';
import { orderPlot } from '../optimize.js';
import { growHoses, kappaMaxFor, type TangleMaterial } from './centerline.js';
import { enforceCurvature, separateHoses } from './separate.js';
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
  repairOcclusion,
  type OccludeOptions,
  type Occluder,
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
 * Stages 1-4: centerlines, weave, marks, and hidden-line removal — the
 * complete occluded scene before the hand finish. Exported for the
 * occlusion regression tests (not re-exported from the package barrel).
 */
export function buildTangleScene(options: TanglesOptions): {
  marks: Mark[];
  /** The drawing before any erasure (marks + contact shadows). */
  marksBefore: Mark[];
  strands: TangleStrand[];
  occOpts: OccludeOptions;
  crossings: ReturnType<typeof findHoseCrossings>;
  aOnTop: boolean[];
  occluders: Occluder[][];
  seed: number;
} {
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

  // Humanisation is split in two. Most of the wobble budget is applied to
  // the CENTERLINES, before crossings, marks, and occlusion, so every mark
  // of a strand and every occlusion boundary shares one distortion — a
  // per-stroke wobble after occlusion scatters the terminations at every
  // reserved gap (each stroke drifts on its own noise track) and the gaps
  // read as broken lines, the worst "haloing" artifact this module can
  // produce. A small residual per-stroke wobble keeps the pen texture, and
  // ONLY that residual inflates the occluders: the 0.7 base covers the
  // pen's own half-width; anything more is pure moat — the halo must read
  // as a held-off sliver, not a channel.
  const geomWobble = o.wobble * 1.1;
  const strokeWobble = o.wobble * 0.3;
  const finishReach = o.wobble * 1.6;
  const strokeReach = strokeWobble * 1.5;
  const inflatePx = 0.7 + strokeReach;

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
  // Interleave: clamp after EVERY relaxation iteration, not once at the
  // end. Each iteration's pushes add fresh kinks; six iterations of
  // compounding them left spikes far past what a final clamp could ease
  // out (κ·r in the tens — the ±r edges fold into loops there, which is
  // most of what reads as "occlusion artifacts" in a dense pile).
  // 10 rounds: the pushes are magnitude-capped (a giant displacement is a
  // guaranteed kink), so a deep A0-pile overlap needs the extra rounds to
  // fully resolve — under-converged separation leaves true overlaps that
  // read as X-ray crossings.
  for (let round = 0; round < 10; round++) {
    separateHoses(paths, radii, o.clearance, 1);
    // Redistribution, NOT diffusive easing: eased-midpoint sweeps are
    // curve-shortening flow, and interleaved with pushes they contract a
    // stubborn contact into a micro-loop hairball whose winding then
    // poisons everything downstream. Redistribution keeps segment
    // lengths, so a push-kink relaxes into a legal arc in place.
    for (let k = 0; k < paths.length; k++) {
      enforceCurvature(paths[k], kappaMaxFor(o.material, radii[k]));
    }
  }
  // Resample to uniform spacing (the pushes compress vertices into
  // micro-segments whose spike angles carry huge curvature), then enforce
  // the cap exactly by turn redistribution.
  const geomNoise = createNoise(subSeed(seed, 8));
  const strands: TangleStrand[] = grown.map((g, k) => {
    const resampled = resampleUniform(paths[k], clamp(g.r / 3, 2, 6));
    enforceCurvature(resampled, kappaMaxFor(o.material, g.r));
    // The geometry share of the humanisation: a low-frequency perpendicular
    // wobble plus a small whole-strand misregistration offset, stamped into
    // the centerline itself so edges, rings, shade, crossings, and
    // occluders all agree on it. Re-clamp curvature afterwards — the
    // wobble adds a little bend everywhere.
    if (geomWobble > 0) {
      const track = k * 0.731 + 0.5;
      const offX = 0.5 * o.wobble * geomNoise.noise2D(track, 31.7);
      const offY = 0.5 * o.wobble * geomNoise.noise2D(track, 47.3);
      let arc = 0;
      for (let i = 0; i < resampled.length; i++) {
        if (i > 0) {
          arc += Math.hypot(
            resampled[i].x - resampled[i - 1].x,
            resampled[i].y - resampled[i - 1].y
          );
        }
        const ahead = resampled[Math.min(i + 1, resampled.length - 1)];
        const behind = resampled[Math.max(i - 1, 0)];
        const tx = ahead.x - behind.x;
        const ty = ahead.y - behind.y;
        const tl = Math.hypot(tx, ty) || 1;
        const w = geomWobble * geomNoise.fbm(arc / 46, track, 2, 0.5, 2.2);
        resampled[i] = {
          x: resampled[i].x + offX + (-ty / tl) * w,
          y: resampled[i].y + offY + (tx / tl) * w,
        };
      }
      enforceCurvature(resampled, kappaMaxFor(o.material, g.r));
    }
    return finalizeOpen(smoothPolyline(resampled, 1), g.r);
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
  const occOpts: OccludeOptions = {
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
  // Snapshot the complete un-erased drawing: `findUnexplainedGaps` diffs the
  // survivors against it to prove every break is caused by something drawn.
  const marksBefore = marks;
  marks = occludeMarks(marks, strands, occluders, occOpts);
  // Belt-and-braces: geometrically verify the survivors and erase any ink
  // still printing inside a tube that is on top of it (see repairOcclusion).
  marks = repairOcclusion(marks, strands, crossings, weave.aOnTop, occluders, occOpts);

  return {
    marks,
    marksBefore,
    strands,
    occOpts,
    crossings,
    aOnTop: weave.aOnTop,
    occluders,
    seed,
  };
}

/**
 * Generate a tangle drawing. Returns plain stroked polylines tagged by
 * layer (`edge` / `ring` / `shade` / `shadow`), deterministic per seed.
 */
export function generateTangles(options: TanglesOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const { marks, seed } = buildTangleScene(options);

  // 5. Plain stroked polylines, layer-tagged for multi-pen export.
  const lines: FlowLine[] = marks.map((m) => ({ points: m.points, layer: m.layer }));

  // 6. Residual hand finish, then clip and reorder. The bulk of the wobble
  // is already in the centerlines (see buildTangleScene) where occlusion
  // could account for it exactly; this pass only adds per-stroke pen
  // texture, so its amplitude is small, its jitter is off (whole-stroke
  // misregistration detaches rings from their edges — the strand-level
  // offset happened in geometry), and its displacement is hard-capped at
  // the reach the occluders were inflated by.
  const strokeWobble = o.wobble * 0.3;
  const finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    {
      amplitude: strokeWobble,
      wavelength: 42,
      jitter: 0,
      seed: subSeed(seed, 6),
      maxDisplacement: strokeWobble * 1.5,
    }
  ).lines.flatMap((l) =>
    clipPolylineToRect(l.points, x0, y0, x1, y1).map((pts) => ({ ...l, points: pts }))
  );

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Reorder only — rings and cuff ellipses are discrete shapes; chaining
  // would fuse them into the edges and soften every ring end-cap.
  return o.optimize !== false ? orderPlot(result) : result;
}
