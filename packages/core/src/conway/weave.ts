import { FlowLine, Point } from '../flow-lines.js';
import { bandLayerName } from '../overlapped-lines.js';
import { createNoise } from '../noise.js';
import { subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { traceIsoContours } from '../iso-contours.js';
import { gaussianBlur } from '../image.js';

/**
 * The `weave` history style: the drawing area is ruled as a calm multi-ink
 * grating — evenly pitched, drafted-straight, the inks coincident — and the
 * long-exposure fields locally disturb it where colonies passed. `coverage`
 * sets how much of the calm ruling is inked: at 1 the full grating, lower an
 * evenly-spaced airy subset (golden-ratio stratified, so the calm field
 * always reads as a deliberate sparse ruling, never clumps) with the missing
 * rulings recruited locally where the trails raise the tone — the drawing
 * builds up from white space.
 *
 * Two forms:
 *  - `grating` — the rulings themselves carry the disturbance: they bend
 *    along the trail motion (leaky lateral integrator that re-registers to
 *    the exact rule in calm paper), converge on trail ridges (pitch swell),
 *    and the inks split/braid with tone (separation + vernier + braid).
 *  - `rings` — the calm ruling stays drafted-straight and dissolves out as
 *    tone rises (reverse recruitment), handing off to nested iso-loop
 *    ripples of the exposure field; the per-ink split/braid rides each
 *    ring's normals, and the vernier beat sweeps radially across the stack.
 *
 * The crisp present reserves smooth paper: a blurred chamfer distance field
 * clips at an exact radius (no cell-block rectangles), and every line ending
 * — at the halo or at a coverage transition — feathers out as phase-coherent
 * shrinking dashes rather than cutting dead on an aligned curve.
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
  /** Blurred chamfer distance to the present's cells, in cell units. */
  haloDist: Float32Array;
  /** Reserved-paper radius around the present in px; <= 0 disables clipping. */
  haloRadius: number;
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
  /** Fraction of the calm ruling drawn, 0..1. */
  coverage: number;
  /** Disturbance form: bent rulings or iso-loop ripples. */
  form: 'grating' | 'rings';
  /** Iso levels (tone units) for the rings form; empty in grating form. */
  ringIsoLevels: number[];
}

const DEG = Math.PI / 180;
const GOLDEN = 0.618033988749895;
// Feathered endings: over the last F px of clearance a line dissolves into
// phase-coherent shrinking dashes; the stop point itself is jittered per
// ruling/ink (retract-only, so jitter never invades the reserve).
const STOP_JITTER_FRAC = 0.6;
// Schmitt hysteresis on the coverage margin: a ruling turns on above +0.05
// and off below -0.05, so blur-floor tone speckle can't chatter fragments.
const GATE_ON = 0.05;
const GATE_OFF = -0.05;
// Grating form: tone recruits missing rulings at this gain. Rings form: tone
// clears the ruling at this gain — gentle, so the ruling thins under the
// ripples rather than vanishing (tone plateaus between colonies give the
// iso-tracer few crossings, and a fully cleared plateau reads as a void).
const RECRUIT_GAIN = 1;
const RING_FADE_GAIN = 0.5;
// Rings vernier analogue: the ruling index becomes the ring level, rescaled
// so the default vernier is visible across a ~5-ring stack.
const RING_VERNIER_SCALE = 8;

const smoothstep01 = (v: number): number => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const frac = (v: number): number => v - Math.floor(v);

interface WeaveSample extends Point {
  /** Local disturbance tone (0..1, vignetted). */
  t: number;
  /** Arclength coordinate along the line (px). */
  s: number;
  /** Signed clearance to the present's reserved paper (px; Infinity if off). */
  hc: number;
}

/** 3-tap position smoothing, wrap-aware for closed loops — rounds the
 * marching-squares staircase off ring loops without shrinking open ends. */
function smoothLoop(pts: Point[], closed: boolean, passes: number): Point[] {
  let cur = pts;
  const n = pts.length;
  if (n < 3) return cur;
  for (let pass = 0; pass < passes; pass++) {
    const out: Point[] = new Array(n);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) {
        out[i] = { x: cur[i].x, y: cur[i].y };
        continue;
      }
      const a = cur[(i - 1 + n) % n];
      const b = cur[i];
      const c = cur[(i + 1) % n];
      out[i] = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    }
    cur = out;
  }
  return cur;
}

/** Tangent-derived left normals, 3-tap smoothed so per-ink offsets don't
 * kink at bends; wrap-aware for closed loops. */
function smoothedNormals(pts: Point[], closed: boolean): { nx: Float64Array; ny: Float64Array } {
  const n = pts.length;
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  const at = (i: number): Point => pts[closed ? (i + n) % n : Math.min(n - 1, Math.max(0, i))];
  for (let i = 0; i < n; i++) {
    const a0 = at(i - 1);
    const a1 = at(i + 1);
    const tx = a1.x - a0.x;
    const ty = a1.y - a0.y;
    const len = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / len;
    ny[i] = tx / len;
  }
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const q = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    const vx = (nx[p] + nx[i] + nx[q]) / 3;
    const vy = (ny[p] + ny[i] + ny[q]) / 3;
    const len = Math.hypot(vx, vy) || 1;
    sx[i] = vx / len;
    sy[i] = vy / len;
  }
  return { nx: sx, ny: sy };
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
    haloDist,
    haloRadius,
    seed,
    vignette,
    angleDeg,
    separation,
    vernier,
    wobble,
    coverage,
    form,
    ringIsoLevels,
  } = p;
  const inks = Math.max(1, Math.round(p.inks));
  const pitch = Math.max(0.75, p.pitch);
  // Rings keep the calm ruling drafted-straight — the disturbance geometry
  // lives in the loops, and a bent fringe would fight them.
  const bend = form === 'rings' ? 0 : p.bend;
  const pitchSwell = form === 'rings' ? 0 : p.pitchSwell;
  const gateGain = form === 'rings' ? -RING_FADE_GAIN : RECRUIT_GAIN;

  const W = cols * cellSize;
  const H = rows * cellSize;
  const lines: FlowLine[] = [];
  if (W <= 0 || H <= 0) return lines;

  const featherLen = clamp(3 * pitch, 4, 18);
  const dashPeriod = Math.max(6, 2 * pitch);

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

  // Bilinear samplers in fractional cell coords (nearest-cell would print the
  // cell staircase into the geometry), cell-centre convention.
  const sampleField = (field: Float32Array) => (x: number, y: number): number => {
    const gx = clamp((x - originX) / cellSize - 0.5, 0, cols - 1.001);
    const gy = clamp((y - originY) / cellSize - 0.5, 0, rows - 1.001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const i00 = y0 * cols + x0;
    return (
      field[i00] * (1 - tx) * (1 - ty) +
      field[i00 + 1] * tx * (1 - ty) +
      field[i00 + cols] * (1 - tx) * ty +
      field[i00 + cols + 1] * tx * ty
    );
  };
  const toneRawAt = sampleField(blurTone);
  const flowXAt = sampleField(flowX);
  const flowYAt = sampleField(flowY);
  const haloDistAt = sampleField(haloDist);

  // Tone is vignetted like the marks style so corner negative space stays calm.
  const toneAt = (x: number, y: number): number => {
    let t = toneRawAt(x, y);
    if (vignette > 0) {
      const gx = clamp((x - originX) / cellSize - 0.5, 0, cols - 1.001);
      const gy = clamp((y - originY) / cellSize - 0.5, 0, rows - 1.001);
      const fx = cols > 1 ? gx / (cols - 1) : 0.5;
      const fy = rows > 1 ? gy / (rows - 1) : 0.5;
      const w = Math.max(0, 1 - 2 * Math.min(fx, 1 - fx)) * Math.max(0, 1 - 2 * Math.min(fy, 1 - fy));
      t *= 1 - vignette * w;
    }
    return clamp(t, 0, 1);
  };

  const flowAt = (x: number, y: number): Point | null => {
    const sx = flowXAt(x, y);
    const sy = flowYAt(x, y);
    const len = Math.hypot(sx, sy);
    if (len < 1e-4) return null;
    return { x: sx / len, y: sy / len };
  };

  // Signed clearance (px) to the present's reserved paper. The distance field
  // measures to alive cell centres; the cell's own square reaches 0.5 cells
  // further, so the reserve threshold adds it back.
  const haloOn = haloRadius > 0;
  const reserveCells = 0.5 + haloRadius / cellSize;
  const haloClearAt = (x: number, y: number): number =>
    haloOn ? (haloDistAt(x, y) - reserveCells) * cellSize : Infinity;

  // Distinct noise streams so touching other conway knobs never reshuffles
  // the weave (the ink-field subSeed convention).
  const braidNoise = createNoise(subSeed(seed, 41));
  const wobNoise = createNoise(subSeed(seed, 42));
  const featherNoise = createNoise(subSeed(seed, 43));

  const ds = clamp(pitch * 0.8, 2, 5);
  const gradProbe = cellSize;
  const relaxLen = 8 * pitch;
  const rulings = Math.floor((2 * halfP) / pitch);

  const emit = (run: Point[], k: number, minLen = 3): void => {
    if (run.length < 2) return;
    let len = 0;
    for (let i = 1; i < run.length; i++) {
      len += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
    }
    if (len >= minLen) lines.push({ points: run, pen: 'fine', layer: bandLayerName(k) });
  };

  /**
   * Emit one traced polyline for every ink, with the tone-scaled per-ink
   * offsets and the feathered-ending taper. Shared by both forms — rulings
   * pass their ruling index as `beatIndex`, rings their level index (scaled).
   * `flipClear` is the arclength distance to the nearest coverage-gate flip
   * (Infinity when unbounded), so gate endings feather exactly like halo ones.
   */
  const emitInkPasses = (
    samples: WeaveSample[],
    nx: Float64Array | number[],
    ny: Float64Array | number[],
    i0: number,
    i1: number,
    flipClear: (i: number) => number,
    beatIndex: number,
    braidTrack: number,
    featherKeyA: number,
    featherKeyB: number,
    minLen = 3
  ): void => {
    for (let k = 0; k < inks; k++) {
      const off = k - (inks - 1) / 2;
      const uStop = 0.5 * (featherNoise.noise2D(featherKeyA * 0.73 + k * 7.9, featherKeyB * 1.37) + 1);
      const stopJit = STOP_JITTER_FRAC * featherLen * uStop;
      const phase =
        dashPeriod *
        0.5 *
        (featherNoise.noise2D(featherKeyA * 0.31 + k * 3.7, featherKeyB * 2.11 + 5.5) + 1);
      let pts: Point[] = [];
      for (let i = i0; i < i1; i++) {
        const c = samples[i];
        const e = Math.min(c.hc, flipClear(i)) - stopJit;
        if (e < 0) {
          emit(pts, k, minLen);
          pts = [];
          continue;
        }
        if (e < featherLen) {
          const q = smoothstep01(e / featherLen);
          if (frac((c.s + phase) / dashPeriod) >= q) {
            emit(pts, k, minLen);
            pts = [];
            continue;
          }
        }
        // All offsets scale with tone: calm paper keeps the inks coincident
        // by construction; trails split, beat (vernier) and braid them.
        const braid =
          separation > 0
            ? 0.35 * separation * braidNoise.noise2D(c.s * 0.02 + k * 7.3, braidTrack)
            : 0;
        const inkOffset =
          c.t * pitch * clamp(separation * off + vernier * off * beatIndex + braid, -2.5, 2.5);
        const amp = wobble * (0.08 + 0.92 * c.t);
        const wob =
          wobble > 0
            ? amp * wobNoise.fbm(c.s / (pitch * 18), braidTrack * 1.19 + k * 11.7, 2, 0.5, 2.2)
            : 0;
        const x = c.x + Number(nx[i]) * (inkOffset + wob);
        const y = c.y + Number(ny[i]) * (inkOffset + wob);
        if (!inRect(x, y)) {
          emit(pts, k, minLen);
          pts = [];
          continue;
        }
        pts.push({ x, y });
      }
      emit(pts, k, minLen);
    }
  };

  // ---- The ruled grating (both forms; rings fade it where loops take over) --
  for (let j = 0; j < rulings; j++) {
    const bj = -halfP + (j + 0.5) * pitch;
    const pj = frac(j * GOLDEN);

    // ---- Trace the base ruling: leaky lateral integrator ------------------
    const runs: WeaveSample[][] = [];
    let samples: WeaveSample[] = [];
    let d = 0; // lateral deviation from the rule
    for (let a = -halfA; a <= halfA; a += ds) {
      // Pitch swell: displace toward (or away from) the blurred-tone ridge so
      // both flanking rulings converge on a trail and spacing carries tone.
      const qx = cx0 + dir.x * a + perp.x * (bj + d);
      const qy = cy0 + dir.y * a + perp.y * (bj + d);
      let swellDisp = 0;
      if (pitchSwell !== 0) {
        const grad =
          (toneAt(qx + perp.x * gradProbe, qy + perp.y * gradProbe) -
            toneAt(qx - perp.x * gradProbe, qy - perp.y * gradProbe)) /
          2;
        swellDisp = clamp(pitchSwell * pitch * 2.5 * grad, -0.45 * pitch, 0.45 * pitch);
      }

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

      if (!inRect(x, y)) {
        if (samples.length >= 2) runs.push(samples);
        samples = [];
        continue;
      }
      samples.push({ x, y, t, s: a + halfA, hc: haloClearAt(x, y) });
    }
    if (samples.length >= 2) runs.push(samples);

    for (const run of runs) {
      const n = run.length;

      // ---- Coverage gate: Schmitt hysteresis on the recruitment margin ----
      // margin = coverage + gain*tone − p_j; the φ-stratified p_j makes the
      // calm subset (and the recruitment order) evenly interleaved.
      const states = new Array<boolean>(n);
      let on = coverage + gateGain * run[0].t - pj > 0;
      for (let i = 0; i < n; i++) {
        const m = coverage + gateGain * run[i].t - pj;
        if (on && m < GATE_OFF) on = false;
        else if (!on && m > GATE_ON) on = true;
        states[i] = on;
      }

      const { nx, ny } = smoothedNormals(run, false);

      // ON segments, with feather clearance to each gate flip.
      let segStart = -1;
      let segIdx = 0;
      for (let i = 0; i <= n; i++) {
        const isOn = i < n && states[i];
        if (isOn && segStart < 0) segStart = i;
        if (!isOn && segStart >= 0) {
          const startFlip = segStart > 0;
          const endFlip = i < n;
          const s0 = run[segStart].s;
          const s1 = run[i - 1].s;
          const flipClear = (idx: number): number =>
            Math.min(startFlip ? run[idx].s - s0 : Infinity, endFlip ? s1 - run[idx].s : Infinity);
          emitInkPasses(run, nx, ny, segStart, i, flipClear, j, j * 0.31, j, segIdx);
          segStart = -1;
          segIdx++;
        }
      }
    }
  }

  // ---- Ripple rings: nested iso-loops of the exposure field ---------------
  if (form === 'rings' && ringIsoLevels.length > 0) {
    // The rings ride an extra-blurred copy of the tone: the wider skirt lets
    // the outer ripples spread into calm paper (real rings travel far beyond
    // the splash) instead of hugging the trail's tight gradient.
    const img = gaussianBlur({ width: cols, height: rows, data: new Float32Array(blurTone) }, 1.8);
    let loopId = 0;
    for (let lv = 0; lv < ringIsoLevels.length; lv++) {
      for (const poly of traceIsoContours(img, ringIsoLevels[lv])) {
        if (poly.length < 3) continue;
        loopId++;
        const raw = poly.map((q) => ({
          x: originX + (q.x + 0.5) * cellSize,
          y: originY + (q.y + 0.5) * cellSize,
        }));
        const closed =
          Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].y - raw[raw.length - 1].y) <
          cellSize * 0.75;
        const pts = smoothLoop(raw, closed, 2);
        const samples: WeaveSample[] = [];
        let s = 0;
        for (let i = 0; i < pts.length; i++) {
          if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          samples.push({
            x: pts[i].x,
            y: pts[i].y,
            t: toneAt(pts[i].x, pts[i].y),
            s,
            hc: haloClearAt(pts[i].x, pts[i].y),
          });
        }
        const { nx, ny } = smoothedNormals(pts, closed);
        // Rings floor their run length at ~2.5 cells: a loop mostly swallowed
        // by a halo must vanish, not survive as a scraggly stub arc.
        emitInkPasses(
          samples,
          nx,
          ny,
          0,
          samples.length,
          () => Infinity,
          lv * RING_VERNIER_SCALE,
          loopId * 0.31,
          loopId,
          lv,
          Math.max(3, cellSize * 2.5)
        );
      }
    }
  }

  return lines;
}
