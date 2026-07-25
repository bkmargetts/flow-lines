import type { Point } from '../flow-lines.js';
import { subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';
import type { WeaveMorph } from './morph.js';

/**
 * Strand shaping: the raw lattice loops are rounded, densified, then
 * deformed in two stages —
 *
 * 1. a **global domain warp**: every vertex of every strand is displaced by
 *    the same smooth noise field. A shared smooth warp of the plane cannot
 *    create or destroy crossings, so at moderate flow the lattice's weave
 *    solution stays valid for free;
 * 2. a **per-strand meander**: perpendicular displacement from a per-strand
 *    noise channel. This is what deliberately tears the grid reading apart
 *    and creates genuinely new tangle crossings at low order.
 *
 * All strands are closed loops (the lattice guarantees it); the helpers here
 * are wrap-aware so the seam never pins or kinks.
 */

export interface Strand {
  /** Densified, warped centerline; closed — the last point connects back to
   *  the first (no duplicate endpoint). */
  pts: Point[];
  /** Unit normals per point (wrap-aware central differences). */
  normals: Point[];
  /** Cumulative arc length per point; arc[0] = 0. */
  arc: number[];
  /** Total loop length including the closing segment. */
  len: number;
}

export interface ShapeOptions {
  cell: number;
  bandWidth: number;
  seed: number;
  /** Drawable box (the margin frame). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** In bleed mode strands run off-page on purpose — no containment. */
  bleed: boolean;
  /** Finish-pass displacement reach, folded into the containment inset. */
  pad: number;
}

/** One Chaikin corner-cut round on a closed loop. Collinear runs are
 *  untouched; turn vertices round into quadratic arcs. */
function chaikinClosed(pts: Point[]): Point[] {
  const n = pts.length;
  const out: Point[] = new Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out[i * 2] = { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 };
    out[i * 2 + 1] = { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 };
  }
  return out;
}

/** Iterated 1-2-1 smoothing with wrap (no pinned endpoints). */
function smoothClosed(pts: Point[], iterations: number): Point[] {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const n = cur.length;
    const out: Point[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = cur[(i - 1 + n) % n];
      const c = cur[i];
      const q = cur[(i + 1) % n];
      out[i] = { x: (p.x + 2 * c.x + q.x) / 4, y: (p.y + 2 * c.y + q.y) / 4 };
    }
    cur = out;
  }
  return cur;
}

/** Resample a closed loop to ~`step`-spaced points (wrap segment included,
 *  no duplicate endpoint). */
function densifyClosed(pts: Point[], step: number): Point[] {
  const s = Math.max(0.5, step);
  const n = pts.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(segLen / s));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Per-point unit normals with wrap-aware central differences. */
export function normalsClosed(pts: Point[]): Point[] {
  const n = pts.length;
  const out: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n];
    const q = pts[(i + 1) % n];
    const tx = q.x - p.x;
    const ty = q.y - p.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = { x: -ty / len, y: tx / len };
  }
  return out;
}

function finalize(pts: Point[]): Strand {
  const n = pts.length;
  const arc: number[] = new Array(n);
  arc[0] = 0;
  for (let i = 1; i < n; i++) {
    arc[i] = arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  const len =
    arc[n - 1] + Math.hypot(pts[0].x - pts[n - 1].x, pts[0].y - pts[n - 1].y);
  return { pts, normals: normalsClosed(pts), arc, len };
}

/** Signed circular difference `a - b` on a loop of length `len`, in
 *  (-len/2, len/2]. */
export function circularDelta(a: number, b: number, len: number): number {
  let d = (((a - b) % len) + len) % len;
  if (d > len / 2) d -= len;
  return d;
}

export interface StrandSample {
  p: Point;
  n: Point;
  t: Point;
  /** Index of the segment the sample falls in. */
  i: number;
}

/** Interpolated point / normal / tangent at arc position `a` (wrapped). */
export function sampleAt(s: Strand, a: number): StrandSample {
  const n = s.pts.length;
  const arc = ((a % s.len) + s.len) % s.len;
  // Binary search for the last index with arc[i] <= arc.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.arc[mid] <= arc) lo = mid;
    else hi = mid - 1;
  }
  const i = lo;
  const p0 = s.pts[i];
  const p1 = s.pts[(i + 1) % n];
  const segLen = i + 1 < n ? s.arc[i + 1] - s.arc[i] : s.len - s.arc[i];
  const t = segLen > 1e-9 ? (arc - s.arc[i]) / segLen : 0;
  const n0 = s.normals[i];
  const n1 = s.normals[(i + 1) % n];
  let nx = n0.x + (n1.x - n0.x) * t;
  let ny = n0.y + (n1.y - n0.y) * t;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const tx = p1.x - p0.x;
  const ty = p1.y - p0.y;
  const tl = Math.hypot(tx, ty) || 1;
  return {
    p: { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t },
    n: { x: nx, y: ny },
    t: { x: tx / tl, y: ty / tl },
    i,
  };
}

/**
 * Separation relaxation: two ribbons closer than a band width without
 * actually crossing is physically impossible — and it's exactly what lets an
 * occluder graze a neighbour's edge lengthwise and shave it off. Points with
 * a near-PARALLEL foreign neighbour inside `minSep` get pushed apart;
 * transversal proximity (a genuine crossing) is left for the weave to handle.
 */
function separateStrands(strands: Point[][], minSep: number, iterations: number): void {
  const cellSize = Math.max(4, minSep);
  const tangentOf = (pts: Point[], i: number): Point => {
    const n = pts.length;
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  };

  for (let it = 0; it < iterations; it++) {
    // Rebuild the hash each pass — points move.
    const buckets = new Map<string, [number, number][]>();
    for (let k = 0; k < strands.length; k++) {
      const pts = strands[k];
      for (let i = 0; i < pts.length; i++) {
        const key = `${Math.floor(pts[i].x / cellSize)},${Math.floor(pts[i].y / cellSize)}`;
        let arr = buckets.get(key);
        if (!arr) {
          arr = [];
          buckets.set(key, arr);
        }
        arr.push([k, i]);
      }
    }

    for (let k = 0; k < strands.length; k++) {
      const pts = strands[k];
      const n = pts.length;
      const sameStrandGap = Math.ceil((3 * minSep) / 4) + 4;

      // Pass 1: nearest near-parallel foreign neighbour per point — distance,
      // which side it sits on, and the would-be push.
      const dist = new Float64Array(n).fill(Infinity);
      const side = new Int8Array(n);
      const pushX = new Float64Array(n);
      const pushY = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const t = tangentOf(pts, i);
        const cx = Math.floor(p.x / cellSize);
        const cy = Math.floor(p.y / cellSize);
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            const arr = buckets.get(`${gx},${gy}`);
            if (!arr) continue;
            for (const [fk, fi] of arr) {
              if (fk === k) {
                const gap = Math.min(Math.abs(fi - i), n - Math.abs(fi - i));
                if (gap <= sameStrandGap) continue;
              }
              const q = strands[fk][fi];
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const d = Math.hypot(dx, dy);
              if (d >= Math.min(minSep, dist[i]) || d < 1e-6) continue;
              const ft = tangentOf(strands[fk], fi);
              if (Math.abs(t.x * ft.x + t.y * ft.y) < 0.8) continue; // transversal
              dist[i] = d;
              side[i] = t.x * dy - t.y * dx > 0 ? 1 : -1;
              const w = (minSep - d) / d;
              pushX[i] = dx * w * 0.35;
              pushY[i] = dy * w * 0.35;
            }
          }
        }
      }

      // Pass 2: repel only pure grazes. A side flip in the neighbourhood
      // means the pair genuinely crosses there — separation would just fight
      // the topology and shake the strand into wiggles; the occluder pass
      // owns crossings.
      const W = Math.max(3, Math.ceil(minSep / 4));
      for (let i = 0; i < n; i++) {
        if (!isFinite(dist[i])) continue;
        let flip = false;
        for (let j = i - W; j <= i + W && !flip; j++) {
          const jj = ((j % n) + n) % n;
          if (isFinite(dist[jj]) && side[jj] !== side[i]) flip = true;
        }
        if (flip) continue;
        pts[i].x += pushX[i];
        pts[i].y += pushY[i];
      }
    }
  }
}

/** Round, densify, warp and meander the raw lattice loops. */
export function shapeStrands(
  raw: Point[][],
  o: ShapeOptions,
  morph: WeaveMorph
): Strand[] {
  const warpNoise = createNoise(subSeed(o.seed, 3));
  const meanderNoise = createNoise(subSeed(o.seed, 4));
  const warpAmp = morph.warpAmpFrac * o.cell;
  const warpScale = morph.warpScaleFrac * o.cell;
  const meanderAmp = morph.meanderAmpFrac * o.cell;
  const step = Math.max(2, Math.min(o.cell / 5, o.bandWidth / 2));

  // Containment (closed mode): displacement fades to zero near the frame so
  // border turnarounds stay pinned inside it — otherwise the warp shoves them
  // past the margin and the final clip chops the bands flat along the box,
  // the one place a clipped edge reads as a bug rather than a choice.
  const rampZone = 0.7 * o.cell;
  const borderRamp = (p: Point): number => {
    if (o.bleed) return 1;
    const d = Math.min(p.x - o.x0, o.x1 - p.x, p.y - o.y0, o.y1 - p.y);
    if (d <= 0) return 0;
    if (d >= rampZone) return 1;
    const t = d / rampZone;
    return t * t * (3 - 2 * t);
  };

  const shaped: Point[][] = [];
  for (let k = 0; k < raw.length; k++) {
    let pts = raw[k];
    if (pts.length < 3) continue;
    // Base corner rounding: two Chaikin rounds turn every break bounce into
    // a woven-strand bend; straight plait runs stay straight.
    pts = chaikinClosed(chaikinClosed(pts));
    pts = smoothClosed(pts, morph.smoothIters);
    pts = densifyClosed(pts, step);

    // Global domain warp — one shared field for all strands.
    if (warpAmp > 0.01) {
      pts = pts.map((p) => {
        const amp = warpAmp * borderRamp(p);
        if (amp < 0.01) return p;
        const nx = warpNoise.noise2D(p.x / warpScale, p.y / warpScale);
        const ny = warpNoise.noise2D(p.x / warpScale + 421.7, p.y / warpScale + 137.3);
        return { x: p.x + nx * amp, y: p.y + ny * amp };
      });
    }

    // Per-strand meander — perpendicular displacement from a private channel.
    // Sampled on a circle in noise space so the displacement is periodic in
    // arc length: no kink where the loop seam wraps.
    if (meanderAmp > 0.01) {
      const normals = normalsClosed(pts);
      const arc: number[] = new Array(pts.length);
      arc[0] = 0;
      for (let i = 1; i < pts.length; i++) {
        arc[i] = arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      const total =
        arc[pts.length - 1] +
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
      const wavelength = 3 * o.cell;
      const radius = total / (2 * Math.PI * wavelength);
      pts = pts.map((p, i) => {
        const amp = meanderAmp * borderRamp(p);
        if (amp < 0.01) return p;
        const theta = (2 * Math.PI * arc[i]) / total;
        const d =
          meanderNoise.noise2D(
            Math.cos(theta) * radius + 19.3 * k,
            Math.sin(theta) * radius + 7.13 * k
          ) * amp;
        return { x: p.x + normals[i].x * d, y: p.y + normals[i].y * d };
      });
      pts = smoothClosed(pts, 1);
    }

    shaped.push(pts);
  }

  // Physicality pass: no two ribbons may run parallel closer than a band
  // width — see separateStrands. The lattice itself already satisfies this;
  // the warp and meander are what can squeeze neighbours together.
  separateStrands(shaped, o.bandWidth + 4, 3);

  // Containment backstop (closed mode): the repulsion pass can nudge a
  // border strand outward past the attenuated zone. Clamp centerlines into
  // the box inset by the band half-width plus the finish reach; offenders
  // are a couple of px at most, and the final smoothing rounds the residue.
  if (!o.bleed) {
    const inset = o.bandWidth / 2 + 2 + o.pad;
    const cx0 = o.x0 + inset;
    const cy0 = o.y0 + inset;
    const cx1 = o.x1 - inset;
    const cy1 = o.y1 - inset;
    if (cx1 > cx0 && cy1 > cy0) {
      for (const pts of shaped) {
        for (const p of pts) {
          if (p.x < cx0) p.x = cx0;
          else if (p.x > cx1) p.x = cx1;
          if (p.y < cy0) p.y = cy0;
          else if (p.y > cy1) p.y = cy1;
        }
      }
    }
  }

  return shaped.map((pts) => finalize(smoothClosed(pts, 1)));
}
