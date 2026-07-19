import type { Point } from '../flow-lines.js';
import type { SimplexNoise } from '../noise.js';
import { lerp, clamp01 } from '../lib/math.js';
import {
  TAU,
  type Archetype,
  type Composition,
  type GesturePreset,
  type PlacedGesture,
  type PlacedKnot,
  type PlacedWhip,
  type Spine,
} from './types.js';
import { makeSpine, moveSpineTo, spineCentroid, spineExit } from './spine.js';

const DEG = Math.PI / 180;

export const ARCHETYPES: Record<Exclude<GesturePreset, 'auto'>, Archetype> = {
  // Massive near-straight bars on structural axes; bleed past the frame is
  // part of the language.
  kline: {
    gestures: [2, 4],
    whips: [0, 1],
    knots: [0, 0],
    sweep: [0.05, 0.35],
    lengthFrac: [0.7, 1.05],
    headings: [0, 90 * DEG, 45 * DEG, -45 * DEG],
    bleed: true,
    inkScale: 1.25,
    entryFrac: 0.04,
    exitFrac: 0.1,
    drynessBias: 0,
    spatterBias: -0.15,
    whipBundle: false,
  },
  // One enso-like sweep plus flicks echoing its release; dry and spattered.
  sumi: {
    gestures: [1, 1],
    whips: [2, 4],
    knots: [0, 0],
    sweep: [3.5, 5.5],
    lengthFrac: [1.1, 1.5],
    headings: null,
    bleed: false,
    inkScale: 0.85,
    entryFrac: 0.12,
    exitFrac: 0.4,
    drynessBias: 0.2,
    spatterBias: 0.2,
    whipBundle: false,
  },
  // A bundle of long parallel whips anchored by one short dark mass.
  hartung: {
    gestures: [1, 1],
    whips: [6, 9],
    knots: [0, 1],
    sweep: [0.2, 0.7],
    lengthFrac: [0.25, 0.4],
    headings: null,
    bleed: false,
    inkScale: 1.3,
    entryFrac: 0.07,
    exitFrac: 0.3,
    drynessBias: 0.1,
    spatterBias: 0,
    whipBundle: true,
  },
  // A dominant scribble knot with one sweep passing through it.
  tangle: {
    gestures: [1, 2],
    whips: [1, 2],
    knots: [1, 1],
    sweep: [0.6, 1.6],
    lengthFrac: [0.6, 0.9],
    headings: null,
    bleed: false,
    inkScale: 0.9,
    entryFrac: 0.1,
    exitFrac: 0.28,
    drynessBias: 0,
    spatterBias: 0,
    whipBundle: false,
  },
};

/** One weighted rng draw resolves 'auto' — drawn first, in fixed order. */
export function pickArchetype(u: number): Exclude<GesturePreset, 'auto'> {
  if (u < 0.3) return 'kline';
  if (u < 0.6) return 'sumi';
  if (u < 0.8) return 'hartung';
  return 'tangle';
}

/** Resolved knobs the composition engine works from. */
export interface ComposeOptions {
  width: number;
  height: number;
  margin: number;
  arch: Archetype;
  gestureCount: number;
  whipCount: number;
  knotCount: number;
  energy: number;
  maxHalf: number;
  coverage: number;
  balance: number;
  negativeSpace: number;
  passSpacing: number;
  /**
   * Optional cap (px) on the dimension mark sizes derive from (stroke
   * lengths, knot radii, bundle pitch, anchor jitter). On sheets whose min
   * work dimension exceeds it, marks keep their tuned physical size while
   * placement still spans the real work rect — more gestures, not bigger
   * ones. Unset = min work dimension exactly as before.
   */
  refMinDim?: number;
}

interface Candidate {
  spine: Spine;
  energy: number;
  mass: number;
  centroid: Point;
}

/**
 * Decide the whole composition: place primaries and counter-gestures by
 * scored candidates (asymmetric balance, containment, ink-over-ink crossing
 * bonus, negative-space veto), then spend what's left of the ink budget on
 * whips and knots. Rendering never second-guesses these decisions.
 *
 * Determinism discipline: every candidate draws the SAME fixed tuple from the
 * rng before any scoring happens, so tuning score weights can never shift the
 * rng stream.
 */
export function compose(o: ComposeOptions, rng: () => number, noise: SimplexNoise): Composition {
  const x0 = o.margin;
  const y0 = o.margin;
  const x1 = o.width - o.margin;
  const y1 = o.height - o.margin;
  const workW = Math.max(1, x1 - x0);
  const workH = Math.max(1, y1 - y0);
  const minDim = Math.min(workW, workH);
  // Mark sizes (lengths, radii, jitter) anchor at refMinDim on oversized
  // sheets; placement, balance, and the ink budget keep the real dimensions.
  const sizingDim = Math.min(minDim, o.refMinDim ?? Infinity);
  const center = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const budget = o.coverage * workW * workH;

  // --- balance + coverage bookkeeping -------------------------------------
  let totalMass = 0;
  let momentX = 0;
  let momentY = 0;
  const grid = new Float64Array(9); // 3×3 coverage cells over the work rect
  const quietTarget = Math.round(9 * clamp01(o.negativeSpace));

  const cellOf = (p: Point): number => {
    const cx = Math.min(2, Math.max(0, Math.floor(((p.x - x0) / workW) * 3)));
    const cy = Math.min(2, Math.max(0, Math.floor(((p.y - y0) / workH) * 3)));
    return cy * 3 + cx;
  };
  const stampSpine = (g: Float64Array, pts: Point[], mass: number): void => {
    for (const p of pts) g[cellOf(p)] += mass / pts.length;
  };
  const quietCells = (g: Float64Array): number => {
    let max = 0;
    for (const v of g) max = Math.max(max, v);
    if (max <= 0) return 9;
    let quiet = 0;
    for (const v of g) if (v < max * 0.1) quiet++;
    return quiet;
  };
  const commit = (pts: Point[], mass: number, centroid: Point): void => {
    stampSpine(grid, pts, mass);
    totalMass += mass;
    momentX += mass * (centroid.x - center.x);
    momentY += mass * (centroid.y - center.y);
  };

  // --- dominant axis + thirds anchor (fixed rng order) ---------------------
  const snapDraw = rng();
  const jitterDraw = rng();
  const diagSign = rng() < 0.5 ? -1 : 1;
  let thetaDom: number;
  if (o.arch.headings) {
    const axis = o.arch.headings[Math.floor(snapDraw * o.arch.headings.length) % o.arch.headings.length];
    thetaDom = axis + (jitterDraw - 0.5) * 12 * DEG;
  } else {
    thetaDom = diagSign * (20 * DEG + 50 * DEG * jitterDraw);
  }
  const anchor = {
    x: x0 + workW * (rng() < 0.5 ? 1 / 3 : 2 / 3) + (rng() - 0.5) * 0.08 * sizingDim,
    y: y0 + workH * (rng() < 0.5 ? 1 / 3 : 2 / 3) + (rng() - 0.5) * 0.08 * sizingDim,
  };

  // --- primaries ------------------------------------------------------------
  const gestures: PlacedGesture[] = [];
  const gestureMass = (spine: Spine, maxHalf: number): number => spine.length * maxHalf * 1.1;

  const drawGestureCandidate = (at: Point, heading: number, lengthScale: number, track: number): Candidate => {
    // Fixed draw tuple: length, sweep magnitude, sweep sign, energy, reverse.
    const lengthU = rng();
    const sweepU = rng();
    const signU = rng();
    const energyU = rng();
    const reverseU = rng();
    const length = lerp(o.arch.lengthFrac[0], o.arch.lengthFrac[1], lengthU) * sizingDim * lengthScale;
    const sweep = lerp(o.arch.sweep[0], o.arch.sweep[1], sweepU) * (signU < 0.5 ? -1 : 1);
    const energy = clamp01(o.energy * (0.85 + 0.3 * energyU));
    // The S-reversal never applies to a near-closed enso.
    const reverseAt =
      Math.abs(sweep) < 2 && reverseU < 0.25 * energy ? 0.55 + 0.25 * reverseU * 4 : -1;
    const spine = makeSpine(
      { start: { x: 0, y: 0 }, heading, length, curvature: sweep / length, energy, reverseAt, track },
      noise
    );
    moveSpineTo(spine, at);
    const maxHalf = o.maxHalf;
    return { spine, energy, mass: gestureMass(spine, maxHalf), centroid: spineCentroid(spine.points) };
  };

  const containment = (pts: Point[]): number => {
    let inside = 0;
    for (const p of pts) if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) inside++;
    return inside / pts.length;
  };

  const crossingAngle = (a: Spine, b: Spine): number | null => {
    // Decimated segment-intersection sweep; returns the crossing angle if any.
    const step = 4;
    for (let i = step; i < a.points.length; i += step) {
      const a0 = a.points[i - step];
      const a1 = a.points[i];
      for (let j = step; j < b.points.length; j += step) {
        const b0 = b.points[j - step];
        const b1 = b.points[j];
        if (segmentsCross(a0, a1, b0, b1)) {
          const angA = Math.atan2(a1.y - a0.y, a1.x - a0.x);
          const angB = Math.atan2(b1.y - b0.y, b1.x - b0.x);
          let d = Math.abs(angA - angB) % Math.PI;
          if (d > Math.PI / 2) d = Math.PI - d;
          return d;
        }
      }
    }
    return null;
  };

  for (let g = 0; g < o.gestureCount; g++) {
    const track = 11 + g * 7.31;
    if (g === 0) {
      // The first primary is not negotiated: dominant axis through the anchor.
      const c = drawGestureCandidate(anchor, thetaDom, 1, track);
      gestures.push({ spine: c.spine, maxHalf: o.maxHalf, energy: c.energy, track });
      commit(c.spine.points, c.mass, c.centroid);
      continue;
    }

    // Draw ALL candidates before scoring (rng stream is score-independent).
    const candidates: Candidate[] = [];
    for (let k = 0; k < 12; k++) {
      const at = { x: x0 + rng() * workW, y: y0 + rng() * workH };
      const headingU = rng();
      const heading = o.arch.headings
        ? o.arch.headings[Math.floor(headingU * o.arch.headings.length) % o.arch.headings.length] +
          (rng() - 0.5) * 12 * DEG
        : thetaDom + (headingU - 0.5) * 140 * DEG;
      candidates.push(drawGestureCandidate(at, heading, 0.5 + 0.3 * ((g * 2.7) % 1), track + k * 0.013));
    }

    let best: Candidate | null = null;
    let bestScore = -Infinity;
    // Balance is a whole-sheet property, so the lean stays on the real dims.
    const targetLean = 0.2 * o.balance * minDim;
    for (const c of candidates) {
      const contain = containment(c.spine.points);
      if (contain < (o.arch.bleed ? 0.45 : 0.85)) continue;

      // Negative-space veto on a tentative stamp.
      const trial = Float64Array.from(grid);
      stampSpine(trial, c.spine.points, c.mass);
      if (quietCells(trial) < quietTarget) continue;

      // Asymmetric balance: lean toward a nonzero residual along the axis.
      const nm = totalMass + c.mass;
      const lx = (momentX + c.mass * (c.centroid.x - center.x)) / nm;
      const ly = (momentY + c.mass * (c.centroid.y - center.y)) / nm;
      const tx = Math.cos(thetaDom) * targetLean;
      const ty = Math.sin(thetaDom) * targetLean;
      const balanceScore = -Math.hypot(lx - tx, ly - ty) / minDim;

      let crossBonus = 0;
      for (const placed of gestures) {
        const ang = crossingAngle(c.spine, placed.spine);
        if (ang !== null && ang > 50 * DEG) crossBonus = Math.max(crossBonus, 1);
      }

      const score = 4 * balanceScore + 1.5 * contain + 1.2 * crossBonus;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) continue; // all candidates vetoed — restraint over force
    gestures.push({ spine: best.spine, maxHalf: o.maxHalf, energy: best.energy, track });
    commit(best.spine.points, best.mass, best.centroid);
  }

  // --- knots ------------------------------------------------------------------
  const knots: PlacedKnot[] = [];
  for (let i = 0; i < o.knotCount; i++) {
    const big = o.arch.knots[1] === 1 && o.arch.gestures[1] <= 2; // tangle's dominant knot
    const radius = (big ? lerp(0.1, 0.16, rng()) : lerp(0.03, 0.06, rng())) * sizingDim;
    // The dominant knot sits where the first primary passes (sweep through
    // it); lesser knots take a free thirds point.
    const base = big && gestures.length > 0 ? spineCentroid(gestures[0].spine.points) : anchor;
    const knotCenter = {
      x: base.x + (rng() - 0.5) * 0.1 * sizingDim,
      y: base.y + (rng() - 0.5) * 0.1 * sizingDim,
    };
    const heading = rng() * TAU;
    const mass = Math.PI * radius * radius * 0.35;
    if (totalMass + mass > budget && knots.length + gestures.length > 1) continue;
    knots.push({ center: knotCenter, radius, heading, track: 300 + i * 5.17 });
    commit([knotCenter], mass, knotCenter);
  }

  // --- whips --------------------------------------------------------------------
  const whips: PlacedWhip[] = [];
  if (o.arch.whipBundle && o.whipCount > 0) {
    // One parallel bundle: shared heading, jittered lateral pitch, anchored
    // across the frame from the dark mass.
    const bundleAnchor = {
      x: x0 + workW * (anchor.x > center.x ? 1 / 3 : 2 / 3),
      y: y0 + workH * (anchor.y > center.y ? 1 / 3 : 2 / 3),
    };
    const pitch = 0.05 * sizingDim;
    const nx = -Math.sin(thetaDom);
    const ny = Math.cos(thetaDom);
    // The whole bundle curves the same way — parallel sweeps of one wrist.
    const bundleSign = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < o.whipCount; i++) {
      const lateral = (i - (o.whipCount - 1) / 2) * pitch * (1 + 0.3 * (rng() - 0.5));
      const along = (rng() - 0.5) * 0.25 * sizingDim; // staggered starts, not a comb
      const length = lerp(0.4, 0.85, rng()) * sizingDim;
      const sweep = lerp(0.1, 0.6, rng()) * bundleSign;
      const energy = clamp01(o.energy * (0.9 + 0.4 * rng()));
      const track = 400 + i * 3.77;
      const spine = makeSpine(
        {
          start: { x: 0, y: 0 },
          heading: thetaDom + (rng() - 0.5) * 10 * DEG,
          length,
          curvature: sweep / length,
          energy,
          reverseAt: -1,
          track,
        },
        noise
      );
      moveSpineTo(spine, {
        x: bundleAnchor.x + nx * lateral + Math.cos(thetaDom) * along,
        y: bundleAnchor.y + ny * lateral + Math.sin(thetaDom) * along,
      });
      const mass = spine.length * 2;
      if (totalMass + mass > budget && whips.length > 1) continue;
      whips.push({ spine, energy, track });
      commit(spine.points, mass, spineCentroid(spine.points));
    }
  } else {
    // Whips echo a source gesture's release.
    for (let i = 0; i < o.whipCount; i++) {
      const source = gestures[i % Math.max(1, gestures.length)];
      const track = 400 + i * 3.77;
      const startU1 = rng();
      const startU2 = rng();
      const headU = rng();
      const lengthU = rng();
      const sweepU = rng();
      const signU = rng();
      const energyU = rng();
      if (!source) break;
      const exit = spineExit(source.spine);
      const start = {
        x: exit.point.x + (startU1 - 0.5) * 0.1 * sizingDim,
        y: exit.point.y + (startU2 - 0.5) * 0.1 * sizingDim,
      };
      const length = lerp(0.2, 0.45, lengthU) * sizingDim;
      const sweep = lerp(0.8, 2, sweepU) * (signU < 0.5 ? -1 : 1);
      const energy = clamp01(o.energy * (0.9 + 0.4 * energyU));
      const spine = makeSpine(
        {
          start,
          heading: exit.tangent + (headU - 0.5) * 50 * DEG,
          length,
          curvature: sweep / length,
          energy,
          reverseAt: -1,
          track,
        },
        noise
      );
      const mass = spine.length * 2;
      if (totalMass + mass > budget && whips.length + gestures.length > 1) continue;
      if (containment(spine.points) < 0.6) continue;
      whips.push({ spine, energy, track });
      commit(spine.points, mass, spineCentroid(spine.points));
    }
  }

  return { gestures, whips, knots, thetaDom };
}

function segmentsCross(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
  const d = (p: Point, q: Point, r: Point): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(b0, b1, a0);
  const d2 = d(b0, b1, a1);
  const d3 = d(a0, a1, b0);
  const d4 = d(a0, a1, b1);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
