import type { Point } from '../flow-lines.js';
import { sampleAtOpen, type TangleStrand } from './strand.js';
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

/**
 * An occluder is a DISTANCE FIELD, not a polygon: a point is covered when
 * it lies within `half` of the over strand's centerline restricted to
 * [arcMin, arcMax] (indices [i0, i1]), or within `half` of the optional
 * capsule segment (end hardware reaching past the strand's tip). The
 * first version used offset-strip polygons; a window a strand sweeps
 * through at its curvature cap folds the strip into a self-intersecting
 * polygon, and the even-odd test then reports points INSIDE the tube as
 * outside — X-ray holes exactly where the pile is densest.
 */
export interface Occluder {
  /** The over strand's polyline (for the distance scan). */
  pts: Point[];
  i0: number;
  i1: number;
  half: number;
  /** Capsule segment past the strand tip (end hardware only). */
  segA?: Point;
  segB?: Point;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** The over strand and its window's arc range, for the self exemption. */
  strand: number;
  arcMin: number;
  arcMax: number;
  /** End-hardware occluder (cuff mouth / aglet capsule). */
  end?: boolean;
  /** Override for the self-exemption arc pad (default: the caller's pad,
   *  2r of the mark's strand). Self-crossing windows need a pad matched to
   *  the field's reach past the window ends (`half`), not 2r: with the wide
   *  default, a window walked far along a self-hug swallows the under
   *  pass's arcs into its own exemption and the self-crossing X-rays. */
  exemptPad?: number;
  /**
   * Outward cut plane at an open end. The distance field is a union of
   * discs, so it bulges a full `half` past the strand's last vertex — but
   * the hardware DRAWN there reaches only `CUFF_OPEN * r` (a hose mouth) or
   * the aglet's length. Without a cut the difference is a bite of reserved
   * paper hanging in front of a tube that ends before it: a crater with
   * nothing above it. Points further than `reach` beyond `(x, y)` along the
   * outward tangent are outside the hardware.
   */
  tipCut?: { x: number; y: number; tx: number; ty: number; reach: number };
}

/** Occluder over `s`'s tube along [arc0, arc1], inflated to `half`. */
function occluderFromWindow(
  s: TangleStrand,
  strandIdx: number,
  arc0: number,
  arc1: number,
  half: number
): Occluder {
  const n = s.pts.length;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.arc[mid] < arc0) lo = mid + 1;
    else hi = mid;
  }
  const i0 = Math.max(0, lo - 1);
  lo = i0;
  hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.arc[mid] <= arc1) lo = mid + 1;
    else hi = mid;
  }
  const i1 = Math.min(n - 1, lo);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const p = s.pts[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    pts: s.pts,
    i0,
    i1,
    half,
    minX: minX - half,
    minY: minY - half,
    maxX: maxX + half,
    maxY: maxY + half,
    strand: strandIdx,
    arcMin: arc0,
    arcMax: arc1,
  };
}

/** Is (x, y) within the occluder's distance field? */
function occluderHits(occ: Occluder, x: number, y: number): boolean {
  const cut = occ.tipCut;
  if (cut && (x - cut.x) * cut.tx + (y - cut.y) * cut.ty > cut.reach) return false;
  const h2 = occ.half * occ.half;
  for (let i = occ.i0; i <= occ.i1; i++) {
    const dx = occ.pts[i].x - x;
    const dy = occ.pts[i].y - y;
    if (dx * dx + dy * dy < h2) return true;
  }
  if (occ.segA && occ.segB) {
    const ax = occ.segA.x;
    const ay = occ.segA.y;
    const bx = occ.segB.x - ax;
    const by = occ.segB.y - ay;
    const len2 = bx * bx + by * by;
    const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / len2)) : 0;
    const dx = ax + bx * t - x;
    const dy = ay + by * t - y;
    if (dx * dx + dy * dy < h2) return true;
  }
  return false;
}

export interface OccludeOptions {
  gap: number;
  inflatePx: number;
  penWidth: number;
  shadowHatch: number;
  /** Lace mode: contact shadows soften — a full-width tick that blends in
   *  among a hose's corrugation rings reads as a staple on a clean ribbon. */
  lace?: boolean;
  /** Per-strand end-hardware arc zones ([lo, hi] per open end). Marks whose
   *  own arc lies in their strand's zone are exempt from OTHER strands'
   *  end-hardware occluders — two overlapping aglets must overdraw, not
   *  mutually shred. */
  endZones?: [number, number][][];
}

export function buildOccluders(
  strands: TangleStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  o: OccludeOptions
): Occluder[][] {
  const byStrand: Occluder[][] = strands.map(() => []);

  // Where each strand goes under EACH SPECIFIC NEIGHBOUR, sorted by arc.
  // An over-window is capped at just over half-way to the nearest crossing
  // where the SAME PAIR flips — that is what stops two close alternating
  // crossings from erasing BOTH passes between them. The cap must be
  // per-pair: layering is pairwise, so strand A ducking under some THIRD
  // strand does not stop A being on top of B — capping on any-strand
  // under-crossings chopped every window in a dense pile to a sliver and
  // left the rest of each overlap lens printing both tubes.
  const underArcsPair = new Map<number, number[]>();
  const pairIdx = (underStrand: number, overStrand: number): number =>
    underStrand * strands.length + overStrand;
  for (const c of crossings) {
    const over = aOnTop[c.id] ? c.a : c.b;
    const under = aOnTop[c.id] ? c.b : c.a;
    const key = pairIdx(under.strand, over.strand);
    let arr = underArcsPair.get(key);
    if (!arr) {
      arr = [];
      underArcsPair.set(key, arr);
    }
    arr.push(under.arc);
  }
  for (const arr of underArcsPair.values()) arr.sort((p, q) => p - q);
  const distToUnder = (
    strand: number,
    otherStrand: number,
    fromArc: number,
    dir: 1 | -1
  ): number => {
    const arr = underArcsPair.get(pairIdx(strand, otherStrand));
    if (!arr) return Infinity;
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
    s: TangleStrand,
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
    // The greedy walk stops at the FIRST local minimum; on a wavy under
    // strand the true minimum can hide one bump further, the walk reports
    // a false "cleared" distance and the window truncates mid-overlap.
    // Sweep a fixed neighbourhood around the stop to de-noise it.
    let best = idx;
    for (let i = Math.max(0, idx - 8); i <= Math.min(n - 1, idx + 8); i++) {
      if (Math.abs(s.arc[i] - homeArc) > bound) continue;
      const di = at(i);
      if (di < d) {
        d = di;
        best = i;
      }
    }
    return { d, idx: best };
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
    // 22 bands: merged dive lenses place their one crossing at the lens
    // midpoint, so a window may need ~20 bands each way to reach the ends.
    const extCap = Math.min(22 * pairBand, s.len);
    // On a self-crossing, keep the under-side distance walk away from the
    // over pass itself (distance 0 there — the walk would never clear).
    const selfPair = over.strand === under.strand;
    const sepArc = selfPair ? Math.abs(over.arc - under.arc) : Infinity;
    const bound = Math.min(10 * pairBand, sepArc / 2);
    const underIdx0 = sampleAtOpen(su, under.arc).i;
    const extend = (dir: 1 | -1): number => {
      const underCap = Math.max(
        0.6 * pairBand,
        0.55 * distToUnder(over.strand, under.strand, over.arc, dir)
      );
      let cap = Math.min(extCap, underCap);
      // A self window must stop short of half-way to the under pass:
      // beyond that the window plus its exemption pad reaches the under
      // pass's own arcs, and the self exemption swallows the very pass
      // this occluder exists to erase.
      if (selfPair) cap = Math.min(cap, sepArc / 2 - walkStep);
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
    const occ = occluderFromWindow(s, over.strand, arc0, arc1, s.r + o.gap + o.inflatePx);
    // Self windows get an exemption pad matched to the field's actual
    // reach past the window ends (a near-centerline mark can be hit up to
    // `half` beyond them) instead of the 2r default: wide enough that the
    // over pass never erases its own marks at the window edge, tight
    // enough that the under pass — at least 6r away by the crossing
    // detector's separation floor — is never exempt.
    if (selfPair) occ.exemptPad = occ.half + 1;
    byStrand[under.strand].push(occ);
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
  strands: TangleStrand[],
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
      // Detection fires on TRUE overlap only (centerlines closer than the
      // summed half-widths). Firing on mere proximity shaved the loser's
      // near edge lengthwise wherever two strands drape side by side —
      // erasure must always mean "something is physically on top".
      const thr = sa.r + sb.r;
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
        if (segA1 - segA0 < Math.max(2, 0.12 * pairBand)) return;
        const aWins = top === ka;
        const winner = aWins ? sa : sb;
        const winnerIdx = aWins ? ka : kb;
        const loserIdx = aWins ? kb : ka;
        const windows: [number, number][] = [];
        if (aWins) {
          windows.push([segA0, segA1]);
        } else {
          // Map the segment onto B via the nearest-point correspondence.
          // One min/max interval is NOT enough: B can loop through the
          // contact zone, visiting it at several disjoint arc ranges — an
          // interval spanning them would be roughly right, but nearest-
          // point aliasing can also UNDER-cover (the deepest loser ink
          // projects onto a B arc outside [min,max]). Cluster the mapped
          // arcs and emit one window per cluster, so every visited stretch
          // of B is covered and nothing between clusters is over-erased.
          const mapped: number[] = [];
          for (let j = from; j <= to; j++) {
            const bj = nearB[j];
            if (bj < 0) continue;
            mapped.push(sb.arc[bj]);
          }
          if (mapped.length === 0) return;
          mapped.sort((p, q) => p - q);
          let w0 = mapped[0];
          let w1 = mapped[0];
          for (let mi = 1; mi < mapped.length; mi++) {
            if (mapped[mi] - w1 > 4 * pairBand) {
              windows.push([w0, w1]);
              w0 = mapped[mi];
            }
            w1 = mapped[mi];
          }
          windows.push([w0, w1]);
        }
        for (const [w0, w1] of windows) {
          byStrand[loserIdx].push(
            occluderFromWindow(
              winner,
              winnerIdx,
              Math.max(0, w0 - endPad),
              Math.min(winner.len, w1 + endPad),
              winner.r + o.gap + o.inflatePx
            )
          );
        }
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
          // Even a SHORT true-overlap pinch must be resolved: the relaxation
          // pass cannot always separate a kiss between two pinning
          // crossings, and when the contact is too glancing to register as
          // a crossing, nothing else covers it — both tubes print, the
          // X-ray tell. Detection is true-overlap-only, so firing here is
          // always physically justified; the tiny floor only rejects
          // single-vertex detection noise.
          if (a1 - a0 < Math.max(2, 0.12 * pairBand)) continue;

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

function bboxesNear(a: TangleStrand, b: TangleStrand, pad: number): boolean {
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

/**
 * End-hardware occluders: a cuff mouth or an aglet is a solid object lying
 * on the pile, but the hardware reaches PAST the centerline's end where no
 * crossing window can exist — without these, other strands X-ray straight
 * through the mouth opening or the aglet capsule. Convention: end hardware
 * always sits on top; the strand's own end-zone marks are exempt via the
 * usual arc-window rule.
 */
export function buildEndOccluders(
  strands: TangleStrand[],
  ends: { cuffStart: boolean; cuffEnd: boolean }[],
  byStrand: Occluder[][],
  o: OccludeOptions
): void {
  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    // Even a stub of a strand draws its hardware, so it needs the
    // occluder — skipping short strands entirely let the pile X-ray
    // straight through their mouths. Only degenerate scraps are skipped.
    if (s.len < 2 * s.r) continue;
    for (const end of ['start', 'end'] as const) {
      if (end === 'start' ? !ends[k].cuffStart : !ends[k].cuffEnd) continue;
      const r = s.r;
      const endArc = end === 'start' ? 0 : s.len;
      const smp = sampleAtOpen(s, endArc);
      const tOut = end === 'start' ? { x: -smp.t.x, y: -smp.t.y } : smp.t;
      // Hose: the mouth ellipse leans 0.34r past the end. Lace: the aglet
      // capsule runs ~5r past it. On a short strand the two end windows
      // must not swallow each other — cap each at half the length.
      const reach = Math.min(o.lace ? 0.6 * r : 1.5 * r, s.len / 2);
      const ext = (o.lace ? 5.4 * r : 0.6 * r) + o.gap + o.inflatePx;
      const half = (o.lace ? 0.85 * r : r) + o.gap + o.inflatePx;

      // The hardware = the strand's own tube over the reach window, plus a
      // capsule reaching `ext` past the tip.
      const tip = { x: smp.p.x + tOut.x * ext, y: smp.p.y + tOut.y * ext };
      const occ = occluderFromWindow(
        s,
        k,
        end === 'start' ? 0 : s.len - reach,
        end === 'start' ? reach : s.len,
        half
      );
      occ.segA = { x: smp.p.x, y: smp.p.y };
      occ.segB = tip;
      // Trim the field to what the hardware actually DRAWS past the tip:
      // a hose mouth is an ellipse leaning `CUFF_OPEN * r` (0.34r) out
      // (hose.ts), a lace aglet a capsule `5r` long (lace.ts). The union of
      // discs otherwise bulges a whole `half` beyond the last vertex, so a
      // duct that stops mid-pile bit a crescent out of whatever lay behind
      // it with nothing drawn in the bite.
      const drawnReach = (o.lace ? 5 : 0.34) * r + o.gap + o.inflatePx;
      occ.tipCut = {
        x: smp.p.x,
        y: smp.p.y,
        tx: tOut.x,
        ty: tOut.y,
        reach: drawnReach,
      };
      occ.minX = Math.min(occ.minX, tip.x - half);
      occ.minY = Math.min(occ.minY, tip.y - half);
      occ.maxX = Math.max(occ.maxX, tip.x + half);
      occ.maxY = Math.max(occ.maxY, tip.y + half);
      occ.end = true;
      for (let j = 0; j < strands.length; j++) byStrand[j].push(occ);
    }
  }
}

function covered(
  x: number,
  y: number,
  arc: number,
  strandIdx: number,
  occs: Occluder[],
  pad: number,
  ownEndZones?: [number, number][]
): boolean {
  for (const occ of occs) {
    if (x < occ.minX || x > occ.maxX || y < occ.minY || y > occ.maxY) continue;
    const exemptPad = occ.exemptPad ?? pad;
    if (
      occ.strand === strandIdx &&
      arc >= occ.arcMin - exemptPad &&
      arc <= occ.arcMax + exemptPad
    )
      continue;
    // Hardware vs hardware: end marks survive another end's occluder.
    if (occ.end && ownEndZones && ownEndZones.some(([lo, hi]) => arc >= lo && arc <= hi))
      continue;
    if (occluderHits(occ, x, y)) return true;
  }
  return false;
}

/** Squared distance from (px, py) to segment ab, plus the parameter t. */
function segDist2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { d2: number; t: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
  const dx = ax + vx * t - px;
  const dy = ay + vy * t - py;
  return { d2: dx * dx + dy * dy, t };
}

/** A stretch of ink that was erased although nothing is drawn over it. */
export interface UnexplainedGap {
  strand: number;
  layer: string;
  /** Midpoint of the unexplained stretch. */
  x: number;
  y: number;
  /** Erased length, px. */
  length: number;
  /** The erased stretch itself, so it can be put back. */
  points: Point[];
  arcs: number[];
}

/**
 * The complement of `findIntrusions`, and the mechanical statement of the
 * reader's expectation: **a break in a line must be explained by something
 * drawn on top of it.**
 *
 * Nearly all erasure here is a distance field around another strand's
 * centerline, so it can only remove ink that genuinely lies inside another
 * tube — those breaks always have a cause the eye can see. But the
 * confetti rules delete ink standing on OPEN PAPER (a short visible peek,
 * a sub-floor fragment, a ring whose edges died), and a cascade can do it
 * too: A erases B, then A's own ink is culled, leaving B's gap with
 * nothing above it. Both read as a line inexplicably falling apart.
 *
 * A survivor point is matched against the survivors' own segments (kept
 * ink lies exactly on them, since survivors are sub-polylines of the
 * original geometry), and each erased run is probed against every strand's
 * tube inflated to the occluder half — so anything a legitimate occluder
 * could have erased counts as covered, provided that strand is actually
 * DRAWN there (it still has a surviving edge at that arc). Contact-shadow
 * ticks are exempt: they drop whole by design.
 */
export function findUnexplainedGaps(
  survivors: Mark[],
  before: Mark[],
  strands: TangleStrand[],
  o: OccludeOptions
): UnexplainedGap[] {
  // --- did this point survive? (exact: kept ink lies on a survivor segment)
  const cell = 8;
  const segKey = (cx: number, cy: number, k: number, layer: string) =>
    `${k}|${layer}|${cx},${cy}`;
  const segGrid = new Map<string, number[][]>();
  for (const m of survivors) {
    for (let i = 1; i < m.points.length; i++) {
      const a = m.points[i - 1];
      const b = m.points[i];
      const seg = [a.x, a.y, b.x, b.y];
      const cx0 = Math.floor(Math.min(a.x, b.x) / cell);
      const cx1 = Math.floor(Math.max(a.x, b.x) / cell);
      const cy0 = Math.floor(Math.min(a.y, b.y) / cell);
      const cy1 = Math.floor(Math.max(a.y, b.y) / cell);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const kk = segKey(cx, cy, m.strand, m.layer);
          let arr = segGrid.get(kk);
          if (!arr) segGrid.set(kk, (arr = []));
          arr.push(seg);
        }
      }
    }
  }
  const survived = (p: Point, k: number, layer: string): boolean => {
    const arr = segGrid.get(segKey(Math.floor(p.x / cell), Math.floor(p.y / cell), k, layer));
    if (!arr) return false;
    for (const s of arr) {
      if (segDist2(p.x, p.y, s[0], s[1], s[2], s[3]).d2 < 0.1225) return true;
    }
    return false;
  };

  // --- is strand k actually INKED next to this spot? An arc-range test is
  // too generous: a strand drawn 30px earlier along its length explains
  // nothing about the paper here. Ask spatially instead — the eye does.
  const inkCell = Math.max(8, 2 * Math.max(...strands.map((s) => s.r)));
  const inkGrid = new Map<string, number[][]>();
  for (const m of survivors) {
    for (const p of m.points) {
      const kk = `${m.strand}|${Math.floor(p.x / inkCell)},${Math.floor(p.y / inkCell)}`;
      let arr = inkGrid.get(kk);
      if (!arr) inkGrid.set(kk, (arr = []));
      arr.push([p.x, p.y]);
    }
  }
  const inkedNear = (k: number, p: Point, within: number): boolean => {
    const cx = Math.floor(p.x / inkCell);
    const cy = Math.floor(p.y / inkCell);
    const w2 = within * within;
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const arr = inkGrid.get(`${k}|${gx},${gy}`);
        if (!arr) continue;
        for (const q of arr) {
          const dx = q[0] - p.x;
          const dy = q[1] - p.y;
          if (dx * dx + dy * dy < w2) return true;
        }
      }
    }
    return false;
  };

  // --- centerline segments, for the "is this paper covered" probe
  let maxR = 0;
  for (const s of strands) maxR = Math.max(maxR, s.r);
  const reachMax = maxR + o.gap + o.inflatePx + 1;
  const cCell = Math.max(8, reachMax);
  const cGrid = new Map<string, [number, number][]>();
  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const cx0 = Math.floor(Math.min(a.x, b.x) / cCell);
      const cx1 = Math.floor(Math.max(a.x, b.x) / cCell);
      const cy0 = Math.floor(Math.min(a.y, b.y) / cCell);
      const cy1 = Math.floor(Math.max(a.y, b.y) / cCell);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const kk = `${cx},${cy}`;
          let arr = cGrid.get(kk);
          if (!arr) cGrid.set(kk, (arr = []));
          arr.push([k, i]);
        }
      }
    }
  }
  const explained = (p: Point, ownStrand: number, ownArc: number): boolean => {
    const cx = Math.floor(p.x / cCell);
    const cy = Math.floor(p.y / cCell);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const arr = cGrid.get(`${gx},${gy}`);
        if (!arr) continue;
        for (const [k, i] of arr) {
          const s = strands[k];
          const reach = s.r + o.gap + o.inflatePx + 1;
          const a = s.pts[i];
          const b = s.pts[i + 1];
          const { d2, t } = segDist2(p.x, p.y, a.x, a.y, b.x, b.y);
          if (d2 >= reach * reach) continue;
          const arcHere = s.arc[i] + t * (s.arc[i + 1] - s.arc[i]);
          // A strand's own local tube is not "on top of" its own ink.
          if (k === ownStrand && Math.abs(arcHere - ownArc) < 5 * s.r) continue;
          if (inkedNear(k, p, s.r + o.gap + 2)) return true;
        }
      }
    }
    return false;
  };

  const minGap = Math.max(2, 2 * o.penWidth);
  const gaps: UnexplainedGap[] = [];
  for (const m of before) {
    // Contact-shadow ticks drop whole when touched — a partial tick reads
    // as dirt, so their disappearance is deliberate, not a broken line.
    if (m.layer === 'shadow') continue;
    const n = m.points.length;
    const gone: boolean[] = new Array(n);
    for (let i = 0; i < n; i++) gone[i] = !survived(m.points[i], m.strand, m.layer);
    let i = 0;
    while (i < n) {
      if (!gone[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < n && gone[j + 1]) j++;
      // Longest contiguous stretch inside [i, j] that nothing explains.
      let bestLo = -1;
      let bestHi = -1;
      let runLo = -1;
      for (let q = i; q <= j + 1; q++) {
        const bad =
          q <= j && !explained(m.points[q], m.strand, m.arcs[q]);
        if (bad && runLo < 0) runLo = q;
        if (!bad && runLo >= 0) {
          if (bestLo < 0 || q - runLo > bestHi - bestLo) {
            bestLo = runLo;
            bestHi = q - 1;
          }
          runLo = -1;
        }
      }
      if (bestLo >= 0) {
        let len = 0;
        for (let q = bestLo; q < bestHi; q++) {
          len += Math.hypot(
            m.points[q + 1].x - m.points[q].x,
            m.points[q + 1].y - m.points[q].y
          );
        }
        if (bestHi === bestLo && n > 1) {
          // Single-point stretch: charge it the local vertex spacing.
          const a = m.points[Math.max(0, bestLo - 1)];
          const b = m.points[Math.min(n - 1, bestLo + 1)];
          len = Math.hypot(b.x - a.x, b.y - a.y) / 2;
        }
        if (len >= minGap) {
          const mid = m.points[(bestLo + bestHi) >> 1];
          // Carry a whisker of the SURVIVING ink on each side so a restored
          // stretch rejoins its neighbours instead of floating — but never
          // reach into ink that was erased for a good reason. The point
          // beyond an unexplained run is erased-and-explained whenever the
          // run sits inside a longer erasure, and putting that back is
          // exactly the X-ray this module exists to prevent.
          const lo = bestLo > 0 && !gone[bestLo - 1] ? bestLo - 1 : bestLo;
          const hi = bestHi < n - 1 && !gone[bestHi + 1] ? bestHi + 1 : bestHi;
          gaps.push({
            strand: m.strand,
            layer: m.layer,
            x: mid.x,
            y: mid.y,
            length: len,
            points: m.points.slice(lo, hi + 1),
            arcs: m.arcs.slice(lo, hi + 1),
          });
        }
      }
      i = j + 1;
    }
  }
  return gaps;
}

/**
 * Verify-and-repair: the crossing walks, graze runs, and end hardware
 * SHOULD cover every overlap between two tubes, but each has geometric
 * edge cases (window caps, correspondence mapping, merged-crossing
 * placement) and any seam they leave prints both tubes — the X-ray tell.
 * So after the main erase pass, directly test the surviving ink: any
 * point sitting strictly inside another strand's tube is an intrusion.
 * Intrusions are clustered per strand pair, each cluster gets ONE winner —
 * the weave's decision at the pair's nearest crossing, falling back to
 * fatter-lies-on-top for crossing-less grazes — and the loser's intruding
 * ink is erased by a synthesized occluder window. Deterministic, and by
 * construction it closes whatever seam produced the leak.
 */
/** Directed intrusion: ink of strand `j` strictly inside the tube of `i`. */
export interface Intrusion {
  j: number;
  i: number;
  iArc: number;
  jArc: number;
  x: number;
  y: number;
}

/**
 * Point-in-tube scan of the surviving ink: every mark point sitting
 * strictly inside another strand's tube (or another pass of its own) is an
 * intrusion the occlusion passes failed to erase. Exported so the tests can
 * assert the pipeline leaves zero of them.
 */
export function findIntrusions(
  marks: Mark[],
  strands: TangleStrand[],
  o: OccludeOptions
): Intrusion[] {
  // Spatial grid of centerline points for point-in-tube tests.
  let maxR = 0;
  for (const s of strands) maxR = Math.max(maxR, s.r);
  const cell = Math.max(8, 2 * maxR);
  const grid = new Map<string, [number, number][]>();
  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    for (let i = 0; i < s.pts.length; i++) {
      const key = `${Math.floor(s.pts[i].x / cell)},${Math.floor(s.pts[i].y / cell)}`;
      let arr = grid.get(key);
      if (!arr) {
        arr = [];
        grid.set(key, arr);
      }
      arr.push([k, i]);
    }
  }

  // "Strictly inside" leaves a pen's tolerance at the silhouette: a mark
  // kissing the boundary is legitimate, but anything deeper prints visibly
  // inside the tube. The floor matters — every extra hit becomes another
  // repair zone and another synthesized occluder, and those go on to drive
  // the sliver rules, so an over-sensitive test costs visible ink far from
  // the leak it was chasing.
  const inset = Math.max(1.25, 0.5 * o.penWidth);
  const intrusions: Intrusion[] = [];
  for (const m of marks) {
    const ownZones = o.endZones?.[m.strand];
    for (let pi = 0; pi < m.points.length; pi++) {
      // End hardware sits on top by convention (see buildEndOccluders): a
      // cuff mouth or aglet overlapping another tube is overdraw, not an
      // intrusion. Flagging it shreds the hardware here while its own end
      // occluder erases the other strand — a mutual white crater.
      if (
        ownZones &&
        ownZones.some(([lo, hi]) => m.arcs[pi] >= lo && m.arcs[pi] <= hi)
      )
        continue;
      const p = m.points[pi];
      const cx = Math.floor(p.x / cell);
      const cy = Math.floor(p.y / cell);
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const arr = grid.get(`${gx},${gy}`);
          if (!arr) continue;
          for (const [k, i] of arr) {
            const s = strands[k];
            // Self-tucks count too — a strand coiling back onto its own
            // earlier pass is hidden-line geometry like any other pair —
            // but only well beyond the local tube neighbourhood.
            if (k === m.strand && Math.abs(s.arc[i] - m.arcs[pi]) < 5 * s.r) continue;
            const inner = Math.max(0, s.r - inset);
            const dx = s.pts[i].x - p.x;
            const dy = s.pts[i].y - p.y;
            if (dx * dx + dy * dy < inner * inner) {
              intrusions.push({
                j: m.strand,
                i: k,
                iArc: s.arc[i],
                jArc: m.arcs[pi],
                x: p.x,
                y: p.y,
              });
            }
          }
        }
      }
    }
  }
  return intrusions;
}

export function repairOcclusion(
  marks: Mark[],
  strands: TangleStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  baseOccluders: Occluder[][],
  o: OccludeOptions
): Mark[] {
  // Scan-and-erase runs in ROUNDS (bounded): one round gives each zone one
  // winner, but a deep self-wad — three or more passes of one strand
  // through the same spot — resolves one pass-pair at a time, and the
  // erasure re-shapes the remaining zones. Rounds converge fast because a
  // round that synthesizes no occluder ends the loop, and winner-side
  // overdraw never synthesizes one.
  const allRepair: Occluder[][] = strands.map(() => []);
  let cur = marks;
  for (let round = 0; round < 3; round++) {
    const intrusions = findIntrusions(cur, strands, o);
    if (intrusions.length === 0) break;

    // Zone the intrusions per UNORDERED pair by position — both directions
    // of the same contact must land in one zone so they get ONE winner. Two
    // directed clusters deciding independently can disagree (their centroids
    // sit near different crossings of the pair) and a disagreement keeps
    // both sides' ink: the exact conflict this pass exists to remove.
    intrusions.sort(
      (a, b) =>
        Math.min(a.i, a.j) - Math.min(b.i, b.j) ||
        Math.max(a.i, a.j) - Math.max(b.i, b.j) ||
        a.x - b.x ||
        a.y - b.y
    );
    const repair: Occluder[][] = strands.map(() => []);
    const zones: Intrusion[][] = [];
    {
      let zone: Intrusion[] = [];
      const samePair = (a: Intrusion, b: Intrusion): boolean =>
        Math.min(a.i, a.j) === Math.min(b.i, b.j) && Math.max(a.i, a.j) === Math.max(b.i, b.j);
      for (const t of intrusions) {
        if (zone.length === 0 || !samePair(zone[0], t)) {
          if (zone.length) zones.push(zone);
          zone = [t];
          continue;
        }
        const band = strands[t.i].r + strands[t.j].r;
        let near = false;
        for (const z of zone) {
          if (Math.hypot(z.x - t.x, z.y - t.y) < 3 * band) {
            near = true;
            break;
          }
        }
        if (near) zone.push(t);
        else {
          zones.push(zone);
          zone = [t];
        }
      }
      if (zone.length) zones.push(zone);
    }
    for (const zone of zones) {
      const i = Math.min(zone[0].i, zone[0].j);
      const j = Math.max(zone[0].i, zone[0].j);
      if (i === j) {
        repairSelfZone(zone, strands, crossings, aOnTop, repair, o);
        continue;
      }
      repairPairZone(zone, i, j, strands, crossings, aOnTop, repair, o);
    }
    let any = false;
    for (const arr of repair) {
      if (arr.length) {
        any = true;
        break;
      }
    }
    if (!any) break;
    for (let k = 0; k < strands.length; k++) allRepair[k].push(...repair[k]);
    cur = occludeMarks(cur, strands, repair, o);
  }
  return dropSliverPeeks(cur, strands, baseOccluders, allRepair, o);
}

/**
 * Resolve one self-contact zone of strand `k`. A wadded strand breaks the
 * "one window per contact" model twice over: a spatial zone can contain
 * hits from SEVERAL pass-pairs (three stacked coils make three contacts in
 * one spot), and a spiral hug longer than one turn INTERLEAVES arcs — the
 * winning turn's window would contain the losing turn's arcs, and any arc
 * inside a window's range is exempt from it by construction, so one big
 * window can never resolve the wad (the ink it should erase is the ink it
 * exempts). So: decide the winner PER HIT (nearest self-crossing in arc
 * space; later coil on top as fallback), then erase along the winning tube
 * in short CHUNKS, each strictly shorter than the local turn period minus
 * both exemption pads — every chunk's exemption then stays inside its own
 * turn, and the neighbouring turn's ink is erased by the chunk that covers
 * it instead of being exempted by the chunk it lies under.
 */
function repairSelfZone(
  zone: Intrusion[],
  strands: TangleStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  repair: Occluder[][],
  o: OccludeOptions
): void {
  const k = zone[0].i;
  const s = strands[k];
  const selfXings: { lo: number; hi: number; overArc: number }[] = [];
  for (const c of crossings) {
    if (c.a.strand !== k || c.b.strand !== k) continue;
    selfXings.push({
      lo: Math.min(c.a.arc, c.b.arc),
      hi: Math.max(c.a.arc, c.b.arc),
      overArc: aOnTop[c.id] ? c.a.arc : c.b.arc,
    });
  }
  // Winning-tube hits: the tube side of this hit is the pass on top here.
  const winning: Intrusion[] = [];
  for (const t of zone) {
    const lo = Math.min(t.iArc, t.jArc);
    const hi = Math.max(t.iArc, t.jArc);
    let winnerArc = -1;
    let bestD = 24 * s.r;
    for (const x of selfXings) {
      const d = Math.abs(x.lo - lo) + Math.abs(x.hi - hi);
      if (d < bestD) {
        bestD = d;
        winnerArc = x.overArc;
      }
    }
    const hiWins = winnerArc >= 0 ? Math.abs(hi - winnerArc) <= Math.abs(lo - winnerArc) : true;
    if (t.iArc === (hiWins ? hi : lo)) winning.push(t);
  }
  if (winning.length === 0) return;
  winning.sort((a, b) => a.iArc - b.iArc);

  const half = s.r + o.gap + o.inflatePx;
  const exempt = half + 1;
  // Contiguous winning-tube runs, then chunks short enough that a chunk's
  // window plus exemption pads spans less than the local turn period.
  let runStart = 0;
  for (let e = 1; e <= winning.length; e++) {
    if (e < winning.length && winning[e].iArc - winning[e - 1].iArc <= 3 * s.r) continue;
    const run = winning.slice(runStart, e);
    runStart = e;
    let minT = Infinity;
    for (const t of run) minT = Math.min(minT, Math.abs(t.iArc - t.jArc));
    const room = minT - 2 * exempt;
    // Turns closer in arc than two exemption pads cannot be separated by
    // an arc-windowed field at all — leave them to the sliver cleanup
    // rather than churn on windows that can never bite.
    if (room <= 2) continue;
    const runLo = Math.max(0, run[0].iArc - 1.2 * s.r);
    const runHi = Math.min(s.len, run[run.length - 1].iArc + 1.2 * s.r);
    const chunkMax = Math.max(2, 0.8 * room);
    const nChunks = Math.max(1, Math.ceil((runHi - runLo) / chunkMax));
    for (let ci = 0; ci < nChunks; ci++) {
      const a0 = runLo + ((runHi - runLo) * ci) / nChunks;
      const a1 = runLo + ((runHi - runLo) * (ci + 1)) / nChunks;
      const occ = occluderFromWindow(s, k, a0, a1, half);
      occ.exemptPad = exempt;
      repair[k].push(occ);
    }
  }
}

/** Resolve one pair-contact zone between strands `i` and `j`. */
function repairPairZone(
  zone: Intrusion[],
  i: number,
  j: number,
  strands: TangleStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  repair: Occluder[][],
  o: OccludeOptions
): void {
  // One winner per zone: the weave's call at the pair's nearest
  // crossing; pure grazes fall back to the fatter tube (tie: lower
  // index), matching the graze pass's convention. "Nearest" is measured
  // in ARC distance on both strands, matching the graze pass's
  // midpoint-between-consecutive-crossings split — a euclidean-nearest
  // crossing can belong to a spatially close but arc-far loop-back of
  // the pair, and picking it inverts the z-order the erase pass already
  // committed to.
  let meanI = 0;
  let meanJ = 0;
  for (const t of zone) {
    meanI += t.i === i ? t.iArc : t.jArc;
    meanJ += t.i === j ? t.iArc : t.jArc;
  }
  meanI /= zone.length;
  meanJ /= zone.length;
  let top = -1;
  let bestD = 12 * (strands[i].r + strands[j].r);
  for (const c of crossings) {
    const samePair =
      (c.a.strand === i && c.b.strand === j) || (c.a.strand === j && c.b.strand === i);
    if (!samePair) continue;
    const ci = c.a.strand === i ? c.a.arc : c.b.arc;
    const cj = c.a.strand === j ? c.a.arc : c.b.arc;
    const d = Math.abs(ci - meanI) + Math.abs(cj - meanJ);
    if (d < bestD) {
      bestD = d;
      top = aOnTop[c.id] ? c.a.strand : c.b.strand;
    }
  }
  if (top < 0) {
    top =
      strands[i].r > strands[j].r + 1e-9
        ? i
        : strands[j].r > strands[i].r + 1e-9
          ? j
          : i;
  }
  const loser = top === i ? j : i;
  // Erase the loser's intruding ink: window along the winner over the
  // arcs where the loser's ink actually sits inside the winner's tube.
  let arcLo = Infinity;
  let arcHi = -Infinity;
  for (const t of zone) {
    if (t.i !== top) continue;
    if (t.iArc < arcLo) arcLo = t.iArc;
    if (t.iArc > arcHi) arcHi = t.iArc;
  }
  if (!isFinite(arcLo)) return; // only over-ink in this zone: nothing to erase
  const pad = 1.2 * (strands[i].r + strands[j].r);
  repair[loser].push(
    occluderFromWindow(
      strands[top],
      top,
      Math.max(0, arcLo - pad),
      Math.min(strands[top].len, arcHi + pad),
      strands[top].r + o.gap + o.inflatePx
    )
  );
}

/**
 * Deep-pile cleanup: in a 4-deep mat a buried strand is legitimately
 * almost entirely hidden — but the per-mark survival rules let short
 * peeks through wherever two occluders don't quite meet, and the result
 * is confetti: an orphan ring arc or a 10px edge stub floating between
 * tubes. A human inker doesn't draw a sliver of buried tube shorter than
 * the tube is wide. So: compute each strand's VISIBLE arc intervals (its
 * centerline outside every occluder), and drop all marks living inside a
 * visible interval shorter than ~a tube width.
 */
function dropSliverPeeks(
  marks: Mark[],
  strands: TangleStrand[],
  base: Occluder[][],
  repair: Occluder[][],
  o: OccludeOptions
): Mark[] {
  interface DeadRun {
    lo: number;
    hi: number;
  }
  const dead: DeadRun[][] = strands.map((s, k) => {
    const occs = [...(base[k] ?? []), ...(repair[k] ?? [])];
    if (occs.length === 0) return [];
    const ownEndZones = o.endZones?.[k];
    const pad = 2 * s.r;
    const step = Math.max(2, s.r / 4);
    // Sandwich test: a peek may only be swallowed when BOTH of its cut
    // ends sit under another strand's actual TUBE (not merely inside the
    // reserved-gap inflation). Dropping a peek that borders open paper
    // amputates the tube — a flat cut hanging in white, worse than any
    // crumb it removes. `covered` with the half shrunk by gap+inflate
    // tests the real tube body.
    const tubeShrink = o.gap + o.inflatePx;
    /** Radius of the fattest real tube burying arc `a`, or -1 if none. */
    const bracketRadius = (a: number): number => {
      const p = sampleAtOpen(s, a).p;
      let best = -1;
      for (const occ of occs) {
        const exemptPad = occ.exemptPad ?? pad;
        if (occ.strand === k && a >= occ.arcMin - exemptPad && a <= occ.arcMax + exemptPad)
          continue;
        if (occ.end && ownEndZones && ownEndZones.some(([lo, hi]) => a >= lo && a <= hi))
          continue;
        if (
          p.x < occ.minX ||
          p.x > occ.maxX ||
          p.y < occ.minY ||
          p.y > occ.maxY
        )
          continue;
        const shrunk: Occluder = { ...occ, half: Math.max(1, occ.half - tubeShrink) };
        if (occluderHits(shrunk, p.x, p.y)) {
          const rOver = strands[occ.strand]?.r ?? 0;
          if (rOver > best) best = rOver;
        }
      }
      return best;
    };
    // Hiddenness is a property of the SILHOUETTE, not the axis. A thin
    // strand crossing a fat one buries the fat one's centerline while both
    // its edges still print in full; scoring the axis called that arc
    // hidden and let the peek rule delete a tube whose outline is plainly
    // there — one of the largest sources of lines breaking for no visible
    // reason. An arc counts as hidden only when the centre AND both edges
    // are covered.
    const hidden = (a: number): boolean => {
      const smp = sampleAtOpen(s, a);
      if (!covered(smp.p.x, smp.p.y, a, k, occs, pad, ownEndZones)) return false;
      for (const side of [1, -1] as const) {
        const ex = smp.p.x + side * smp.n.x * s.r;
        const ey = smp.p.y + side * smp.n.y * s.r;
        if (!covered(ex, ey, a, k, occs, pad, ownEndZones)) return false;
      }
      return true;
    };
    const runs: DeadRun[] = [];
    let visStart = 0;
    let prevCovered = true;
    let arc = 0;
    // Sentinel pass over [0, len] collecting the visible runs; how short a
    // run has to be to count as debris is decided per run below.
    for (; arc <= s.len + step; arc += step) {
      const a = Math.min(arc, s.len);
      const isCov = hidden(a);
      if (prevCovered && !isCov) visStart = a;
      if (!prevCovered && isCov) runs.push({ lo: visStart, hi: a });
      prevCovered = isCov;
      if (a >= s.len) break;
    }
    // A visible run touching either strand END stays: a tube emerging off
    // the pile edge or into its own cuff is real anatomy, however short.
    // And a peek is judged against the tubes that BURY it, not against its
    // own radius: the same 40px stretch is debris between two fat ducts and
    // honest anatomy between two thin ones. The old blanket `3 * s.r` asked
    // the wrong strand — at r = 24 it discarded 72px of plainly visible
    // tube — so this can only ever be gentler, never more aggressive.
    return runs.filter((r) => {
      if (r.lo <= step || r.hi >= s.len - step) return false;
      const rl = bracketRadius(Math.max(0, r.lo - 1.5 * step));
      const rr = bracketRadius(Math.min(s.len, r.hi + 1.5 * step));
      if (rl < 0 || rr < 0) return false;
      return r.hi - r.lo < Math.min(3 * s.r, 0.6 * (rl + rr));
    });
  });

  // Split marks against the dead intervals — never whole-drop by a single
  // representative arc: a long edge piece whose MID happens to land in one
  // short dead sliver would vanish end to end, leaving hundreds of px of
  // rings with no silhouette (ring-ladder skeletons, the worst read a
  // deep pile can produce). Short single-arc marks (rings, ticks) reduce
  // to the mid test naturally.
  const inDead = (runs: DeadRun[], a: number): boolean => {
    for (const r of runs) {
      if (a >= r.lo && a <= r.hi) return true;
      if (r.lo > a) break;
    }
    return false;
  };
  const kept: Mark[] = [];
  for (const m of marks) {
    const runs = dead[m.strand];
    if (!runs || runs.length === 0) {
      kept.push(m);
      continue;
    }
    let pts: Point[] = [];
    let arcs: number[] = [];
    const flush = () => {
      if (pts.length >= 2) {
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
          len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        if (len >= 1.5 * o.penWidth)
          kept.push({ points: pts, arcs, layer: m.layer, strand: m.strand });
      }
      pts = [];
      arcs = [];
    };
    for (let i = 0; i < m.points.length; i++) {
      if (inDead(runs, m.arcs[i])) flush();
      else {
        pts.push(m.points[i]);
        arcs.push(m.arcs[i]);
      }
    }
    flush();
  }

  // Edge support: corrugation, shade, and ticks belong to a tube that has
  // a silhouette there. In a deep pile the survival rules can keep a ring
  // arc whose edges both died — a floating smile between other tubes, the
  // most conspicuous confetti a mat produces. Keep interior marks only
  // within ~a radius of a surviving edge of their own strand.
  const edgeRuns: [number, number][][] = strands.map(() => []);
  for (const m of kept) {
    if (m.layer !== 'edge') continue;
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of m.arcs) {
      if (a < lo) lo = a;
      if (a > hi) hi = a;
    }
    edgeRuns[m.strand].push([lo, hi]);
  }
  for (const runs of edgeRuns) runs.sort((p, q) => p[0] - q[0]);
  return kept.filter((m) => {
    if (m.layer === 'edge') return true;
    const runs = edgeRuns[m.strand];
    const r = strands[m.strand].r;
    const mid = m.arcs[Math.floor(m.arcs.length / 2)];
    for (const [lo, hi] of runs) {
      if (mid >= lo - 1.5 * r && mid <= hi + 1.5 * r) return true;
      if (lo > mid + 1.5 * r) break;
    }
    return false;
  });
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
  strands: TangleStrand[],
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
    // Edge fragments: a hose keeps short slivers (real anatomy between
    // adjacent crossings); a lace fragment shorter than about a width reads
    // as dirt — the wad zones were full of 5px edge crumbs. These floors
    // discard ink that SURVIVED the erase, i.e. ink standing on open paper,
    // so they must stay near the pen's own scale: the old absolute 4.5px
    // (and 2.2r for lace, a full tube width) deleted visible outline and
    // left breaks with nothing above them.
    const minRun = Math.max(1.5 * o.penWidth, (o.lace ? 0.8 : 0.35) * r);
    const ownEndZones = o.endZones?.[mark.strand];

    const isCrossMark = mark.layer === 'shadow';
    if (isCrossMark) {
      // Any hit drops the whole tick. A tick also dies when the strand's
      // CENTERLINE is covered anywhere within ~1.5 widths of it: edges
      // vanish by fragment-length while ticks vanish by coverage, so a
      // buried stretch (edges chopped below the fragment floor) would
      // otherwise leave its tick chain floating on bare paper.
      const sMark = strands[mark.strand];
      let hit = false;
      for (const da of [-3 * r, 0, 3 * r]) {
        const a = Math.max(0, Math.min(sMark.len, mark.arcs[0] + da));
        const centre = sampleAtOpen(sMark, a).p;
        if (covered(centre.x, centre.y, a, mark.strand, occs, pad, ownEndZones)) {
          hit = true;
          break;
        }
      }
      outer: for (let i = 0; i < mark.points.length - 1 && !hit; i++) {
        const a = mark.points[i];
        const b = mark.points[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.ceil(segLen / micro));
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const arc = mark.arcs[i] + (mark.arcs[i + 1] - mark.arcs[i]) * t;
          if (covered(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, arc, mark.strand, occs, pad, ownEndZones)) {
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
    // Same principle as `minRun`: these reject ink that is standing on open
    // paper, so they are kept close to the pen. A ring that keeps 41% of its
    // sweep is a legible arc across the tube, not a shard — the old 0.6
    // threshold binned it and left the gap unexplained.
    const minLenFor = (attached: boolean): number =>
      mark.layer === 'shade'
        ? Math.max(minRun, 0.6 * r)
        : mark.layer === 'ring'
          ? Math.max(1.5 * o.penWidth, (attached ? 0.2 : 0.4) * origLen)
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
    push(p0, mark.arcs[0], covered(p0.x, p0.y, mark.arcs[0], mark.strand, occs, pad, ownEndZones));
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
        push(p, arc, covered(p.x, p.y, arc, mark.strand, occs, pad, ownEndZones));
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
  strands: TangleStrand[],
  crossings: Crossing[],
  aOnTop: boolean[],
  o: OccludeOptions
): Mark[] {
  const marks: Mark[] = [];
  if (o.shadowHatch <= 0.02) return marks;
  const nT = o.lace ? 1 : Math.round(1 + o.shadowHatch * 3);
  const reachFrac = o.lace ? 0.45 : 0.8;

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
      const reach = s.r * reachFrac;
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
