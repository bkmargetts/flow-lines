import { Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';

/**
 * Meander migration simulation (Howard–Knutson family): a single channel
 * centerline evolves by bank erosion. Local curvature is smoothed with a
 * one-sided upstream exponential kernel (the friction lag of real rivers —
 * this is what makes bends *translate downstream* instead of just ballooning),
 * and each point migrates toward the outer bank in proportion. When a bend's
 * neck pinches closer than a channel width, the loop is spliced out and left
 * behind as an oxbow. Snapshots of the centerline along the way become the
 * historical traces (scroll bars) the renderer draws as the river's memory.
 *
 * Everything is deterministic: the caller supplies the noise source, and the
 * sim itself draws no randomness beyond it.
 */
export interface MeanderSimParams {
  /** Inner drawing rect, px */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Flow axis angle, radians (0 = left→right) */
  angle: number;
  /** Channel width, px — the physical scale everything derives from */
  channelWidth: number;
  /** Perpendicular half-extent of the valley confinement, px */
  valleyHalf: number;
  /** Centerline resample spacing, px */
  ds: number;
  /** Migration steps */
  iterations: number;
  /**
   * Migration gain: displacement per iteration is `rate · W · (κ·W)` px —
   * curvature is normalized by the channel width, so the same rate migrates
   * the same number of *channel widths* per iteration at any sheet size.
   */
  rate: number;
  /** Upstream curvature-lag length λ, px — sets the emergent bend scale */
  lag: number;
  /** Perpendicular bank noise, 0..1 */
  jitter: number;
  /** Neck distance below which a loop cuts off, px */
  cutoffDist: number;
  /** How many evenly-spaced historical snapshots to record */
  snapshots: number;
  /** Arclength from each (pinned, off-page) end over which migration fades in, px */
  endTaper: number;
  /** How far past the rect the centerline extends along the axis, px */
  overhang: number;
}

export interface MeanderTrace {
  points: Point[];
  /** The iteration this snapshot was taken at */
  iter: number;
}

export interface MeanderOxbow {
  /** The abandoned loop's centerline arc (open — the neck ends nearly touch) */
  points: Point[];
  /** The iteration the cutoff happened at */
  iter: number;
}

export interface MeanderSimResult {
  /** The final channel centerline */
  channel: Point[];
  /** Historical centerlines, oldest first */
  traces: MeanderTrace[];
  /** Abandoned loops, oldest first */
  oxbows: MeanderOxbow[];
  iterations: number;
}

/** Evenly resample a polyline to spacing ds, keeping the exact endpoints. */
function resample(points: Point[], ds: number): Point[] {
  if (points.length < 2) return points.slice();
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const n = Math.max(2, Math.round(total / ds));
  const step = total / n;
  const out: Point[] = [{ ...points[0] }];
  let acc = 0;
  let target = step;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + seg >= target && out.length < n) {
      const t = (target - acc) / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      target += step;
    }
    acc += seg;
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

/** Signed curvature at each interior point of a (roughly uniform) polyline. */
function curvatures(points: Point[], ds: number): Float64Array {
  const n = points.length;
  const k = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const ax = points[i].x - points[i - 1].x;
    const ay = points[i].y - points[i - 1].y;
    const bx = points[i + 1].x - points[i].x;
    const by = points[i + 1].y - points[i].y;
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    k[i] = Math.atan2(cross, dot) / ds;
  }
  return k;
}

/**
 * Splice out any loop whose neck has pinched below cutoffDist. Returns the
 * abandoned arcs (there is at most one per call in practice; the loop repeats
 * until the line is clean).
 */
function cutOffLoops(
  points: Point[],
  cutoffDist: number,
  minSep: number
): { points: Point[]; oxbows: Point[][] } {
  const oxbows: Point[][] = [];
  let pts = points;
  let found = true;
  while (found) {
    found = false;
    const cell = cutoffDist;
    const grid = new Map<string, number[]>();
    for (let i = 0; i < pts.length; i++) {
      const key = `${Math.floor(pts[i].x / cell)},${Math.floor(pts[i].y / cell)}`;
      let bucket = grid.get(key);
      if (!bucket) grid.set(key, (bucket = []));
      bucket.push(i);
    }
    outer: for (let i = 0; i < pts.length; i++) {
      const gx = Math.floor(pts[i].x / cell);
      const gy = Math.floor(pts[i].y / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${gx + dx},${gy + dy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i + minSep) continue;
            const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
            if (d < cutoffDist) {
              oxbows.push(pts.slice(i, j + 1).map((p) => ({ ...p })));
              pts = pts.slice(0, i + 1).concat(pts.slice(j));
              found = true;
              break outer;
            }
          }
        }
      }
    }
  }
  return { points: pts, oxbows };
}

export function simulateMeander(params: MeanderSimParams, noise: SimplexNoise): MeanderSimResult {
  const {
    x0,
    y0,
    x1,
    y1,
    angle,
    channelWidth,
    valleyHalf,
    ds,
    iterations,
    rate,
    lag,
    jitter,
    cutoffDist,
    snapshots,
    endTaper,
    overhang,
  } = params;

  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const nrmX = -dirY;
  const nrmY = dirX;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  // Axis extent: project the rect corners so the river spans the whole frame
  // at any flow angle, plus an overhang so the pinned ends sit off-page.
  let uMin = Infinity;
  let uMax = -Infinity;
  for (const [px, py] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ]) {
    const u = (px - cx) * dirX + (py - cy) * dirY;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
  }
  uMin -= overhang;
  uMax += overhang;

  // Gentle seeded perpendicular displacement breaks the symmetry so bends
  // have somewhere to start; tapered to zero at the pinned ends.
  const initFreq = 1 / Math.max(1e-6, lag * 2.5);
  const n0 = Math.max(8, Math.round((uMax - uMin) / ds));
  let points: Point[] = [];
  for (let i = 0; i <= n0; i++) {
    const u = uMin + ((uMax - uMin) * i) / n0;
    const t = Math.min(1, (u - uMin) / endTaper, (uMax - u) / endTaper);
    const taper = t * t * (3 - 2 * t);
    const v = noise.noise2D(u * initFreq, 7.31) * valleyHalf * 0.3 * taper;
    points.push({ x: cx + dirX * u + nrmX * v, y: cy + dirY * u + nrmY * v });
  }

  // A cutoff needs a genuine loop, not a tight wiggle: the two neck points
  // must be separated by at least a bend's worth of arclength (loops emerge
  // at the lag scale), so what's left behind is a horseshoe, never a sliver.
  const minSep = Math.max(8, Math.ceil((Math.PI * lag) / ds), Math.ceil((channelWidth * 6) / ds));
  const K = Math.max(1, Math.ceil((lag * 3) / ds));
  const lagW = new Float64Array(K + 1);
  for (let k = 0; k <= K; k++) lagW[k] = Math.exp((-k * ds) / lag);
  // Stability: a kink's curvature would otherwise demand a huge step.
  const maxStep = ds * 0.6;
  const jitterFreq = 1 / Math.max(1e-6, channelWidth * 3);
  // Feature-scaled magnitudes so behaviour is sheet-size invariant.
  const migRate = rate * channelWidth;

  // History starts once the river has developed real bends — the juvenile
  // near-straight course would draw as mechanical full-width streaks.
  const snapAt = new Set<number>();
  for (let k = 1; k <= snapshots; k++) {
    const frac = 0.3 + (0.67 * k) / snapshots;
    snapAt.add(Math.max(1, Math.round(iterations * frac)));
  }

  const traces: MeanderTrace[] = [];
  const oxbows: MeanderOxbow[] = [];

  for (let it = 1; it <= iterations; it++) {
    const n = points.length;
    const k = curvatures(points, ds);

    // Upstream-lagged curvature: migration here answers to the bends behind.
    const ks = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let wSum = 0;
      const kk = Math.min(K, i);
      for (let m = 0; m <= kk; m++) {
        sum += k[i - m] * lagW[m];
        wSum += lagW[m];
      }
      ks[i] = wSum > 0 ? sum / wSum : 0;
    }

    const next: Point[] = new Array(n);
    let s = 0;
    let total = (n - 1) * ds;
    for (let i = 0; i < n; i++, s += ds) {
      const prev = points[Math.max(0, i - 1)];
      const nxt = points[Math.min(n - 1, i + 1)];
      let tx = nxt.x - prev.x;
      let ty = nxt.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;

      // Outer-bank migration: for a left turn (κ>0) the outer bank is on the
      // right, so displacement runs along (ty, -tx).
      let d = migRate * channelWidth * ks[i];
      if (d > maxStep) d = maxStep;
      else if (d < -maxStep) d = -maxStep;

      // Bank noise, perpendicular to the flow.
      const jn = noise.noise2D(s * jitterFreq, 41 + it * 0.37) * jitter * migRate * 0.25;
      let dxp = ty * (d + jn);
      let dyp = -tx * (d + jn);

      // Valley confinement: a weak ever-present centering keeps the whole belt
      // from ratcheting off the axis, and a soft spring past 60% of the
      // half-width stops it at the belt edge without a visible wall.
      const v = (points[i].x - cx) * nrmX + (points[i].y - cy) * nrmY;
      let pull = (v / valleyHalf) * migRate * 0.04;
      const over = (Math.abs(v) - valleyHalf * 0.6) / (valleyHalf * 0.4);
      if (over > 0) pull += Math.min(over * over, 4) * migRate * 0.7 * Math.sign(v);
      dxp -= nrmX * pull;
      dyp -= nrmY * pull;

      // Pin the off-page ends so the river always enters and exits the frame.
      const et = Math.min(1, s / endTaper, (total - s) / endTaper);
      const taper = et <= 0 ? 0 : et * et * (3 - 2 * et);
      next[i] = { x: points[i].x + dxp * taper, y: points[i].y + dyp * taper };
    }

    // Light bank diffusion: damps sub-channel-width wiggle (jitter, splice
    // kinks) that would otherwise knot into scribble, without eroding real
    // bends (which live at the much larger lag scale).
    for (let i = 1; i < n - 1; i++) {
      const mx = (next[i - 1].x + next[i + 1].x) / 2;
      const my = (next[i - 1].y + next[i + 1].y) / 2;
      next[i] = { x: next[i].x * 0.82 + mx * 0.18, y: next[i].y * 0.82 + my * 0.18 };
    }

    points = resample(next, ds);
    const cut = cutOffLoops(points, cutoffDist, minSep);
    if (cut.oxbows.length > 0) {
      points = resample(cut.points, ds);
      for (const arc of cut.oxbows) oxbows.push({ points: arc, iter: it });
    }
    if (snapAt.has(it)) traces.push({ points: points.map((p) => ({ ...p })), iter: it });
  }

  return { channel: points, traces, oxbows, iterations };
}
