import { FlowLine, Point } from '../flow-lines.js';
import { bandLayerName } from '../overlapped-lines.js';
import { createNoise } from '../noise.js';
import { subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';

/**
 * The `weave` history style: the whole drawing area is ruled as a calm
 * multi-ink grating — evenly pitched, drafted-straight, the inks coincident —
 * and the long-exposure fields locally disturb it where colonies passed. Four
 * mechanisms, each scaled by the local exposure tone so calm paper stays a
 * perfect ruling by construction:
 *
 *  - bend        — the ruling direction swings toward the trail's motion and
 *                  relaxes back to the base angle as exposure fades,
 *  - pitch swell — rulings converge on (or spread off) trail ridges so
 *                  spacing carries the tone,
 *  - separation  — the inks split apart with per-ink phase/pitch (vernier)
 *                  offsets and braid through the disturbance,
 *  - wobble      — hand-shake amplitude rises with exposure.
 *
 * One lateral integration per ruling serves every ink: the traced base line
 * carries a leaky deviation state that integrates the bending velocity and
 * exponentially re-registers to the exact rule in calm paper (so downstream
 * of every disturbance the even grating is restored — no permanent drift),
 * and the per-ink offsets ride its smoothed normals.
 */
export interface WeaveParams {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  cellSize: number;
  /** Gaussian-blurred perceptual tone, cell grid (0..1). */
  blurTone: Float32Array;
  /** Blurred colony motion-field components, cell grid. */
  flowX: Float32Array;
  flowY: Float32Array;
  /** Reserved-paper cells around the crisp present. */
  haloCells: Uint8Array;
  seed: number;
  /** Corner negative-space hold, 0..1 (same weight as the marks style). */
  vignette: number;
  /** Inks in the grating; each emits on its own `band-NN` layer. */
  inks: number;
  /** Ruling spacing within one ink, px. */
  pitch: number;
  /** Grating direction in degrees; 0 = vertical (ink-field convention). */
  angleDeg: number;
  /** Per-ink lateral split at full exposure, fraction of pitch per ink step. */
  separation: number;
  /** Per-ink pitch differential at full exposure (vernier beat). */
  vernier: number;
  /** How far the ruling swings toward the trail motion at full exposure, 0..1. */
  bend: number;
  /** Signed density swell: >0 converges rulings on trail ridges. */
  pitchSwell: number;
  /** Hand-wobble amplitude at full exposure, px. */
  wobble: number;
}

const DEG = Math.PI / 180;

interface WeaveSample extends Point {
  /** Local disturbance tone (0..1, vignetted). */
  t: number;
  /** Arclength coordinate along the ruling (grating frame). */
  s: number;
}

export function renderWeave(p: WeaveParams): FlowLine[] {
  const {
    cols,
    rows,
    originX,
    originY,
    cellSize,
    blurTone,
    flowX,
    flowY,
    haloCells,
    seed,
    vignette,
    angleDeg,
    separation,
    vernier,
    bend,
    pitchSwell,
    wobble,
  } = p;
  const inks = Math.max(1, Math.round(p.inks));
  const pitch = Math.max(0.75, p.pitch);

  const W = cols * cellSize;
  const H = rows * cellSize;
  const lines: FlowLine[] = [];
  if (W <= 0 || H <= 0) return lines;

  // Grating frame (ink-field convention: angle 0 = vertical rulings).
  const rad = angleDeg * DEG;
  const dir = { x: Math.sin(rad), y: Math.cos(rad) };
  const perp = { x: Math.cos(rad), y: -Math.sin(rad) };
  const cx0 = originX + W / 2;
  const cy0 = originY + H / 2;
  const halfA = 0.5 * (Math.abs(dir.x) * W + Math.abs(dir.y) * H);
  const halfP = 0.5 * (Math.abs(perp.x) * W + Math.abs(perp.y) * H);

  const inRect = (x: number, y: number): boolean =>
    x >= originX && x <= originX + W && y >= originY && y <= originY + H;

  // Bilinear tone sample in fractional cell coords (nearest-cell would print
  // the cell staircase into the bending), vignetted like the marks style so
  // the corner negative space stays calm ruling.
  const toneAt = (x: number, y: number): number => {
    const gx = clamp((x - originX) / cellSize - 0.5, 0, cols - 1.001);
    const gy = clamp((y - originY) / cellSize - 0.5, 0, rows - 1.001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const i00 = y0 * cols + x0;
    let t =
      blurTone[i00] * (1 - tx) * (1 - ty) +
      blurTone[i00 + 1] * tx * (1 - ty) +
      blurTone[i00 + cols] * (1 - tx) * ty +
      blurTone[i00 + cols + 1] * tx * ty;
    if (vignette > 0) {
      const fx = cols > 1 ? gx / (cols - 1) : 0.5;
      const fy = rows > 1 ? gy / (rows - 1) : 0.5;
      const w = Math.max(0, 1 - 2 * Math.min(fx, 1 - fx)) * Math.max(0, 1 - 2 * Math.min(fy, 1 - fy));
      t *= 1 - vignette * w;
    }
    return clamp(t, 0, 1);
  };

  const flowAt = (x: number, y: number): Point | null => {
    const gx = clamp((x - originX) / cellSize - 0.5, 0, cols - 1.001);
    const gy = clamp((y - originY) / cellSize - 0.5, 0, rows - 1.001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const i00 = y0 * cols + x0;
    const sx =
      flowX[i00] * (1 - tx) * (1 - ty) + flowX[i00 + 1] * tx * (1 - ty) +
      flowX[i00 + cols] * (1 - tx) * ty + flowX[i00 + cols + 1] * tx * ty;
    const sy =
      flowY[i00] * (1 - tx) * (1 - ty) + flowY[i00 + 1] * tx * (1 - ty) +
      flowY[i00 + cols] * (1 - tx) * ty + flowY[i00 + cols + 1] * tx * ty;
    const len = Math.hypot(sx, sy);
    if (len < 1e-4) return null;
    return { x: sx / len, y: sy / len };
  };

  const inHalo = (x: number, y: number): boolean => {
    const cxi = Math.min(cols - 1, Math.max(0, Math.floor((x - originX) / cellSize)));
    const cyi = Math.min(rows - 1, Math.max(0, Math.floor((y - originY) / cellSize)));
    return haloCells[cyi * cols + cxi] === 1;
  };

  // Distinct noise streams so touching other conway knobs never reshuffles
  // the weave (the ink-field subSeed convention).
  const braidNoise = createNoise(subSeed(seed, 41));
  const wobNoise = createNoise(subSeed(seed, 42));

  const ds = clamp(pitch * 0.8, 2, 5);
  const gradProbe = cellSize;
  const relaxLen = 8 * pitch;
  const rulings = Math.floor((2 * halfP) / pitch);

  const emit = (run: Point[], k: number): void => {
    if (run.length < 2) return;
    let len = 0;
    for (let i = 1; i < run.length; i++) {
      len += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
    }
    if (len >= 3) lines.push({ points: run, pen: 'fine', layer: bandLayerName(k) });
  };

  for (let j = 0; j < rulings; j++) {
    const bj = -halfP + (j + 0.5) * pitch;

    // ---- Trace the base ruling: leaky lateral integrator -----------------
    const runs: WeaveSample[][] = [];
    let samples: WeaveSample[] = [];
    let d = 0; // lateral deviation from the rule
    for (let a = -halfA; a <= halfA; a += ds) {
      // Pitch swell: displace toward (or away from) the blurred-tone ridge so
      // both flanking rulings converge on a trail and spacing carries tone.
      const qx = cx0 + dir.x * a + perp.x * (bj + d);
      const qy = cy0 + dir.y * a + perp.y * (bj + d);
      const grad =
        (toneAt(qx + perp.x * gradProbe, qy + perp.y * gradProbe) -
          toneAt(qx - perp.x * gradProbe, qy - perp.y * gradProbe)) /
        2;
      const swellDisp = clamp(pitchSwell * pitch * 2.5 * grad, -0.45 * pitch, 0.45 * pitch);

      const x = qx + perp.x * swellDisp;
      const y = qy + perp.y * swellDisp;
      const t = toneAt(x, y);

      // Bend: lateral velocity toward the local trail motion, hemisphere-
      // aligned so the disturbance never reverses travel.
      let v = 0;
      if (bend > 0 && t > 0) {
        const f = flowAt(x, y);
        if (f) {
          const along = f.x * dir.x + f.y * dir.y;
          const fx = along < 0 ? -f.x : f.x;
          const fy = along < 0 ? -f.y : f.y;
          v = bend * t * (fx * perp.x + fy * perp.y);
        }
      }
      // Integrate, then leak back to the rule at a rate that vanishes inside
      // full-tone trails — calm paper always re-registers to the exact ruling.
      d = (d + v * ds) * Math.exp((-(1 - t) * ds) / relaxLen);
      d = clamp(d, -4 * pitch, 4 * pitch);

      if (!inRect(x, y) || inHalo(x, y)) {
        if (samples.length >= 2) runs.push(samples);
        samples = [];
        continue;
      }
      samples.push({ x, y, t, s: a + halfA });
    }
    if (samples.length >= 2) runs.push(samples);

    // ---- Per-ink emission on the traced line's smoothed normals ----------
    for (const run of runs) {
      // Tangent-derived left normals, 3-tap smoothed so per-ink offsets don't
      // kink at bends (the ink-field centerline trick).
      const n = run.length;
      const nx = new Float64Array(n);
      const ny = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const a0 = run[Math.max(0, i - 1)];
        const a1 = run[Math.min(n - 1, i + 1)];
        const tx = a1.x - a0.x;
        const ty = a1.y - a0.y;
        const len = Math.hypot(tx, ty) || 1;
        nx[i] = -ty / len;
        ny[i] = tx / len;
      }
      for (let i = 1; i < n - 1; i++) {
        const sx = (nx[i - 1] + nx[i] + nx[i + 1]) / 3;
        const sy = (ny[i - 1] + ny[i] + ny[i + 1]) / 3;
        const len = Math.hypot(sx, sy) || 1;
        nx[i] = sx / len;
        ny[i] = sy / len;
      }

      for (let k = 0; k < inks; k++) {
        const off = k - (inks - 1) / 2;
        let pts: Point[] = [];
        for (let i = 0; i < n; i++) {
          const c = run[i];
          // All offsets scale with tone: calm paper keeps the inks coincident
          // by construction; trails split, beat (vernier) and braid them.
          const braid =
            separation > 0
              ? 0.35 * separation * braidNoise.noise2D(c.s * 0.02 + k * 7.3, j * 0.31)
              : 0;
          const inkOffset =
            c.t * pitch * clamp(separation * off + vernier * off * j + braid, -2.5, 2.5);
          const amp = wobble * (0.08 + 0.92 * c.t);
          const wob =
            wobble > 0
              ? amp * wobNoise.fbm(c.s / (pitch * 18), j * 0.37 + k * 11.7, 2, 0.5, 2.2)
              : 0;
          const x = c.x + nx[i] * (inkOffset + wob);
          const y = c.y + ny[i] * (inkOffset + wob);
          if (!inRect(x, y)) {
            emit(pts, k);
            pts = [];
            continue;
          }
          pts.push({ x, y });
        }
        emit(pts, k);
      }
    }
  }

  return lines;
}
