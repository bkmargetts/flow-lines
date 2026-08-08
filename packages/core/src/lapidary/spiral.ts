import { Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp } from '../lib/math.js';
import {
  THETA_SAMPLES,
  blobBoundaryTable,
  angularBoundaryTable,
  type LapidaryShape,
} from './shapes.js';
import type { LapidaryTexture, LayoutConfig, Region, ResolvedTexture } from './layout.js';

const TWO_PI = Math.PI * 2;

/** Hard cap on ribbon cells — past this the sheet reads as confetti and the
 *  per-region halo carve cost grows for nothing (the BRECCIA_CAP idiom). */
const SPIRAL_CELL_CAP = 48;

/**
 * The spiral's cross-section form as a per-θ multiplier table on the base
 * ellipse vector — the same convention as the agate ring tables, so the
 * whole walk shares the nesting pipeline's geometry. Circular forms reuse
 * the blob/facet tables verbatim; rectangular forms are a superellipse
 * (affine-scaled by the frame, so the coil squares off to the sheet's
 * aspect), softened for organic (plus a gentle blob modulation so the coil
 * breathes) and crisp for angular.
 */
function spiralBoundaryTable(cfg: LayoutConfig, shape: LapidaryShape): Float64Array {
  if (cfg.spiralForm === 'circular') {
    return shape === 'angular'
      ? angularBoundaryTable(subSeed(cfg.seed, 20), cfg.irregularity)
      : blobBoundaryTable(subSeed(cfg.seed, 20), cfg.irregularity * 0.7, null, 0);
  }
  const p = shape === 'angular' ? 8 : 4.5;
  const mod =
    shape === 'organic'
      ? blobBoundaryTable(subSeed(cfg.seed, 20), cfg.irregularity * 0.7, null, 0)
      : null;
  let modMean = 1;
  if (mod) {
    modMean = 0;
    for (let j = 0; j < THETA_SAMPLES; j++) modMean += mod[j];
    modMean /= THETA_SAMPLES;
  }
  const table = new Float64Array(THETA_SAMPLES);
  let maxR = 0;
  for (let j = 0; j < THETA_SAMPLES; j++) {
    const theta = (j / THETA_SAMPLES) * TWO_PI;
    const c = Math.abs(Math.cos(theta)) ** p + Math.abs(Math.sin(theta)) ** p;
    let r = 1 / c ** (1 / p);
    if (mod) r *= 1 + 0.12 * cfg.irregularity * (mod[j] / modMean - 1);
    table[j] = r;
    if (r > maxR) maxR = r;
  }
  for (let j = 0; j < THETA_SAMPLES; j++) table[j] /= maxR;
  return table;
}

/**
 * The spiral arrangement: one continuous ribbon wound from the rim into the
 * centre (or, 'outward', read the other way), chopped into textured cells.
 *
 * Geometry lives in the agate table space — centre + ellipse frame + a per-θ
 * form table B(θ) — so the centreline is ρ(θT) = (coverage − pitch·θT/2π)·B(θ)
 * and the ribbon edges are radial offsets of it (star-shaped offsets can
 * never self-intersect while the width clears the local winding gap, which
 * the clamp below guarantees). Cell cuts, the blend deal's random walks, and
 * the width pulse each draw from their own sub-seed streams, and the cuts
 * depend only on the centreline — re-rolling any width knob never reshuffles
 * the cells or their textures.
 *
 * `spiralDirection` decides which end of the ribbon leads: z ascends from the
 * trailing end to the leading end (so the leading end is drawn on top and
 * everything else carves around it), the texture deal cycles from the
 * trailing end, and the signed taper thins toward the leading end.
 */
export function spiralRegions(
  cfg: LayoutConfig,
  resolve: (cfg: LayoutConfig, z: number, prevKind: LapidaryTexture | null) => ResolvedTexture
): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const cx = x0 + rx + cfg.centerX * rx;
  const cy = y0 + ry + cfg.centerY * ry;

  // One seeded coin for 'mixed' — there is only one spiral to deal.
  const shape: LapidaryShape =
    cfg.shapes === 'mixed'
      ? makeRandom(subSeed(cfg.seed, 21))() < 0.5
        ? 'organic'
        : 'angular'
      : cfg.shapes;
  const table = spiralBoundaryTable(cfg, shape);
  let minB = Infinity;
  for (let j = 0; j < THETA_SAMPLES; j++) minB = Math.min(minB, table[j]);
  const bAt = (theta: number): number => {
    const f =
      ((((theta / TWO_PI) * THETA_SAMPLES) % THETA_SAMPLES) + THETA_SAMPLES) % THETA_SAMPLES;
    const j = Math.floor(f);
    return table[j] + (table[(j + 1) % THETA_SAMPLES] - table[j]) * (f - j);
  };
  const baseLen = (theta: number): number =>
    Math.hypot(Math.cos(theta) * rx, Math.sin(theta) * ry) || 1e-6;

  // Winding count clamp (the nestedRingTables min-gap idiom): shed turns
  // until the tightest winding pitch clears the seam plus a couple of
  // strokes — graceful degradation on small sheets, no rng consumed.
  const minPitchPx = cfg.haloPx * 2 + cfg.spacingPx * 2.5;
  const minR = Math.min(rx, ry);
  let turns = clamp(Math.round(cfg.bands), 2, 10);
  while (turns > 1 && ((cfg.coverage * 0.9) / turns) * minB * minR < minPitchPx) turns--;
  const pitchNorm = (cfg.coverage * 0.9) / turns;

  const noise = createNoise(subSeed(cfg.seed, 23));
  // Organic coils drift off the ideal winding; the cap keeps adjacent
  // windings (whose drifts sample 2π apart) from ever meeting. Angular
  // coils get none — the corners are the point.
  const driftAmp = shape === 'organic' ? pitchNorm * 0.12 * cfg.irregularity : 0;

  // ---- Pass 1: centreline walk. Adaptive Δθ keeps arc steps at a fixed
  // physical length, with a cap so the innermost winding still resolves its
  // form and a floor bounding total sample count.
  const stepPx = Math.max(2.5, 5 * cfg.featureScale);
  const thetaEnd = TWO_PI * turns;
  const thetas: number[] = [];
  const rhos: number[] = [];
  const cum: number[] = [];
  let prev: Point | null = null;
  let arc = 0;
  let thetaT = 0;
  for (let guard = 0; guard < 20000; guard++) {
    const theta = thetaT % TWO_PI;
    const b = bAt(theta);
    let rho = (cfg.coverage - (pitchNorm * thetaT) / TWO_PI) * b;
    if (driftAmp > 0) rho += driftAmp * b * noise.fbm(thetaT / 4.4, 3.7, 2, 0.5, 2);
    const c = { x: cx + Math.cos(theta) * rx * rho, y: cy + Math.sin(theta) * ry * rho };
    if (prev) arc += Math.hypot(c.x - prev.x, c.y - prev.y);
    thetas.push(thetaT);
    rhos.push(rho);
    cum.push(arc);
    prev = c;
    if (thetaT >= thetaEnd) break;
    const radPx = Math.max(6, rho * baseLen(theta));
    const dTheta = clamp(stepPx / radPx, TWO_PI / 720, TWO_PI / 96);
    thetaT = Math.min(thetaEnd, thetaT + dTheta);
  }
  const total = cum[cum.length - 1];
  if (!(total > stepPx * 4)) return [];

  // ---- Pass 2: ribbon edges. Width = base fraction of the local winding
  // pitch × signed taper (t = arc fraction from the trailing end) × the
  // low-frequency pulse, then hard-clamped against each neighbouring
  // winding's true (drift-aware) centreline so edges can meet but never
  // cross. The reserved inter-winding paper collapses as the width
  // approaches 1 — at full width the coil closes up and covers the page,
  // with the carve (cells) or a hairline floor (blend) supplying the seam.
  const driftAt = (tt: number): number =>
    driftAmp > 0 ? driftAmp * noise.fbm(tt / 4.4, 3.7, 2, 0.5, 2) : 0;
  // Blend cells are never clipped, so windings keep a pen-width hairline
  // even at full width — the wobble cap (0.35·halo per side) can narrow it
  // but not cross it. Cells rely on the halo carve for their seam instead.
  const seamPad = Math.max(
    cfg.spiralJoin === 'blend' ? cfg.haloPx : 0,
    2.2 * cfg.haloPx * clamp((1 - cfg.spiralWidth) / 0.45, 0, 1)
  );
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let i = 0; i < thetas.length; i++) {
    const tt = thetas[i];
    const theta = tt % TWO_PI;
    const b = bAt(theta);
    const bl = baseLen(theta);
    const gapPx = pitchNorm * b * bl;
    const dNow = driftAt(tt);
    // Each winding stays on its own side of the midline to its neighbours,
    // so per-winding taper/pulse differences can never make edges cross.
    const gapInPx = (pitchNorm + dNow - driftAt(tt + TWO_PI)) * b * bl;
    const gapOutPx = (pitchNorm + driftAt(tt - TWO_PI) - dNow) * b * bl;
    const tFrac = cum[i] / total;
    const t = cfg.spiralDirection === 'inward' ? tFrac : 1 - tFrac;
    const taperF = Math.max(0.12, lerp(1, 1 - 0.75 * cfg.spiralTaper, t));
    const pulseF = 1 + cfg.spiralPulse * 0.45 * noise.fbm(tt / 2.2, 7.3, 2, 0.5, 2);
    const desired = 0.5 * cfg.spiralWidth * gapPx * taperF * pulseF;
    const floorHalf = Math.max(2, 0.8 * cfg.spacingPx);
    const halfIn = Math.max(
      1,
      Math.min(0.5 * (gapInPx - seamPad), Math.max(floorHalf, desired))
    );
    const halfOut = Math.max(
      1,
      Math.min(0.5 * (gapOutPx - seamPad), Math.max(floorHalf, desired))
    );
    const rhoOut = rhos[i] + halfOut / bl;
    const rhoIn = Math.max(0.004, rhos[i] - halfIn / bl);
    outer.push({ x: cx + Math.cos(theta) * rx * rhoOut, y: cy + Math.sin(theta) * ry * rhoOut });
    inner.push({ x: cx + Math.cos(theta) * rx * rhoIn, y: cy + Math.sin(theta) * ry * rhoIn });
  }

  // ---- Cell cuts: seeded arc intervals targeting half the local winding
  // circumference, so cells shrink with the coil toward the core (ammonite
  // chambers). Cut positions depend only on the centreline arc — width and
  // taper knobs never move them.
  const rng = makeRandom(subSeed(cfg.seed, 22));
  const blMean = (rx + ry) / 2;
  const minCell = Math.max(cfg.spacingPx * 6, cfg.haloPx * 4, stepPx * 4);
  const bounds: number[] = [0];
  let cursor = 0;
  let s = 0;
  while (bounds.length < SPIRAL_CELL_CAP) {
    while (cursor < cum.length - 1 && cum[cursor] < s) cursor++;
    const localCirc = Math.PI * Math.max(0, rhos[cursor]) * blMean;
    s += Math.max(minCell, localCirc * 0.5) * (0.7 + 0.6 * rng());
    if (s >= total - minCell * 0.5) break;
    bounds.push(s);
  }
  bounds.push(total);
  // Arc positions → sample indices, keeping every cell at least two
  // samples wide (abutting cells share their boundary sample exactly).
  const idx: number[] = [0];
  let at = 0;
  for (let k = 1; k < bounds.length - 1; k++) {
    while (at < cum.length - 1 && cum[at] < bounds[k]) at++;
    if (at >= idx[idx.length - 1] + 2 && at <= cum.length - 3) idx.push(at);
  }
  idx.push(cum.length - 1);

  // ---- Regions. z ascends trailing end → leading end; geometric cell g
  // counts rim → core along the walk.
  const n = idx.length - 1;
  const seamless = cfg.spiralJoin === 'blend';
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  if (cfg.field) {
    const tex = resolve(cfg, 0, null);
    prevKind = tex.kind;
    regions.push({
      z: 0,
      poly: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
      tex,
    });
  }

  // Blend deal state: the kind holds for a run of cells while the angle and
  // pitch walk in small bounded steps — patterns morph instead of cutting.
  let runLeft = 0;
  let runZ = 0;
  let cur: ResolvedTexture | null = null;
  let runBaseSpacing = 0;
  for (let z = 1; z <= n; z++) {
    let tex: ResolvedTexture;
    if (!seamless) {
      tex = resolve(cfg, z, prevKind);
      prevKind = tex.kind;
    } else {
      let next: ResolvedTexture;
      if (runLeft <= 0 || !cur) {
        runZ++;
        next = resolve(cfg, runZ, prevKind);
        prevKind = next.kind;
        runBaseSpacing = next.spacing;
        runLeft = 3 + Math.floor(rng() * 3);
      } else {
        next = {
          ...cur,
          angleRad: cur.angleRad + (((rng() * 2 - 1) * cfg.angleDriftDeg) / 3) * (Math.PI / 180),
          spacing: clamp(
            cur.spacing * (0.92 + 0.16 * rng()),
            runBaseSpacing * 0.6,
            runBaseSpacing * 1.6
          ),
        };
      }
      cur = next;
      runLeft--;
      tex = { ...next, seed: subSeed(cfg.seed, 1200 + z) };
    }
    const g = cfg.spiralDirection === 'inward' ? z - 1 : n - z;
    const ia = idx[g];
    const ib = idx[g + 1];
    const outerEdge = outer.slice(ia, ib + 1);
    const innerEdge = inner.slice(ia, ib + 1);
    const poly = [...outerEdge, ...[...innerEdge].reverse()];
    regions.push({
      z,
      poly,
      tex,
      ribbon: { outer: outerEdge, inner: innerEdge },
      seamless: seamless || undefined,
    });
  }
  return regions;
}
