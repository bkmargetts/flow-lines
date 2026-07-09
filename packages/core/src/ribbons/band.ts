import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import type { SimplexNoise } from '../noise.js';
import { circularDelta, sampleAt, type Strand } from './warp.js';

/**
 * Band construction: every strand centerline is swept to a constant-width
 * band drawn as two edge outlines, cross-band "rungs" that bow with the
 * surface (the cross-contour curvature cue), and longitudinal shade hatch
 * hugging the shadow-side edge in hand-sized patches.
 *
 * Twists are a width envelope: through a twist the signed half-width sweeps
 * +h → −h with a cosine ease, so the two edges cross at the pinch — the
 * bow-tie silhouette of a flipped ribbon. A closed loop must carry an even
 * number of twists (one twist makes a Möbius band whose edge can't close),
 * so twists always come in pairs.
 */

export interface Mark {
  points: Point[];
  /** Arc position along the source strand per point — lets the occluder pass
   *  exempt a strand's own over-window from erasing its own marks. */
  arcs: number[];
  layer: string;
  strand: number;
}

export interface BandProfile {
  /** Signed width envelope per centerline point: +1, easing through −1 and
   *  back across the twist pair. */
  m: number[];
  twistArcs: number[];
}

export type RibbonStyle = 'band' | 'silk';

export interface BandOptions {
  /** 'band': constant-width woven band. 'silk': flat-ribbon treatment —
   *  apparent width follows travel direction (a draped ribbon narrows as it
   *  tilts away), cross-contour arcs hug one edge instead of spanning the
   *  band, and shading is oblique hatch rather than cylinder-longitudinal. */
  style: RibbonStyle;
  bandWidth: number;
  rungs: number;
  rungCurve: number;
  shading: number;
  shadowHatch: number;
  lightAngle: number;
  twists: number;
  penWidth: number;
  cell: number;
  seed: number;
}

/** Cosine step from +1 (before) to −1 (after) across a window of ±w. */
function twistRamp(d: number, w: number): number {
  if (d <= -w) return 1;
  if (d >= w) return -1;
  return Math.cos((Math.PI * (d + w)) / (2 * w));
}

/**
 * Draw the per-strand genome (twist gate + candidate positions + rung phase)
 * and build the width envelope. All rands are drawn unconditionally in fixed
 * order so the geometry never re-rolls as knobs move.
 */
export function bandProfile(
  strand: Strand,
  k: number,
  crossingArcs: number[],
  o: BandOptions,
  drapeNoise: SimplexNoise
): { profile: BandProfile; rungPhase: number } {
  const rand = makeRandom(subSeed(o.seed, 5) + k * 17);
  const gate = rand();
  const jitterA = rand();
  const jitterB = rand();
  const rungPhase = rand();

  const twistArcs: number[] = [];
  const window = 1.7 * o.bandWidth;
  if (gate < o.twists && strand.len > 10 * window) {
    // A twist under an over-pass reads as mud, and crossings are dense, so
    // random placement never clears them. Instead: find the largest
    // crossing-free gaps along the strand and pinch at their centers.
    const sorted = [...crossingArcs].sort((p, q) => p - q);
    const gaps: { center: number; half: number }[] = [];
    if (sorted.length === 0) {
      gaps.push(
        { center: jitterA * strand.len, half: strand.len / 4 },
        { center: jitterB * strand.len, half: strand.len / 4 }
      );
    } else {
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + strand.len;
        gaps.push({ center: ((a + b) / 2) % strand.len, half: (b - a) / 2 });
      }
      gaps.sort((p, q) => q.half - p.half || p.center - q.center);
    }
    // Twist count scales with strand length (always even — one twist on a
    // closed loop is a Möbius band whose edges can't close). Greedy pick of
    // the clearest gaps, kept well apart.
    const minClear = 1.1 * o.bandWidth;
    const target = 2 * Math.max(1, Math.round((o.twists * strand.len) / (16 * o.cell)));
    for (const g of gaps) {
      if (twistArcs.length >= target) break;
      if (g.half <= minClear) continue;
      let clear = true;
      for (const t of twistArcs) {
        if (Math.abs(circularDelta(g.center, t, strand.len)) <= 4 * window) {
          clear = false;
          break;
        }
      }
      if (clear) twistArcs.push(g.center);
    }
    if (twistArcs.length % 2 === 1) twistArcs.pop();
  }

  const m: number[] = new Array(strand.pts.length);
  for (let i = 0; i < strand.pts.length; i++) {
    let v = 1;
    for (const t of twistArcs) {
      v *= twistRamp(circularDelta(strand.arc[i], t, strand.len), window);
    }
    if (o.style === 'silk') {
      // Flat-ribbon drape: apparent width follows travel direction — full
      // width face-on, narrowing as the ribbon "tilts away". The drape axis
      // drifts slowly across the page so the modulation reads as cloth
      // hanging, not as a mechanical rule.
      const n = strand.normals[i];
      const theta = Math.atan2(-n.x, n.y); // tangent angle
      const drift = drapeNoise.noise2D(
        strand.pts[i].x / (6 * o.cell),
        strand.pts[i].y / (6 * o.cell)
      );
      const axis = -Math.PI / 4 + drift * 0.7;
      v *= 0.38 + 0.62 * Math.pow(Math.abs(Math.sin(theta - axis)), 0.9);
    }
    m[i] = v;
  }
  return { profile: { m, twistArcs }, rungPhase };
}

/** Append the wrap point so downstream splitting never needs wrap logic. */
function closeRun(pts: Point[], arcs: number[], first: Point, firstArc: number): void {
  pts.push({ ...first });
  arcs.push(firstArc);
}

export function buildBandMarks(
  strand: Strand,
  k: number,
  profile: BandProfile,
  rungPhase: number,
  shadeNoise: SimplexNoise,
  o: BandOptions
): Mark[] {
  const marks: Mark[] = [];
  const n = strand.pts.length;
  const h = o.bandWidth / 2;
  const { m } = profile;

  // --- Edges -------------------------------------------------------------
  // Signed half-width: through a twist the edges sweep across each other.
  // At each twist pinch one edge yields a small gap (alternating sides) so
  // the crossing edges read as over/under rather than an X.
  const edgeGapAt = (arc: number, side: 0 | 1): boolean => {
    for (let t = 0; t < profile.twistArcs.length; t++) {
      if (t % 2 !== side) continue;
      const d = Math.abs(circularDelta(arc, profile.twistArcs[t], strand.len));
      if (d < 0.6 * o.bandWidth) return true;
    }
    return false;
  };
  for (const side of [0, 1] as const) {
    const sign = side === 0 ? 1 : -1;
    let pts: Point[] = [];
    let arcs: number[] = [];
    let firstOpen: { p: Point; arc: number } | null = null;
    const flush = () => {
      if (pts.length >= 2) marks.push({ points: pts, arcs, layer: 'edge', strand: k });
      pts = [];
      arcs = [];
    };
    for (let i = 0; i < n; i++) {
      if (edgeGapAt(strand.arc[i], side)) {
        flush();
        continue;
      }
      const off = sign * h * m[i];
      const p = {
        x: strand.pts[i].x + strand.normals[i].x * off,
        y: strand.pts[i].y + strand.normals[i].y * off,
      };
      if (pts.length === 0 && i === 0) firstOpen = { p, arc: 0 };
      pts.push(p);
      arcs.push(strand.arc[i]);
    }
    // Close the loop visually when no gap interrupted the seam.
    if (pts.length >= 2 && firstOpen && !edgeGapAt(0, side)) {
      closeRun(pts, arcs, firstOpen.p, strand.len);
    }
    flush();
  }

  // --- Rungs ---------------------------------------------------------------
  if (o.rungs > 0.02 && o.style === 'band') {
    const step = o.bandWidth * (0.6 + 1.5 * (1 - o.rungs));
    const bow = o.rungCurve * o.bandWidth * 0.22;
    for (let a = rungPhase * step; a < strand.len - step * 0.25; a += step) {
      const s = sampleAt(strand, a);
      const idx = s.i;
      const mv = m[idx];
      if (Math.abs(mv) < 0.5) continue; // pinch zone
      const reach = h * mv * 0.88;
      const pts: Point[] = [];
      const arcs: number[] = [];
      const SAMPLES = 4;
      for (let j = 0; j < SAMPLES; j++) {
        const t = j / (SAMPLES - 1);
        const off = reach * (1 - 2 * t);
        const bowOff = bow * Math.sin(Math.PI * t);
        pts.push({
          x: s.p.x + s.n.x * off + s.t.x * bowOff,
          y: s.p.y + s.n.y * off + s.t.y * bowOff,
        });
        arcs.push(a);
      }
      marks.push({ points: pts, arcs, layer: 'rung', strand: k });
    }
  }

  // Silk cross-contour: sparse one-sided arcs that hug alternating edges and
  // die out near the centre — the surface-curvature cue of a flat ribbon,
  // without the segmented-hose reading of full-width rungs.
  if (o.rungs > 0.02 && o.style === 'silk') {
    const step = o.bandWidth * (0.9 + 2.2 * (1 - o.rungs));
    const bow = o.rungCurve * o.bandWidth * 0.2;
    let side = 1;
    for (let a = rungPhase * step; a < strand.len - step * 0.25; a += step) {
      const s = sampleAt(strand, a);
      const mv = m[s.i];
      if (Math.abs(mv) < 0.45) continue;
      const reach = h * mv;
      const pts: Point[] = [];
      const arcs: number[] = [];
      const SAMPLES = 4;
      for (let j = 0; j < SAMPLES; j++) {
        const t = j / (SAMPLES - 1);
        const off = reach * side * (0.86 - 1.05 * t); // near edge → past centre
        const bowOff = bow * Math.sin(Math.PI * t);
        pts.push({
          x: s.p.x + s.n.x * off + s.t.x * bowOff,
          y: s.p.y + s.n.y * off + s.t.y * bowOff,
        });
        arcs.push(a);
      }
      marks.push({ points: pts, arcs, layer: 'rung', strand: k });
      side = -side;
    }
  }

  // Silk shading: short oblique hatch ticks slanting inward from the shadow
  // edge, in noise-gated patches — longitudinal strokes are precisely how a
  // CYLINDER is shaded, so the band style keeps them and silk must not.
  // Emitted on the 'shadow' layer so occlusion whole-drops a touched tick
  // (a clipped sliver of hatch reads as dirt).
  if (o.shading > 0.05 && o.style === 'silk') {
    const lx = Math.cos(o.lightAngle);
    const ly = Math.sin(o.lightAngle);
    const step = o.penWidth * 2.6;
    for (let a = rungPhase * step; a < strand.len - step * 0.25; a += step) {
      const s = sampleAt(strand, a);
      const mv = m[s.i];
      const edgeDist = Math.abs(h * mv);
      if (edgeDist < 0.2 * o.bandWidth) continue;
      const sSign = s.n.x * lx + s.n.y * ly < 0 ? 1 : -1;
      const gate = shadeNoise.noise2D(a / (2.4 * o.cell), 3.7 + k * 13.1);
      if (gate > o.shading * 1.3 - 0.42) continue;
      // From just inside the shadow edge, slanting inward and backward.
      let dx = -s.n.x * sSign * 0.78 + s.t.x * 0.63;
      let dy = -s.n.y * sSign * 0.78 + s.t.y * 0.63;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const tickLen = edgeDist * 0.95;
      const x0 = s.p.x + s.n.x * sSign * edgeDist * 0.88;
      const y0 = s.p.y + s.n.y * sSign * edgeDist * 0.88;
      const pts: Point[] = [];
      const arcs: number[] = [];
      for (let j = 0; j < 3; j++) {
        const t = j / 2;
        pts.push({ x: x0 + dx * tickLen * t, y: y0 + dy * tickLen * t });
        arcs.push(a);
      }
      marks.push({ points: pts, arcs, layer: 'shadow', strand: k });
    }
  }

  // --- Shade hatch -----------------------------------------------------------
  // Longitudinal strokes hugging the shadow-side edge, in noise-gated patches.
  if (o.shading > 0.05 && o.style === 'band') {
    const lx = Math.cos(o.lightAngle);
    const ly = Math.sin(o.lightAngle);
    const K = Math.max(1, Math.round(1 + o.shading * 2.6));
    // Enough separation that the innermost stroke reads as tone, not as a
    // doubled outline hugging the edge.
    const spacing = o.penWidth * 2.4;
    for (let kk = 1; kk <= K; kk++) {
      let pts: Point[] = [];
      let arcs: number[] = [];
      let runSide = 0;
      const flush = () => {
        if (pts.length >= 3) marks.push({ points: pts, arcs, layer: 'shade', strand: k });
        pts = [];
        arcs = [];
      };
      for (let i = 0; i < n; i++) {
        const edgeDist = Math.abs(h * m[i]);
        const inset = edgeDist - kk * spacing;
        if (inset < 0.15 * o.bandWidth) {
          flush();
          continue;
        }
        // Shadow side: offset away from the light. A side flip means the
        // ribbon turned through the light — lift the pen, don't jump across.
        const sSign = strand.normals[i].x * lx + strand.normals[i].y * ly < 0 ? 1 : -1;
        if (sSign !== runSide && pts.length > 0) flush();
        runSide = sSign;
        const gate = shadeNoise.noise2D(
          strand.arc[i] / (2.4 * o.cell),
          kk * 3.7 + k * 13.1
        );
        if (gate > o.shading * 1.3 - 0.42 - (kk - 1) * 0.32) {
          flush();
          continue;
        }
        pts.push({
          x: strand.pts[i].x + strand.normals[i].x * sSign * inset,
          y: strand.pts[i].y + strand.normals[i].y * sSign * inset,
        });
        arcs.push(strand.arc[i]);
      }
      flush();
    }
  }

  return marks;
}
