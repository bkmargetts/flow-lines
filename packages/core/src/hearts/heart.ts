import type { FlowLine, Point } from '../flow-lines.js';
import { clamp, lerp } from '../lib/math.js';
import type { HeartSpec } from './layout.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export interface HeartBuildOpts {
  shading: number;
  lightAngle: number;
  fillDensity: number;
  hatchAngle: number;
  hatchJitter: number;
  penWidth: number;
}

export interface HeartBuild {
  strokes: FlowLine[];
  /** Slightly inflated outline polygon for the shared depth buffer. */
  occluder: Point[];
  depth: number;
}

/** Vertical aspect for a plumpness value: 0 = tall and pointy, 1 = wide and
 *  chubby. Applied to the parametric curve's y before rotation. */
export const heartAspect = (plump: number): number => lerp(1.25, 0.85, clamp(plump, 0, 1));

/** Radius of the bounding circle about the heart's centre. The tip reaches
 *  r·aspect (exact for pointy hearts, aspect ≥ 1); for chubby hearts the
 *  lobe diagonal governs but stays under r, so max(1, aspect) bounds both. */
export const heartBoundRadius = (r: number, plump: number): number =>
  r * Math.max(1, heartAspect(plump));

/** Sample count for a full heart outline, scaled like the sports-balls seam
 *  circles so small hearts stay cheap and big ones stay smooth. */
const heartSamples = (r: number): number => clamp(Math.round(r * 1.6), 24, 96);

/**
 * The classic parametric heart (same harmonic family as `heartRegion` in
 * stickmen/region.ts), sampled as a closed polyline: lobes span ±16/17·r,
 * plumpness stretches or squashes it vertically, rotated about the centre.
 * Insets are just re-evaluations at a smaller r — always simple and closed,
 * with the cleft shallowing toward the centre the way hand-nested hearts do.
 */
export function heartOutline(
  cx: number,
  cy: number,
  r: number,
  rot: number,
  plump: number,
  n = heartSamples(r)
): Point[] {
  const ay = heartAspect(plump);
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    // x ∈ [-16,16], y ∈ [-17,12] (y up); normalize by 17 and flip y for the page.
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const dx = (hx / 17) * r;
    const dy = (-hy / 17) * r * ay;
    pts.push({ x: cx + dx * cosR - dy * sinR, y: cy + dx * sinR + dy * cosR });
  }
  return pts;
}

/**
 * Exact hatch fill of a simple polygon: for each scanline in the rotated
 * frame, intersect the infinite hatch line with every edge, sort the hits
 * along the line and pair them even-odd into inside runs — the non-convex
 * cleft clips exactly, no rasterization. `phase` (0..1) slides the whole
 * family so no two hearts' hatch registers alike.
 */
export function hatchPolygon(
  poly: Point[],
  angle: number,
  spacing: number,
  phase: number
): Point[][] {
  if (poly.length < 3) return [];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  let minU = Infinity;
  let maxU = -Infinity;
  for (const p of poly) {
    const u = p.x * nx + p.y * ny;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
  }
  const out: Point[][] = [];
  const ts: number[] = [];
  for (let u = minU + spacing * (0.3 + 0.7 * phase); u < maxU; u += spacing) {
    ts.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      const ua = a.x * nx + a.y * ny;
      const ub = b.x * nx + b.y * ny;
      if ((ua <= u && ub > u) || (ub <= u && ua > u)) {
        const f = (u - ua) / (ub - ua);
        const px = a.x + (b.x - a.x) * f;
        const py = a.y + (b.y - a.y) * f;
        ts.push(px * dx + py * dy);
      }
    }
    if (ts.length < 2) continue;
    ts.sort((p, q) => p - q);
    for (let k = 0; k + 1 < ts.length; k += 2) {
      const t0 = ts[k];
      const t1 = ts[k + 1];
      if (t1 - t0 < spacing * 0.4) continue; // corner slivers read as flecks
      out.push([
        { x: nx * u + dx * t0, y: ny * u + dy * t0 },
        { x: nx * u + dx * t1, y: ny * u + dy * t1 },
      ]);
    }
  }
  return out;
}

/** Rotate a local (heart-frame) point about the heart's centre onto the page. */
const place = (spec: HeartSpec, lx: number, ly: number): Point => {
  const cosR = Math.cos(spec.rot);
  const sinR = Math.sin(spec.rot);
  return { x: spec.x + lx * cosR - ly * sinR, y: spec.y + lx * sinR + ly * cosR };
};

/**
 * One heart: the outline plus its style's interior marks — concentric copies
 * for solid, exact even-odd hatch for hatched, a jagged crack for broken —
 * an optional shadow-side band lit by one shared page-space light, bold
 * multi-pass emphasis, and a cupid's arrow whose shaft is hidden where it
 * passes behind the heart's own body.
 */
export function buildHeart(spec: HeartSpec, o: HeartBuildOpts): HeartBuild {
  const { x, y, r, plump, rot } = spec;
  const strokes: FlowLine[] = [];
  const spacing = Math.max(2, lerp(o.penWidth * 4.5, o.penWidth * 1.8, clamp(o.fillDensity, 0, 1)));

  strokes.push({ points: heartOutline(x, y, r, rot, plump), pen: 'fine', layer: 'outline' });
  if (spec.bold) {
    // Bold emphasis is repeated offset passes of the same pen, never a wider
    // stroke — the repo's one-pen contract.
    for (const inset of [o.penWidth * 0.9, o.penWidth * 1.8]) {
      if (r - inset < 2) break;
      strokes.push({ points: heartOutline(x, y, r - inset, rot, plump), pen: 'fine', layer: 'outline' });
    }
  }

  switch (spec.style) {
    case 'outline':
      break;
    case 'solid':
      for (let rr = r - spacing; rr > Math.max(2, spacing * 0.6); rr -= spacing) {
        strokes.push({ points: heartOutline(x, y, rr, rot, plump), pen: 'fine', layer: 'fill' });
      }
      break;
    case 'hatched': {
      const inset = Math.max(2, r - o.penWidth * 1.2);
      if (inset > 2) {
        const angle =
          o.hatchAngle + rot + (spec.g[0] * 2 - 1) * clamp(o.hatchJitter, 0, 1) * 30 * DEG;
        for (const seg of hatchPolygon(heartOutline(x, y, inset, rot, plump), angle, spacing, spec.g[1])) {
          strokes.push({ points: seg, pen: 'fine', layer: 'fill' });
        }
      }
      break;
    }
    case 'broken':
      strokes.push({ points: crack(spec), pen: 'fine', layer: 'fill' });
      break;
  }

  if (o.shading > 0) strokes.push(...shade(spec, o));
  if (spec.arrow && r >= 9) strokes.push(...arrow(spec));

  const inflate = Math.max(0.6, o.penWidth * 0.75);
  return {
    strokes,
    occluder: heartOutline(x, y, r + inflate, rot, plump),
    depth: spec.depth,
  };
}

/** The broken-heart crack: a jagged polyline from the cleft notch down
 *  toward the tip, lateral swings tapering as it goes — the universally-read
 *  icon, no outline splitting needed. */
function crack(spec: HeartSpec): Point[] {
  const { r, plump, g } = spec;
  const ay = heartAspect(plump);
  const y0 = -(5 / 17) * r * ay; // the cleft dip (the t=0 outline sample)
  const y1 = 0.82 * r * ay; // short of the tip
  const side0 = g[2] < 0.5 ? 1 : -1;
  const pts: Point[] = [place(spec, 0, y0)];
  const SEGS = 5;
  for (let i = 1; i < SEGS; i++) {
    const t = i / SEGS;
    const amp = r * (0.12 + 0.12 * g[2 + (i % 5)]) * (1 - 0.45 * t);
    const side = i % 2 === 0 ? -side0 : side0;
    pts.push(place(spec, side * amp, lerp(y0, y1, t)));
  }
  pts.push(place(spec, 0, y1));
  return pts;
}

/**
 * Shadow-side band: a few inset copies close under the outline, each split to
 * the runs facing away from the light — crescents hugging the silhouette on
 * the shadow side. The light is page-space and shared by the whole pile
 * (deliberately NOT heart-rotated), like the sports-balls shade rings.
 */
function shade(spec: HeartSpec, o: HeartBuildOpts): FlowLine[] {
  const { x, y, r, rot, plump } = spec;
  if (r < 6) return []; // rings on a tiny heart turn to mush
  const shading = clamp(o.shading, 0, 1);
  const lx = Math.cos(o.lightAngle);
  const ly = Math.sin(o.lightAngle);
  const spacing = Math.max(2.5, o.penWidth * 2.2);
  const band = r * (0.12 + 0.42 * shading);
  const rings = Math.max(2, Math.round(band / spacing));
  const out: FlowLine[] = [];
  for (let k = 0; k < rings; k++) {
    const rk = r * 0.96 - (k * band) / Math.max(1, rings - 1);
    if (rk < 3) break;
    const ring = heartOutline(x, y, rk, rot, plump);
    ring.pop(); // drop the duplicated closing point; we re-walk it cyclically
    const n = ring.length;
    const inShadow = (p: Point): boolean => {
      const dx = p.x - x;
      const dy = p.y - y;
      const len = Math.hypot(dx, dy) || 1;
      return (dx * lx + dy * ly) / len < -0.15;
    };
    // Start the cyclic walk on a lit sample so a shadow arc never splits
    // across the array seam.
    let start = 0;
    while (start < n && inShadow(ring[start])) start++;
    if (start === n) start = 0; // fully shadowed (can't happen with the margin, but safe)
    let run: Point[] = [];
    const flush = (): void => {
      if (run.length >= 3) out.push({ points: run, pen: 'fine', layer: 'shading' });
      run = [];
    };
    for (let i = 0; i < n; i++) {
      const p = ring[(start + i) % n];
      if (inShadow(p)) run.push(p);
      else flush();
    }
    flush();
  }
  return out;
}

/**
 * The cupid's arrow: a shaft through the heart's centre kept only OUTSIDE the
 * outline (the body occludes it), barbs at the exit tip, fletching ticks at
 * the entry — the classic pierced heart.
 */
function arrow(spec: HeartSpec): FlowLine[] {
  const { x, y, r, rot, plump, g } = spec;
  const arot = rot - 0.45 + (g[6] - 0.5) * 0.3;
  const dx = Math.cos(arot);
  const dy = Math.sin(arot);
  const L = heartBoundRadius(r, plump) * 1.45;
  // Even-odd crossings of the infinite shaft with a slightly inflated
  // outline, as params along the shaft — sorted, they bound the inside spans.
  const poly = heartOutline(x, y, r + Math.max(1, r * 0.04), rot, plump);
  const nx = -dy;
  const ny = dx;
  const ts: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const ua = (a.x - x) * nx + (a.y - y) * ny;
    const ub = (b.x - x) * nx + (b.y - y) * ny;
    if ((ua <= 0 && ub > 0) || (ub <= 0 && ua > 0)) {
      const f = (0 - ua) / (ub - ua);
      const px = a.x + (b.x - a.x) * f;
      const py = a.y + (b.y - a.y) * f;
      ts.push((px - x) * dx + (py - y) * dy);
    }
  }
  if (ts.length < 2) return [];
  ts.sort((p, q) => p - q);
  const at = (t: number): Point => ({ x: x + dx * t, y: y + dy * t });
  const out: FlowLine[] = [];
  // Outside spans: entry up to the first crossing, gaps between inside spans,
  // last crossing out to the head.
  const bounds = [-L, ...ts, L];
  for (let k = 0; k + 1 < bounds.length; k += 2) {
    if (bounds[k + 1] - bounds[k] > 1) {
      out.push({ points: [at(bounds[k]), at(bounds[k + 1])], pen: 'fine', layer: 'decor' });
    }
  }
  // Head barbs at the exit tip.
  const barb = r * 0.24;
  for (const side of [1, -1]) {
    const ba = arot + Math.PI + side * 0.42;
    const tip = at(L);
    out.push({
      points: [tip, { x: tip.x + Math.cos(ba) * barb, y: tip.y + Math.sin(ba) * barb }],
      pen: 'fine',
      layer: 'decor',
    });
  }
  // Fletching: three tick pairs near the entry end, swept back along the shaft.
  const fl = r * 0.2;
  for (let k = 0; k < 3; k++) {
    const base = at(-L + k * fl * 0.55);
    for (const side of [1, -1]) {
      const fa = arot + Math.PI - side * 0.7;
      out.push({
        points: [base, { x: base.x + Math.cos(fa) * fl, y: base.y + Math.sin(fa) * fl }],
        pen: 'fine',
        layer: 'decor',
      });
    }
  }
  return out;
}
