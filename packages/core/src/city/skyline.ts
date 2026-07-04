import { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp, clamp01 } from '../lib/math.js';
import { pushRun } from '../landscape/hatching.js';
import { occludeBehind } from '../landscape/features.js';
import type { Morph } from './morph.js';
import type { Face } from './project.js';
import { drawWindows, hatchFace, emitRing, inflatePoly, type FaceCraft } from './facade.js';

/**
 * Skyline mode: front-on elevation rows drawn back-to-front, structured like
 * the landscape generator's receding ridge stack. The front row is tallest
 * and carries the ink (full window grids plus a shadow strip turning the
 * off-light corner); back rows recede into light simple hatch masses —
 * atmospheric perspective with a pen. Same per-mass occlusion primitive as
 * the iso mode, same facade machinery via a trivial front-view `Face`.
 */

export interface SkylineOptions {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  seed: number;
  rows: number;
  lot: number;
  street: number;
  heightMean: number;
  heightVariance: number;
  storey: number;
  tiers: number;
  downtown: number;
  lightSide: 'left' | 'right';
  windows: number;
  windowPitch: number;
  shadeStrength: number;
  hatchSpacing: number;
  penWidth: number;
}

interface SkyBuilding {
  xL: number;
  w: number;
  h: number;
  yBase: number;
  topShift: number; // trapezoid lean of the top edge
  wavePhase: number;
  storey: number;
  winPhase: number;
}

export function drawSkyline(
  morph: Morph,
  noise: SimplexNoise,
  o: SkylineOptions,
  budget: { left: number }
): FlowLine[] {
  let lines: FlowLine[] = [];
  const n = Math.max(1, Math.round(o.rows));
  const usableH = o.y1 - o.y0;
  const lift = 0.075 * usableH;
  // Downtown bump: one seed-chosen x where the skyline peaks.
  const gRng = makeRandom(subSeed(o.seed, 3));
  const peakX = o.x0 + (0.25 + 0.5 * gRng()) * (o.x1 - o.x0);
  const peakR = 0.3 * (o.x1 - o.x0);

  for (let row = n - 1; row >= 0; row--) {
    const rowFrac = n > 1 ? row / (n - 1) : 0;
    const rowBase = o.y1 - row * lift;
    const hScale = lerp(1, 0.45, rowFrac);
    const rng = makeRandom(subSeed(o.seed, 211 + row * 17));

    let x = o.x0 - o.lot * 0.3 * rng();
    let guard = 0;
    while (x < o.x1 && guard++ < 400) {
      // Fixed-length per-building draw vector, same discipline as the grid
      // genome: the slider scales reach, it never re-rolls.
      const wDraw = rng();
      const gapDraw = rng();
      const h1 = rng();
      const h2 = rng();
      const h3 = rng();
      const leanDraw = rng() * 2 - 1;
      const wavePhase = rng();
      const winPhase = rng();
      const baseJit = rng() * 2 - 1;
      const tierDraw = rng();
      const antennaDraw = rng();
      const craftSeed = rng();

      const w = o.lot * lerp(0.75 + 0.9 * wDraw, 1.1, morph.order * 0.8);
      const peak = 1 + 0.7 * clamp01(o.downtown) * Math.exp(-Math.pow((x - peakX) / peakR, 2));
      const gauss = (h1 + h2 + h3 - 1.5) * 2;
      const sigma = 0.5 * o.heightVariance * morph.heightSigmaScale;
      // An elevation wants presence the iso grid doesn't: the same height knob
      // reads squat head-on, so the skyline stretches it toward a half-sheet
      // composition (still capped by the frame).
      let h = o.heightMean * 1.75 * hScale * peak * Math.exp(sigma * gauss);
      h = clamp(h, 1.6 * o.storey, rowBase - o.y0 - 6);
      const hQ = Math.max(o.storey, Math.round(h / o.storey) * o.storey);
      h = lerp(h, hQ, morph.storeySnap);

      const b: SkyBuilding = {
        xL: x,
        w,
        h,
        yBase: rowBase + baseJit * 3 * morph.F,
        topShift: leanDraw * 0.12 * h * morph.leanFrac * 6.25, // leanFrac already carries knob & F^1.5
        wavePhase,
        storey: o.storey,
        winPhase,
      };
      const craft: FaceCraft = {
        rng: makeRandom(subSeed(o.seed, 977 + row * 131 + Math.floor(craftSeed * 1e6))),
        taper: morph.taper,
        jitter: morph.jitterAng,
      };

      lines = drawSkyBuilding(lines, b, row, rowFrac, morph, noise, craft, o, budget);

      // A setback tier crowns some tall front/middle-row buildings.
      if (row < n - 1 && tierDraw < o.tiers && h > 5 * o.storey) {
        const tw = w * lerp(0.45 + 0.2 * wDraw, 0.6, morph.order);
        const tb: SkyBuilding = {
          ...b,
          xL: x + (w - tw) * lerp(rng(), 0.5, morph.order),
          w: tw,
          yBase: b.yBase - h,
          h: h * 0.3,
          topShift: b.topShift * 0.5,
        };
        lines = drawSkyBuilding(lines, tb, row, rowFrac, morph, noise, craft, o, budget);
      }
      // An antenna tick on occasional roofs.
      if (antennaDraw < 0.13 && h > 4 * o.storey) {
        const ax = x + w * (0.2 + 0.6 * wavePhase) + b.topShift;
        const ay = b.yBase - h;
        pushRun(lines, [{ x: ax, y: ay }, { x: ax, y: ay - h * (0.07 + 0.06 * wavePhase) }], 'edge');
      }

      const gap = lerp((gapDraw * 1.7 - 0.35) * o.street, o.street * 0.4, morph.order);
      x += w + gap;
    }
  }
  return lines;
}

function drawSkyBuilding(
  lines: FlowLine[],
  b: SkyBuilding,
  row: number,
  rowFrac: number,
  morph: Morph,
  noise: SimplexNoise,
  craft: FaceCraft,
  o: SkylineOptions,
  budget: { left: number }
): FlowLine[] {
  const yTop = b.yBase - b.h;
  const waveA = morph.waveAmp * lerp(1, 0.5, rowFrac);
  const N = Math.max(3, Math.round(b.w / 12));
  const roofY = (s: number): number =>
    yTop + waveA * noise.noise2D((b.xL + s) * 0.07 + b.wavePhase * 53, b.wavePhase * 29);

  // Closed silhouette: base → up the left edge → wavy roof → down the right.
  const sil: Point[] = [{ x: b.xL, y: b.yBase }];
  sil.push({ x: b.xL + b.topShift, y: roofY(0) });
  for (let i = 1; i <= N; i++) {
    const s = (b.w * i) / N;
    sil.push({ x: b.xL + s + b.topShift, y: roofY(s) });
  }
  sil.push({ x: b.xL + b.w, y: b.yBase });
  // Corner indices over the CLOSED ring (emitRing appends the closing point).
  const silCorners = [0, 1, 1 + N, 2 + N, 3 + N];
  lines = occludeBehind(lines, inflatePoly(sil, 1.2));

  // The front-view face: shear follows the trapezoid lean.
  const face: Face = {
    W: b.w,
    z0: 0,
    z1: b.h,
    at: (s, z) => ({ x: b.xL + s + (z / b.h) * b.topShift, y: b.yBase - z }),
  };

  if (row === 0) {
    // Front row: full window grids + a shadow strip hugging the off-light
    // side — the classic skyline ink for turning the corner.
    if (o.windows > 0) {
      drawWindows(lines, face, morph, craft, noise, {
        pitch: o.windowPitch,
        storey: b.storey,
        density: o.windows,
        phase: b.winPhase,
        style: 'full',
        budget,
      });
    }
    const stripW = 0.18 * b.w;
    const strip: Face = {
      W: stripW,
      z0: 0,
      z1: b.h * 0.985,
      at: (s, z) => face.at(o.lightSide === 'left' ? b.w - stripW + s : s, z),
    };
    hatchFace(lines, strip, morph, craft, noise, {
      spacing: o.hatchSpacing * 0.7,
      tone: clamp01(o.shadeStrength * 1.1),
      angleDeg: 90,
      cross: false,
    });
  } else {
    // Receding rows: vertical hatch masses whose tone lightens with depth —
    // without it the back rows float as empty outlines instead of reading as
    // a city behind the city. The middle row keeps sparse sill dashes as
    // glints in the tone.
    hatchFace(lines, face, morph, craft, noise, {
      spacing: o.hatchSpacing * lerp(1.0, 1.5, rowFrac),
      tone: clamp01(o.shadeStrength * lerp(1.05, 0.7, rowFrac)),
      angleDeg: 90,
      cross: false,
    });
    if (row === 1 && o.windows > 0) {
      drawWindows(lines, face, morph, craft, noise, {
        pitch: o.windowPitch * 1.4,
        storey: b.storey * 1.3,
        density: o.windows * 0.55,
        phase: b.winPhase,
        style: 'ticks',
        budget,
      });
    }
  }

  // Contour: bold and doubled up front, single further back, a plain fine
  // outline on the farthest rows.
  if (row === 0) emitRing(lines, sil, 'contour', o.penWidth, b.h > 5 * o.storey ? 2 : 1, silCorners);
  else if (row === 1) emitRing(lines, sil, 'contour', o.penWidth, 1, silCorners);
  else {
    const ring = sil.slice();
    ring.push({ ...ring[0] });
    for (let c = 0; c + 1 < silCorners.length; c++) {
      pushRun(lines, ring.slice(silCorners[c], silCorners[c + 1] + 1), 'edge');
    }
  }
  return lines;
}
