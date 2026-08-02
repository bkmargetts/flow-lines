import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import type { SimplexNoise } from '../noise.js';
import { sampleAtOpen, type TangleStrand } from './strand.js';

/**
 * Hose construction: each centerline is swept to a constant-radius tube
 * drawn as two edge outlines, corrugation rings, and longitudinal shade
 * hatch hugging the shadow-side edge in hand-sized patches.
 *
 * The rings are the signature mark and they are NOT straight ticks: a
 * corrugation ridge wraps the cylinder, so each ring is a half-ellipse —
 * full tube width across, bulging along the axis toward the viewer — with
 * one consistent bow direction per hose (flipping per ring reads as noise).
 * Ring pitch is proportional to radius (thin and fat hoses read as the same
 * material at different scales) and compresses through bends, which is the
 * single most characteristic corrugated-hose behaviour: drawn along the
 * local normals the rings already fan toward the bend's centre for free,
 * and the pitch modulation crowds them on top of that.
 */

export interface Mark {
  points: Point[];
  /** Arc position along the source strand per point — lets the occluder pass
   *  exempt a strand's own over-window from erasing its own marks. */
  arcs: number[];
  layer: string;
  strand: number;
}

export interface HoseMarkOptions {
  /** 0..1 ring pitch (pitch ∝ radius). */
  ringDensity: number;
  /** 0..1 ellipse bulge on the rings. */
  ringCurve: number;
  /** 0..1 shadow-side longitudinal hatch strength. */
  shading: number;
  /** Light direction, radians. */
  lightAngle: number;
  penWidth: number;
  seed: number;
}

/** How far a hose end's cuff hardware reaches along the axis, in radii. */
export const CUFF_REACH = 1.1;

export function buildHoseMarks(
  strand: TangleStrand,
  k: number,
  cuffStart: boolean,
  cuffEnd: boolean,
  shadeNoise: SimplexNoise,
  o: HoseMarkOptions
): Mark[] {
  const marks: Mark[] = [];
  const n = strand.pts.length;
  const r = strand.r;

  // Per-hose genome, drawn unconditionally in fixed order so the geometry
  // never re-rolls as knobs move.
  const rand = makeRandom(subSeed(o.seed, 5) + k * 17);
  const ringPhase = rand();
  const bowRoll = rand();
  const doubleRoll = rand();
  const bowSign = bowRoll < 0.5 ? 1 : -1;
  const doubles = doubleRoll < 0.7 && r >= 13;

  // --- Edges ---------------------------------------------------------------
  for (const side of [1, -1] as const) {
    const pts: Point[] = [];
    const arcs: number[] = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: strand.pts[i].x + strand.normals[i].x * side * r,
        y: strand.pts[i].y + strand.normals[i].y * side * r,
      });
      arcs.push(strand.arc[i]);
    }
    marks.push({ points: pts, arcs, layer: 'edge', strand: k });
  }

  // --- Corrugation rings -----------------------------------------------------
  if (o.ringDensity > 0.02) {
    const baseStep = Math.max(2.5 * o.penWidth, r * (0.5 + 1.1 * (1 - o.ringDensity)));
    const bow = o.ringCurve * r * 0.4;
    const ringLo = cuffStart ? CUFF_REACH * r : 0;
    const ringHi = strand.len - (cuffEnd ? CUFF_REACH * r : 0);
    const kappaAt = (a: number): number => {
      const dd = Math.max(2, r * 0.6);
      const t0 = sampleAtOpen(strand, a - dd).t;
      const t1 = sampleAtOpen(strand, a + dd).t;
      const cross = t0.x * t1.y - t0.y * t1.x;
      const dot = t0.x * t1.x + t0.y * t1.y;
      return Math.abs(Math.atan2(cross, dot)) / (2 * dd);
    };
    let a = ringLo + ringPhase * baseStep;
    while (a < ringHi - baseStep * 0.2) {
      // Rings crowd through bends — the corrugation compresses on the
      // inside. Drawn along the local normals they already fan toward the
      // bend's centre, so the pitch squeeze stays gentle: the fan alone
      // nearly closes the inside spacing, and any more crowding makes the
      // inside of a tight bend read as a solid black smear.
      const squeeze = Math.max(0.7, Math.min(1, 1 - 0.35 * kappaAt(a) * r));
      emitRing(marks, strand, k, a, r * 0.96, bowSign * bow);
      if (doubles && squeeze > 0.85) {
        // Twin ridges only on straight-ish runs — in a bend the fan
        // already stacks rings; a twin there is mud.
        const a2 = a + Math.max(1.6 * o.penWidth, 0.16 * r);
        if (a2 < ringHi) emitRing(marks, strand, k, a2, r * 0.96, bowSign * bow * 0.8);
      }
      a += baseStep * squeeze;
    }
  }

  // --- Shade hatch -----------------------------------------------------------
  // Longitudinal strokes hugging the shadow-side edge, in noise-gated
  // patches — precisely how a cylinder is shaded.
  if (o.shading > 0.05) {
    const lx = Math.cos(o.lightAngle);
    const ly = Math.sin(o.lightAngle);
    const K = Math.max(1, Math.round(1 + o.shading * 2.6));
    const spacing = o.penWidth * 2.4;
    const shadeCell = 3 * r;
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
        const inset = r - kk * spacing;
        if (inset < 0.3 * r) {
          flush();
          continue;
        }
        // Shadow side: offset away from the light. A side flip means the
        // hose turned through the light — lift the pen, don't jump across.
        const sSign = strand.normals[i].x * lx + strand.normals[i].y * ly < 0 ? 1 : -1;
        if (sSign !== runSide && pts.length > 0) flush();
        runSide = sSign;
        const gate = shadeNoise.noise2D(strand.arc[i] / (2.4 * shadeCell), kk * 3.7 + k * 13.1);
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

  // --- Cuffs -----------------------------------------------------------------
  if (cuffStart) marks.push(...cuffMarks(strand, k, 'start', o));
  if (cuffEnd) marks.push(...cuffMarks(strand, k, 'end', o));

  return marks;
}

/** One corrugation ring: a half-ellipse wrapping the cylinder — semi-major
 *  `reach` across the tube, semi-minor `bow` along it. */
function emitRing(
  marks: Mark[],
  strand: TangleStrand,
  k: number,
  a: number,
  reach: number,
  bow: number
): void {
  const s = sampleAtOpen(strand, a);
  const pts: Point[] = [];
  const arcs: number[] = [];
  const SAMPLES = 7;
  for (let j = 0; j < SAMPLES; j++) {
    const t = j / (SAMPLES - 1);
    const across = reach * Math.cos(Math.PI * t);
    const along = bow * Math.sin(Math.PI * t);
    pts.push({
      x: s.p.x + s.n.x * across + s.t.x * along,
      y: s.p.y + s.n.y * across + s.t.y * along,
    });
    arcs.push(a);
  }
  marks.push({ points: pts, arcs, layer: 'ring', strand: k });
}

/**
 * An on-page hose end: a short stiff collar (two tight low-bow rings), the
 * mouth ellipse seen obliquely, an inner wall, and a few shade ticks inside
 * the opening. The mouth is on the 'edge' layer — a partially occluded mouth
 * should split, not vanish; the ticks are 'shadow' and drop whole.
 */
function cuffMarks(
  strand: TangleStrand,
  k: number,
  end: 'start' | 'end',
  o: HoseMarkOptions
): Mark[] {
  const marks: Mark[] = [];
  const r = strand.r;
  const endArc = end === 'start' ? 0 : strand.len;
  const s = sampleAtOpen(strand, endArc);
  const tOut = end === 'start' ? { x: -s.t.x, y: -s.t.y } : s.t;
  const nrm = s.n;
  const CUFF_OPEN = 0.34;

  // Collar rings: the stiff end fitting — tight pitch, reduced bow.
  for (const d of [0.4 * r, 0.78 * r]) {
    const a = end === 'start' ? d : strand.len - d;
    const smp = sampleAtOpen(strand, a);
    const pts: Point[] = [];
    const arcs: number[] = [];
    const SAMPLES = 7;
    const bow = o.ringCurve * r * 0.16 * (end === 'start' ? -1 : 1);
    for (let j = 0; j < SAMPLES; j++) {
      const t = j / (SAMPLES - 1);
      pts.push({
        x: smp.p.x + smp.n.x * r * 0.98 * Math.cos(Math.PI * t) + smp.t.x * bow * Math.sin(Math.PI * t),
        y: smp.p.y + smp.n.y * r * 0.98 * Math.cos(Math.PI * t) + smp.t.y * bow * Math.sin(Math.PI * t),
      });
      arcs.push(a);
    }
    marks.push({ points: pts, arcs, layer: 'ring', strand: k });
  }

  // Mouth ellipse (outer rim) and inner wall, centred on the end point.
  for (const scale of [1, 0.78]) {
    const pts: Point[] = [];
    const arcs: number[] = [];
    const S = scale === 1 ? 24 : 18;
    for (let j = 0; j <= S; j++) {
      const phi = (2 * Math.PI * j) / S;
      pts.push({
        x: s.p.x + nrm.x * r * scale * Math.cos(phi) + tOut.x * r * CUFF_OPEN * scale * Math.sin(phi),
        y: s.p.y + nrm.y * r * scale * Math.cos(phi) + tOut.y * r * CUFF_OPEN * scale * Math.sin(phi),
      });
      arcs.push(endArc);
    }
    marks.push({ points: pts, arcs, layer: 'edge', strand: k });
  }

  // Shade ticks inside the mouth's shadow half — the opening reads hollow.
  const lx = Math.cos(o.lightAngle);
  const ly = Math.sin(o.lightAngle);
  const sSign = nrm.x * lx + nrm.y * ly < 0 ? 1 : -1;
  for (let i = 1; i <= 3; i++) {
    const off = sSign * r * (0.18 + 0.18 * i);
    const chord = CUFF_OPEN * r * Math.sqrt(Math.max(0, 1 - (off / r) ** 2)) * 0.75;
    const pts: Point[] = [];
    const arcs: number[] = [];
    for (let j = 0; j < 3; j++) {
      const t = j / 2;
      const along = chord * (2 * t - 1);
      pts.push({
        x: s.p.x + nrm.x * off + tOut.x * along,
        y: s.p.y + nrm.y * off + tOut.y * along,
      });
      arcs.push(endArc);
    }
    marks.push({ points: pts, arcs, layer: 'shadow', strand: k });
  }

  return marks;
}
