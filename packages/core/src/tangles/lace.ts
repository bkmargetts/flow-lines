import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { sampleAtOpen, type TangleStrand } from './strand.js';
import type { Mark } from './hose.js';

/**
 * Shoelace construction: a lace is a FLAT ribbon, not a tube — two clean
 * edges, no corrugation, no cylinder shade. Its character comes from three
 * things: twist flips (the ribbon turns over — a width envelope pinches to
 * a point and back, the bow-tie silhouette, borrowed from the ribbon-weave
 * module's twists), aglets (the stiff little capsule tips) on on-page
 * ends, and the crinkly wander the growth pass already gave it.
 *
 * Twists sit at the centres of the largest crossing-free gaps along the
 * strand — a flip under an over-pass reads as mud — and at each pinch one
 * edge (alternating sides) lifts for a short gap so the flip reads as the
 * ribbon turning over, not as an X.
 */

export interface LaceMarkOptions {
  /** 0..1 twist-flip frequency. */
  twists: number;
  penWidth: number;
  seed: number;
}

/** Cosine step from +1 (before) to −1 (after) across a window of ±w. */
function twistRamp(d: number, w: number): number {
  if (d <= -w) return 1;
  if (d >= w) return -1;
  return Math.cos((Math.PI * (d + w)) / (2 * w));
}

export function buildLaceMarks(
  strand: TangleStrand,
  k: number,
  cuffStart: boolean,
  cuffEnd: boolean,
  crossingArcs: number[],
  o: LaceMarkOptions
): Mark[] {
  const marks: Mark[] = [];
  const n = strand.pts.length;
  const r = strand.r;
  const width = 2 * r;
  // A drawn flip stretches over a few widths — compressed flips vanish
  // into the wobble at lace scale.
  const window = 2.5 * width;

  // Per-lace genome, drawn unconditionally in fixed order.
  const rand = makeRandom(subSeed(o.seed, 5) + k * 17);
  const jitterA = rand();
  rand(); // parity with the hose stream (bow roll)
  rand(); // parity with the hose stream (doubles roll)

  // --- Twist placement -------------------------------------------------------
  // Largest crossing-free gaps first; open strand, so an odd count is fine.
  const twistArcs: number[] = [];
  if (o.twists > 0.02 && strand.len > 8 * window) {
    const sorted = [...crossingArcs].sort((p, q) => p - q);
    const gaps: { center: number; half: number }[] = [];
    const endPad = (cuffStart ? 6 * r : 2 * r) + window;
    const stops = [endPad, ...sorted, strand.len - ((cuffEnd ? 6 * r : 2 * r) + window)];
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (b - a > 2 * window) gaps.push({ center: (a + b) / 2, half: (b - a) / 2 });
    }
    gaps.sort((p, q) => q.half - p.half || p.center - q.center);
    const target = Math.max(1, Math.round((o.twists * strand.len) / (14 * width)));
    for (const g of gaps) {
      if (twistArcs.length >= target) break;
      let clear = true;
      for (const t of twistArcs) {
        if (Math.abs(g.center - t) <= 5 * window) {
          clear = false;
          break;
        }
      }
      if (clear) twistArcs.push(g.center + (jitterA - 0.5) * 0.5 * g.half);
    }
  }

  // Signed width envelope: +1 sweeping through −1 across each twist.
  const m: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let v = 1;
    for (const t of twistArcs) v *= twistRamp(strand.arc[i] - t, window);
    m[i] = v;
  }

  // --- Edges -------------------------------------------------------------
  // Both edges run straight through each pinch: with the signed envelope
  // they cross at the waist, giving the bow-tie silhouette of a flat
  // ribbon turning over. (The ribbon-weave module gaps one edge at its
  // twists, but at lace scale a gap reads as a break, not a flip.)
  for (const sign of [1, -1] as const) {
    const pts: Point[] = [];
    const arcs: number[] = [];
    for (let i = 0; i < n; i++) {
      const off = sign * r * m[i];
      pts.push({
        x: strand.pts[i].x + strand.normals[i].x * off,
        y: strand.pts[i].y + strand.normals[i].y * off,
      });
      arcs.push(strand.arc[i]);
    }
    marks.push({ points: pts, arcs, layer: 'edge', strand: k });
  }

  // Fold shadow: two short ticks converging on the waist inside the
  // "after" triangle — the cue that turns an X into a fold. 'shadow'
  // layer so a touched tick drops whole.
  for (const t of twistArcs) {
    const waist = sampleAtOpen(strand, t).p;
    for (const frac of [0.45, 0.8]) {
      const a = t + frac * window;
      if (a > strand.len) continue;
      const s2 = sampleAtOpen(strand, a);
      const mv = twistArcs.reduce((v, tt) => v * twistRamp(a - tt, window), 1);
      const edgePt = {
        x: s2.p.x + s2.n.x * r * mv,
        y: s2.p.y + s2.n.y * r * mv,
      };
      const pts: Point[] = [];
      const arcs: number[] = [];
      for (const u of [0.3, 0.55, 0.82]) {
        pts.push({
          x: waist.x + (edgePt.x - waist.x) * u,
          y: waist.y + (edgePt.y - waist.y) * u,
        });
        arcs.push(a);
      }
      marks.push({ points: pts, arcs, layer: 'shadow', strand: k });
    }
  }

  // --- Aglets -----------------------------------------------------------------
  if (cuffStart) marks.push(...agletMarks(strand, k, 'start', o));
  if (cuffEnd) marks.push(...agletMarks(strand, k, 'end', o));

  return marks;
}

/**
 * An aglet: the stiff capsule tip of a lace, drawn as ONE closed outline —
 * base corner, straight side, rounded tip arc, straight side back, and
 * across the base (which doubles as the crimp line). A single closed
 * polyline splits gracefully when partially occluded (a "C" of capsule),
 * where separate side/crimp marks sliced lengthwise left floating bars.
 * 'edge' layer, arcs pinned to the end arc.
 */
function agletMarks(
  strand: TangleStrand,
  k: number,
  end: 'start' | 'end',
  o: LaceMarkOptions
): Mark[] {
  const r = strand.r;
  const endArc = end === 'start' ? 0 : strand.len;
  const s = sampleAtOpen(strand, endArc);
  const tOut = end === 'start' ? { x: -s.t.x, y: -s.t.y } : { x: s.t.x, y: s.t.y };
  const nrm = s.n;
  const aw = 0.75 * r; // aglet half-width
  const len = Math.max(5 * r, 4 * o.penWidth);

  const at = (along: number, across: number): Point => ({
    x: s.p.x + tOut.x * along + nrm.x * across,
    y: s.p.y + tOut.y * along + nrm.y * across,
  });

  const pts: Point[] = [at(0, aw), at(len - aw, aw)];
  const SAMPLES = 8;
  for (let j = 1; j < SAMPLES; j++) {
    const phi = Math.PI / 2 - (Math.PI * j) / (SAMPLES - 1);
    pts.push(at(len - aw + Math.cos(phi) * aw, Math.sin(phi) * aw));
  }
  pts.push(at(0, -aw));
  pts.push(at(0, aw)); // close across the base — the crimp line
  const arcs = pts.map(() => endArc);
  return [{ points: pts, arcs, layer: 'edge', strand: k }];
}
