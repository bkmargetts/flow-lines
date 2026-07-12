import type { Point } from '../flow-lines.js';
import { pointInPolygon } from '../lib/polyline.js';
import { outlineFromEdges } from '../lib/spatial.js';
import { circularDelta, sampleAt, type Strand } from './warp.js';
import type { Crossing } from './crossings.js';
import type { BandProfile, Mark } from './band.js';

/**
 * Hidden-line removal at crossings. Each crossing stamps a local occluder:
 * the OVER strand's band polygon around the crossing, inflated by the
 * reserved-paper gap plus the finish pass's reach (so wobble can't bend
 * erased ink back into the gap). The UNDER strand's marks are broken where
 * they enter that polygon — the clean sliver of paper that makes a crossing
 * read as over/under.
 *
 * Occluders are held per under-strand (a strand is over at some crossings
 * and under at others, so a global z-buffer can't express the weave). On a
 * self-crossing the occluder comes from the same strand, so mark points
 * whose own arc lies inside the over-window's arc range are exempt — a
 * strand must not erase the very pass that's on top.
 */

export interface Occluder {
  poly: Point[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** The over strand and its window's arc range, for the self exemption. */
  strand: number;
  arcMin: number;
  arcMax: number;
}

export interface OccludeOptions {
  bandWidth: number;
  gap: number;
  inflatePx: number;
  penWidth: number;
  shadowHatch: number;
}

export function buildOccluders(
  strands: Strand[],
  profiles: BandProfile[],
  crossings: Crossing[],
  aOnTop: boolean[],
  o: OccludeOptions
): Occluder[][] {
  const byStrand: Occluder[][] = strands.map(() => []);
  const h = o.bandWidth / 2;

  // Where each strand goes UNDER, sorted by arc. A band beneath another band
  // cannot occlude anything past that point, so over-windows are capped at
  // just over half-way to the nearest under-crossing — this is what stops two
  // close alternating crossings from erasing BOTH passes between them.
  const underArcs: number[][] = strands.map(() => []);
  for (const c of crossings) {
    const under = aOnTop[c.id] ? c.b : c.a;
    underArcs[under.strand].push(under.arc);
  }
  for (const arr of underArcs) arr.sort((p, q) => p - q);
  const distToUnder = (strand: number, fromArc: number, dir: 1 | -1): number => {
    const arr = underArcs[strand];
    if (arr.length === 0) return Infinity;
    const len = strands[strand].len;
    let best = Infinity;
    for (const u of arr) {
      const fwd = (((dir === 1 ? u - fromArc : fromArc - u) % len) + len) % len;
      if (fwd > 1e-9 && fwd < best) best = fwd;
    }
    return best;
  };

  /** Greedy point-to-polyline distance descent: walk `idx` on `s` towards
   *  the local minimum distance to `p`, bounded to stay near `homeArc`. */
  const localDist = (
    s: Strand,
    p: Point,
    idx: number,
    homeArc: number,
    bound: number
  ): { d: number; idx: number } => {
    const n = s.pts.length;
    const at = (i: number) => {
      const q = s.pts[((i % n) + n) % n];
      return Math.hypot(q.x - p.x, q.y - p.y);
    };
    let d = at(idx);
    for (let step = 0; step < 80; step++) {
      const dPrev = at(idx - 1);
      const dNext = at(idx + 1);
      if (dPrev < d && dPrev <= dNext) {
        idx--;
        d = dPrev;
      } else if (dNext < d) {
        idx++;
        d = dNext;
      } else break;
      const arcHere = s.arc[((idx % n) + n) % n];
      if (Math.abs(circularDelta(arcHere, homeArc, s.len)) > bound) break;
    }
    return { d, idx };
  };

  for (const c of crossings) {
    const over = aOnTop[c.id] ? c.a : c.b;
    const under = aOnTop[c.id] ? c.b : c.a;
    const s = strands[over.strand];
    const su = strands[under.strand];
    const profile = profiles[over.strand];

    // The over window must run to the true end of the overlap: walk along the
    // over strand from the crossing, tracking distance to the under
    // centerline, until the bands have really separated. A closed-form
    // extent (angle-based) truncates mid-graze on shallow crossings and
    // shaves a neighbour's edge lengthwise — the worst artifact this module
    // can produce.
    const clearDist = o.bandWidth + o.gap + o.inflatePx + 1;
    const walkStep = Math.max(2, o.bandWidth / 3);
    const extCap = Math.min(16 * o.bandWidth, s.len * 0.49);
    // On a self-crossing, keep the under-side distance walk away from the
    // over pass itself (distance 0 there — the walk would never clear).
    const sepArc =
      over.strand === under.strand
        ? Math.abs(circularDelta(over.arc, under.arc, s.len))
        : Infinity;
    const bound = Math.min(10 * o.bandWidth, sepArc / 2);
    const underIdx0 = sampleAt(su, under.arc).i;
    const extend = (dir: 1 | -1): number => {
      const underCap = Math.max(
        0.6 * o.bandWidth,
        0.55 * distToUnder(over.strand, over.arc, dir)
      );
      const cap = Math.min(extCap, underCap);
      let ext = Math.min(o.bandWidth * 0.75, cap);
      let idx = underIdx0;
      while (ext < cap) {
        const p = sampleAt(s, over.arc + dir * ext).p;
        const r = localDist(su, p, idx, under.arc, bound);
        idx = r.idx;
        if (r.d > clearDist) break;
        ext += walkStep;
      }
      return Math.min(ext + walkStep, cap);
    };

    const arc0 = over.arc - extend(-1);
    const arc1 = over.arc + extend(1);
    const left: Point[] = [];
    const right: Point[] = [];
    const stepCount = Math.max(6, Math.ceil((arc1 - arc0) / Math.max(2, o.bandWidth / 3)));
    for (let j = 0; j <= stepCount; j++) {
      const a = arc0 + ((arc1 - arc0) * j) / stepCount;
      const smp = sampleAt(s, a);
      const half = Math.abs(h * profile.m[smp.i]) + o.gap + o.inflatePx;
      left.push({ x: smp.p.x + smp.n.x * half, y: smp.p.y + smp.n.y * half });
      right.push({ x: smp.p.x - smp.n.x * half, y: smp.p.y - smp.n.y * half });
    }
    const poly = outlineFromEdges(left, right);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const wrap = ((v: number) => ((v % s.len) + s.len) % s.len);
    byStrand[under.strand].push({
      poly,
      minX,
      minY,
      maxX,
      maxY,
      strand: over.strand,
      arcMin: wrap(arc0),
      arcMax: wrap(arc1),
    });
  }
  return byStrand;
}

/** Is arc `a` inside the (wrapped) window [arcMin, arcMax] padded by `pad`? */
function inArcWindow(a: number, occ: Occluder, len: number, pad: number): boolean {
  const lo = occ.arcMin - pad;
  const hi = occ.arcMax + pad;
  if (occ.arcMin <= occ.arcMax) {
    if (a >= lo && a <= hi) return true;
    // Wrapped padding.
    return a >= lo + len || a <= hi - len;
  }
  // Window itself wraps.
  return a >= lo || a <= hi;
}

function covered(
  x: number,
  y: number,
  arc: number,
  strandIdx: number,
  strandLen: number,
  occs: Occluder[],
  pad: number
): boolean {
  for (const occ of occs) {
    if (x < occ.minX || x > occ.maxX || y < occ.minY || y > occ.maxY) continue;
    if (occ.strand === strandIdx && inArcWindow(arc, occ, strandLen, pad)) continue;
    if (pointInPolygon(occ.poly, x, y)) return true;
  }
  return false;
}

/**
 * Break marks against their strand's occluders. Long marks (edges, shade)
 * are split into surviving runs, with the cut boundary refined by
 * micro-sampling only near occluders so the gap ends land clean; short cross
 * marks (rungs, contact-shadow ticks) drop whole when touched — a partial
 * tick reads as dirt.
 */
export function occludeMarks(
  marks: Mark[],
  strands: Strand[],
  occludersByStrand: Occluder[][],
  o: OccludeOptions
): Mark[] {
  const out: Mark[] = [];
  const micro = Math.max(1.2, o.penWidth * 0.9);
  const minRun = Math.max(4.5, o.bandWidth * 0.4);

  for (const mark of marks) {
    const occs = occludersByStrand[mark.strand];
    const sLen = strands[mark.strand].len;
    const pad = o.bandWidth;
    if (!occs || occs.length === 0) {
      out.push(mark);
      continue;
    }

    const isCrossMark = mark.layer === 'rung' || mark.layer === 'shadow';
    if (isCrossMark) {
      // Sample finely along the whole (short) mark; any hit drops it.
      let hit = false;
      outer: for (let i = 0; i < mark.points.length - 1 && !hit; i++) {
        const a = mark.points[i];
        const b = mark.points[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.ceil(segLen / micro));
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const arc = mark.arcs[i] + (mark.arcs[i + 1] - mark.arcs[i]) * t;
          if (
            covered(
              a.x + (b.x - a.x) * t,
              a.y + (b.y - a.y) * t,
              arc,
              mark.strand,
              sLen,
              occs,
              pad
            )
          ) {
            hit = true;
            break outer;
          }
        }
      }
      if (!hit) out.push(mark);
      continue;
    }

    // Long marks: walk segments, micro-sampling only where an occluder's
    // bbox is near, and emit the surviving runs.
    // A stub of shade with its band erased around it reads as dirt — shade
    // survivors must be substantial; edges may stay short (the sliver between
    // two adjacent crossings is real weave anatomy).
    const minLen = mark.layer === 'shade' ? Math.max(minRun, o.bandWidth * 0.9) : minRun;
    let runPts: Point[] = [];
    let runArcs: number[] = [];
    const flush = () => {
      if (runPts.length >= 2) {
        let len = 0;
        for (let i = 1; i < runPts.length; i++) {
          len += Math.hypot(runPts[i].x - runPts[i - 1].x, runPts[i].y - runPts[i - 1].y);
        }
        if (len >= minLen)
          out.push({ points: runPts, arcs: runArcs, layer: mark.layer, strand: mark.strand });
      }
      runPts = [];
      runArcs = [];
    };
    const push = (p: Point, arc: number, isCovered: boolean) => {
      if (isCovered) flush();
      else {
        runPts.push(p);
        runArcs.push(arc);
      }
    };

    const nearOcc = (a: Point, b: Point): boolean => {
      const minX = Math.min(a.x, b.x) - 2;
      const maxX = Math.max(a.x, b.x) + 2;
      const minY = Math.min(a.y, b.y) - 2;
      const maxY = Math.max(a.y, b.y) + 2;
      for (const occ of occs) {
        if (maxX < occ.minX || minX > occ.maxX || maxY < occ.minY || minY > occ.maxY)
          continue;
        return true;
      }
      return false;
    };

    const p0 = mark.points[0];
    push(p0, mark.arcs[0], covered(p0.x, p0.y, mark.arcs[0], mark.strand, sLen, occs, pad));
    for (let i = 0; i < mark.points.length - 1; i++) {
      const a = mark.points[i];
      const b = mark.points[i + 1];
      if (!nearOcc(a, b)) {
        push(b, mark.arcs[i + 1], false);
        continue;
      }
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(segLen / micro));
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const arc = mark.arcs[i] + (mark.arcs[i + 1] - mark.arcs[i]) * t;
        push(p, arc, covered(p.x, p.y, arc, mark.strand, sLen, occs, pad));
      }
    }
    flush();
  }
  return out;
}

/**
 * Contact shadows: short cross-band ticks on the UNDER strand just past both
 * ends of the reserved gap, spacing opening geometrically as they fade — the
 * classic ink cue that the under-pass sits in the over-pass's shade.
 */
export function contactShadows(
  strands: Strand[],
  profiles: BandProfile[],
  crossings: Crossing[],
  aOnTop: boolean[],
  o: OccludeOptions
): Mark[] {
  const marks: Mark[] = [];
  if (o.shadowHatch <= 0.02) return marks;
  const h = o.bandWidth / 2;
  const nT = Math.round(1 + o.shadowHatch * 3);

  for (const c of crossings) {
    const under = aOnTop[c.id] ? c.b : c.a;
    const s = strands[under.strand];
    const profile = profiles[under.strand];
    const sinA = Math.max(Math.sin(c.angle), 0.3);
    const cover = (h + o.gap) / sinA;
    const base = o.penWidth * 1.5;

    for (const dir of [1, -1] as const) {
      let off = cover + o.inflatePx + 0.5;
      for (let j = 0; j < nT; j++) {
        const arc = under.arc + dir * off;
        const smp = sampleAt(s, arc);
        const mv = profile.m[smp.i];
        if (Math.abs(mv) >= 0.5) {
          const reach = h * mv * 0.8;
          const pts: Point[] = [];
          const arcs: number[] = [];
          for (let q = 0; q < 3; q++) {
            const t = q / 2;
            const offN = reach * (1 - 2 * t);
            pts.push({ x: smp.p.x + smp.n.x * offN, y: smp.p.y + smp.n.y * offN });
            arcs.push(((arc % s.len) + s.len) % s.len);
          }
          marks.push({ points: pts, arcs, layer: 'shadow', strand: under.strand });
        }
        off += base * Math.pow(1.7, j);
      }
    }
  }
  return marks;
}
