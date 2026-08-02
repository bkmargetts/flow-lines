import { createNoise } from './noise.js';
import { bandLayerName } from './overlapped-lines.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { orderPlot, type PlotOrderOptions } from './optimize.js';
import { makeRandom, randomSeed, subSeed } from './lib/rng.js';
import { clamp, clamp01 } from './lib/math.js';

/**
 * Ink field — material-forward multi-ink fields in the vein of Joel
 * Cammarata's plotted work: the geometry is deliberately simple and regular
 * (a drafted band, a uniform lattice, stripe bands) so that the physical
 * behaviour of the inks — how crossing gel colours stack, how a fountain pen
 * depletes over the plot, how misregistered passes shimmer — carries the
 * piece. Three styles:
 *
 * - `ribbon` — one drafted band path (axis-aligned / 45° segments with
 *   filleted corners, the CAD look) rendered as dense parallel offsets;
 *   every ink draws the *full* band with its own lateral phase and a small
 *   pitch differential, so the inks beat against each other like a vernier
 *   and the colour that reads as foreground braids smoothly along the band.
 * - `lattice` — a uniform parallel-line lattice where large seeded colour
 *   planes (page-spanning wedges, big rectangles) set each ink's local
 *   density: the composition emerges from colour-plane boundaries inside one
 *   regular field, with no outlines anywhere.
 * - `stripes` — stripe bands along the stroke direction whose ink mix drifts
 *   band to band, optionally quantised into hard alternating blocks.
 *
 * Every ink is a real `band-NN` pen layer; tone and colour come from line
 * density and physical overlap, never stroke width. Deterministic per seed —
 * each concern (skeleton, planes, per-ink misregistration) draws from its own
 * `subSeed` stream so touching one knob never reshuffles another feature.
 */
export type InkFieldStyle = 'ribbon' | 'lattice' | 'stripes';

export interface InkFieldOptions {
  width: number;
  height: number;
  /** Clear border kept free of marks, px. */
  margin?: number;
  style?: InkFieldStyle;
  /** Number of inks (pen layers), 1..4. */
  inkCount?: number;
  /** Gap between adjacent lines within one ink, px. */
  pitchPx?: number;
  /** Stroke direction for lattice/stripes in degrees; 0 = vertical. */
  angleDeg?: number;
  /** Pen width, px — sizes the pen-test dots. */
  penWidthPx?: number;

  /** Lateral offset between successive inks, as a fraction of the pitch. */
  inkPhase?: number;
  /** Vernier: per-ink pitch differential (fraction). The beat between the
   *  slightly different pitches is what braids the ribbon's colours. */
  inkPitchDelta?: number;
  /** Per-ink lateral drift over the full band length, in pitch units —
   *  slides the vernier's coincidence zones along the band. */
  phaseDrift?: number;
  /** Whole-ink misregistration amplitude, px (seeded dx/dy per ink). */
  misregisterPx?: number;
  /** Random per-point perpendicular shake, px. */
  jitterPx?: number;
  /** Peak low-frequency wobble of each line, px. */
  wobbleAmpPx?: number;
  /** Wobble wavelength along the line, px. */
  wobbleWavelengthPx?: number;

  /** Ribbon: full band width, px. */
  bandWidthPx?: number;
  /** Ribbon: drafted skeleton segments, 2..8. */
  ribbonSegments?: number;

  /** Lattice: number of large colour planes, 0..4. */
  planeCount?: number;
  /** Lattice: light inset rectangle patches, 0..2. */
  insetPatches?: number;
  /** Lattice: background coverage where no plane claims the point, 0..1. */
  baseDensity?: number;
  /** Lattice: dominant-ink coverage inside a plane, 0..1. */
  planeDensity?: number;

  /** Stripes: number of stripe bands along the stroke direction. */
  stripeCount?: number;
  /** Stripes: band-edge overlap, 0..1 (higher = neighbouring mixes bleed). */
  stripeSoftness?: number;
  /** Stripes: quantise coverage into hard alternating dark/light blocks. */
  stripeBlocks?: boolean;
  /** Stripes: dark-block fraction of each block period, 0..1. */
  blockDuty?: number;

  /** Margin swatch: one small filled test dot per ink (default true). */
  penTests?: boolean;
  /** Plot order as a wear gradient: pen wear follows stroke order, so a
   *  spatial ramp turns dulling/depletion into a composed gradient. */
  wearOrder?: 'none' | 'sweep' | 'centerOut' | 'centerIn';
  /** Sweep direction for `wearOrder: 'sweep'`, degrees; 0 = top→bottom. */
  wearAngleDeg?: number;
  /** Drop emitted polylines shorter than this, px. */
  minSegmentLengthPx?: number;
  seed?: number;
  /** Reorder strokes to cut pen-up travel (default true). */
  optimize?: boolean;
}

interface CenterlinePoint {
  x: number;
  y: number;
  /** Unit normal (left of travel). */
  nx: number;
  ny: number;
  /** Cumulative arclength from the start. */
  s: number;
}

const DEG = Math.PI / 180;

/** Sample an arc from `a0` to `a1` (radians) about a centre, every ~2px. */
function sampleArc(cx: number, cy: number, r: number, a0: number, a1: number): Point[] {
  const sweep = a1 - a0;
  const steps = Math.max(2, Math.ceil((Math.abs(sweep) * r) / 2));
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (sweep * i) / steps;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Densify a polyline to ~`step` px spacing with normals and arclength. */
function toCenterline(pts: Point[], step: number): CenterlinePoint[] {
  const out: CenterlinePoint[] = [];
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = i === 1 ? 0 : 1; j <= n; j++) {
      const t = j / n;
      out.push({ x: a.x + ux * len * t, y: a.y + uy * len * t, nx: -uy, ny: ux, s: s + len * t });
    }
    s += len;
  }
  // Smooth normals across joints so offsets don't kink at segment boundaries.
  for (let i = 1; i < out.length - 1; i++) {
    const nx = (out[i - 1].nx + out[i].nx + out[i + 1].nx) / 3;
    const ny = (out[i - 1].ny + out[i].ny + out[i + 1].ny) / 3;
    const len = Math.hypot(nx, ny) || 1;
    out[i] = { ...out[i], nx: nx / len, ny: ny / len };
  }
  return out;
}

/**
 * Draft the ribbon skeleton: a seeded walk of axis-aligned / 45° segments
 * inside `box`, corners filleted at radius `r` — every candidate turn/length
 * is tried in seeded order and the first that stays inside wins, so the walk
 * is deterministic and never leaves the sheet.
 */
function draftSkeleton(
  rng: () => number,
  box: { x0: number; y0: number; x1: number; y1: number },
  segments: number,
  quantum: number,
  filletR: number
): Point[] {
  const inside = (p: Point): boolean =>
    p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;

  const start: Point = {
    x: box.x0 + (0.15 + 0.7 * rng()) * (box.x1 - box.x0),
    y: box.y0 + (0.15 + 0.7 * rng()) * (box.y1 - box.y0),
  };
  let heading = Math.floor(rng() * 8) * 45;

  const pts: Point[] = [start];
  const turns = [0, 45, -45, 90, -90];
  for (let i = 0; i < segments; i++) {
    // Seeded-shuffled candidate order; first (turn, length) that fits wins.
    // The opening segment has no incoming direction to respect, so it
    // searches every 45° heading instead of turning off the seeded one.
    const candidates =
      i === 0
        ? [0, 1, 2, 3, 4, 5, 6, 7]
            .map((n) => ({ t: n * 45 - heading, r: rng() }))
            .sort((a, b) => a.r - b.r || a.t - b.t)
            .map((c) => c.t)
        : turns
            .map((t) => ({ t, r: rng() }))
            .sort((a, b) => a.r - b.r || a.t - b.t)
            .map((c) => c.t);
    const lens = [2, 3].map((m) => m * quantum);
    let placed = false;
    for (const turn of candidates) {
      for (const len of lens) {
        const h = (heading + turn) * DEG;
        const prev = pts[pts.length - 1];
        const next = { x: prev.x + Math.sin(h) * len, y: prev.y + Math.cos(h) * len };
        // The whole segment must fit, with fillet room at both ends.
        const mid = { x: (prev.x + next.x) / 2, y: (prev.y + next.y) / 2 };
        if (inside(next) && inside(mid) && len >= filletR * 2.2) {
          pts.push(next);
          heading += turn;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) break; // boxed in — a shorter skeleton is fine
  }
  // A degenerate box can strand the walk at its start point; fall back to the
  // longest straight the box allows so the ribbon always exists.
  if (pts.length < 2) {
    const cx = (box.x0 + box.x1) / 2;
    return box.y1 - box.y0 >= box.x1 - box.x0
      ? [{ x: cx, y: box.y0 }, { x: cx, y: box.y1 }]
      : [{ x: box.x0, y: (box.y0 + box.y1) / 2 }, { x: box.x1, y: (box.y0 + box.y1) / 2 }];
  }
  return pts;
}

/** Fillet every interior corner of a segment chain with radius `r`. */
function filletSkeleton(pts: Point[], r: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const a = pts[i - 1];
    const b = pts[i + 1];
    const inLen = Math.hypot(p.x - a.x, p.y - a.y);
    const outLen = Math.hypot(b.x - p.x, b.y - p.y);
    const ux = (p.x - a.x) / inLen;
    const uy = (p.y - a.y) / inLen;
    const vx = (b.x - p.x) / outLen;
    const vy = (b.y - p.y) / outLen;
    const cross = ux * vy - uy * vx;
    const dot = clamp(ux * vx + uy * vy, -1, 1);
    const theta = Math.acos(dot); // turn angle
    if (Math.abs(cross) < 1e-6 || theta < 1e-3) {
      out.push(p);
      continue;
    }
    // Tangent length trimmed off each side; clamp so short segments survive.
    const tan = Math.min(r * Math.tan(theta / 2), inLen * 0.45, outLen * 0.45);
    const rEff = tan / Math.tan(theta / 2);
    const t1 = { x: p.x - ux * tan, y: p.y - uy * tan };
    // Arc centre sits perpendicular to the incoming direction, on the turn side.
    const side = cross > 0 ? 1 : -1;
    const cx = t1.x - uy * rEff * side;
    const cy = t1.y + ux * rEff * side;
    const a0 = Math.atan2(t1.y - cy, t1.x - cx);
    const a1 = a0 + theta * side;
    out.push(...sampleArc(cx, cy, rEff, a0, a1));
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function generateInkField(options: InkFieldOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    style = 'ribbon',
    inkCount = 3,
    pitchPx = 3,
    angleDeg = 0,
    penWidthPx = 1.2,
    inkPhase = 0.35,
    inkPitchDelta = 0.03,
    phaseDrift = 1.2,
    misregisterPx = 1,
    jitterPx = 0,
    wobbleAmpPx = 0,
    wobbleWavelengthPx = 160,
    bandWidthPx = 110,
    ribbonSegments = 5,
    planeCount = 3,
    insetPatches = 1,
    baseDensity = 0.45,
    planeDensity = 0.9,
    stripeCount = 9,
    stripeSoftness = 0.45,
    stripeBlocks = false,
    blockDuty = 0.5,
    penTests = true,
    wearOrder = 'none',
    wearAngleDeg = 0,
    minSegmentLengthPx = 3,
    seed = randomSeed(),
    optimize = true,
  } = options;

  const noise = createNoise(seed);
  const inks = clamp(Math.round(inkCount), 1, 4);
  const pitch = Math.max(0.75, pitchPx);

  const minX = margin;
  const minY = margin;
  const maxX = width - margin;
  const maxY = height - margin;
  const usableW = Math.max(0, maxX - minX);
  const usableH = Math.max(0, maxY - minY);
  const lines: FlowLine[] = [];

  if (usableW <= 0 || usableH <= 0) {
    return { lines, width, height, seed };
  }

  // Seeded whole-ink misregistration: the tiny paper-shift between pen swaps,
  // promoted to a deliberate knob. Ink 0 stays put as the reference pass.
  const misreg: Point[] = [];
  for (let k = 0; k < inks; k++) {
    const r = makeRandom(subSeed(seed, 10 + k));
    misreg.push(
      k === 0
        ? { x: 0, y: 0 }
        : { x: misregisterPx * (2 * r() - 1), y: misregisterPx * (2 * r() - 1) }
    );
  }

  /** Emit `run` (≥2 pts, long enough) onto ink k's band layer. */
  const flushRun = (run: Point[], k: number): void => {
    if (run.length < 2) return;
    let len = 0;
    for (let i = 1; i < run.length; i++) {
      len += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
    }
    if (len >= minSegmentLengthPx) {
      lines.push({ points: run, layer: bandLayerName(k), pen: 'fine' });
    }
  };

  if (style === 'ribbon') {
    const bandW = clamp(bandWidthPx, pitch * 4, Math.min(usableW, usableH) * 0.8);
    const halfW = bandW / 2;
    const filletR = halfW * 1.15;
    const pad = halfW + misregisterPx + wobbleAmpPx + jitterPx;
    const box = { x0: minX + pad, y0: minY + pad, x1: maxX - pad, y1: maxY - pad };
    if (box.x1 > box.x0 && box.y1 > box.y0) {
      const segs = clamp(Math.round(ribbonSegments), 2, 8);
      const quantum = Math.max(filletR * 1.2, Math.min(box.x1 - box.x0, box.y1 - box.y0) / 4);
      const skeleton = draftSkeleton(makeRandom(subSeed(seed, 1)), box, segs, quantum, filletR);
      const center = toCenterline(filletSkeleton(skeleton, filletR), 2.5);
      const total = center.length ? center[center.length - 1].s : 0;

      if (center.length >= 2 && total > 0) {
        for (let k = 0; k < inks; k++) {
          // Vernier: each ink's pitch differs a hair, so inks slide past each
          // other across the band; the drift slides the beat along the band.
          const pitchK = pitch * (1 + inkPitchDelta * (k - (inks - 1) / 2));
          const phiK = inkPhase * pitch * k;
          const passCount = Math.floor(bandW / pitchK) + 1;
          for (let j = 0; j < passCount; j++) {
            let run: Point[] = [];
            for (const c of center) {
              const drift = phaseDrift * pitch * k * (c.s / total);
              const wob =
                wobbleAmpPx > 0
                  ? wobbleAmpPx * noise.fbm(c.s / wobbleWavelengthPx, j * 0.37 + k * 11.7, 2, 0.5, 2.2)
                  : 0;
              const jit = jitterPx > 0 ? jitterPx * noise.noise2D(c.s * 0.5, j * 3.1 + k * 17) : 0;
              const d = -halfW + phiK + j * pitchK + drift + wob + jit;
              // The band edge stays a crisp cut: samples that slide off it lift
              // the pen rather than smearing along the boundary.
              if (d < -halfW - pitch * 0.25 || d > halfW + pitch * 0.25) {
                flushRun(run, k);
                run = [];
                continue;
              }
              const x = c.x + c.nx * d + misreg[k].x;
              const y = c.y + c.ny * d + misreg[k].y;
              if (x < minX || x > maxX || y < minY || y > maxY) {
                flushRun(run, k);
                run = [];
                continue;
              }
              run.push({ x, y });
            }
            flushRun(run, k);
          }
        }
      }
    }
  } else {
    // ---- lattice & stripes: one directional grating, ink presence decided
    // per sample (density carries the composition, never outlines) ----
    const rad = angleDeg * DEG;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);
    const px = Math.cos(rad);
    const py = -Math.sin(rad);
    const cx = width / 2;
    const cy = height / 2;
    const halfA = 0.5 * (Math.abs(dx) * usableW + Math.abs(dy) * usableH);
    const halfP = 0.5 * (Math.abs(px) * usableW + Math.abs(py) * usableH);
    const step = Math.max(2, Math.min(6, halfA / 24));

    // Lattice colour planes: page-spanning half-plane wedges and big rects,
    // painter's order (a later plane overrides where it covers), each with a
    // seeded dominant ink. Inset patches force near-paper — the light square
    // punched out of a saturated field.
    interface Plane {
      kind: 'wedge' | 'rect';
      // wedge: signed half-plane a*x + b*y <= c; rect: bounds.
      a: number;
      b: number;
      c: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      weights: number[];
    }
    const planes: Plane[] = [];
    const patches: { x0: number; y0: number; x1: number; y1: number }[] = [];
    if (style === 'lattice') {
      const rng = makeRandom(subSeed(seed, 2));
      const nPlanes = clamp(Math.round(planeCount), 0, 4);
      for (let i = 0; i < nPlanes; i++) {
        const dominant = Math.floor(rng() * inks);
        // A plane reads as a *committed* colour mass: dominant ink near solid,
        // the rest a whisper (specks of minority ink read as noise, not mix).
        const weights: number[] = [];
        for (let k = 0; k < inks; k++) {
          weights.push(k === dominant ? clamp01(planeDensity) : clamp01(planeDensity * 0.06 * rng()));
        }
        if (rng() < 0.55) {
          // Wedge: a half-plane through two points on different page edges.
          const theta = rng() * Math.PI;
          const a = Math.cos(theta);
          const b = Math.sin(theta);
          const off = (rng() - 0.5) * 0.8;
          const c = a * (cx + off * usableW) + b * (cy + off * usableH);
          planes.push({ kind: 'wedge', a, b, c, x0: 0, y0: 0, x1: 0, y1: 0, weights });
        } else {
          const w = (0.3 + 0.4 * rng()) * usableW;
          const h = (0.3 + 0.4 * rng()) * usableH;
          const x0 = minX + rng() * (usableW - w);
          const y0 = minY + rng() * (usableH - h);
          planes.push({ kind: 'rect', a: 0, b: 0, c: 0, x0, y0, x1: x0 + w, y1: y0 + h, weights });
        }
      }
      const nPatches = clamp(Math.round(insetPatches), 0, 2);
      for (let i = 0; i < nPatches; i++) {
        const w = (0.1 + 0.15 * rng()) * usableW;
        const h = (0.1 + 0.15 * rng()) * usableH;
        const x0 = minX + (0.1 + 0.7 * rng()) * (usableW - w);
        const y0 = minY + (0.1 + 0.7 * rng()) * (usableH - h);
        patches.push({ x0, y0, x1: x0 + w, y1: y0 + h });
      }
    }

    // The base field is itself a colour decision, not an even mix: one seeded
    // dominant ink carries it (a blue field, not blue-ish confetti), the rest
    // barely flecked in.
    const baseRng = makeRandom(subSeed(seed, 3));
    const baseDominant = Math.floor(baseRng() * inks);
    const baseWeights: number[] = [];
    for (let k = 0; k < inks; k++) {
      baseWeights.push(
        k === baseDominant ? clamp01(baseDensity) : clamp01(baseDensity * 0.08 * baseRng())
      );
    }

    const weightsAt = (x: number, y: number): number[] => {
      let w = baseWeights;
      for (const p of planes) {
        const hit =
          p.kind === 'wedge'
            ? p.a * x + p.b * y <= p.c
            : x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;
        if (hit) w = p.weights;
      }
      for (const r of patches) {
        if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return w.map((v) => v * 0.12);
      }
      return w;
    };

    // Stripe machinery: the stripe coordinate runs ALONG the strokes (as in
    // the references: horizontal strokes / vertical colour bands, vertical
    // strokes / horizontal blocks), warped by *slow* noise so band edges
    // drift gently line to line instead of jagging into camouflage. The inks
    // split each spot by weight share — the local winner draws a near-solid
    // stroke and the runner-up bleeds in through the overlap — rather than
    // each ink dashing independently.
    const stripeSpan = 2 * halfA;
    const nStripes = Math.max(2, Math.round(stripeCount));
    const stripeW = stripeSpan / nStripes;
    const bump = stripeW * (0.5 + clamp01(stripeSoftness));
    const stripeU = (a: number, b: number): number =>
      a + halfA + stripeW * 0.3 * noise.noise2D(a * 0.0015, b * 0.004);
    const stripeSharesAt = (u: number): number[] => {
      const w: number[] = new Array(inks).fill(0);
      for (let m = -1; m <= nStripes; m++) {
        const centre = (m + 0.5) * stripeW;
        const v = 1 - Math.abs(u - centre) / bump;
        if (v > 0) w[((m % inks) + inks) % inks] += v;
      }
      let sum = 0;
      for (const v of w) sum += v;
      if (sum <= 0) return w;
      return w.map((v) => v / sum);
    };
    // Hard blocks: near-ruled boundaries (a whisper of warp, nothing like the
    // soft stripes' drift); dark blocks take full lines, light blocks keep
    // every other *whole* line — a lighter band reads as wider spacing, not
    // as a band of broken dashes.
    const blockAt = (a: number, b: number): { dark: boolean; keep: boolean } => {
      if (!stripeBlocks) return { dark: true, keep: true };
      const u = a + halfA + stripeW * 0.04 * noise.noise2D(a * 0.002 + 9.2, b * 0.003);
      const phase = u / stripeW - Math.floor(u / stripeW);
      const dark = phase < clamp01(blockDuty);
      const keep = dark || Math.round((b + halfP) / pitch) % 2 === 0;
      return { dark, keep };
    };

    for (let k = 0; k < inks; k++) {
      const phiK = inkPhase * pitch * k;
      const firstB = -Math.ceil(halfP / pitch) * pitch + phiK;
      for (let b = firstB; b <= halfP + 1e-6; b += pitch) {
        const pointAt = (a: number): Point => {
          const wob =
            wobbleAmpPx > 0
              ? wobbleAmpPx * noise.fbm(a / wobbleWavelengthPx, b * 0.013 + k * 7.7, 2, 0.5, 2.2)
              : 0;
          const jit = jitterPx > 0 ? jitterPx * noise.noise2D(a * 0.5, b * 0.5 + k * 13) : 0;
          const perp = b + wob + jit;
          return {
            x: cx + dx * a + px * perp + misreg[k].x,
            y: cy + dy * a + py * perp + misreg[k].y,
          };
        };
        const drawsAt = (a: number): boolean => {
          const p = pointAt(a);
          if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
          if (style === 'stripes') {
            const u = stripeU(a, b);
            const block = blockAt(a, b);
            if (!block.keep) return false;
            const share = stripeSharesAt(u)[k] ?? 0;
            // Slow dither along the stroke: the winning ink runs near-solid,
            // hand-over zones switch in long takes rather than dashes.
            const dither = 0.5 * (noise.noise2D(b * 0.043 + k * 7.3, a * 0.0015 + k * 3.1) + 1);
            return dither < clamp01(share * (block.dark ? 1.15 : 0.95));
          }
          const w = weightsAt(p.x, p.y);
          // Long-grained along the stroke: partial coverage breaks into long
          // dashes and gaps (the pen lifting and resuming), never speckle.
          const dither = 0.5 * (noise.noise2D(b * 0.043 + k * 7.3, a * 0.004 + k * 3.1) + 1);
          return dither < clamp01(w[k] ?? 0);
        };
        // Bisection-refine every on/off transition so plane and block edges
        // land on their true boundary, not the coarse sampling grid.
        const crossing = (aIn: number, aOut: number): Point => {
          let lo = aIn;
          let hi = aOut;
          for (let i = 0; i < 14; i++) {
            const mid = (lo + hi) / 2;
            if (drawsAt(mid)) lo = mid;
            else hi = mid;
          }
          return pointAt(lo);
        };

        let run: Point[] = [];
        let prevA: number | null = null;
        let prevPass = false;
        for (let a = -halfA; a <= halfA + 1e-6; a += step) {
          const pass = drawsAt(a);
          if (pass) {
            if (!prevPass && prevA !== null) run.push(crossing(a, prevA));
            run.push(pointAt(a));
          } else if (prevPass && prevA !== null) {
            run.push(crossing(prevA, a));
            flushRun(run, k);
            run = [];
          }
          prevA = a;
          prevPass = pass;
        }
        flushRun(run, k);
      }
    }
  }

  // Pen-test dots: one small filled swatch per ink inside the margin box —
  // the artist's habit of proofing each pen before the plot, kept as a mark.
  if (penTests && lines.length) {
    const rDot = Math.max(2, penWidthPx * 2.2);
    const gap = rDot * 2 + Math.max(4, penWidthPx * 4);
    const y = maxY - rDot - 2;
    for (let k = 0; k < inks; k++) {
      const cxDot = minX + rDot + 2 + k * gap;
      if (cxDot + rDot > maxX) break;
      for (let r = rDot; r > penWidthPx * 0.3; r -= Math.max(0.5, penWidthPx * 0.7)) {
        const ring: Point[] = [];
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          ring.push({ x: cxDot + r * Math.cos(a), y: y + r * Math.sin(a) });
        }
        lines.push({ points: ring, layer: bandLayerName(k), pen: 'fine' });
      }
    }
  }

  const result: FlowLinesResult = { lines, width, height, seed };
  if (!optimize) return result;
  if (wearOrder !== 'none') {
    const order: PlotOrderOptions = { mode: wearOrder, angleDeg: wearAngleDeg };
    return orderPlot(result, { order });
  }
  return orderPlot(result);
}
