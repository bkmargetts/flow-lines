import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import type { SimplexNoise } from '../noise.js';
import { foldRadiusFor } from './centerline.js';
import { sampleAtOpen, type TangleStrand } from './strand.js';
import type { Mark } from './hose.js';

/**
 * Shoelace construction: a lace is a FLAT ribbon, not a tube — two clean
 * edges, no corrugation, no cylinder shade. Its character comes from
 * flatness made visible three ways:
 *
 * - every hairpin FOLD the growth pass produced is a face flip — the
 *   ribbon shows its edge through the fold, so the width envelope pinches
 *   through zero there (the bow-tie silhouette);
 * - the `twists` knob adds extra mid-run flips, placed in the largest
 *   crossing-free gaps (a flip under an over-pass reads as mud);
 * - a whisper of silk-style drape modulates the apparent width with the
 *   travel direction (the ribbon-weave module's silk idiom) — floored high
 *   at 0.85: any more at lace width reads as lumpy edges, not flatness.
 *
 * Aglets (the stiff little capsule tips) mark on-page ends.
 */

export interface LaceMarkOptions {
  /** 0..1 twist-flip frequency. */
  twists: number;
  /** 0..1 woven-fabric texture density. */
  shading: number;
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
  foldArcs: number[],
  drapeNoise: SimplexNoise,
  o: LaceMarkOptions
): Mark[] {
  const marks: Mark[] = [];
  const n = strand.pts.length;
  const r = strand.r;
  const width = 2 * r;
  // A mid-run flip stretches over a few widths — compressed flips vanish
  // into the wobble. A FOLD flip must complete inside the hairpin's bend,
  // or the pinched envelope spans both legs and the whole fold collapses
  // into a needle.
  const window = 2.5 * width;
  const foldWindow = Math.max(0.9 * width, 0.5 * Math.PI * foldRadiusFor(r));

  // Per-lace genome, drawn unconditionally in fixed order.
  const rand = makeRandom(subSeed(o.seed, 5) + k * 17);
  const jitterA = rand();
  rand(); // parity with the hose stream (bow roll)
  rand(); // parity with the hose stream (doubles roll)

  // --- Twist placement -------------------------------------------------------
  // Every fold is a flip — the ribbon turns over through a hairpin. The
  // knob adds extra mid-run flips in the largest crossing-free gaps.
  interface Flip {
    arc: number;
    win: number;
    fold: boolean;
  }
  // A fold's face flip only draws when the fold has clear paper: pinching
  // the width where other strands cross shreds into crumbs under the
  // occlusion pass. The hairpin geometry itself stays either way.
  const flipClear = foldWindow + width;
  const flips: Flip[] = foldArcs
    .filter((a) => a > 2 * r + foldWindow && a < strand.len - (2 * r + foldWindow))
    .filter((a) => !crossingArcs.some((c) => Math.abs(c - a) < flipClear))
    .map((a) => ({ arc: a, win: foldWindow, fold: true }));
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
    const target =
      flips.length + Math.max(0, Math.round((o.twists * strand.len) / (14 * width)));
    for (const g of gaps) {
      if (flips.length >= target) break;
      let clear = true;
      for (const t of flips) {
        if (Math.abs(g.center - t.arc) <= 5 * window) {
          clear = false;
          break;
        }
      }
      if (clear)
        flips.push({ arc: g.center + (jitterA - 0.5) * 0.5 * g.half, win: window, fold: false });
    }
  }

  // Signed width envelope: +1 sweeping through −1 across each flip, times
  // the silk drape — apparent width follows travel direction, with the
  // drape axis drifting slowly across the page so the modulation reads as
  // cloth resting, not a mechanical rule.
  const m: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let v = 1;
    for (const t of flips) v *= twistRamp(strand.arc[i] - t.arc, t.win);
    const nn = strand.normals[i];
    const theta = Math.atan2(-nn.x, nn.y);
    const drift = drapeNoise.noise2D(strand.pts[i].x / 320, strand.pts[i].y / 320);
    const axis = -Math.PI / 4 + drift * 0.7;
    v *= 0.85 + 0.15 * Math.pow(Math.abs(Math.sin(theta - axis)), 0.9);
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

  // Fold shadow on MID-RUN flips only: two short ticks converging on the
  // waist inside the "after" triangle — the cue that turns an X into a
  // fold. A hairpin fold needs no help (the turn itself tells the story,
  // and extra ticks inside a tight apex read as scratches). 'shadow'
  // layer so a touched tick drops whole.
  for (const t of flips) {
    if (t.fold) continue;
    const waist = sampleAtOpen(strand, t.arc).p;
    for (const frac of [0.45, 0.8]) {
      const a = t.arc + frac * t.win;
      if (a > strand.len) continue;
      const s2 = sampleAtOpen(strand, a);
      const mv = flips.reduce((v, tt) => v * twistRamp(a - tt.arc, tt.win), 1);
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

  // --- Weave texture -----------------------------------------------------
  // The fabric read: short diagonal ticks alternating ±40° to the axis —
  // herringbone braid — in hand-sized noise-gated patches, driven by the
  // shading knob. 'shadow' layer: a tick touched by an occluder drops
  // whole (a clipped weave tick reads as dirt).
  if (o.shading > 0.05) {
    const step = Math.max(2.1 * o.penWidth, 0.34 * width);
    let alt = 1;
    for (let a = 0.4 * step; a < strand.len - 0.4 * step; a += step, alt = -alt) {
      if (cuffStart && a < 2.4 * r) continue;
      if (cuffEnd && a > strand.len - 2.4 * r) continue;
      const gate = drapeNoise.noise2D(a / (7 * width), 7.1 + k * 11.3);
      if (gate > o.shading * 1.3 - 0.42) continue;
      let mv = 1;
      for (const t of flips) mv *= twistRamp(a - t.arc, t.win);
      if (Math.abs(mv) < 0.55) continue;
      const smp = sampleAtOpen(strand, a);
      const halfLen = 0.4 * width * Math.abs(mv);
      const ang = 0.72 * alt;
      const dx = smp.t.x * Math.cos(ang) + smp.n.x * Math.sin(ang);
      const dy = smp.t.y * Math.cos(ang) + smp.n.y * Math.sin(ang);
      const pts: Point[] = [];
      const arcs: number[] = [];
      for (let j = 0; j < 3; j++) {
        const u = j / 2 - 0.5;
        pts.push({ x: smp.p.x + dx * halfLen * 2 * u, y: smp.p.y + dy * halfLen * 2 * u });
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
