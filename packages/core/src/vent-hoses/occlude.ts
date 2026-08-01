import type { Point } from '../flow-lines.js';
import { pointInPolygon } from '../lib/polyline.js';
import { outlineFromEdges } from '../lib/spatial.js';
import { sampleAtOpen, type HoseStrand } from './strand.js';
import type { Crossing } from './crossings.js';
import type { Mark } from './hose.js';

/**
 * Hidden-line removal at crossings, adapted from the ribbons module for open
 * strands with per-hose radii. Each crossing stamps a local occluder: the
 * OVER hose's tube polygon around the crossing, inflated by the reserved-
 * paper gap plus the finish pass's reach (so wobble can't bend erased ink
 * back into the gap). The UNDER hose's marks are broken where they enter
 * that polygon — the clean sliver of paper that makes a crossing read as
 * over/under.
 *
 * Occluders are held per under-strand (a hose is over at some crossings and
 * under at others, so a global z-buffer can't express the weave). On a
 * self-crossing the occluder comes from the same strand, so mark points
 * whose own arc lies inside the over-window's arc range are exempt — a hose
 * must not erase the very pass that's on top of itself.
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
  gap: number;
  inflatePx: number;
  penWidth: number;
  shadowHatch: number;
}

export function buildOccluders(
  strands: HoseStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  o: OccludeOptions
): Occluder[][] {
  const byStrand: Occluder[][] = strands.map(() => []);

  // Where each strand goes UNDER, sorted by arc. A hose beneath another hose
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
    let best = Infinity;
    for (const u of arr) {
      const fwd = dir === 1 ? u - fromArc : fromArc - u;
      if (fwd > 1e-9 && fwd < best) best = fwd;
    }
    return best;
  };

  /** Greedy point-to-polyline distance descent: walk `idx` on `s` towards
   *  the local minimum distance to `p`, bounded to stay near `homeArc`. */
  const localDist = (
    s: HoseStrand,
    p: Point,
    idx: number,
    homeArc: number,
    bound: number
  ): { d: number; idx: number } => {
    const n = s.pts.length;
    const at = (i: number) => {
      const q = s.pts[Math.max(0, Math.min(n - 1, i))];
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
      idx = Math.max(0, Math.min(n - 1, idx));
      if (Math.abs(s.arc[idx] - homeArc) > bound) break;
    }
    return { d, idx };
  };

  for (const c of crossings) {
    const over = aOnTop[c.id] ? c.a : c.b;
    const under = aOnTop[c.id] ? c.b : c.a;
    const s = strands[over.strand];
    const su = strands[under.strand];
    const pairBand = s.r + su.r;

    // The over window must run to the true end of the overlap: walk along the
    // over strand from the crossing, tracking distance to the under
    // centerline, until the tubes have really separated. A closed-form
    // extent (angle-based) truncates mid-graze on shallow crossings and
    // shaves a neighbour's edge lengthwise — the worst artifact this module
    // can produce.
    const clearDist = pairBand + o.gap + o.inflatePx + 1;
    const walkStep = Math.max(2, pairBand / 3);
    const extCap = Math.min(16 * pairBand, s.len);
    // On a self-crossing, keep the under-side distance walk away from the
    // over pass itself (distance 0 there — the walk would never clear).
    const sepArc =
      over.strand === under.strand ? Math.abs(over.arc - under.arc) : Infinity;
    const bound = Math.min(10 * pairBand, sepArc / 2);
    const underIdx0 = sampleAtOpen(su, under.arc).i;
    const extend = (dir: 1 | -1): number => {
      const underCap = Math.max(
        0.6 * pairBand,
        0.55 * distToUnder(over.strand, over.arc, dir)
      );
      const cap = Math.min(extCap, underCap);
      let ext = Math.min(pairBand * 0.75, cap);
      let idx = underIdx0;
      while (ext < cap) {
        const probeArc = over.arc + dir * ext;
        if (probeArc < 0 || probeArc > s.len) break; // window ran off the end
        const p = sampleAtOpen(s, probeArc).p;
        const rr = localDist(su, p, idx, under.arc, bound);
        idx = rr.idx;
        if (rr.d > clearDist) break;
        ext += walkStep;
      }
      return Math.min(ext + walkStep, cap);
    };

    const arc0 = Math.max(0, over.arc - extend(-1));
    const arc1 = Math.min(s.len, over.arc + extend(1));
    const half = s.r + o.gap + o.inflatePx;
    const left: Point[] = [];
    const right: Point[] = [];
    const stepCount = Math.max(6, Math.ceil((arc1 - arc0) / Math.max(2, pairBand / 3)));
    for (let j = 0; j <= stepCount; j++) {
      const a = arc0 + ((arc1 - arc0) * j) / stepCount;
      const smp = sampleAtOpen(s, a);
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
    byStrand[under.strand].push({
      poly,
      minX,
      minY,
      maxX,
      maxY,
      strand: over.strand,
      arcMin: arc0,
      arcMax: arc1,
    });
  }
  return byStrand;
}

/**
 * Pair-contact occluders. Two hoses can overlap visually along a RUN, not
 * just at a crossing point: a graze whose centerlines never intersect, or
 * the stretch between two nearby crossings of the same pair — the
 * per-crossing walk windows are deliberately capped short of each other so
 * alternating crossings don't erase both passes, which leaves the middle of
 * a deep overlap covered by neither. Un-occluded overlap is the worst
 * artifact this module can produce: both tubes draw and the rings of one
 * float across the face of the other.
 *
 * So every contact run (centerline distance inside rA+rB+gap+reach) gets
 * resolved end to end. Runs with no crossing get the physical treatment —
 * the fatter hose simply lies on top. Runs containing crossings are split
 * at the midpoints between consecutive crossings, and each segment's top
 * hose is whoever the weave put on top at its nearest crossing, so the
 * over/under story stays exactly the solved weave and the swap lands in
 * the reserved paper between the two windows.
 */
export function buildGrazeOccluders(
  strands: HoseStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  byStrand: Occluder[][],
  o: OccludeOptions
): void {
  // Per ordered pair: crossing arcs on each side plus who won, sorted by
  // the arc along the pair's first strand.
  const pairKey = (a: number, b: number) => a * strands.length + b;
  const crossArcs = new Map<number, { a: number; b: number; top: number }[]>();
  for (const c of crossings) {
    if (c.a.strand === c.b.strand) continue; // self pairs stay walk-window-only
    const lo = Math.min(c.a.strand, c.b.strand);
    const hi = Math.max(c.a.strand, c.b.strand);
    const key = pairKey(lo, hi);
    let entry = crossArcs.get(key);
    if (!entry) {
      entry = [];
      crossArcs.set(key, entry);
    }
    entry.push({
      a: c.a.strand === lo ? c.a.arc : c.b.arc,
      b: c.a.strand === lo ? c.b.arc : c.a.arc,
      top: aOnTop[c.id] ? c.a.strand : c.b.strand,
    });
  }
  for (const entry of crossArcs.values()) entry.sort((p, q) => p.a - q.a);

  for (let ka = 0; ka < strands.length; ka++) {
    for (let kb = ka + 1; kb < strands.length; kb++) {
      const sa = strands[ka];
      const sb = strands[kb];
      const thr = sa.r + sb.r + o.gap + o.inflatePx;
      // Coarse bbox rejection.
      if (!bboxesNear(sa, sb, thr)) continue;

      // Distance from each point of A to B (grid over B).
      const cell = Math.max(4, thr);
      const grid = new Map<string, number[]>();
      for (let i = 0; i < sb.pts.length; i++) {
        const key = `${Math.floor(sb.pts[i].x / cell)},${Math.floor(sb.pts[i].y / cell)}`;
        let arr = grid.get(key);
        if (!arr) {
          arr = [];
          grid.set(key, arr);
        }
        arr.push(i);
      }
      const na = sa.pts.length;
      const nearB = new Int32Array(na).fill(-1);
      for (let i = 0; i < na; i++) {
        const p = sa.pts[i];
        const cx = Math.floor(p.x / cell);
        const cy = Math.floor(p.y / cell);
        let best = thr;
        let bestIdx = -1;
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            const arr = grid.get(`${gx},${gy}`);
            if (!arr) continue;
            for (const j of arr) {
              const q = sb.pts[j];
              const d = Math.hypot(q.x - p.x, q.y - p.y);
              if (d < best) {
                best = d;
                bestIdx = j;
              }
            }
          }
        }
        nearB[i] = bestIdx;
      }

      // Contact runs along A, each resolved end to end.
      const pairBand = sa.r + sb.r;
      const entry = crossArcs.get(pairKey(ka, kb)) ?? [];

      /** Emit one resolved segment [from..to] (A indices) with `top` on top. */
      const emitSegment = (from: number, to: number, top: number, endPad: number) => {
        const segA0 = sa.arc[from];
        const segA1 = sa.arc[to];
        if (segA1 - segA0 < 0.5 * pairBand) return;
        const aWins = top === ka;
        const winner = aWins ? sa : sb;
        const winnerIdx = aWins ? ka : kb;
        const loserIdx = aWins ? kb : ka;
        let w0 = segA0;
        let w1 = segA1;
        if (!aWins) {
          // Map the segment onto B via the nearest-point correspondence.
          let bLo = Infinity;
          let bHi = -Infinity;
          for (let j = from; j <= to; j++) {
            const bj = nearB[j];
            if (bj < 0) continue;
            const arcJ = sb.arc[bj];
            if (arcJ < bLo) bLo = arcJ;
            if (arcJ > bHi) bHi = arcJ;
          }
          if (!isFinite(bLo)) return;
          w0 = bLo;
          w1 = bHi;
        }
        byStrand[loserIdx].push(
          occluderFromWindow(
            winner,
            winnerIdx,
            Math.max(0, w0 - endPad),
            Math.min(winner.len, w1 + endPad),
            winner.r + o.gap + o.inflatePx
          )
        );
      };

      let runStart = -1;
      for (let i = 0; i <= na; i++) {
        const inContact = i < na && nearB[i] >= 0;
        if (inContact && runStart < 0) runStart = i;
        if (!inContact && runStart >= 0) {
          const from = runStart;
          const to = i - 1;
          runStart = -1;
          const a0 = sa.arc[from];
          const a1 = sa.arc[to];
          if (a1 - a0 < 1.5 * pairBand) continue;

          // Crossings of this pair inside (or hard against) the run.
          const inRun = entry.filter((c) => c.a > a0 - pairBand && c.a < a1 + pairBand);
          if (inRun.length === 0) {
            // Pure graze: the fatter hose lies on top (tie: earlier strand).
            emitSegment(from, to, sa.r >= sb.r ? ka : kb, 0.75 * pairBand);
            continue;
          }

          // Split the run at midpoints between consecutive crossings; each
          // segment continues its own crossing's winner.
          let segFrom = from;
          for (let ci = 0; ci < inRun.length; ci++) {
            const boundary =
              ci + 1 < inRun.length ? (inRun[ci].a + inRun[ci + 1].a) / 2 : Infinity;
            let segTo = to;
            if (isFinite(boundary)) {
              segTo = segFrom;
              while (segTo + 1 <= to && sa.arc[segTo + 1] <= boundary) segTo++;
            }
            emitSegment(segFrom, segTo, inRun[ci].top, 0.35 * pairBand);
            segFrom = Math.min(segTo + 1, to);
          }
        }
      }
    }
  }
}

function bboxesNear(a: HoseStrand, b: HoseStrand, pad: number): boolean {
  let aMinX = Infinity;
  let aMinY = Infinity;
  let aMaxX = -Infinity;
  let aMaxY = -Infinity;
  for (const p of a.pts) {
    if (p.x < aMinX) aMinX = p.x;
    if (p.y < aMinY) aMinY = p.y;
    if (p.x > aMaxX) aMaxX = p.x;
    if (p.y > aMaxY) aMaxY = p.y;
  }
  let bMinX = Infinity;
  let bMinY = Infinity;
  let bMaxX = -Infinity;
  let bMaxY = -Infinity;
  for (const p of b.pts) {
    if (p.x < bMinX) bMinX = p.x;
    if (p.y < bMinY) bMinY = p.y;
    if (p.x > bMaxX) bMaxX = p.x;
    if (p.y > bMaxY) bMaxY = p.y;
  }
  return (
    aMinX - pad < bMaxX && aMaxX + pad > bMinX && aMinY - pad < bMaxY && aMaxY + pad > bMinY
  );
}

function occluderFromWindow(
  s: HoseStrand,
  strandIdx: number,
  arc0: number,
  arc1: number,
  half: number
): Occluder {
  const left: Point[] = [];
  const right: Point[] = [];
  const stepCount = Math.max(6, Math.ceil((arc1 - arc0) / Math.max(2, s.r / 2)));
  for (let j = 0; j <= stepCount; j++) {
    const a = arc0 + ((arc1 - arc0) * j) / stepCount;
    const smp = sampleAtOpen(s, a);
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
  return { poly, minX, minY, maxX, maxY, strand: strandIdx, arcMin: arc0, arcMax: arc1 };
}

function covered(
  x: number,
  y: number,
  arc: number,
  strandIdx: number,
  occs: Occluder[],
  pad: number
): boolean {
  for (const occ of occs) {
    if (x < occ.minX || x > occ.maxX || y < occ.minY || y > occ.maxY) continue;
    if (occ.strand === strandIdx && arc >= occ.arcMin - pad && arc <= occ.arcMax + pad)
      continue;
    if (pointInPolygon(occ.poly, x, y)) return true;
  }
  return false;
}

/**
 * Break marks against their strand's occluders. Long marks (edges, shade,
 * cuff ellipses) are split into surviving runs, with the cut boundary
 * refined by micro-sampling only near occluders so the gap ends land clean;
 * contact-shadow ticks drop whole when touched — a partial tick reads as
 * dirt. Rings sit in between: they split like long marks but a survivor
 * must keep most of its sweep (~70%), so a ring grazed by the gap stays as
 * a confident "C" while a ring cut to a shard vanishes — whole-dropping
 * every touched ring left long bald stretches of naked tube beside busy
 * crossings, which read as a different (smooth) material.
 */
export function occludeMarks(
  marks: Mark[],
  strands: HoseStrand[],
  occludersByStrand: Occluder[][],
  o: OccludeOptions
): Mark[] {
  const out: Mark[] = [];
  const micro = Math.max(1.2, o.penWidth * 0.9);

  for (const mark of marks) {
    const occs = occludersByStrand[mark.strand];
    if (!occs || occs.length === 0) {
      out.push(mark);
      continue;
    }
    const r = strands[mark.strand].r;
    const pad = 2 * r;
    const minRun = Math.max(4.5, 0.35 * r);

    const isCrossMark = mark.layer === 'shadow';
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
          if (covered(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, arc, mark.strand, occs, pad)) {
            hit = true;
            break outer;
          }
        }
      }
      if (!hit) out.push(mark);
      continue;
    }

    // Long marks: walk segments, micro-sampling only where an occluder's
    // bbox is near, and emit the surviving runs. A stub of shade with its
    // tube erased around it reads as dirt — shade survivors must be
    // substantial. Ring survivors are attachment-aware: a stub that still
    // reaches one of the ring's original endpoints reads as corrugation
    // peeking out from under the over hose and may stay short — it's what
    // carries the corrugation right up to the reserved gap — while a
    // mid-fragment cut at both ends is a floating smile and must keep most
    // of the sweep to live. Edges may stay short (the sliver between two
    // adjacent crossings is real pile anatomy).
    let origLen = 0;
    for (let i = 1; i < mark.points.length; i++) {
      origLen += Math.hypot(
        mark.points[i].x - mark.points[i - 1].x,
        mark.points[i].y - mark.points[i - 1].y
      );
    }
    const minLenFor = (attached: boolean): number =>
      mark.layer === 'shade'
        ? Math.max(minRun, 1.2 * r)
        : mark.layer === 'ring'
          ? Math.max(4.5, (attached ? 0.25 : 0.6) * origLen)
          : minRun;
    let runPts: Point[] = [];
    let runArcs: number[] = [];
    let anyFlushedCovered = false;
    let runStartsAtMarkStart = true;
    let runEndsAtMarkEnd = false;
    const flush = () => {
      if (runPts.length >= 2) {
        let len = 0;
        for (let i = 1; i < runPts.length; i++) {
          len += Math.hypot(runPts[i].x - runPts[i - 1].x, runPts[i].y - runPts[i - 1].y);
        }
        const attached =
          (runStartsAtMarkStart && !anyFlushedCovered) || runEndsAtMarkEnd;
        if (len >= minLenFor(attached))
          out.push({ points: runPts, arcs: runArcs, layer: mark.layer, strand: mark.strand });
      }
      runPts = [];
      runArcs = [];
      runStartsAtMarkStart = false;
    };
    const push = (p: Point, arc: number, isCovered: boolean) => {
      if (isCovered) {
        flush();
        anyFlushedCovered = true;
      } else {
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
    push(p0, mark.arcs[0], covered(p0.x, p0.y, mark.arcs[0], mark.strand, occs, pad));
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
        push(p, arc, covered(p.x, p.y, arc, mark.strand, occs, pad));
      }
    }
    // The closing run (if any) reaches the mark's original end point.
    runEndsAtMarkEnd = true;
    flush();
  }
  return out;
}

/**
 * Contact shadows: short cross-tube ticks on the UNDER hose just past both
 * ends of the reserved gap, spacing opening geometrically as they fade — the
 * classic ink cue that the under-pass sits in the over-pass's shade.
 */
export function contactShadows(
  strands: HoseStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  o: OccludeOptions
): Mark[] {
  const marks: Mark[] = [];
  if (o.shadowHatch <= 0.02) return marks;
  const nT = Math.round(1 + o.shadowHatch * 3);

  // Candidate tick arcs per under-strand. Two guards against tangle scribble:
  // shallow (osculating) crossings get no ticks — their geometric cover
  // distance explodes with 1/sin and the ticks land far from any visible
  // pinch, floating on open tube — and ticks from neighbouring crossings
  // that land nearly on top of each other collapse to one.
  const byStrand: number[][] = strands.map(() => []);
  for (const c of crossings) {
    if (c.angle < 0.45) continue;
    const over = aOnTop[c.id] ? c.a : c.b;
    const under = aOnTop[c.id] ? c.b : c.a;
    const s = strands[under.strand];
    const rOver = strands[over.strand].r;
    const sinA = Math.max(Math.sin(c.angle), 0.3);
    const cover = (rOver + o.gap) / sinA;
    const base = o.penWidth * 1.5;
    for (const dir of [1, -1] as const) {
      let off = cover + o.inflatePx + 0.5;
      for (let j = 0; j < nT; j++) {
        const arc = under.arc + dir * off;
        if (arc >= 0 && arc <= s.len) byStrand[under.strand].push(arc);
        off += base * Math.pow(1.7, j);
      }
    }
  }

  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    const arcsSorted = byStrand[k].sort((p, q) => p - q);
    const minSpacing = o.penWidth * 2.5;
    let last = -Infinity;
    for (const arc of arcsSorted) {
      if (arc - last < minSpacing) continue;
      last = arc;
      const smp = sampleAtOpen(s, arc);
      const reach = s.r * 0.8;
      const pts: Point[] = [];
      const arcs: number[] = [];
      for (let q = 0; q < 3; q++) {
        const t = q / 2;
        const offN = reach * (1 - 2 * t);
        pts.push({ x: smp.p.x + smp.n.x * offN, y: smp.p.y + smp.n.y * offN });
        arcs.push(arc);
      }
      marks.push({ points: pts, arcs, layer: 'shadow', strand: k });
    }
  }
  return marks;
}
