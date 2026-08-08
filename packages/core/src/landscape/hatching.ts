import { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { lerp } from '../lib/math.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** A runaway guard: never emit more strokes than this, however dense the knobs. */
const LINE_CAP = 90000;

// ——————————————————————————————————————————————————————————————————————
// Geometry helpers
// ——————————————————————————————————————————————————————————————————————

/** Append `pts` as a FlowLine if it has enough points to draw. */
export function pushRun(out: FlowLine[], pts: Point[], layer: string, pen?: 'fine' | 'bold'): void {
  if (out.length >= LINE_CAP) return;
  if (pts.length >= 2) out.push({ points: pts, layer, ...(pen ? { pen } : {}) });
}

/** Subdivide a straight segment so the hand-drawn finish can bow it. */
export function densifySegment(a: Point, b: Point, step: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.min(40, Math.round(len / step)));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return pts;
}

/** Linear-interpolated y of a left→right profile at an arbitrary x. */
export function sampleProfileY(profile: Point[], x: number): number {
  if (x <= profile[0].x) return profile[0].y;
  const last = profile[profile.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].x >= x) {
      const a = profile[i - 1];
      const b = profile[i];
      const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
      return lerp(a.y, b.y, t);
    }
  }
  return last.y;
}

/** Inside-intervals of the infinite line P(t)=O+t·D against a closed simple
 *  polygon, as sorted [tEnter,tExit] pairs (even-odd parity, half-open edges). */
export function clipLineToPolygon(poly: Point[], O: Point, D: Point): [number, number][] {
  const ts: number[] = [];
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const det = ex * D.y - ey * D.x;
    if (Math.abs(det) < 1e-9) continue;
    const rx = a.x - O.x;
    const ry = a.y - O.y;
    const u = (D.x * ry - D.y * rx) / det;
    if (u < 0 || u >= 1) continue;
    const t = (ex * ry - ey * rx) / det;
    ts.push(t);
  }
  if (ts.length < 2) return [];
  ts.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < ts.length; i += 2) {
    if (ts[i + 1] - ts[i] > 1e-6) out.push([ts[i], ts[i + 1]]);
  }
  return out;
}

// ——————————————————————————————————————————————————————————————————————
// Hatch craft
// ——————————————————————————————————————————————————————————————————————

/** Per-stroke craft: a shared rng, end-taper amount, angle jitter, subdivision. */
export interface Craft {
  rng: () => number;
  taper: number;
  jitter: number; // radians
  subStep: number;
  /**
   * Multiplier on the absolute px lengths below — the end-trim cap and the
   * mid-stroke pen-lift gap. Both are physical distances, so a caller drawing
   * the same artwork at a denser render density has to scale them or the
   * taper and the lift shrink on the page. Defaults to 1 (unscaled).
   */
  scale?: number;
}

/** A tone field: darkness 0..1 at a location (1 = tight hatch / dark). */
export type ToneFn = (x: number, y: number) => number;

/** Emit one hatch stroke A→B with tapered/broken ends and a slight per-stroke
 *  rotation, so a region's hatch never looks like a printed screen. */
export function emitStroke(out: FlowLine[], A: Point, B: Point, layer: string, craft: Craft): void {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (len < 1.5) return;
  const ux = dx / len;
  const uy = dy / len;
  const craftScale = craft.scale ?? 1;
  const maxTrim = Math.min(len * 0.35, 8 * craftScale) * craft.taper;
  let a = craft.rng() * maxTrim * 0.7;
  let b = len - craft.rng() * maxTrim * 0.7;
  if (b - a < 1.5) {
    a = 0;
    b = len;
  }
  const segs: [number, number][] = [];
  if (craft.taper > 0 && b - a > 16 && craft.rng() < craft.taper * 0.22) {
    const g = (2 + craft.rng() * 4) * craftScale;
    const m = a + (0.4 + 0.2 * craft.rng()) * (b - a);
    segs.push([a, m - g / 2]);
    segs.push([m + g / 2, b]);
  } else {
    segs.push([a, b]);
  }
  const ang = (craft.rng() * 2 - 1) * craft.jitter;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const mx = A.x + ux * ((a + b) / 2);
  const my = A.y + uy * ((a + b) / 2);
  const at = (t: number): Point => {
    const x = A.x + ux * t;
    const y = A.y + uy * t;
    const rx = x - mx;
    const ry = y - my;
    return { x: mx + rx * ca - ry * sa, y: my + rx * sa + ry * ca };
  };
  for (const [s, e] of segs) {
    if (e - s < 1.5) continue;
    pushRun(out, densifySegment(at(s), at(e), craft.subStep), layer);
  }
}

/** Emit a hatch run as a chain of SHORT strokes (with small pen-up gaps) when
 *  it would otherwise span the whole band — real hill hatching is built from
 *  short marks, not band-long lines. `maxLen <= 0` keeps the run whole. */
function emitHatchRun(out: FlowLine[], A: Point, B: Point, layer: string, craft: Craft, maxLen: number): void {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (maxLen <= 0 || len <= maxLen * 1.25) {
    emitStroke(out, A, B, layer, craft);
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  let t = 0;
  let guard = 0;
  while (t < len - 1 && guard++ < 200) {
    const seg = maxLen * (0.8 + 0.4 * craft.rng());
    const e = Math.min(len, t + seg);
    // Stagger each mark a hair off the shared axis — collinear dashes with tiny
    // gaps read as one long ruled line, which defeats the chopping entirely.
    const off = (craft.rng() - 0.5) * 0.9;
    const px = -uy * off;
    const py = ux * off;
    emitStroke(out, { x: A.x + ux * t + px, y: A.y + uy * t + py }, { x: A.x + ux * e + px, y: A.y + uy * e + py }, layer, craft);
    t = e + 1.5 + craft.rng() * 2.5;
  }
}

/** Hand-sized low-frequency patch mask, so cross-hatch builds up in worked
 *  patches instead of an even screen (deeper layers patchier). */
function makePatchMask(noise: SimplexNoise, x: number, y: number, layer: number, scale: number, amount: number): boolean {
  if (amount <= 0) return true;
  const freq = 1 / Math.max(1, scale);
  // At amount 0.5 roughly half the band passes — the mask must carve real
  // holes or the cross-hatch fills in as an even net.
  const cut = -1 + amount * (1.9 + 0.5 * Math.max(0, layer - 1));
  return noise.noise2D(x * freq, y * freq) > cut;
}

export type BreakFn = (t0: number, t1: number, O: Point, D: Point, rng: () => number) => [number, number][];

/** Optional refinements, both inert when omitted. */
export interface SweepHatchOptions {
  /**
   * Always keep this much of each clipped run's two ends, whatever `gate`
   * says. A gate that can bite into the ends of a run shreds the boundary the
   * run was clipped against — fine for a hillside fading into mist, fatal for
   * a shape whose crisp silhouette is the whole point.
   */
  edgeKeepPx?: number;
  /**
   * Fix the family's starting offset (0..1 of a pitch) instead of drawing it
   * from `craft.rng`. Callers that deal several families over abutting shapes
   * use it to stop neighbours registering identically.
   */
  phase01?: number;
  /**
   * How finely the row is chopped before `tone` and `gate` are sampled
   * (default 30px). A gate carrying hand-sized organic holes needs sampling
   * well under the hole size, or its boundaries come out as blocky steps at
   * the piece length.
   */
  pieceLenPx?: number;
}

/** A family of parallel hatch lines across `poly` at `angleDeg`. Local spacing
 *  opens where `tone` is light (atmospheric perspective). `gate` lets a layer
 *  fill only the dark/patchy parts (cross-hatch). `breakFn` dashes the run. */
export function sweepHatch(
  out: FlowLine[],
  poly: Point[],
  angleDeg: number,
  baseSpacing: number,
  tone: ToneFn,
  gate: (x: number, y: number, t: number) => boolean,
  layer: string,
  craft: Craft,
  breakFn?: BreakFn,
  maxLen = 0,
  opts: SweepHatchOptions = {}
): void {
  const edgeKeep = opts.edgeKeepPx ?? 0;
  const pieceLen = Math.max(1, opts.pieceLenPx ?? 30);
  const ang = angleDeg * DEG;
  const dir: Point = { x: Math.cos(ang), y: Math.sin(ang) };
  const nrm: Point = { x: -Math.sin(ang), y: Math.cos(ang) };
  let sMin = Infinity;
  let sMax = -Infinity;
  for (const p of poly) {
    const s = nrm.x * p.x + nrm.y * p.y;
    if (s < sMin) sMin = s;
    if (s > sMax) sMax = s;
  }
  let s =
    sMin + (opts.phase01 === undefined ? craft.rng() : opts.phase01) * baseSpacing;
  let guard = 0;
  while (s <= sMax && guard++ < 6000) {
    const O: Point = { x: nrm.x * s, y: nrm.y * s };
    const runs = clipLineToPolygon(poly, O, dir);
    // Tone is sampled piecewise along the row (a single midpoint or max let
    // one dark spot keep a whole row tight), but contiguous passing pieces
    // merge back into ONE run before emission — emitting each sampling piece
    // as its own tapered stroke shredded every row into ~30px ticks.
    let toneSum = 0;
    let toneN = 0;
    for (const [t0, t1] of runs) {
      const prePieces = breakFn ? breakFn(t0, t1, O, dir, craft.rng) : ([[t0, t1]] as [number, number][]);
      for (const [a0, b0] of prePieces) {
        const plen = b0 - a0;
        const nPieces = Math.max(1, Math.ceil(plen / pieceLen));
        // null sentinel, NOT -1: the line parameter t is signed and goes
        // negative whenever the row origin lands past the polygon — a -1
        // sentinel silently swallowed every stroke in those regions.
        let runStart: number | null = null;
        const flushRun = (end: number): void => {
          if (runStart !== null && end - runStart > 1) {
            emitHatchRun(out, { x: O.x + dir.x * runStart, y: O.y + dir.y * runStart }, { x: O.x + dir.x * end, y: O.y + dir.y * end }, layer, craft, maxLen);
          }
          runStart = null;
        };
        for (let pi = 0; pi < nPieces; pi++) {
          const a = a0 + (plen * pi) / nPieces;
          const b = a0 + (plen * (pi + 1)) / nPieces;
          const mx = O.x + dir.x * ((a + b) / 2);
          const my = O.y + dir.y * ((a + b) / 2);
          const tv = tone(mx, my);
          toneSum += tv;
          toneN++;
          // The run's own ends are exempt: they sit on the boundary this row
          // was clipped to, and letting the gate eat them frays that edge.
          const atEnd = edgeKeep > 0 && (a - t0 < edgeKeep || t1 - b < edgeKeep);
          // Paper cutoff: genuinely light passages hold clean paper.
          if (!atEnd && (!gate(mx, my, tv) || tv < 0.15 + 0.04 * craft.rng())) {
            flushRun(a);
            continue;
          }
          if (runStart === null) runStart = a;
        }
        flushRun(b0);
      }
    }
    const meanTone = toneN ? toneSum / toneN : 0.5;
    s += Math.max(0.8, baseSpacing / Math.max(0.18, meanTone));
  }
}

/** How far comb strokes may tilt from vertical. An unclamped slope-normal at a
 *  steep crest lays band-long diagonals that read as scratch marks. */
const COMB_MAX_TILT = 35 * DEG;

export interface CombShade {
  mist?: number; // 0..1 — fade hatch out before the band base (lost-and-found)
  fadeNoise?: SimplexNoise; // the anchor field: where mist sits vs where the ridge connects
  fadeRow?: number; // noise row for this band, so bands don't share mist banks
  shadeSlope?: number; // 0..1 — darken away-facing flanks, lighten lit ones
  lightX?: number; // -1 | 1 — horizontal light direction (from the sun side)
}

/** Cross-contour comb: short strokes dropped from the silhouette `upper` along
 *  the local slope-normal, clipped to the band — hatch that wraps the hill.
 *  Strokes fade out before the band base when `mist` is up (paper below a
 *  ragged edge — the lost-and-found silhouette of an ink wash), and flank
 *  tone follows the light direction when `shadeSlope` is up. */
function combHatch(out: FlowLine[], upper: Point[], poly: Point[], baseSpacing: number, tone: ToneFn, layer: string, craft: Craft, maxLen = 0, shade: CombShade = {}): void {
  const x0 = upper[0].x;
  const x1 = upper[upper.length - 1].x;
  const mist = shade.mist ?? 0;
  const depthBase = lerp(1, 0.35, mist);
  let x = x0 + craft.rng() * baseSpacing;
  let guard = 0;
  while (x <= x1 && guard++ < 4000) {
    const yTop = sampleProfileY(upper, x);
    // A wide, damped slope window: a ±3px window chased every silhouette
    // wiggle and fanned the comb like grass tufts; on sharp profiles adjacent
    // strokes flipped tilt and crossed like scattered sticks.
    const xa = Math.max(x0, x - 14);
    const xb = Math.min(x1, x + 14);
    const tx = xb - xa;
    const ty = sampleProfileY(upper, xb) - sampleProfileY(upper, xa);
    const slope = ty / Math.max(1e-6, tx);
    const tilt = 0.8 * Math.max(-COMB_MAX_TILT, Math.min(COMB_MAX_TILT, Math.atan2(-ty, tx)));
    const nx = Math.sin(tilt);
    const ny = Math.cos(tilt);
    const O: Point = { x: x + nx * 0.5, y: yTop + ny * 0.5 + 0.5 };
    const dir: Point = { x: nx, y: ny };
    const runs = clipLineToPolygon(poly, O, dir);
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const iv of runs) {
      if (iv[1] <= 0) continue;
      const d = Math.abs(iv[0]);
      if (d < bd) {
        bd = d;
        best = iv;
      }
    }
    let tv = tone(x, yTop);
    if (shade.shadeSlope) {
      // tanh steepens the response so gentle dune flanks still separate into
      // lit and shadow sides.
      const lit = Math.max(0, Math.min(1, 0.5 + 0.9 * Math.tanh(slope * 3) * (shade.lightX ?? 1)));
      tv *= lerp(1 + 0.4 * shade.shadeSlope, 1 - 0.6 * shade.shadeSlope, lit);
    }
    // Stroke economy is a MIST effect, not the fabric: near and mid bands
    // draw every stroke at near-full reach (density lives in spacing, like a
    // real engraved hillside); only hazy far bands lose strokes and vary
    // reach, so the survivors gather in noise-dark patches emerging from mist.
    const mistK = Math.max(0, Math.min(1, (mist - 0.2) / 0.5));
    // Even deep in mist most strokes survive at the crest — a ridge must stay
    // a connected mass dissolving downward, or it floats as a detached fringe.
    const keep = lerp(1, tv >= 0.5 ? 1 : Math.max(0, 0.35 + (tv - 0.05) * 2.2), mistK);
    if (best && tv >= 0.13 && craft.rng() < keep) {
      const a = Math.max(0, best[0]) + craft.rng() * Math.min(4, (best[1] - best[0]) * 0.15);
      const b = best[1];
      const Hb = b - a;
      // Anchored mist fade: a low-frequency field along x decides where the
      // mist bank sits. Where it clears (roughly a third of the range) the
      // hatch is boosted to FULL depth so the ridge connects down into the
      // next crest — a constant-fraction fade left a full-width white channel
      // above every crest, and the ridges read as floating shelves.
      const anchor = shade.fadeNoise ? 0.5 + 0.5 * shade.fadeNoise.fbm(x * 0.008, shade.fadeRow ?? 7.7, 2, 0.5, 2, 1) : 0.5;
      let dFrac = depthBase * (0.55 + 0.9 * tv);
      dFrac += mistK * 1.1 * Math.pow(Math.max(0, (anchor - 0.55) / 0.45), 1.3);
      let depth = Hb * Math.max(0, Math.min(1, dFrac));
      const reachAmp = lerp(0.1, 0.4, mistK);
      depth *= 1 - reachAmp + 2 * reachAmp * craft.rng();
      const b2 = a + Math.min(Hb, depth);
      if (b2 - a > 1.5) emitHatchRun(out, { x: O.x + dir.x * a, y: O.y + dir.y * a }, { x: O.x + dir.x * b2, y: O.y + dir.y * b2 }, layer, craft, maxLen);
    }
    // In mist, lightness lives in SHALLOW DEPTH and drop-out, not spacing —
    // widely spaced long strokes read as stray hairs, while closely spaced
    // short ones hugging the crest read as a ridge dissolving into haze.
    const spacingTone = Math.max(tv, lerp(tv, 0.62, mistK));
    x += Math.max(0.8, baseSpacing / Math.max(0.18, spacingTone));
  }
}

/**
 * A receding ground plane (beach, meadow flat): rows echo the shoreline just
 * below it, flatten toward horizontal as they come forward, and open up —
 * long light dashes with generous gaps and whole rows skipped where the tone
 * is light. A tight wet-sand accent hugs the shore. The old treatment combed
 * near-vertical strokes down from the shoreline, which read as a cliff
 * curtain instead of ground.
 */
export function hatchGround(
  out: FlowLine[],
  upper: Point[],
  yBottom: number,
  tone: ToneFn,
  spacing: number,
  layer: string,
  craft: Craft,
  dither: SimplexNoise
): void {
  const x0 = upper[0].x;
  const x1 = upper[upper.length - 1].x;
  let shoreSum = 0;
  for (const p of upper) shoreSum += p.y;
  const avgShoreY = shoreSum / Math.max(1, upper.length);
  const depthRange = Math.max(8, yBottom - avgShoreY);

  // Row y at (x, d): the shore's shape relaxes to flat within ~60% of the depth.
  const rowY = (x: number, d: number): number => {
    const flat = Math.min(1, d / (0.6 * depthRange));
    return lerp(sampleProfileY(upper, x), avgShoreY, flat) + d;
  };

  const emitRow = (d: number, dash: number, gap: number, jitter: number): void => {
    let x = x0 + craft.rng() * gap;
    let guard = 0;
    while (x < x1 && guard++ < 300) {
      const len = dash * (0.6 + 0.8 * craft.rng());
      const xe = Math.min(x1, x + len);
      const midY = rowY((x + xe) / 2, d);
      if (midY > yBottom - 1) break;
      const tv = tone((x + xe) / 2, midY);
      // Whole passages of the ground hold paper; the dither keeps the skip
      // boundary organic rather than a contour of its own.
      if (tv >= 0.22 + 0.18 * dither.noise2D(x * 0.008, d * 0.05)) {
        const yOff = (craft.rng() - 0.5) * jitter;
        const pts: Point[] = [];
        for (let sx = x; sx <= xe + 0.5; sx += 8) pts.push({ x: sx, y: rowY(sx, d) + yOff });
        if (pts.length && pts[pts.length - 1].x < xe) pts.push({ x: xe, y: rowY(xe, d) + yOff });
        pushRun(out, pts, layer);
      }
      x = xe + gap * (0.6 + 0.8 * craft.rng());
    }
  };

  // Wet-sand accent: two or three tight long-dash rows right under the shore.
  const accentRows = 2 + (craft.rng() < 0.5 ? 1 : 0);
  for (let r = 0; r < accentRows; r++) {
    emitRow(spacing * 0.6 * (r + 1), 40 + craft.rng() * 20, 8 + craft.rng() * 6, 0.8);
  }

  // Open ground rows, gap widening as they come forward (nearer = lighter).
  let d = spacing * (2 + craft.rng());
  let guard = 0;
  while (avgShoreY + d < yBottom && guard++ < 200) {
    const dNorm = Math.min(1, d / depthRange);
    emitRow(d, 40 + 40 * craft.rng(), 8 + 10 * craft.rng(), 1.6);
    d += spacing * lerp(1.0, 1.9, dNorm);
  }
}

export interface LandParams {
  rng: () => number;
  taper: number;
  jitter: number;
  formFollow: boolean;
  baseAngleDeg: number;
  crossHatch: number;
  patchiness: number;
  patchNoise: SimplexNoise;
  maxLen: number;
  shade?: CombShade;
}

/** Hatch a land band: a base pass (form-following comb or straight sweep) plus
 *  cross-hatch shadow layers gated by tone + patchiness. Strokes are kept short
 *  (`maxLen`) so the band reads as worked hatching, not band-long lines. */
export function hatchLand(out: FlowLine[], upper: Point[], poly: Point[], tone: ToneFn, baseSpacing: number, layer: string, p: LandParams): void {
  const craft: Craft = { rng: p.rng, taper: p.taper, jitter: p.jitter, subStep: 12 };
  // Straight hatch takes the same lit/shadow flank shading as the comb, read
  // from the silhouette slope above each sample.
  let shaded = tone;
  const sh = p.shade;
  if (!p.formFollow && sh?.shadeSlope) {
    const xa0 = upper[0].x;
    const xb0 = upper[upper.length - 1].x;
    shaded = (x, y) => {
      const xa = Math.max(xa0, x - 8);
      const xb = Math.min(xb0, x + 8);
      const slope = (sampleProfileY(upper, xb) - sampleProfileY(upper, xa)) / Math.max(1e-6, xb - xa);
      const lit = Math.max(0, Math.min(1, 0.5 + 0.9 * Math.tanh(slope * 3) * (sh.lightX ?? 1)));
      return tone(x, y) * lerp(1 + 0.4 * sh.shadeSlope!, 1 - 0.6 * sh.shadeSlope!, lit);
    };
  }
  if (p.formFollow) combHatch(out, upper, poly, baseSpacing, tone, layer, craft, p.maxLen, p.shade);
  else sweepHatch(out, poly, p.baseAngleDeg, baseSpacing, shaded, () => true, layer, craft, undefined, p.maxLen);
  const light: Craft = { rng: p.rng, taper: Math.min(1, p.taper + 0.2), jitter: p.jitter * 1.3, subStep: 12 };
  for (let k = 1; k <= p.crossHatch; k++) {
    const ang = 33 + (k - 1) * 27;
    const thr = 0.62 + 0.15 * k;
    // Patch scale ~16 spacings: the mask must gate whole hand-sized areas —
    // stroke-sized blobs pass isolated marks that read as scattered sticks.
    sweepHatch(out, poly, ang, baseSpacing * 1.75, shaded, (x, y, t) => t > thr && makePatchMask(p.patchNoise, x, y, k, baseSpacing * 16, p.patchiness), layer, light, undefined, p.maxLen * 0.55);
  }
}
