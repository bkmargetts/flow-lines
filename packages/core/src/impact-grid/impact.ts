import type { Point } from '../flow-lines.js';
import { clamp01, lerp } from '../lib/math.js';
import { smoothstep } from '../lib/spatial.js';
import type { RegionSpec } from './layout.js';

/** Nearest-point query result against the prepared impact path. */
export interface PathHit {
  /** Distance to the path, px. */
  d: number;
  /** Nearest point on the path. */
  qx: number;
  qy: number;
  /** Which side of the nearest segment the query point sits on (±1). */
  side: number;
  /** Unit tangent of the nearest segment, in the path's direction of travel
   *  — the sweep direction debris drags along. */
  tx: number;
  ty: number;
  /** Gesture speed at the nearest sample, 0..1 — fast flicks hit harder. */
  speed: number;
  /** Arc length along the path at the nearest point, px. */
  arc: number;
}

/** Where the trajectory actually strikes: the fast, deep sample the
 *  pane-wide damage radiates from. */
export interface Epicentre {
  x: number;
  y: number;
  /** Gesture speed at the strike, 0..1. */
  speed: number;
  /** Arc length along the path at the strike, px. */
  arc: number;
}

export interface PathField {
  nearest(x: number, y: number): PathHit;
  falloff(d: number): number;
  /** The prepared (thinned + resampled) centreline — what `inkPath` draws. */
  points: Point[];
  epicentre: Epicentre | null;
}

/** Longest segment list we'll query against. */
const MAX_SEGMENTS = 512;

interface Sample extends Point {
  speed: number;
  arc: number;
}

/**
 * Compile the drawn trajectory into a queryable, speed-aware field. The RAW
 * drag points carry the gesture's velocity — pointer events arrive on a
 * clock, so fast flicks leave wide gaps and careful passes dense ones.
 * Speed is read per raw sample (gap / reference), then the polyline is
 * thinned and resampled to a density-independent spacing with speed
 * interpolated along — so the *geometry* is stable however it was drawn,
 * while the *violence* still remembers the gesture. Synthetic evenly-spaced
 * paths (tests, CLI) read as constant speed.
 *
 * The epicentre is the sample inside the region maximizing speed² plus a
 * penetration-depth bonus — the fast, deep strike; null when the path
 * never enters the region.
 */
export function preparePath(
  path: Point[] | undefined,
  radius: number,
  region: RegionSpec,
  innerMin: number
): PathField | null {
  if (!path || path.length < 2) return null;

  // Per-raw-point speed, normalized against a page-relative flick gap.
  const speedRef = 0.06 * innerMin;
  let rawArc = 0;
  const raw: Sample[] = path.map((p, i) => {
    if (i === 0) return { x: p.x, y: p.y, speed: 0, arc: 0 };
    const gap = Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y);
    rawArc += gap;
    return { x: p.x, y: p.y, speed: clamp01(gap / speedRef), arc: rawArc };
  });
  if (raw.length >= 2) raw[0].speed = raw[1].speed;

  // Thin near-duplicates (keeping the max speed seen through the gap), then
  // resample to a fixed step with speed lerped along each kept segment.
  const minStep = radius * 0.02;
  const thinned: Sample[] = [raw[0]];
  let pending = raw[0].speed;
  for (let i = 1; i < raw.length; i++) {
    pending = Math.max(pending, raw[i].speed);
    const prev = thinned[thinned.length - 1];
    if (Math.hypot(raw[i].x - prev.x, raw[i].y - prev.y) >= minStep) {
      thinned.push({ x: raw[i].x, y: raw[i].y, speed: pending, arc: raw[i].arc });
      pending = 0;
    }
  }
  if (thinned.length < 2) return null;

  const step = minStep * 2;
  let pts: Sample[] = [thinned[0]];
  for (let i = 1; i < thinned.length; i++) {
    const a = thinned[i - 1];
    const b = thinned[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(segLen / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      pts.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        speed: a.speed + (b.speed - a.speed) * t,
        arc: a.arc + (b.arc - a.arc) * t,
      });
    }
  }
  if (pts.length - 1 > MAX_SEGMENTS) {
    const stride = Math.ceil((pts.length - 1) / MAX_SEGMENTS);
    const strided: Sample[] = [];
    for (let i = 0; i < pts.length; i += stride) strided.push(pts[i]);
    if (strided[strided.length - 1] !== pts[pts.length - 1]) strided.push(pts[pts.length - 1]);
    pts = strided;
  }

  let epicentre: Epicentre | null = null;
  let best = -Infinity;
  for (const p of pts) {
    if (!region.contains(p.x, p.y)) continue;
    const score = p.speed * p.speed + 0.3 * (region.depth(p.x, p.y) / region.extent);
    if (score > best) {
      best = score;
      epicentre = { x: p.x, y: p.y, speed: p.speed, arc: p.arc };
    }
  }
  if (!epicentre) {
    // The path never enters the slab: strike from its closest approach.
    let bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - region.centroid.x, p.y - region.centroid.y);
      if (d < bestD) {
        bestD = d;
        epicentre = { x: p.x, y: p.y, speed: p.speed, arc: p.arc };
      }
    }
  }

  const nearest = (x: number, y: number): PathHit => {
    let bestD2 = Infinity;
    let hit: PathHit = { d: 0, qx: pts[0].x, qy: pts[0].y, side: 1, tx: 1, ty: 0, speed: 0, arc: 0 };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = a.x + t * dx;
      const qy = a.y + t * dy;
      const d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
      if (d2 < bestD2) {
        bestD2 = d2;
        const len = Math.sqrt(len2) || 1;
        hit = {
          d: 0,
          qx,
          qy,
          side: dx * (y - a.y) - dy * (x - a.x) >= 0 ? 1 : -1,
          tx: dx / len,
          ty: dy / len,
          speed: a.speed + (b.speed - a.speed) * t,
          arc: a.arc + (b.arc - a.arc) * t,
        };
      }
    }
    hit.d = Math.sqrt(bestD2);
    return hit;
  };

  return {
    nearest,
    falloff: (d) => smoothstep(clamp01(1 - d / radius)),
    points: pts.map((p) => ({ x: p.x, y: p.y })),
    epicentre,
  };
}

/** The four states of the pane, graded from the strike outward. */
export type DamageZone = 'dust' | 'cascade' | 'cracked' | 'intact';

export interface CellDamage {
  zone: DamageZone;
  /** Combined damage 0..1 (channel + pane stress). */
  D: number;
  hit: PathHit;
  /** Radial direction from the epicentre (unit) — sliver orientation. */
  rx: number;
  ry: number;
  /** 0..1 how far DOWNSTREAM of the strike (along the travel direction)
   *  this cell sits — the debris cone widens with it. */
  downstream: number;
}

/**
 * The single-pane damage model: every cell's damage is the sum of a channel
 * term (how close the trajectory passes, weighted by gesture speed) and a
 * pane term (stress radiating from the epicentre across the whole slab).
 * Zone thresholds widen with `shatter`; a cell the line physically crosses
 * is always at least cascade.
 */
export function cellDamage(
  field: PathField,
  cx: number,
  cy: number,
  extent: number,
  radius: number,
  reach: number,
  energy: number,
  paneStress: number,
  shatter: number,
  focus: number
): CellDamage {
  const hit = field.nearest(cx, cy);
  const epi = field.epicentre;
  // `focus` concentrates the channel by arc distance from the strike: at 1
  // the line passes almost harmlessly through the far tail of its own
  // trajectory (a single crater); at 0 the whole trajectory carves with
  // equal appetite — the reference plates' end-to-end swept channel.
  const arcAtten = epi
    ? smoothstep(clamp01(1 - Math.abs(hit.arc - epi.arc) / (2.2 * reach)))
    : 1;
  const atten = lerp(1, arcAtten, clamp01(focus));
  // The channel narrows where the gesture crawled: local speed sets the
  // carve width as well as its intensity.
  const rEff = radius * (0.55 + 0.45 * hit.speed);
  const channel =
    smoothstep(clamp01(1 - hit.d / rEff)) *
    (0.4 + 0.6 * hit.speed) *
    (0.5 + 0.5 * energy) *
    atten;
  let pane = 0;
  let rx = hit.side * -hit.ty;
  let ry = hit.side * hit.tx;
  if (epi) {
    const dEpi = Math.hypot(cx - epi.x, cy - epi.y);
    // Squared falloff with a sub-cascade ceiling: the pane's far field
    // CRACKS (facets stay lodged); only near the strike does pane stress
    // alone fling shards — flanks survive, graded, like a real pane.
    const s = smoothstep(clamp01(1 - dEpi / reach));
    pane = paneStress * 0.55 * s * s;
    if (dEpi > 1e-6) {
      rx = (cx - epi.x) / dEpi;
      ry = (cy - epi.y) / dEpi;
    }
  }
  const D = clamp01(channel + pane);
  // shatter widens every zone; at 0 the pane refuses to break at all.
  let zone: DamageZone = 'intact';
  if (shatter > 0) {
    // A wider cracked band than dust/cascade: the reference grades intact →
    // cracked → shards over a broad annulus rather than a cliff.
    const dustT = 0.93 - 0.28 * shatter;
    const cascadeT = 0.66 - 0.26 * shatter;
    const crackT = 0.3 - 0.22 * shatter;
    zone = D > dustT ? 'dust' : D > cascadeT ? 'cascade' : D > crackT ? 'cracked' : 'intact';
    if (hit.d < extent && zone !== 'dust') zone = 'cascade';
  }
  const downstream = epi ? clamp01((hit.arc - epi.arc) / Math.max(reach, 1)) : 0;
  return { zone, D, hit, rx, ry, downstream };
}
