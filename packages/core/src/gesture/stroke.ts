import type { FlowLine, Point } from '../flow-lines.js';
import type { SimplexNoise } from '../noise.js';
import { trimPolyline } from '../lib/polyline.js';
import { smoothstep01, type Spine } from './types.js';

/** How a spine is inked: pressure envelope, pass pitch, and dryness. */
export interface StrokeStyle {
  /** peak half-width of the stroke body in px */
  maxHalf: number;
  /** offset-pass pitch in px (~pen width · 0.85 so passes fuse into solid ink) */
  passSpacing: number;
  /** 0..1 — how readily the ink breaks up */
  dryness: number;
  /** fraction of the stroke spent pressing down (default 0.1) */
  entryFrac: number;
  /** fraction spent releasing (long on the fast end) */
  exitFrac: number;
  noise: SimplexNoise;
  /** noise decorrelation track for this stroke */
  track: number;
  layer: string;
}

/**
 * Pressure envelope → per-point half-width. Quick press-down at the entry, a
 * long release toward the exit, and a little belly modulation (real brushes
 * are never constant). Floored at half the pass pitch so the center pass
 * always survives to the tips.
 */
export function pressureWidths(spine: Spine, style: StrokeStyle): number[] {
  const { maxHalf, passSpacing, entryFrac, exitFrac, noise, track } = style;
  return spine.points.map((_, i) => {
    const t = spine.arc[i] / spine.length;
    const entry = smoothstep01(t / entryFrac);
    const exit = smoothstep01((1 - t) / exitFrac);
    const belly = 1 + 0.15 * noise.noise2D(t * 2.2, track + 31);
    return Math.max(passSpacing * 0.5, maxHalf * entry * exit * belly);
  });
}

/**
 * Offset a polyline sideways by a per-point signed distance along the local
 * normal — `offsetPolyline` generalized to a varying width (same
 * central-difference tangent arithmetic).
 */
export function offsetVarying(points: Point[], dist: number[]): Point[] {
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = {
      x: points[i].x + (-ty / len) * dist[i],
      y: points[i].y + (tx / len) * dist[i],
    };
  }
  return out;
}

/**
 * Realize a spine as ink: repeated offset passes of the single pen filling a
 * pressure-tapered body, with dry-brush breakup.
 *
 * Each lane `k` runs at constant pitch `k·passSpacing` through the belly and
 * hugs the tapered outline where the width falls below it; a lane only exists
 * where the width clears 0.6 of its pitch, so pass *lengths* shrink outward —
 * that is the taper (no stroke-width tricks, no pile-of-passes tip blobs).
 *
 * Dry-brush drops sub-runs where a per-lane noise field falls under a
 * threshold that grows with lane edge-ness, local speed, and dryness: the
 * ribbon's edges fray before its core, and breakup concentrates in the fast
 * exit tail — the way a starved brush actually releases.
 */
export function renderStroke(spine: Spine, style: StrokeStyle): FlowLine[] {
  const { maxHalf, passSpacing, dryness, noise, track, layer } = style;
  const n = spine.points.length;
  const w = pressureWidths(spine, style);
  // Local wetness: where the pen presses hard the ink pools and stays solid;
  // breakup belongs to the light, fast parts of the stroke.
  const wet = w.map((v) => v / Math.max(maxHalf, 1e-6));
  const K = Math.min(18, Math.ceil(maxHalf / passSpacing));
  const out: FlowLine[] = [];

  for (let k = -K; k <= K; k++) {
    const dk = Math.abs(k) * passSpacing;
    const laneEdge = dk / Math.max(maxHalf, 1e-6);

    // Contiguous index runs where this lane exists.
    let i = 0;
    while (i < n) {
      if (w[i] <= dk * 0.6) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && w[j] > dk * 0.6) j++;
      if (j - i >= 3) {
        const sub = spine.points.slice(i, j);
        const dist: number[] = new Array(j - i);
        for (let m = i; m < j; m++) dist[m - i] = Math.sign(k) * Math.min(dk, w[m]);
        const pass = offsetVarying(sub, dist);
        emitDryRuns(pass, spine, i, k, laneEdge, style, out);
      }
      i = j;
    }
  }

  return out;

  function emitDryRuns(
    pass: Point[],
    sp: Spine,
    baseIndex: number,
    k: number,
    laneEdge: number,
    st: StrokeStyle,
    lines: FlowLine[]
  ): void {
    const lambda = 22;
    let run: Point[] = [];
    let runStartT = 0;
    const flush = (): void => {
      if (run.length < 2) {
        run = [];
        return;
      }
      // Discard specks — except near the tip, where dry flecks are the point.
      const minLen = runStartT > 0.8 ? st.passSpacing : 2 * st.passSpacing;
      let len = 0;
      for (let m = 1; m < run.length; m++) {
        len += Math.hypot(run[m].x - run[m - 1].x, run[m].y - run[m - 1].y);
      }
      if (len >= minLen) {
        lines.push({
          points: trimPolyline(run, 0.04),
          pen: k === 0 ? 'bold' : 'fine',
          layer,
        });
      }
      run = [];
    };

    for (let m = 0; m < pass.length; m++) {
      const si = baseIndex + m;
      const t = sp.arc[si] / sp.length;
      const breakVal = 0.5 + 0.5 * noise.noise2D(sp.arc[si] / lambda, track + k * 0.73);
      const threshold =
        dryness *
        (0.15 + 0.85 * Math.pow(laneEdge, 1.5)) *
        (0.3 + 0.7 * sp.speed[si]) *
        (1 - 0.7 * wet[si]);
      if (breakVal < threshold) {
        flush();
        continue;
      }
      if (run.length === 0) runStartT = t;
      run.push(pass[m]);
    }
    flush();
  }
}
