import { FlowLine, Point } from '../flow-lines.js';
import { makeRandom } from '../lib/rng.js';
import { offsetPolyline, trimPolyline } from '../lib/polyline.js';
import { StemShade, StemTexture, BotanicalFill, BotanicalSupport, BotanicalVessel } from './types.js';
import { densify, normalsOf, outlineFromEdges, smoothstep } from '../lib/spatial.js';

// ——— stem rendering (rounded tube) ———

export interface StemRenderOpts {
  penPx: number;
  taper: number;
  stemFill: BotanicalFill;
  light: Point;
  shadeDensity: number;
  stemShade: StemShade;
  stemTexture?: StemTexture;
  branch: boolean;
}

export function buildStem(center: Point[], baseHalf: number, o: StemRenderOpts): { lines: FlowLine[]; silhouette: Point[][] } {
  const { penPx, taper, light, shadeDensity, stemShade, branch } = o;
  const samples = densify(center, penPx);
  const n = samples.length;
  if (n < 2) return { lines: [], silhouette: [] };

  const cum: number[] = new Array(n);
  cum[0] = 0;
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  const total = cum[n - 1] || 1;
  const normals = normalsOf(samples);
  const tipHalf = Math.max(penPx * 0.5, baseHalf * 0.12);
  const w: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = cum[i] / total;
    let wi = baseHalf + (tipHalf - baseHalf) * smoothstep(Math.pow(t, 1 - taper * 0.5));
    // A branch tapers to a point where it joins its parent, so junctions flow
    // instead of showing a blunt cap.
    if (branch) wi *= smoothstep(Math.min(1, t / 0.14));
    w[i] = Math.max(penPx * 0.4, wi);
  }

  // Silhouette polygon (left edge forward, right edge back).
  const poly: Point[] = new Array(2 * n);
  for (let i = 0; i < n; i++) {
    poly[i] = { x: samples[i].x + normals[i].x * w[i], y: samples[i].y + normals[i].y * w[i] };
    const j = n - 1 - i;
    poly[n + i] = { x: samples[j].x - normals[j].x * w[j], y: samples[j].y - normals[j].y * w[j] };
  }

  // Non-shaded modes keep the old filled/outline ribbon.
  if (o.stemFill !== 'shaded') {
    return { lines: ribbon(samples, normals, w, penPx, 'stem', o.stemFill), silhouette: [poly] };
  }

  const lines: FlowLine[] = [];
  const thick = baseHalf > penPx * 1.4;

  if (!thick) {
    // Thin stems are a single confident, flowing line — not a doubled rail.
    lines.push({ points: samples.map((p) => ({ ...p })), layer: 'stem' });
    return { lines, silhouette: [poly] };
  }

  // Thick stem → one continuous tapered outline (a flowing closed contour).
  lines.push({ points: [...poly, { ...poly[0] }], layer: 'stem' });

  // Which side is in shadow (outward normal faces away from the light).
  let leftShadow = 0;
  for (let i = 0; i < n; i++) leftShadow += normals[i].x * light.x + normals[i].y * light.y < 0 ? 1 : -1;
  const shadowSign = leftShadow > 0 ? 1 : -1;

  // Subtle weight on the shadow edge (engraver's swelling line).
  const shadowEdge = shadowSign > 0 ? poly.slice(0, n) : poly.slice(n).reverse();
  const heavier = trimPolyline(offsetPolyline(shadowEdge, -shadowSign * penPx * 0.5), 0.06);
  if (heavier.length >= 2) lines.push({ points: heavier, layer: 'stem', pen: 'bold' });

  if (stemShade === 'none' || shadeDensity <= 0.01) return { lines, silhouette: [poly] };

  if (stemShade === 'along') {
    // Build the shadow side with along-axis lines from the shadow edge inward —
    // `shadeDensity` sets how far across the tube the shading reaches, so the
    // lit side stays clean and the form reads as a lit cylinder.
    const shadeSpacing = penPx * 1.8;
    const reach = 0.2 + 0.8 * shadeDensity; // fraction of the half-width filled
    let inset = penPx * 0.6;
    for (let guard = 0; guard < 12 && inset < baseHalf * 2 * reach; guard++, inset += shadeSpacing) {
      let run: Point[] = [];
      for (let i = 0; i < n; i++) {
        const sideShadow = normals[i].x * light.x + normals[i].y * light.y < 0 ? 1 : -1;
        const dmag = w[i] - inset;
        if (dmag > w[i] * 0.08 && sideShadow === shadowSign) {
          run.push({ x: samples[i].x + normals[i].x * shadowSign * dmag, y: samples[i].y + normals[i].y * shadowSign * dmag });
        } else if (run.length >= 2) { lines.push({ points: run, layer: 'stem' }); run = []; }
        else run = [];
      }
      if (run.length >= 2) lines.push({ points: run, layer: 'stem' });
    }
  } else {
    // Cross-hatch: short ticks wrapping across the tube on the shadow side, as
    // far in as `shadeDensity` dictates.
    const tickStep = penPx * (2.2 + (1 - shadeDensity) * 4);
    const reach = 0.3 + 0.7 * shadeDensity;
    let acc = tickStep;
    for (let i = 1; i < n; i++) {
      acc += cum[i] - cum[i - 1];
      if (acc < tickStep) continue;
      acc = 0;
      const sideShadow = normals[i].x * light.x + normals[i].y * light.y < 0 ? 1 : -1;
      if (sideShadow !== shadowSign || w[i] < penPx * 1.2) continue;
      lines.push({
        points: [
          { x: samples[i].x + normals[i].x * shadowSign * w[i] * (1 - reach), y: samples[i].y + normals[i].y * shadowSign * w[i] * (1 - reach) },
          { x: samples[i].x + normals[i].x * shadowSign * w[i] * 0.96, y: samples[i].y + normals[i].y * shadowSign * w[i] * 0.96 },
        ],
        layer: 'stem',
      });
    }
  }

  // Bark: broken striations running along a thick, woody cane (with occasional
  // short cross-dashes — lenticels). Deterministic from sample index, so no rng
  // is threaded in. Only the thickest part of the stem reads as old wood.
  if (o.stemTexture === 'bark') {
    const hash = (k: number) => {
      const s = Math.sin(k * 12.9898 + 4.1) * 43758.5453;
      return s - Math.floor(s);
    };
    const lanes = 3;
    for (let lane = 0; lane < lanes; lane++) {
      const frac = (lane + 1) / (lanes + 1); // across the tube, lit→shadow
      let run: Point[] = [];
      for (let i = 0; i < n; i++) {
        // Only on stout sections; furrows break up (pen lifts) pseudo-randomly.
        const woody = w[i] > penPx * 2.2;
        const gap = hash(i * 0.7 + lane * 31.3) < 0.22;
        const off = (frac - 0.5) * 2 * w[i] * 0.8 + (hash(i + lane * 7) - 0.5) * penPx * 0.6;
        if (woody && !gap) {
          run.push({ x: samples[i].x + normals[i].x * off, y: samples[i].y + normals[i].y * off });
        } else if (run.length >= 2) { lines.push({ points: run, layer: 'stem' }); run = []; }
        else run = [];
      }
      if (run.length >= 2) lines.push({ points: run, layer: 'stem' });
    }
    // Lenticels: a few short horizontal dashes across the cane.
    for (let i = 2; i < n - 2; i++) {
      if (w[i] <= penPx * 2.4 || hash(i * 2.3) > 0.06) continue;
      const h = w[i] * 0.5;
      lines.push({
        points: [
          { x: samples[i].x - normals[i].x * h, y: samples[i].y - normals[i].y * h },
          { x: samples[i].x + normals[i].x * h, y: samples[i].y + normals[i].y * h },
        ],
        layer: 'stem',
      });
    }
  }

  return { lines, silhouette: [poly] };
}

// ——— page furniture: ground line & vessel ———

/** A single hand-drawn ground line near the base of the arrangement: a gentle
 *  undulation that settles flat at the ends. No silhouette (it occludes
 *  nothing), drawn behind the stems. */
export function buildGround(width: number, height: number, margin: number, baseY: number | undefined, wobble: number): FlowLine {
  const y0 = baseY ?? height - margin;
  const x0 = margin * 1.4;
  const x1 = width - margin * 1.4;
  const amp = Math.max(0.6, wobble) * 2;
  const steps = 60;
  const pts: Point[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const env = Math.sin(Math.PI * t); // settle flat at both ends
    pts.push({ x: x0 + (x1 - x0) * t, y: y0 + Math.sin(t * 7.5 + 1.3) * amp * env });
  }
  return { points: pts, layer: 'stem' };
}

/** A drawn garden support the trellis climbers wrap: a diamond lattice, a round
 *  arch, or a tapering obelisk. Returned as stem-layer lines, drawn behind the
 *  stems so they read as climbing it. */
/** The support's panel frame — shared by the drawn furniture and the climb
 *  paths so climbers land exactly on the built structure. A lattice is a
 *  *garden panel* (inset, below head height), not an edge-to-edge tile. */
export function supportFrame(support: BotanicalSupport, width: number, height: number, margin: number): { x0: number; x1: number; yTop: number; yBot: number } {
  if (support === 'lattice') {
    const x0 = margin + width * 0.06;
    const x1 = width - margin - width * 0.06;
    const yBot = height - margin * 1.4;
    const yTop = margin + (height - 2 * margin) * 0.18;
    return { x0, x1, yTop, yBot };
  }
  return { x0: margin * 1.6, x1: width - margin * 1.6, yTop: margin * 1.6, yBot: height - margin * 1.4 };
}

export function buildSupport(support: BotanicalSupport, width: number, height: number, margin: number, penPx = 1): FlowLine[] {
  if (support === 'none') return [];
  const lines: FlowLine[] = [];
  const { x0, x1, yTop, yBot } = supportFrame(support, width, height, margin);
  if (support === 'lattice') {
    // A bounded garden panel: doubled posts and rails carry the structure,
    // diamond diagonals clipped inside. Coarser diamonds than before — a fine
    // full-page grid read as mechanical wallpaper behind the plants.
    const step = (x1 - x0) / 5;
    const iy0 = yTop;
    const iy1 = yBot;
    const within = (p: Point) => p.y >= iy0 && p.y <= iy1 && p.x >= x0 && p.x <= x1;
    const span = Math.max(x1 - x0, iy1 - iy0);
    for (let d = -Math.ceil(span / step) - 1; d <= Math.ceil(span / step) + 1; d++) {
      const c = d * step;
      const a: Point[] = [];
      const b: Point[] = [];
      for (let s = 0; s <= 1.0001; s += 0.04) {
        const px = x0 + (x1 - x0) * s;
        a.push({ x: px, y: iy0 + (px - x0) + c });
        b.push({ x: px, y: iy1 - (px - x0) - c });
      }
      const ca = a.filter(within);
      const cb = b.filter(within);
      if (ca.length >= 2) lines.push({ points: ca, layer: 'stem' });
      if (cb.length >= 2) lines.push({ points: cb, layer: 'stem' });
    }
    // Doubled posts and rails (a drawn thickness, single pen) + post caps.
    const t = Math.max(3, penPx * 3);
    for (const x of [x0, x1]) {
      lines.push({ points: [{ x: x - t / 2, y: yBot }, { x: x - t / 2, y: yTop - t * 1.2 }], layer: 'stem' });
      lines.push({ points: [{ x: x + t / 2, y: yBot }, { x: x + t / 2, y: yTop - t * 1.2 }], layer: 'stem' });
      lines.push({ points: [{ x: x - t * 1.1, y: yTop - t * 1.2 }, { x: x + t * 1.1, y: yTop - t * 1.2 }], layer: 'stem' });
    }
    for (const y of [yTop, yBot]) {
      lines.push({ points: [{ x: x0, y: y - t / 2 }, { x: x1, y: y - t / 2 }], layer: 'stem' });
      lines.push({ points: [{ x: x0, y: y + t / 2 }, { x: x1, y: y + t / 2 }], layer: 'stem' });
    }
    return lines;
  }
  if (support === 'arch') {
    const cx = width / 2;
    const r = (x1 - x0) / 2;
    const archTop = yTop + r;
    // Two uprights and a semicircular crown.
    lines.push({ points: [{ x: x0, y: yBot }, { x: x0, y: archTop }], layer: 'stem' });
    lines.push({ points: [{ x: x1, y: yBot }, { x: x1, y: archTop }], layer: 'stem' });
    const crown: Point[] = [];
    for (let s = 0; s <= 24; s++) {
      const a = Math.PI - (s / 24) * Math.PI;
      crown.push({ x: cx + Math.cos(a) * r, y: archTop - Math.sin(a) * r });
    }
    lines.push({ points: crown, layer: 'stem' });
    // A couple of rungs.
    for (const fy of [0.45, 0.72]) {
      const y = archTop + (yBot - archTop) * fy;
      lines.push({ points: [{ x: x0, y }, { x: x1, y }], layer: 'stem' });
    }
    return lines;
  }
  // obelisk: a tapering four-leg tepee with horizontal rings.
  const cx = width / 2;
  const halfBot = (x1 - x0) / 2;
  const halfTop = halfBot * 0.12;
  const legs = [
    [{ x: cx - halfBot, y: yBot }, { x: cx - halfTop, y: yTop }],
    [{ x: cx + halfBot, y: yBot }, { x: cx + halfTop, y: yTop }],
    [{ x: cx - halfBot * 0.5, y: yBot }, { x: cx, y: yTop }],
    [{ x: cx + halfBot * 0.5, y: yBot }, { x: cx, y: yTop }],
  ];
  for (const [a, b] of legs) lines.push({ points: [a, b], layer: 'stem' });
  for (const fy of [0.25, 0.55, 0.82]) {
    const half = halfBot + (halfTop - halfBot) * fy;
    const y = yBot + (yTop - yBot) * fy;
    lines.push({ points: [{ x: cx - half, y }, { x: cx + half, y }], layer: 'stem' });
  }
  // A finial.
  lines.push({ points: [{ x: cx, y: yTop }, { x: cx, y: yTop - margin * 0.6 }], layer: 'stem' });
  return lines;
}

/** Guide polylines that climb *along* a support's actual members — a zigzag
 *  staircase up the lattice diagonals, up-and-over the arch, up the obelisk
 *  legs — so trellis growth reads as trained onto the structure instead of
 *  floating in front of it. Points are dense enough for the guide-steering to
 *  track each turn. */
export function supportClimbPaths(
  support: BotanicalSupport,
  width: number,
  height: number,
  margin: number,
  n: number,
  rng: () => number
): Point[][] {
  const { x0, x1, yTop, yBot } = supportFrame(support, width, height, margin);
  const paths: Point[][] = [];
  const cx = width / 2;

  if (support === 'lattice') {
    const step = (x1 - x0) / 5;
    for (let k = 0; k < n; k++) {
      let x = x0 + ((k + 0.5 + (rng() - 0.5) * 0.4) / n) * (x1 - x0);
      let y = yBot;
      const pts: Point[] = [{ x, y: Math.min(height - margin * 1.1, yBot + step * 0.4) }, { x, y }];
      // Climb diagonal by diagonal, flipping direction at each crossing (with
      // an occasional run of two) and bouncing off the posts.
      let dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
      while (y > yTop + step * 0.4) {
        const seg = Math.min(step, y - yTop);
        if (x + dir * seg > x1 - step * 0.25 || x + dir * seg < x0 + step * 0.25) dir = -dir as 1 | -1;
        const nx = x + dir * seg;
        const ny = y - seg;
        for (let s = 1; s <= 4; s++) pts.push({ x: x + ((nx - x) * s) / 4, y: y + ((ny - y) * s) / 4 });
        x = nx;
        y = ny;
        if (rng() < 0.7) dir = -dir as 1 | -1;
      }
      paths.push(pts);
    }
    return paths;
  }

  if (support === 'arch') {
    const r = (x1 - x0) / 2;
    const archTop = yTop + r;
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : k / (n - 1);
      if (u <= 0.34 || u >= 0.66) {
        // Outer climbers ride an upright, then curl along the crown toward the
        // apex — the classic climbing-rose-over-an-arch silhouette.
        const left = u <= 0.34;
        const px = left ? x0 : x1;
        const pts: Point[] = [{ x: px, y: yBot }];
        for (let s = 1; s <= 6; s++) pts.push({ x: px, y: yBot + (archTop - yBot) * (s / 6) });
        const sweep = (0.25 + rng() * 0.2) * Math.PI; // how far over the crown
        for (let s = 1; s <= 8; s++) {
          const a = left ? Math.PI - sweep * (s / 8) : sweep * (s / 8);
          pts.push({ x: cx + Math.cos(a) * r, y: archTop - Math.sin(a) * r });
        }
        paths.push(pts);
      } else {
        // Inner climbers rise through the opening and stop under the crown.
        const px = x0 + u * (x1 - x0);
        const crownY = archTop - Math.sqrt(Math.max(0, r * r - (px - cx) * (px - cx)));
        const top = crownY + (yBot - crownY) * (0.06 + rng() * 0.1);
        const pts: Point[] = [];
        for (let s = 0; s <= 8; s++) {
          const t = s / 8;
          pts.push({ x: px + Math.sin(t * Math.PI * 2 + k) * width * 0.02, y: yBot + (top - yBot) * t });
        }
        paths.push(pts);
      }
    }
    return paths;
  }

  if (support === 'obelisk') {
    const halfBot = (x1 - x0) / 2;
    const halfTop = halfBot * 0.12;
    const legX = [-1, 1, -0.5, 0.5];
    for (let k = 0; k < n; k++) {
      const f = legX[k % 4];
      const bx = cx + f * halfBot;
      const tx = cx + (f === -1 ? -halfTop : f === 1 ? halfTop : 0);
      const pts: Point[] = [];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        pts.push({ x: bx + (tx - bx) * t, y: yBot + (yTop - yBot) * t });
      }
      paths.push(pts);
    }
    return paths;
  }

  return paths;
}

/** Half-width fraction along a vessel profile (top=0 → base=1), smoothstep
 *  interpolated between control points. */
function sampleProfile(prof: [number, number][], u: number): number {
  for (let i = 1; i < prof.length; i++) {
    if (u <= prof[i][0]) {
      const [u0, h0] = prof[i - 1];
      const [u1, h1] = prof[i];
      return h0 + (h1 - h0) * smoothstep((u - u0) / (u1 - u0 || 1));
    }
  }
  return prof[prof.length - 1][1];
}

/** Designed vessel silhouettes (control points: [u from mouth→foot, half-width
 *  fraction of the mouth reference]) plus per-type height/width factors so each
 *  keeps its proportions (a bowl is wide and low, an amphora tall and narrow). */
export interface VesselSpec { profile: [number, number][]; h: number; w: number; }
export const VESSEL_SPECS: Record<Exclude<BotanicalVessel, 'none'>, VesselSpec> = {
  vase: { h: 1.0, w: 1.0, profile: [[0, 0.92], [0.06, 0.96], [0.12, 0.76], [0.24, 0.8], [0.44, 1.14], [0.62, 1.24], [0.82, 1.0], [0.94, 0.76], [1, 0.7]] },
  urn: { h: 1.12, w: 0.95, profile: [[0, 0.96], [0.035, 1.06], [0.085, 0.84], [0.17, 0.72], [0.28, 0.88], [0.44, 1.2], [0.59, 1.36], [0.73, 1.22], [0.86, 0.9], [0.93, 0.6], [0.965, 0.68], [1, 0.58]] },
  amphora: { h: 1.18, w: 0.9, profile: [[0, 0.62], [0.05, 0.74], [0.12, 0.6], [0.2, 0.66], [0.4, 0.98], [0.57, 1.04], [0.73, 0.82], [0.86, 0.5], [0.93, 0.3], [0.965, 0.22], [0.985, 0.32], [1, 0.26]] },
  'bud-vase': { h: 1.04, w: 0.72, profile: [[0, 0.52], [0.07, 0.46], [0.2, 0.4], [0.38, 0.52], [0.57, 0.9], [0.75, 1.0], [0.87, 0.84], [0.95, 0.6], [1, 0.5]] },
  pot: { h: 0.82, w: 1.05, profile: [[0, 1.0], [0.03, 1.08], [0.08, 1.0], [0.5, 0.82], [0.9, 0.64], [0.96, 0.6], [1, 0.64]] },
  jar: { h: 0.94, w: 1.0, profile: [[0, 0.8], [0.04, 0.84], [0.1, 0.88], [0.16, 0.84], [0.26, 0.96], [0.38, 1.0], [0.84, 1.0], [0.93, 0.9], [1, 0.84]] },
  'mason-jar': { h: 0.98, w: 0.96, profile: [[0, 0.82], [0.05, 0.88], [0.12, 0.84], [0.2, 0.86], [0.3, 1.0], [0.42, 1.0], [0.86, 1.0], [0.94, 0.94], [1, 0.9]] },
  bowl: { h: 0.62, w: 1.4, profile: [[0, 1.0], [0.05, 1.06], [0.14, 1.0], [0.45, 0.82], [0.74, 0.54], [0.9, 0.36], [1, 0.44]] },
};

/** A foreshortened latitude/rim ellipse arc on the vessel (a0..a1 radians). */
function ellipseArc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, segs: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * (i / segs);
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

/** A drawn container the arrangement rises out of, rendered as a real
 *  pen-and-ink still-life vessel: a designed surface-of-revolution silhouette
 *  (rim lip, foot ring, a band or two) modelled with a full value structure —
 *  bare highlight on the lit side, graded cross-contour hatching into a
 *  cross-hatched core shadow, a reflected-light sliver at the shadow edge — plus
 *  a contact + cast shadow on the ground. Everything is cross-contour, directional
 *  hatching keyed to the same `light` as the stems, held in a light value key,
 *  and the caller wobbles it through the same hand-drawn pass + sketch overdraw,
 *  so it reads as the same hand and grounds the arrangement instead of flattening
 *  it. The silhouette occludes the stem bases; the cast shadow is returned
 *  separately to sit on the ground behind the vessel. */
export function buildVessel(
  cx: number,
  topY: number,
  bottomY: number,
  mouthHalf: number,
  type: BotanicalVessel,
  light: Point,
  penPx: number,
  shadeDensity: number,
  castShadow: number,
  seed: number
): { lines: FlowLine[]; silhouette: Point[][]; shadow: FlowLine[] } {
  const prof = VESSEL_SPECS[type === 'none' ? 'vase' : type].profile;
  const N = 56;
  const H = bottomY - topY;
  const hwAt: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    hwAt.push(mouthHalf * sampleProfile(prof, u));
    ys.push(topY + H * u);
  }
  // One smoothing pass over the half-widths for a confident silhouette.
  for (let i = 1; i < N; i++) hwAt[i] = (hwAt[i - 1] + 2 * hwAt[i] + hwAt[i + 1]) / 4;
  const hwOf = (u: number): number => hwAt[Math.max(0, Math.min(N, Math.round(u * N)))];

  // Profile outline: down the left edge, across the base, up the right edge.
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= N; i++) {
    left.push({ x: cx - hwAt[i], y: ys[i] });
    right.push({ x: cx + hwAt[i], y: ys[i] });
  }
  const poly = outlineFromEdges(left, right);

  const lines: FlowLine[] = [];
  // Drawn outline = just the two side profiles. The mouth ellipse and base arc
  // close the form; stroking the closed silhouette would draw a chord straight
  // across the mouth (and base), doubling the rim. `poly` stays for occlusion.
  lines.push({ points: left, layer: 'stem' });
  lines.push({ points: right, layer: 'stem' });

  const depth = 0.16; // latitude-ellipse foreshortening (ry/rx)

  // Mouth: one clean opening ellipse. A short arc along the *back* inner edge
  // reads as wall thickness / an open cavity — without doubling the whole rim
  // into a stacked "double circle".
  const rimHalf = hwAt[0];
  const rimRy = Math.max(2, rimHalf * depth);
  lines.push({ points: ellipseArc(cx, topY, rimHalf, rimRy, 0, 2 * Math.PI, 28), layer: 'stem' });
  lines.push({ points: ellipseArc(cx, topY + rimRy * 0.45, rimHalf * 0.84, rimRy * 0.84, Math.PI * 1.12, Math.PI * 1.88, 16), layer: 'stem' });

  // Foot ring: the seated base plus a slightly higher inner edge (the foot's
  // top), both front (lower) arcs only since the back is hidden.
  const footHalf = hwAt[N];
  const footRy = Math.max(2, footHalf * depth);
  lines.push({ points: ellipseArc(cx, bottomY, footHalf, footRy, 0, Math.PI, 18), layer: 'stem' });
  lines.push({ points: ellipseArc(cx, bottomY - footRy * 0.85, footHalf * 0.9, footRy * 0.85, 0.12 * Math.PI, 0.88 * Math.PI, 16), layer: 'stem' });

  // A pair of incised bands on the belly — front arcs only — for a bit of
  // ceramic character. Anchored around the widest point of the body (not fixed
  // high up, where they'd crowd the neck/mouth on a short-necked vessel).
  let uWide = 0.5;
  let widest = 0;
  for (let i = 0; i <= N; i++) if (hwAt[i] > widest) { widest = hwAt[i]; uWide = i / N; }
  const b1 = Math.max(0.26, Math.min(0.7, uWide - 0.1));
  const b2 = Math.min(0.88, Math.max(b1 + 0.14, uWide + 0.16));
  for (const bu of [b1, b2]) {
    const hw = hwOf(bu);
    if (hw < penPx * 3) continue;
    lines.push({ points: ellipseArc(cx, topY + H * bu, hw, Math.max(1.5, hw * depth), 0.1 * Math.PI, 0.9 * Math.PI, 14), layer: 'stem' });
  }

  // —— value structure: meridian form-lines down the shadow hemisphere ——
  // Vertical strokes that hug the profile — each offset inward from the silhouette
  // by a fixed *longitude* fraction of the local half-width — so they swell with
  // the belly and pinch at the neck, reading as a curved, lit ceramic surface
  // instead of a stack of flat horizontal bands. Packed from just inside the
  // terminator toward the silhouette, leaving a reflected-light sliver bare at the
  // edge and the whole lit hemisphere clean. (Vessel uses its own seeded jitter,
  // independent of the generator rng.)
  if (shadeDensity > 0.01) {
    const shadowSign = light.x <= 0 ? 1 : -1; // light from the left → shade right
    const jit = makeRandom((seed ^ 0x9e3779b9) >>> 0);
    const HALF = Math.PI / 2;
    // A meridian at longitude `psi` (0 = terminator, π/2 = silhouette edge):
    // a vertical stroke offset inward from the silhouette by sin(psi) of the
    // local half-width, so it hugs the belly and pinches at the neck. Broken
    // where the form is too narrow to carry a line.
    const meridian = (psi: number, u0: number): void => {
      const f = Math.sin(psi);
      // Meridians are drawn as broken hand-hatched runs, not one unbroken
      // top-to-bottom rule: the pen lifts and resumes, more often on the inner
      // (near-terminator) lines, so the shaded band reads as laid hatching
      // instead of a printed comb. End height also varies per line.
      const gapProb = 0.015 + (1 - f) * 0.035;
      const yEnd = bottomY - penPx * (1 + jit() * 4);
      let run: Point[] = [];
      for (let y = topY + H * u0; y <= yEnd; y += penPx) {
        const u = (y - topY) / H;
        const hw = hwOf(u);
        if (hw < penPx * 1.6) {
          if (run.length >= 2) lines.push({ points: run, layer: 'stem' });
          run = [];
          continue;
        }
        const jx = (jit() - 0.5) * penPx * 0.4;
        run.push({ x: cx + shadowSign * hw * f + jx, y });
        if (run.length > 6 && jit() < gapProb) {
          lines.push({ points: run, layer: 'stem' });
          run = [];
          y += penPx * (1.5 + jit() * 3);
        }
      }
      if (run.length >= 2) lines.push({ points: run, layer: 'stem' });
    };
    // Layer 1 — meridians stepped in equal longitude so they sit sparse near the
    // terminator and naturally crowd toward the silhouette (the core-shadow
    // band), reading as a rounded turned form. The last sliver before the edge
    // (psi → π/2) is left bare for reflected light, and the lit hemisphere stays
    // clean. The mouth catches the light, so terminator-side lines start lower.
    const psi0 = 0.12 * HALF;
    const psi1 = 0.84 * HALF;
    const dpsi = 0.085 + (1 - shadeDensity) * 0.13;
    for (let psi = psi0; psi <= psi1; psi += dpsi) meridian(psi, 0.04 + 0.05 * (1 - Math.sin(psi)));
    // Layer 2 — core shadow: extra meridians interleaved in the outer band
    // deepen the darkest accent just inside the reflected-light edge.
    if (shadeDensity > 0.45) {
      for (let psi = psi0 + dpsi * 0.5; psi <= psi1; psi += dpsi) {
        if (Math.sin(psi) < 0.55) continue;
        meridian(psi, 0.1);
      }
    }
  }

  // —— grounding: contact + cast shadow on the ground ——
  const shadow: FlowLine[] = [];
  if (castShadow > 0.01) {
    const sdir = light.x <= 0 ? 1 : -1; // shadow falls away from the light
    const reach = footHalf * (1.5 + castShadow * 2.6);
    const ccx = cx + sdir * reach * 0.4;
    const gy = bottomY + footRy * 0.5;
    const rx = reach * 0.6 + footHalf * 0.7;
    const ry = Math.max(penPx * 2, footHalf * 0.34);
    const rows = Math.max(2, Math.round((ry * 2) / (penPx * 1.8)));
    const sj = makeRandom((seed ^ 0x51ed27) >>> 0);
    for (let r = 0; r < rows; r++) {
      const yy = gy - ry + (r + 0.5) * ((2 * ry) / rows);
      const dy = (yy - gy) / ry;
      const hc = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      if (hc < penPx) continue;
      const xa = ccx - hc;
      const xb = ccx + hc;
      let x = xa;
      while (x < xb) {
        const t = (x - xa) / (xb - xa || 1);
        const farT = sdir > 0 ? t : 1 - t; // 0 at the foot, 1 at the far end
        const inkLen = penPx * (1.4 + (1 - farT) * 3.4);
        const gap = penPx * (0.7 + farT * 3.0) * (0.6 + sj());
        // Solid contact near the foot; the cast shadow breaks up with distance.
        if (farT < 0.18 || sj() > farT * 0.85) {
          shadow.push({ points: [{ x, y: yy }, { x: Math.min(xb, x + inkLen), y: yy }], layer: 'shadow' });
        }
        x += inkLen + gap;
      }
    }
  }

  return { lines, silhouette: [poly], shadow };
}

/** Filled / outline ribbon (the non-botanical fill modes). */
export function ribbon(
  samples: Point[],
  normals: Point[],
  w: number[],
  penPx: number,
  layer: string,
  mode: BotanicalFill
): FlowLine[] {
  const n = samples.length;
  let maxHalf = 0;
  for (const v of w) if (v > maxHalf) maxHalf = v;

  const lines: FlowLine[] = [];
  const outline: Point[] = new Array(2 * n + 1);
  for (let i = 0; i < n; i++) {
    outline[i] = { x: samples[i].x + normals[i].x * w[i], y: samples[i].y + normals[i].y * w[i] };
    const j = n - 1 - i;
    outline[n + i] = { x: samples[j].x - normals[j].x * w[j], y: samples[j].y - normals[j].y * w[j] };
  }
  outline[2 * n] = { ...outline[0] };
  lines.push({ points: outline, layer, pen: 'bold' });
  if (mode === 'outline') return lines;

  const gap = mode === 'highlight' ? penPx * 1.6 : 0;
  for (let k = 0; k * penPx <= maxHalf + 1e-6; k++) {
    const offsets = k === 0 ? [0] : [k * penPx, -k * penPx];
    for (const d of offsets) {
      const ad = Math.abs(d);
      let run: Point[] = [];
      for (let i = 0; i < n; i++) {
        const fits = ad <= w[i] + 1e-6 && !(d > 0 && gap > 0 && w[i] - d < gap);
        if (fits) run.push({ x: samples[i].x + normals[i].x * d, y: samples[i].y + normals[i].y * d });
        else if (run.length >= 2) { lines.push({ points: run, layer, pen: 'bold' }); run = []; }
        else run = [];
      }
      if (run.length >= 2) lines.push({ points: run, layer, pen: 'bold' });
    }
  }
  return lines;
}
