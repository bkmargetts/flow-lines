import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';
import { densify, steer } from '../lib/spatial.js';
import { smoothPolyline } from '../lib/polyline.js';
import { clamp, lerp } from '../lib/math.js';

/**
 * Strand centerlines: a heading integrated with noise-modulated curvature —
 * the gesture spine's "ballistic pen" idea, but sign-changing so the strand
 * wanders instead of committing to one arc. No control-point splines (they
 * read as CAD curves).
 *
 * The one hard invariant is the curvature cap: the tube edges are the
 * centerline offset by ±r along the normals, and a naive normal offset folds
 * into a cusp once κ·r ≥ 1. Growth clamps every per-step heading change
 * (noise + steering combined) to the material's κmax, so the fattest strand
 * still bends on a radius comfortably larger than its own half-width.
 *
 * Materials: a HOSE is stiff — its minimum bend radius scales with its
 * radius (BEND_FACTOR·r) and it wanders in long confident arcs. A LACE is
 * floppy — its minimum bend is a few of its own half-widths with a small
 * absolute floor, its wander is higher-frequency crinkle, and it runs
 * longer.
 */

// 1.8 keeps the inside of a hose's tightest bend at 0.8r — rings fan
// through it without converging into a sunburst hub (they do below ~0.7r).
export const BEND_FACTOR = 1.8;

export type TangleMaterial = 'hose' | 'lace';

/** The tightest legal bend for a strand of half-width `r`. For a lace this
 *  is the FOLD radius — the hairpin apex where the ribbon turns back on
 *  itself; between folds the growth uses a far gentler smooth cap. */
export function kappaMaxFor(material: TangleMaterial, r: number): number {
  return material === 'lace' ? 1 / foldRadiusFor(r) : 1 / (BEND_FACTOR * r);
}

/** Hairpin apex radius for a lace of half-width `r`: wide enough that the
 *  fold's two legs hold visible paper between them — legs in contact read
 *  as a collapsed needle, not a fold. */
export function foldRadiusFor(r: number): number {
  return Math.max(1.9 * r, 1.5 * r + 3);
}

export interface GrowOptions {
  /** Drawable box (the margin frame). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  material: TangleMaterial;
  count: number;
  radiusMin: number;
  radiusMax: number;
  /** 0..1 curvature energy + wander frequency. */
  wander: number;
  /** 0..1 probability each strand end terminates on-page with an open end
   *  (a hose cuff / a lace aglet). */
  cuffChance: number;
  /** Extra reserved paper between parallel strands, px. */
  clearance: number;
  /** Finish-pass displacement reach — pads every placement margin. */
  pad: number;
  seed: number;
}

export interface GrownHose {
  pts: Point[];
  r: number;
  cuffStart: boolean;
  cuffEnd: boolean;
  /** Arc positions of hairpin fold apexes (lace material only). */
  foldArcs: number[];
}

const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

interface FieldPoint {
  x: number;
  y: number;
  /** Tube radius of the hose this point belongs to. */
  r: number;
  /** Unit travel direction at this point. */
  tx: number;
  ty: number;
  /** Arc position along the owning hose (own-tail fields only). */
  arc?: number;
}

/**
 * Spatial hash of already-grown hoses, so later hoses can feel them: a hose
 * that finds itself running ALONG a neighbour steers away (a lengthwise hug
 * deep enough to overlap can't be drawn — between two pinning crossings the
 * relaxation pass can't pull it back out either), while a transversal
 * approach is left alone — worming OVER things is the whole point.
 */
class HoseField {
  private readonly cell: number;
  private readonly buckets = new Map<string, FieldPoint[]>();

  constructor(cell: number) {
    this.cell = Math.max(4, cell);
  }

  add(p: FieldPoint): void {
    const key = `${Math.floor(p.x / this.cell)},${Math.floor(p.y / this.cell)}`;
    let arr = this.buckets.get(key);
    if (!arr) {
      arr = [];
      this.buckets.set(key, arr);
    }
    arr.push(p);
  }

  /**
   * The deepest ALONG-RUNNING violation near (x, y): among field points
   * within `within` whose travel direction is near-parallel to `(hx, hy)`,
   * the one with the largest `threshold(q) - distance` deficit. Transversal
   * points never count — a crossing in the making must not mask (or be
   * masked by) a parallel neighbour behind it.
   */
  worstAlong(
    x: number,
    y: number,
    within: number,
    hx: number,
    hy: number,
    threshold: (q: FieldPoint) => number,
    skip?: (q: FieldPoint) => boolean
  ): { p: FieldPoint; d: number } | null {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const reach = Math.max(1, Math.ceil(within / this.cell));
    let best: FieldPoint | null = null;
    let bestD = 0;
    let bestDeficit = 0;
    for (let gy = cy - reach; gy <= cy + reach; gy++) {
      for (let gx = cx - reach; gx <= cx + reach; gx++) {
        const arr = this.buckets.get(`${gx},${gy}`);
        if (!arr) continue;
        for (const q of arr) {
          if (skip && skip(q)) continue;
          if (Math.abs(hx * q.tx + hy * q.ty) <= 0.72) continue;
          const d = Math.hypot(q.x - x, q.y - y);
          const deficit = threshold(q) - d;
          if (deficit > bestDeficit) {
            bestDeficit = deficit;
            bestD = d;
            best = q;
          }
        }
      }
    }
    return best ? { p: best, d: bestD } : null;
  }
}

export function growHoses(o: GrowOptions): GrownHose[] {
  const noise = createNoise(subSeed(o.seed, 2));
  const boxW = o.x1 - o.x0;
  const boxH = o.y1 - o.y0;
  const diag = Math.hypot(boxW, boxH);
  const cx = (o.x0 + o.x1) / 2;
  const cy = (o.y0 + o.y1) / 2;
  const hoses: GrownHose[] = [];
  const field = new HoseField(2 * o.radiusMax + o.clearance);

  for (let k = 0; k < o.count; k++) {
    // Per-hose stream keyed by k, rands drawn unconditionally in fixed order:
    // changing `count` must never re-roll the hoses that were already there.
    const rand = makeRandom(subSeed(o.seed, 1) + k * 101);
    const rRoll = rand();
    const edgeRoll = rand();
    const posRoll = rand();
    const headJitter = rand();
    const lenRoll = rand();
    const cuffStartRoll = rand();
    const cuffEndRoll = rand();
    const startInX = rand();
    const startInY = rand();
    const headRoll = rand();

    // Thin-biased radius spread: a pile reads best as several slim runs
    // against one or two fat trunks.
    const r = lerp(o.radiusMin, o.radiusMax, Math.pow(rRoll, 1.35));
    const cuffStart = cuffStartRoll < o.cuffChance;
    const cuffEnd = cuffEndRoll < o.cuffChance;

    let x: number;
    let y: number;
    let theta: number;
    if (cuffStart) {
      // The mouth needs clear paper around it — inset well inside the frame.
      const inset = Math.min(2.2 * r + o.pad, boxW * 0.35);
      x = lerp(o.x0 + inset, o.x1 - inset, startInX);
      y = lerp(o.y0 + Math.min(2.2 * r + o.pad, boxH * 0.35), o.y1 - Math.min(2.2 * r + o.pad, boxH * 0.35), startInY);
      theta = headRoll * 2 * Math.PI;
    } else {
      // Enter from off-page so the frame clip cuts the hose mid-run.
      const edge = Math.floor(edgeRoll * 4) % 4;
      const t = 0.08 + 0.84 * posRoll;
      const out = r + o.pad + 4;
      if (edge === 0) {
        x = o.x0 + boxW * t;
        y = o.y0 - out;
        theta = Math.PI / 2;
      } else if (edge === 1) {
        x = o.x1 + out;
        y = o.y0 + boxH * t;
        theta = Math.PI;
      } else if (edge === 2) {
        x = o.x0 + boxW * t;
        y = o.y1 + out;
        theta = -Math.PI / 2;
      } else {
        x = o.x0 - out;
        y = o.y0 + boxH * t;
        theta = 0;
      }
      theta += (headJitter - 0.5) * 1.3;
    }

    // A dropped lace is CURSIVE: long confident curls and loops — same-sign
    // curvature that breathes — joined by S-transitions where the sign
    // flips, with an occasional hairpin fold as an accent. Directionless
    // wander reads as spaghetti; distributed crinkle reads as nerves.
    const lace = o.material === 'lace';
    const targetLen = diag * (0.55 + 0.9 * lenRoll) * (lace ? 1.35 : 1);
    const ds = 3.5;
    const foldRadius = foldRadiusFor(r);
    const loopRadius = lerp(95, 42, o.wander);
    const kappaMax = lace ? 1 / loopRadius : kappaMaxFor(o.material, r);
    const kAmp = kappaMax * (0.3 + 0.7 * o.wander);
    const wanderScale = lace ? 2.2 * (2 * Math.PI * loopRadius) : lerp(240, 70, o.wander);
    const maxTurn = kappaMax * ds;
    const foldMaxTurn = (1 / foldRadius) * ds;

    // Fold and curl-sign schedules: a fixed number of rolls regardless of
    // use, so knob changes never re-roll the layout. Folds are rare
    // accents; sign flips land roughly once per loop circumference.
    const foldMean = lerp(950, 380, o.wander);
    const folds: { arc: number; turn: number; dir: 1 | -1 }[] = [];
    {
      let acc = foldMean * (0.5 + 0.8 * rand());
      for (let f = 0; f < 6; f++) {
        const spacingRoll = rand();
        const turnRoll = rand();
        const dirRoll = rand();
        if (lace) {
          folds.push({
            arc: acc,
            turn: lerp(2.45, 3.65, turnRoll), // 140°..210°
            dir: dirRoll < 0.5 ? 1 : -1,
          });
        }
        acc += foldMean * (0.7 + 1.2 * spacingRoll);
      }
    }
    const loopCirc = 2 * Math.PI * loopRadius;
    const signFlips: number[] = [];
    let curlSign: 1 | -1 = rand() < 0.5 ? 1 : -1;
    {
      let acc = loopCirc * (0.3 + 0.55 * rand());
      for (let f = 0; f < 24; f++) {
        const spacingRoll = rand();
        signFlips.push(acc);
        acc += loopCirc * (0.35 + 0.55 * spacingRoll);
      }
    }
    let signIdx = 0;
    // Same-sign rotation budget: a curl may close at most ~0.85 of a full
    // turn before the sign is forced to flip — open curls and c-shapes are
    // the lace vocabulary; multi-turn concentric spirals are a ball of
    // yarn, and a trapped spiral is the worst wad this material can form.
    let sameSignTurn = 0;
    const exitOvershoot = r + o.pad + 4;
    const cuffInsetX = Math.min(2.2 * r + o.pad, boxW * 0.35);
    const cuffInsetY = Math.min(2.2 * r + o.pad, boxH * 0.35);
    const borderZone = 2.5 * r + 24;
    const maxSteps = Math.ceil((targetLen / ds) * 2.5) + 500;

    const pts: Point[] = [{ x, y }];
    const own = new HoseField(Math.max(8, 2.5 * r));
    const foldArcs: number[] = [];
    let foldIdx = 0;
    let foldTurnLeft = 0;
    let foldDir: 1 | -1 = 1;
    let foldCalmUntil = -1;
    let arcPos = 0;
    for (let step = 0; step < maxSteps; step++) {
      const exitPhase = !cuffEnd && arcPos >= 0.72 * targetLen;

      // Enter fold mode: a committed hairpin — constant tight curvature
      // until the rolled turn is spent. Nothing steers a fold open.
      if (
        !exitPhase &&
        foldIdx < folds.length &&
        foldTurnLeft <= 0 &&
        arcPos >= folds[foldIdx].arc &&
        arcPos >= foldCalmUntil && // never fold inside the previous fold's calm zone
        arcPos < targetLen * 0.82
      ) {
        foldTurnLeft = folds[foldIdx].turn;
        foldDir = folds[foldIdx].dir;
        // Apex sits half-way through the turn from here.
        foldArcs.push(arcPos + (foldTurnLeft / 2) * foldRadius);
        foldCalmUntil = arcPos + foldTurnLeft * foldRadius + Math.PI * foldRadius;
        foldIdx++;
      }
      if (foldTurnLeft > 0) {
        const turn = Math.min(foldMaxTurn, foldTurnLeft);
        theta += foldDir * turn;
        foldTurnLeft -= turn;
        x += Math.cos(theta) * ds;
        y += Math.sin(theta) * ds;
        arcPos += ds;
        pts.push({ x, y });
        own.add({ x, y, r, tx: Math.cos(theta), ty: Math.sin(theta), arc: arcPos });
        continue;
      }

      let evade = 0;
      let want: number;
      if (lace) {
        // Curl: same-sign curvature breathing between 45% and 100% of the
        // loop rate; the sign flips at scheduled arcs (the cursive joints).
        let flip = false;
        while (signIdx < signFlips.length && arcPos >= signFlips[signIdx]) {
          flip = true;
          signIdx++;
        }
        if (sameSignTurn > 2 * Math.PI * 0.85) flip = true;
        if (flip) {
          curlSign = curlSign === 1 ? -1 : 1;
          sameSignTurn = 0;
        }
        const breathe =
          0.45 + 0.55 * (0.5 + 0.5 * noise.noise2D(arcPos / wanderScale, k * 13.7 + 0.5));
        want = theta + curlSign * kappaMax * breathe * ds;
        sameSignTurn += kappaMax * breathe * ds;
      } else {
        want = theta + kAmp * noise.noise2D(arcPos / wanderScale, k * 13.7 + 0.5) * ds;
      }

      if (exitPhase) {
        // Head out along the edge the CURRENT heading points at — nearest-
        // edge exits funnel every strand in a region into the same parallel
        // column (the wad factory). Fall back to the nearest edge when the
        // heading-aligned edge is more than half the sheet away.
        const hx = Math.cos(theta);
        const hy = Math.sin(theta);
        const tx = hx > 1e-6 ? (o.x1 - x) / hx : hx < -1e-6 ? (o.x0 - x) / hx : Infinity;
        const ty = hy > 1e-6 ? (o.y1 - y) / hy : hy < -1e-6 ? (o.y0 - y) / hy : Infinity;
        let target: number;
        if (Math.min(tx, ty) < 0.55 * diag) {
          target = tx < ty ? (hx > 0 ? 0 : Math.PI) : hy > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          const dl = x - o.x0;
          const dr = o.x1 - x;
          const dt = y - o.y0;
          const db = o.y1 - y;
          const m = Math.min(dl, dr, dt, db);
          target = m === dl ? Math.PI : m === dr ? 0 : m === dt ? -Math.PI / 2 : Math.PI / 2;
        }
        want = steer(want, target, 0.2);
      } else {
        // Feel the pile: veer off a neighbour we're running along; leave a
        // transversal approach alone — that's a crossing in the making. The
        // strand's OWN tail counts as a neighbour too (ignoring the last few
        // radii behind the tip): self-hugs are the one overlap the
        // downstream occlusion machinery genuinely can't tell a clean story
        // about.
        const hx = Math.cos(theta);
        const hy = Math.sin(theta);
        const thr = (q: FieldPoint) => r + q.r + o.clearance + 4;
        // Laces drape: side-by-side runs are the material's nature, so the
        // veer-off softens — the separation pass still holds physical
        // spacing. And just past a fold, nothing may pry the hairpin open.
        const veerScale = lace ? 0.8 : 1;
        const calm = arcPos < foldCalmUntil;
        const veerOff = (p: FieldPoint, d: number) => {
          const t = thr(p);
          const away = Math.atan2(y - p.y, x - p.x);
          const depth = (t - d) / t;
          evade = Math.max(evade, depth);
          want = steer(want, away, veerScale * 0.4 * Math.min(1, depth + 0.35));
        };
        if (!calm) {
          const near = field.worstAlong(x, y, r + o.radiusMax + o.clearance + 6, hx, hy, thr);
          if (near) veerOff(near.p, near.d);
          const selfGap = lace ? Math.max(5 * r, 1.2 * Math.PI * foldRadius + 5 * r) : 5 * r;
          const nearSelf = own.worstAlong(
            x,
            y,
            2 * r + o.clearance + 6,
            hx,
            hy,
            thr,
            (q) => arcPos - (q.arc ?? 0) < selfGap
          );
          if (nearSelf) veerOff(nearSelf.p, nearSelf.d);
        }
        // Containment: ease back toward the page centre as the tip nears the
        // frame, hard once it strays past it — mid-run strands stay on-page.
        const d = Math.min(x - o.x0, o.x1 - x, y - o.y0, o.y1 - y);
        if (d < borderZone) {
          const ctarget = Math.atan2(cy - y, cx - x);
          const amt = d <= 0 ? 0.6 : 0.45 * (1 - d / borderZone);
          want = steer(want, ctarget, amt);
        }
      }

      // The curvature cap applies to the TOTAL turn — noise and steering
      // combined — or the offset edges fold at the steering points. A lace
      // dodging a live contact may exceed its aesthetic curl cap up to the
      // fold rate: the deflection kink where one strand shoulders off
      // another is physical, and losing the dodge means centerlines fused.
      const turnCap = lace && evade > 0 ? Math.min(foldMaxTurn, maxTurn * (1 + 4 * evade)) : maxTurn;
      theta += clamp(wrapAngle(want - theta), -turnCap, turnCap);
      x += Math.cos(theta) * ds;
      y += Math.sin(theta) * ds;
      arcPos += ds;
      pts.push({ x, y });
      own.add({ x, y, r, tx: Math.cos(theta), ty: Math.sin(theta), arc: arcPos });

      if (exitPhase) {
        const outBy = Math.max(o.x0 - x, x - o.x1, o.y0 - y, y - o.y1);
        if (outBy >= exitOvershoot) break;
      } else if (cuffEnd && arcPos >= targetLen) {
        const insideCuff =
          x >= o.x0 + cuffInsetX &&
          x <= o.x1 - cuffInsetX &&
          y >= o.y0 + cuffInsetY &&
          y <= o.y1 - cuffInsetY;
        if (insideCuff) break;
        // Not deep enough for a clean mouth yet — keep going; the
        // containment steering is already pulling toward the centre.
      }
    }

    if (pts.length < 8) continue;
    const smoothed = smoothPolyline(pts, 2);
    const dense = densify(smoothed, clamp(r / 3, 2, 6));
    for (let i = 0; i < dense.length; i++) {
      const ahead = dense[Math.min(i + 1, dense.length - 1)];
      const behind = dense[Math.max(i - 1, 0)];
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const tl = Math.hypot(tx, ty) || 1;
      field.add({ x: dense[i].x, y: dense[i].y, r, tx: tx / tl, ty: ty / tl });
    }
    hoses.push({ pts: dense, r, cuffStart, cuffEnd, foldArcs });
  }
  return hoses;
}
