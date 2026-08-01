import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';
import { densify, steer } from '../lib/spatial.js';
import { smoothPolyline } from '../lib/polyline.js';
import { clamp, lerp } from '../lib/math.js';

/**
 * Hose centerlines: a heading integrated with noise-modulated curvature —
 * the gesture spine's "ballistic pen" idea, but sign-changing so the hose
 * wanders instead of committing to one arc. No control-point splines (they
 * read as CAD curves).
 *
 * The one hard invariant is the curvature cap: the tube edges are the
 * centerline offset by ±r along the normals, and a naive normal offset folds
 * into a cusp once κ·r ≥ 1. Growth clamps every per-step heading change
 * (noise + steering combined) to κmax = 1/(BEND_FACTOR·r), so the fattest
 * hose still bends on a radius comfortably larger than its own.
 */

// 1.8 keeps the inside of the tightest bend at 0.8r — rings fan through it
// without converging into a sunburst hub (they do below ~0.7r).
export const BEND_FACTOR = 1.8;

export interface GrowOptions {
  /** Drawable box (the margin frame). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  count: number;
  radiusMin: number;
  radiusMax: number;
  /** 0..1 curvature energy + wander frequency. */
  wander: number;
  /** 0..1 probability each hose end terminates on-page with an open cuff. */
  cuffChance: number;
  /** Extra reserved paper between parallel hoses, px. */
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

    const targetLen = diag * (0.55 + 0.9 * lenRoll);
    const ds = 3.5;
    const kappaMax = 1 / (BEND_FACTOR * r);
    const kAmp = kappaMax * (0.3 + 0.7 * o.wander);
    const wanderScale = lerp(240, 70, o.wander);
    const maxTurn = kappaMax * ds;
    const exitOvershoot = r + o.pad + 4;
    const cuffInsetX = Math.min(2.2 * r + o.pad, boxW * 0.35);
    const cuffInsetY = Math.min(2.2 * r + o.pad, boxH * 0.35);
    const borderZone = 2.5 * r + 24;
    const maxSteps = Math.ceil((targetLen / ds) * 2.5) + 500;

    const pts: Point[] = [{ x, y }];
    const own = new HoseField(Math.max(8, 2.5 * r));
    let arcPos = 0;
    for (let step = 0; step < maxSteps; step++) {
      const exitPhase = !cuffEnd && arcPos >= 0.72 * targetLen;
      let want = theta + kAmp * noise.noise2D(arcPos / wanderScale, k * 13.7 + 0.5) * ds;

      if (exitPhase) {
        // Head for whichever frame edge is nearest, straight out.
        const dl = x - o.x0;
        const dr = o.x1 - x;
        const dt = y - o.y0;
        const db = o.y1 - y;
        const m = Math.min(dl, dr, dt, db);
        const target = m === dl ? Math.PI : m === dr ? 0 : m === dt ? -Math.PI / 2 : Math.PI / 2;
        want = steer(want, target, 0.2);
      } else {
        // Feel the pile: veer off a neighbour we're running along; leave a
        // transversal approach alone — that's a crossing in the making. The
        // hose's OWN tail counts as a neighbour too (ignoring the last few
        // radii behind the tip): a wanderer that coils back onto itself
        // osculates its own earlier pass, and self-hugs are the one overlap
        // the downstream occlusion machinery genuinely can't tell a clean
        // story about.
        const hx = Math.cos(theta);
        const hy = Math.sin(theta);
        const thr = (q: FieldPoint) => r + q.r + o.clearance + 4;
        const veerOff = (p: FieldPoint, d: number) => {
          const t = thr(p);
          const away = Math.atan2(y - p.y, x - p.x);
          want = steer(want, away, 0.4 * Math.min(1, (t - d) / t + 0.35));
        };
        const near = field.worstAlong(x, y, r + o.radiusMax + o.clearance + 6, hx, hy, thr);
        if (near) veerOff(near.p, near.d);
        const nearSelf = own.worstAlong(
          x,
          y,
          2 * r + o.clearance + 6,
          hx,
          hy,
          thr,
          (q) => arcPos - (q.arc ?? 0) < 5 * r
        );
        if (nearSelf) veerOff(nearSelf.p, nearSelf.d);
        // Containment: ease back toward the page centre as the tip nears the
        // frame, hard once it strays past it — mid-run hoses stay on-page.
        const d = Math.min(x - o.x0, o.x1 - x, y - o.y0, o.y1 - y);
        if (d < borderZone) {
          const target = Math.atan2(cy - y, cx - x);
          const amt = d <= 0 ? 0.6 : 0.45 * (1 - d / borderZone);
          want = steer(want, target, amt);
        }
      }

      // The curvature cap applies to the TOTAL turn — noise and steering
      // combined — or the offset edges fold at the steering points.
      theta += clamp(wrapAngle(want - theta), -maxTurn, maxTurn);
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
    hoses.push({ pts: dense, r, cuffStart, cuffEnd });
  }
  return hoses;
}
