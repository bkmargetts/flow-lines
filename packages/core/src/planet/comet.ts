import { Point } from '../flow-lines.js';
import { makeRandom } from '../lib/rng.js';
import { TAU, DEG } from './vec3.js';
import { pushRun } from './geometry.js';
import type { SceneCtx } from './context.js';

/** Comet coma and tail, drawn at scene scope around the primary nucleus.
 *  Two stroke families fan anti-sunward on the 'tail' layer: a broad swept
 *  dust tail (curved arcs, all bending the same way) and a narrower, straighter
 *  ion tail. Strokes are broken, and break more with distance, so the tail
 *  fades into the paper. The coma is a few sunward-biased broken arcs. */
export function renderCometTail(scene: SceneCtx): void {
  const { o, seed, cx, cy, R, L, lines } = scene;
  if (o.planetType !== 'comet' || o.layout !== 'single') return;
  const tr = makeRandom(seed + 2121);
  const ld = Math.hypot(L.x, L.y);
  // Anti-sun direction in the screen plane; grazing overhead light degrades
  // to a leftward tail rather than no tail at all.
  const ax = ld > 1e-6 ? -L.x / ld : -1;
  const ay = ld > 1e-6 ? -L.y / ld : 0;
  const aAng = Math.atan2(ay, ax);
  const spread = Math.max(2, o.tailSpread) * DEG;
  const tailLen = Math.max(0.5, o.tailLength) * R;

  const stroke = (
    ang: number,
    len: number,
    bend: number,
    startR: number,
    fade: number
  ): void => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const px = -s;
    const py = c;
    const sx = cx + c * startR;
    const sy = cy + s * startR;
    const n = Math.max(10, Math.ceil(len / 5));
    let run: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // Swept arc: linear along the fan direction, quadratic sideways.
      const x = sx + c * len * t + px * bend * len * t * t;
      const y = sy + s * len * t + py * bend * len * t * t;
      // The pen lifts more and more as the tail thins out.
      if (tr() < t * fade) {
        pushRun(lines, run, 'tail');
        run = [];
        continue;
      }
      run.push({ x, y });
    }
    pushRun(lines, run, 'tail');
  };

  // Dust tail: broad fan of same-sign curved arcs.
  const dust = 30;
  for (let i = 0; i < dust; i++) {
    const ang = aAng + (tr() - 0.5) * 2 * spread;
    const len = tailLen * (0.5 + tr() * 0.5);
    const bend = 0.1 + tr() * 0.14; // all bending the same way — swept dust
    const startR = R * (1.04 + tr() * 0.3);
    stroke(ang, len, bend, startR, 0.5);
  }
  // Ion tail: fewer, straighter, longer strokes down the middle of the fan.
  const ion = 8;
  for (let i = 0; i < ion; i++) {
    const ang = aAng + (tr() - 0.5) * spread * 0.7;
    const len = tailLen * (0.75 + tr() * 0.45);
    const bend = 0.015 + tr() * 0.03;
    const startR = R * (1.02 + tr() * 0.15);
    stroke(ang, len, bend, startR, 0.35);
  }
  // Coma: broken arcs hugging the nucleus, denser on the sunward side.
  for (let k = 0; k < 3; k++) {
    const rr = R * (1.14 + k * 0.16);
    const n = Math.max(60, Math.ceil((TAU * rr) / 5));
    let run: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * TAU;
      const c = Math.cos(t);
      const s = Math.sin(t);
      // Sunward bias: keep-probability peaks opposite the tail direction.
      const sunward = 0.3 + 0.7 * Math.max(0, -(c * ax + s * ay));
      if (tr() >= sunward * (0.8 - k * 0.18)) {
        pushRun(lines, run, 'tail');
        run = [];
        continue;
      }
      run.push({ x: cx + c * rr, y: cy + s * rr });
    }
    pushRun(lines, run, 'tail');
  }
}
