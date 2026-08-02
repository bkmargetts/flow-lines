import type { Point } from '../flow-lines.js';
import { sampleAtOpen, type TangleStrand } from './strand.js';
import type { Crossing } from './crossings.js';
import { CUFF_OPEN, type Mark } from './hose.js';
import { arcAt, type ArcTable } from './depth.js';

/**
 * Hidden-line removal.
 *
 * A tube's BODY is the paper within `r` of its centerline, and the whole of
 * occlusion is one rule: erase a mark point when it lies inside the body of
 * something stacked on top of it. `depth.ts` supplies the stacking order —
 * per arc, so a hose can be over one neighbour and under the next — and this
 * module does nothing but ask that question at each point.
 *
 * The previous implementation never asked it. It approximated, per crossing,
 * the arc-range over which one strand was on top (a walk with caps, pads and
 * exemptions), erased inside a distance field around that guess, and then ran
 * three further passes — a graze sweep, a verify-and-repair, a confetti
 * culler — to patch what the guess got wrong. The last of those deleted ink
 * standing on open paper, which is what made outlines stop in mid-air.
 *
 * Because the test here is exact, the failure modes are not tuned away, they
 * are unreachable: ink inside a higher arc's body is always erased (no window
 * edge to leak through), ink is erased ONLY when inside a higher arc's body
 * (so every gap sits behind a drawn silhouette), and a global order cannot
 * say both A-over-B and B-over-A (so two tubes can never erase each other).
 */

export interface OccludeOptions {
  gap: number;
  inflatePx: number;
  penWidth: number;
  shadowHatch: number;
  /** Lace mode: contact shadows soften — a full-width tick that blends in
   *  among a hose's corrugation rings reads as a staple on a clean ribbon. */
  lace?: boolean;
  /** Per-strand end-hardware arc zones ([lo, hi] per open end). */
  endZones?: [number, number][][];
  /** Which ends carry drawn hardware. Absent = no hardware anywhere. */
  ends?: { cuffStart: boolean; cuffEnd: boolean }[];
}

/** A tip plane: the paper beyond it, along `t` from `(x, y)`, carries no ink. */
export interface TipClip {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

/** The end hardware as an occluding shape — a hose's mouth or a lace's aglet. */
export type EndCap =
  | {
      kind: 'ellipse';
      x: number;
      y: number;
      /** Unit axes: `n` across the mouth, `t` along the strand, pointing out. */
      nx: number;
      ny: number;
      tx: number;
      ty: number;
      /** Semi-axes: `A` across, `B` along. */
      A: number;
      B: number;
    }
  | { kind: 'capsule'; x0: number; y0: number; x1: number; y1: number; reach: number };

/**
 * What a strand covers at its two ends, as drawn — the single definition the
 * eraser and the detectors both read, so they cannot disagree about where a
 * hose stops.
 *
 * A hose ends FLAT: `hose.ts` draws two offset edges that simply stop at the
 * last centerline vertex, with nothing closing them. Modelling the end as a
 * round cap of radius `r` (the natural thing when a tube is a swept disc) puts
 * an opaque bulge on paper that carries no ink, and anything passing behind it
 * loses a crescent of line for no visible reason.
 *
 * An open cuff does add ink past the tip, but only the mouth ELLIPSE — `r`
 * across by `CUFF_OPEN * r` along. A lace's aglet is a true capsule, of the
 * aglet's half-width and reaching to where its own round tip is centred.
 *
 * `grow` inflates the shape (the reserved gap when erasing, a negative inset
 * when asking whether ink is strictly inside).
 */
export function endShapeOf(
  s: TangleStrand,
  cuffStart: boolean,
  cuffEnd: boolean,
  o: { lace?: boolean; penWidth: number },
  grow: number
): { start: TipClip; end: TipClip; caps: { at: 'start' | 'end'; shape: EndCap }[] } {
  const tipOf = (at: 'start' | 'end'): TipClip => {
    const smp = sampleAtOpen(s, at === 'start' ? 0 : s.len);
    const sign = at === 'start' ? -1 : 1;
    return { x: smp.p.x, y: smp.p.y, tx: smp.t.x * sign, ty: smp.t.y * sign };
  };
  const start = tipOf('start');
  const end = tipOf('end');
  const caps: { at: 'start' | 'end'; shape: EndCap }[] = [];
  for (const at of ['start', 'end'] as const) {
    if (at === 'start' ? !cuffStart : !cuffEnd) continue;
    const tip = at === 'start' ? start : end;
    if (o.lace) {
      // Aglet (`lace.ts`): a capsule of half-width `aw` whose round tip is
      // centred `len - aw` out from the lace's end.
      const aw = 0.75 * s.r;
      const len = Math.max(5 * s.r, 4 * o.penWidth);
      caps.push({
        at,
        shape: {
          kind: 'capsule',
          x0: tip.x,
          y0: tip.y,
          x1: tip.x + tip.tx * (len - aw),
          y1: tip.y + tip.ty * (len - aw),
          reach: Math.max(0, aw + grow),
        },
      });
    } else {
      caps.push({
        at,
        shape: {
          kind: 'ellipse',
          x: tip.x,
          y: tip.y,
          nx: -tip.ty,
          ny: tip.tx,
          tx: tip.tx,
          ty: tip.ty,
          A: Math.max(1e-6, s.r + grow),
          B: Math.max(1e-6, CUFF_OPEN * s.r + grow),
        },
      });
    }
  }
  return { start, end, caps };
}

/** Is `(x, y)` inside this piece of end hardware? */
export function inEndCap(cap: EndCap, x: number, y: number): boolean {
  if (cap.kind === 'ellipse') {
    const u = (x - cap.x) * cap.nx + (y - cap.y) * cap.ny;
    const v = (x - cap.x) * cap.tx + (y - cap.y) * cap.ty;
    return (u / cap.A) ** 2 + (v / cap.B) ** 2 < 1;
  }
  return segDist2(x, y, cap.x0, cap.y0, cap.x1, cap.y1).d2 < cap.reach * cap.reach;
}

/** Is `(x, y)` beyond a flat end, where the strand has stopped? */
export function beyondTip(clip: TipClip, x: number, y: number, pad: number): boolean {
  return (x - clip.x) * clip.tx + (y - clip.y) * clip.ty > pad;
}

/** Squared distance from (px, py) to segment ab, and the parameter along it. */
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

interface BodyBase {
  arc: number;
  strand: number;
  /** Arc positions at the body's ends, for the own-tube exemption. */
  a0: number;
  a1: number;
}

interface BodySeg extends BodyBase {
  kind: 'seg';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Erase radius: the tube plus its reserved paper. */
  reach: number;
  /**
   * Flat ends (see `endShapeOf`). Empty on interior segments; a strand short
   * enough to be a single segment carries both of its tips here.
   */
  clips: TipClip[];
  /** How far past a flat end the reserved gap still reaches. */
  clipPad: number;
}

/** Drawn end hardware as a body — a cuff mouth or an aglet. */
interface BodyCap extends BodyBase {
  kind: 'cap';
  cap: EndCap;
}

type Body = BodySeg | BodyCap;

/**
 * Every tube body in a uniform grid, tagged with the arc that owns it.
 *
 * The body has to be the shape of the INK, not a convenient approximation of
 * it, because the whole promise of this module is that a break in a line is
 * explained by something the reader can see covering it. A body that reaches
 * past the drawing erases onto bare paper, and no amount of correct stacking
 * saves that.
 *
 * So the ends are modelled as they are drawn, not as capsules:
 *
 * - a hose stops FLAT at its last vertex (two offset edges, nothing closing
 *   them), so the terminal segments carry an axial clip;
 * - an open cuff adds its mouth ELLIPSE — half-axes `r` across by
 *   `CUFF_OPEN * r` along (`hose.ts`) — not a round cap of radius `r`, which
 *   is what used to chew a crescent out of every duct passing behind a hose
 *   mouth;
 * - a lace's aglet is a genuine capsule, but of the aglet's half-width and
 *   stopping where the aglet's own round tip is centred (`lace.ts`).
 */
export class BodyIndex {
  private readonly cell: number;
  private readonly grid = new Map<string, Body[]>();

  constructor(strands: TangleStrand[], table: ArcTable, o: OccludeOptions) {
    let maxReach = 0;
    for (const s of strands) maxReach = Math.max(maxReach, s.r + o.gap + o.inflatePx);
    this.cell = Math.max(8, maxReach);
    const d = o.gap + o.inflatePx;

    for (let k = 0; k < strands.length; k++) {
      const s = strands[k];
      const reach = s.r + d;
      const last = s.pts.length - 2;
      const shape = endShapeOf(s, o.ends?.[k].cuffStart ?? false, o.ends?.[k].cuffEnd ?? false, o, d);
      for (let i = 0; i + 1 < s.pts.length; i++) {
        const clips: TipClip[] = [];
        if (i === 0) clips.push(shape.start);
        if (i === last) clips.push(shape.end);
        this.add({
          kind: 'seg',
          arc: arcAt(table, k, (s.arc[i] + s.arc[i + 1]) / 2),
          strand: k,
          x0: s.pts[i].x,
          y0: s.pts[i].y,
          x1: s.pts[i + 1].x,
          y1: s.pts[i + 1].y,
          a0: s.arc[i],
          a1: s.arc[i + 1],
          reach,
          clips,
          clipPad: d,
        });
      }
      // Hardware past each open end, shaped like the mark that is drawn there.
      for (const cap of shape.caps) {
        const endArc = cap.at === 'start' ? 0 : s.len;
        this.add({
          kind: 'cap',
          arc: arcAt(table, k, endArc),
          strand: k,
          a0: endArc,
          a1: endArc,
          cap: cap.shape,
        });
      }
    }
  }

  private add(body: Body): void {
    const c = this.cell;
    let x0: number;
    let x1: number;
    let y0: number;
    let y1: number;
    if (body.kind === 'seg') {
      const pad = body.reach;
      x0 = Math.min(body.x0, body.x1) - pad;
      x1 = Math.max(body.x0, body.x1) + pad;
      y0 = Math.min(body.y0, body.y1) - pad;
      y1 = Math.max(body.y0, body.y1) + pad;
    } else if (body.cap.kind === 'ellipse') {
      const pad = Math.max(body.cap.A, body.cap.B);
      x0 = body.cap.x - pad;
      x1 = body.cap.x + pad;
      y0 = body.cap.y - pad;
      y1 = body.cap.y + pad;
    } else {
      const pad = body.cap.reach;
      x0 = Math.min(body.cap.x0, body.cap.x1) - pad;
      x1 = Math.max(body.cap.x0, body.cap.x1) + pad;
      y0 = Math.min(body.cap.y0, body.cap.y1) - pad;
      y1 = Math.max(body.cap.y0, body.cap.y1) + pad;
    }
    for (let cy = Math.floor(y0 / c); cy <= Math.floor(y1 / c); cy++) {
      for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) {
        const key = `${cx},${cy}`;
        let arr = this.grid.get(key);
        if (!arr) this.grid.set(key, (arr = []));
        arr.push(body);
      }
    }
  }

  /** Bodies whose cell contains (x, y). */
  near(x: number, y: number): Body[] | undefined {
    return this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`);
  }
}

/**
 * Is this point of a mark hidden — inside the body of an arc stacked above
 * the arc the mark belongs to?
 *
 * A strand never hides its own ink locally: its outline sits exactly `r` from
 * its own centerline and would otherwise erase itself everywhere. Only a
 * genuinely different pass counts, and the crossing detector guarantees a
 * self-crossing's two passes are at least `6r` apart in arc, so the `5r`
 * neighbourhood below separates "my own tube" from "a coil of me on top of
 * me" without ambiguity.
 */
function hiddenAt(
  index: BodyIndex,
  table: ArcTable,
  strands: TangleStrand[],
  x: number,
  y: number,
  markStrand: number,
  markArc: number,
  ownArc: number
): boolean {
  const bodies = index.near(x, y);
  if (!bodies) return false;
  const ownDepth = table.depth[ownArc];
  for (const body of bodies) {
    if (body.arc === ownArc) continue;
    if (table.depth[body.arc] <= ownDepth) continue;
    let t: number;
    if (body.kind === 'seg') {
      const hit = segDist2(x, y, body.x0, body.y0, body.x1, body.y1);
      if (hit.d2 >= body.reach * body.reach) continue;
      // Past the flat end of a hose there is no ink, so there is nothing to
      // hide behind either.
      let past = false;
      for (const c of body.clips) {
        if (beyondTip(c, x, y, body.clipPad)) {
          past = true;
          break;
        }
      }
      if (past) continue;
      t = hit.t;
    } else {
      if (!inEndCap(body.cap, x, y)) continue;
      t = 0;
    }
    if (body.strand === markStrand) {
      const arcHere = body.a0 + (body.a1 - body.a0) * t;
      if (Math.abs(arcHere - markArc) < 5 * strands[markStrand].r) continue;
    }
    return true;
  }
  return false;
}

/**
 * Break marks against the stacking order. Long marks (edges, shade, cuff
 * ellipses) split into their surviving runs, with the cut refined by
 * micro-sampling so the gap ends land clean; contact-shadow ticks drop whole
 * when touched, since a partial tick reads as dirt rather than as a tick.
 *
 * There is deliberately no confetti rule beyond discarding a run too short to
 * be a line at all. Anything longer survived the erase test, which means it
 * is standing on open paper, and deleting ink on open paper is precisely the
 * artifact this rewrite exists to remove.
 */
export function occludeMarks(
  marks: Mark[],
  strands: TangleStrand[],
  table: ArcTable,
  index: BodyIndex,
  o: OccludeOptions
): Mark[] {
  const out: Mark[] = [];
  const micro = Math.max(1.2, o.penWidth * 0.9);
  const minRun = 1.5 * o.penWidth;

  for (const mark of marks) {
    const s = strands[mark.strand];
    const hidden = (p: Point, arc: number): boolean =>
      hiddenAt(
        index,
        table,
        strands,
        p.x,
        p.y,
        mark.strand,
        arc,
        arcAt(table, mark.strand, arc)
      );

    if (mark.layer === 'shadow') {
      let hit = false;
      // A tick also dies when the strand's centerline is buried within ~1.5
      // widths of it: edges vanish by fragment length while ticks vanish by
      // coverage, so a buried stretch would otherwise leave its tick chain
      // floating on bare paper.
      for (const da of [-3 * s.r, 0, 3 * s.r]) {
        const a = Math.max(0, Math.min(s.len, mark.arcs[0] + da));
        if (hidden(sampleAtOpen(s, a).p, a)) {
          hit = true;
          break;
        }
      }
      for (let i = 0; i < mark.points.length && !hit; i++) {
        if (hidden(mark.points[i], mark.arcs[i])) hit = true;
      }
      if (!hit) out.push(mark);
      continue;
    }

    let runPts: Point[] = [];
    let runArcs: number[] = [];
    const flush = () => {
      if (runPts.length >= 2) {
        let len = 0;
        for (let i = 1; i < runPts.length; i++) {
          len += Math.hypot(runPts[i].x - runPts[i - 1].x, runPts[i].y - runPts[i - 1].y);
        }
        if (len >= minRun)
          out.push({ points: runPts, arcs: runArcs, layer: mark.layer, strand: mark.strand });
      }
      runPts = [];
      runArcs = [];
    };
    const push = (p: Point, arc: number) => {
      if (hidden(p, arc)) flush();
      else {
        runPts.push(p);
        runArcs.push(arc);
      }
    };

    push(mark.points[0], mark.arcs[0]);
    for (let i = 0; i + 1 < mark.points.length; i++) {
      const a = mark.points[i];
      const b = mark.points[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(segLen / micro));
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        push(
          { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
          mark.arcs[i] + (mark.arcs[i + 1] - mark.arcs[i]) * t
        );
      }
    }
    flush();
  }
  return out;
}

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
 * Point-in-tube scan of the surviving ink: every mark point sitting strictly
 * inside another strand's tube (or another pass of its own) is ink printing
 * through something. Exported so the tests can assert the pipeline leaves
 * none of it.
 */
export function findIntrusions(
  marks: Mark[],
  strands: TangleStrand[],
  o: OccludeOptions
): Intrusion[] {
  let maxR = 0;
  for (const s of strands) maxR = Math.max(maxR, s.r);
  const cell = Math.max(8, 2 * maxR);
  const grid = new Map<string, [number, number][]>();
  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    for (let i = 0; i < s.pts.length; i++) {
      const key = `${Math.floor(s.pts[i].x / cell)},${Math.floor(s.pts[i].y / cell)}`;
      let arr = grid.get(key);
      if (!arr) grid.set(key, (arr = []));
      arr.push([k, i]);
    }
  }

  // "Strictly inside" leaves a pen's tolerance at the silhouette: a mark
  // kissing the boundary is legitimate, anything deeper prints visibly
  // inside the tube.
  const inset = Math.max(1.25, 0.5 * o.penWidth);
  // The same flat ends the eraser works to: a hose stops at its last vertex,
  // so ink beyond that is not inside anything, and a cuff covers only its
  // mouth ellipse. Judging intrusions against round caps instead would demand
  // erasure the reader has no mark to explain.
  const shapes = strands.map((s, k) =>
    endShapeOf(s, o.ends?.[k].cuffStart ?? false, o.ends?.[k].cuffEnd ?? false, o, -inset)
  );
  const intrusions: Intrusion[] = [];
  for (const m of marks) {
    const ownZones = o.endZones?.[m.strand];
    for (let pi = 0; pi < m.points.length; pi++) {
      // End hardware sits on top by convention: a cuff mouth or aglet
      // overlapping another tube is overdraw, not ink printing through.
      if (ownZones && ownZones.some(([lo, hi]) => m.arcs[pi] >= lo && m.arcs[pi] <= hi)) continue;
      const p = m.points[pi];
      const cx = Math.floor(p.x / cell);
      const cy = Math.floor(p.y / cell);
      const hit = (k: number, iArc: number) =>
        intrusions.push({ j: m.strand, i: k, iArc, jArc: m.arcs[pi], x: p.x, y: p.y });
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const arr = grid.get(`${gx},${gy}`);
          if (!arr) continue;
          for (const [k, i] of arr) {
            const s = strands[k];
            if (k === m.strand && Math.abs(s.arc[i] - m.arcs[pi]) < 5 * s.r) continue;
            const inner = Math.max(0, s.r - inset);
            const dx = s.pts[i].x - p.x;
            const dy = s.pts[i].y - p.y;
            if (dx * dx + dy * dy >= inner * inner) continue;
            // Only the terminal vertices can be the closest point past a tip,
            // so the clip stays local — a strand curling back on itself is
            // still solid where it doubles behind its own end plane.
            if (i === 0 && beyondTip(shapes[k].start, p.x, p.y, 0)) continue;
            if (i === s.pts.length - 1 && beyondTip(shapes[k].end, p.x, p.y, 0)) continue;
            hit(k, s.arc[i]);
          }
        }
      }
      // Hardware is opaque too: ink inside a cuff mouth or an aglet is buried
      // just as surely as ink inside the tube.
      for (let k = 0; k < strands.length; k++) {
        const s = strands[k];
        for (const cap of shapes[k].caps) {
          const endArc = cap.at === 'start' ? 0 : s.len;
          if (k === m.strand && Math.abs(endArc - m.arcs[pi]) < 5 * s.r) continue;
          if (inEndCap(cap.shape, p.x, p.y)) hit(k, endArc);
        }
      }
    }
  }
  return intrusions;
}

/** A stretch of ink that was erased although nothing is stacked over it. */
export interface UnexplainedGap {
  strand: number;
  layer: string;
  x: number;
  y: number;
  length: number;
}

/**
 * The converse invariant: every break in a line must be caused by a tube
 * stacked on top of it. Under this model that is the exact negation of the
 * erase rule, so it can only fail through an implementation slip — a
 * survivor run discarded by the short-run floor, or a mark the splitter
 * dropped — which is precisely what is worth catching.
 */
export function findUnexplainedGaps(
  survivors: Mark[],
  before: Mark[],
  strands: TangleStrand[],
  table: ArcTable,
  index: BodyIndex,
  o: OccludeOptions
): UnexplainedGap[] {
  // Kept ink lies exactly on a survivor segment, since survivors are
  // sub-polylines of the original geometry.
  const cell = 8;
  const key = (cx: number, cy: number, k: number, layer: string) => `${k}|${layer}|${cx},${cy}`;
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
          const kk = key(cx, cy, m.strand, m.layer);
          let arr = segGrid.get(kk);
          if (!arr) segGrid.set(kk, (arr = []));
          arr.push(seg);
        }
      }
    }
  }
  const survived = (p: Point, k: number, layer: string): boolean => {
    const arr = segGrid.get(key(Math.floor(p.x / cell), Math.floor(p.y / cell), k, layer));
    if (!arr) return false;
    for (const s of arr) if (segDist2(p.x, p.y, s[0], s[1], s[2], s[3]).d2 < 0.1225) return true;
    return false;
  };

  const minGap = Math.max(2, 2 * o.penWidth);
  const gaps: UnexplainedGap[] = [];
  for (const m of before) {
    // Contact ticks drop whole by design, so their absence is not a break.
    if (m.layer === 'shadow') continue;
    const n = m.points.length;
    let i = 0;
    while (i < n) {
      if (survived(m.points[i], m.strand, m.layer)) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < n && !survived(m.points[j + 1], m.strand, m.layer)) j++;
      let lo = -1;
      let best = -1;
      let bestHi = -1;
      for (let q = i; q <= j + 1; q++) {
        const bad =
          q <= j &&
          !hiddenAt(
            index,
            table,
            strands,
            m.points[q].x,
            m.points[q].y,
            m.strand,
            m.arcs[q],
            arcAt(table, m.strand, m.arcs[q])
          );
        if (bad && lo < 0) lo = q;
        if (!bad && lo >= 0) {
          if (best < 0 || q - lo > bestHi - best) {
            best = lo;
            bestHi = q - 1;
          }
          lo = -1;
        }
      }
      // A lone lost vertex is not a hole in the drawing: a run has to reach
      // two points to be a polyline at all, so the splitter drops isolated
      // micro-samples, and the ink that costs is under a pen width. Only a
      // span of consecutive lost vertices is a break the eye can see.
      if (best >= 0 && bestHi > best) {
        let len = 0;
        for (let q = best; q < bestHi; q++) {
          len += Math.hypot(
            m.points[q + 1].x - m.points[q].x,
            m.points[q + 1].y - m.points[q].y
          );
        }
        if (len >= minGap) {
          const mid = m.points[(best + bestHi) >> 1];
          gaps.push({ strand: m.strand, layer: m.layer, x: mid.x, y: mid.y, length: len });
        }
      }
      i = j + 1;
    }
  }
  return gaps;
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

  // Two guards against tangle scribble: shallow (osculating) crossings get no
  // ticks — their geometric cover distance explodes with 1/sin and the ticks
  // land far from any visible pinch — and ticks from neighbouring crossings
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
