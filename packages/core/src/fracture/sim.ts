import { Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { steer, smoothstep } from '../lib/spatial.js';
import { clamp } from '../lib/math.js';

/**
 * Fracture simulation — crack propagation in a drying/stressed sheet.
 *
 * Three local rules produce the emergent geometry of real desiccation crack
 * networks (mud, glaze crazing, old paint):
 *
 *  - **Nucleation by screened stress**: cracks start at maxima of a stress
 *    field, but existing cracks *relieve* stress in a neighbourhood, so no new
 *    crack is born near an old one. This is what drives the hierarchy — each
 *    generation can only subdivide the plates the previous one left.
 *  - **Perpendicular capture**: a growing tip that senses a nearby crack turns
 *    toward the perpendicular approach and arrests *on* it. Real cracks meet at
 *    ~right angles because the free surface of an open crack carries no shear —
 *    the same screening, seen by a moving tip. T-junctions, never X-crossings.
 *  - **Simultaneous growth**: all tips of a generation advance round-robin and
 *    register every step immediately, so same-generation cracks arrest each
 *    other exactly like older ones.
 */

export interface FractureSimParams {
  /** Inner frame (cracks live here), page px. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Crack generations (hierarchy depth). */
  generations: number;
  /** 0..1 — scales nucleation site count (via the relief radius). */
  crackDensity: number;
  /** Stress-noise feature size as a fraction of the min frame dimension. */
  stressScale: number;
  /** 0..1 — tip inertia; high = straight confident primaries. */
  straightness: number;
  /** 0..1 — per-step heading jitter. */
  jitter: number;
  /** 0..1 — how strongly crack directions align to `anisotropyAngle`. */
  anisotropy: number;
  /** Preferred crack axis in radians (axial — θ and θ+π are the same). */
  anisotropyAngle: number;
  /** 0..1 — stress below this arrests a tip (leaves calm plates uncracked). */
  arrestThreshold: number;
  /** Distance at which a tip senses and turns toward an existing crack, px. */
  captureRadius: number;
  /** 0..1 — fraction of gen-0 cracks seeded on the frame border, growing inward. */
  edgeNucleation: number;
  /** Growth step length, px. */
  step: number;
}

export interface FractureCrack {
  points: Point[];
  generation: number;
  /** Why each end stopped ('junction' ends were snapped onto another crack
   *  and must not be trimmed/frayed, or the T contact opens). */
  endA: 'junction' | 'border' | 'faded';
  endB: 'junction' | 'border' | 'faded';
}

export interface FractureJunction {
  x: number;
  y: number;
  /** Absolute angle between the arriving tip and the struck crack, degrees, 0..90. */
  angleDiffDeg: number;
  generation: number;
}

export interface FractureSimResult {
  cracks: FractureCrack[];
  junctions: FractureJunction[];
}

// Runaway guards, far above any sensible parameterisation.
const MAX_CRACKS = 1200;
const MAX_STEPS_PER_TIP = 4000;

interface StoredSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  crackId: number;
  segIndex: number;
}

export interface SegmentHit {
  dist: number;
  /** Closest point on the segment. */
  px: number;
  py: number;
  /** Segment direction, radians. */
  angle: number;
}

/**
 * Uniform spatial hash of crack segments. Unlike `ProximityGrid` this answers
 * *which* segment is nearest (closest point + direction), which the
 * perpendicular-capture rule needs. A segment is bucketed into every cell it
 * crosses so queries only scan the 3×3 neighbourhood.
 */
export class SegmentGrid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly ox: number;
  private readonly oy: number;
  private readonly buckets: StoredSegment[][];

  constructor(x0: number, y0: number, x1: number, y1: number, cell: number) {
    this.cell = Math.max(1, cell);
    this.ox = x0;
    this.oy = y0;
    this.cols = Math.max(1, Math.ceil((x1 - x0) / this.cell));
    this.rows = Math.max(1, Math.ceil((y1 - y0) / this.cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  private cellX(x: number): number {
    return clamp(Math.floor((x - this.ox) / this.cell), 0, this.cols - 1);
  }

  private cellY(y: number): number {
    return clamp(Math.floor((y - this.oy) / this.cell), 0, this.rows - 1);
  }

  add(ax: number, ay: number, bx: number, by: number, crackId: number, segIndex: number): void {
    const seg: StoredSegment = { ax, ay, bx, by, crackId, segIndex };
    const cx0 = Math.min(this.cellX(ax), this.cellX(bx));
    const cx1 = Math.max(this.cellX(ax), this.cellX(bx));
    const cy0 = Math.min(this.cellY(ay), this.cellY(by));
    const cy1 = Math.max(this.cellY(ay), this.cellY(by));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        this.buckets[cy * this.cols + cx].push(seg);
      }
    }
  }

  /**
   * Nearest stored segment within `radius` of (x, y), excluding the querying
   * tip's own most recent segments (a tip must not capture itself: its trailing
   * segments are always within a step of it).
   */
  nearest(
    x: number,
    y: number,
    radius: number,
    excludeCrackId: number,
    excludeAfterSeg: number
  ): SegmentHit | null {
    const reach = Math.max(1, Math.ceil(radius / this.cell));
    const cx = this.cellX(x);
    const cy = this.cellY(y);
    let best: SegmentHit | null = null;
    let bestD2 = radius * radius;
    for (let gy = cy - reach; gy <= cy + reach; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - reach; gx <= cx + reach; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        for (const s of this.buckets[gy * this.cols + gx]) {
          if (s.crackId === excludeCrackId && s.segIndex >= excludeAfterSeg) continue;
          const dx = s.bx - s.ax;
          const dy = s.by - s.ay;
          const len2 = dx * dx + dy * dy || 1;
          const t = clamp(((x - s.ax) * dx + (y - s.ay) * dy) / len2, 0, 1);
          const px = s.ax + dx * t;
          const py = s.ay + dy * t;
          const d2 = (x - px) * (x - px) + (y - py) * (y - py);
          if (d2 < bestD2) {
            bestD2 = d2;
            best = { dist: Math.sqrt(d2), px, py, angle: Math.atan2(dy, dx) };
          }
        }
      }
    }
    return best;
  }
}

/** Wrap an angle difference to (-π, π]. */
function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Acute angle between two axial directions, degrees 0..90. */
function axialDiffDeg(a: number, b: number): number {
  let d = Math.abs(angleDelta(a, b)) * (180 / Math.PI);
  if (d > 90) d = 180 - d;
  return d;
}

interface Tip {
  crackId: number;
  x: number;
  y: number;
  heading: number;
  /** The crack's own propagation axis — the tip is pulled back to it. */
  axis: number;
  /** Constant per-tip curvature, radians/step — some cracks arc gently. */
  bend: number;
  stepsLeft: number;
  alive: boolean;
  /** Which end of the crack this tip extends: prepend (A) or append (B). */
  end: 'A' | 'B';
}

/**
 * Run the fracture simulation. `random` is drawn in a fixed order; `stressNoise`
 * and `orientNoise` are two independent simplex fields (the caller seeds them).
 */
export function simulateFracture(
  p: FractureSimParams,
  random: () => number,
  stressNoise: SimplexNoise,
  orientNoise: SimplexNoise
): FractureSimResult {
  const { x0, y0, x1, y1 } = p;
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 4 || h <= 4) return { cracks: [], junctions: [] };
  const minDim = Math.min(w, h);
  const diag = Math.hypot(w, h);
  const step = p.step;

  const stressF = 1 / Math.max(1e-6, p.stressScale * minDim);
  const stress = (x: number, y: number): number =>
    0.5 + 0.5 * stressNoise.fbm(x * stressF, y * stressF, 4);

  // Each crack propagates along its OWN axis — straight with gentle wander —
  // not along a shared orientation field. A shared smooth field combs
  // neighbouring cracks parallel and the whole sheet reads as wood grain;
  // independent straight cracks + perpendicular capture is what closes the
  // network into polygonal plates. The noise only adds a weak, large-scale
  // wander so long cracks curve organically instead of ruling themselves.
  const wanderF = 1 / Math.max(1e-6, 0.35 * minDim);
  const wanderAt = (x: number, y: number): number =>
    orientNoise.noise2D(x * wanderF, y * wanderF) * 0.5;

  /** A birth axis: uniform-random, pulled toward the anisotropy axis in
   *  doubled-angle space (axial — θ and θ+π are one direction). */
  const birthAxis = (): number => {
    const tr = random() * Math.PI;
    const ca = Math.cos(2 * tr) * (1 - p.anisotropy) + Math.cos(2 * p.anisotropyAngle) * p.anisotropy;
    const sa = Math.sin(2 * tr) * (1 - p.anisotropy) + Math.sin(2 * p.anisotropyAngle) * p.anisotropy;
    return Math.atan2(sa, ca) / 2;
  };

  const grid = new SegmentGrid(x0, y0, x1, y1, Math.max(step, p.captureRadius));
  const cracks: FractureCrack[] = [];
  const junctions: FractureJunction[] = [];
  // Per-crack live geometry: B-end points appended, A-end points prepended
  // (kept reversed for O(1) push, joined at the end).
  const partA: Point[][] = [];
  const partB: Point[][] = [];
  const segCount: number[] = [];

  // Base relief radius: how much sheet a gen-0 crack "drains". crackDensity
  // 0..1 sweeps roughly 1/2..1/10th of the min dimension — primaries stay few
  // enough to read as the big committed spans; generations do the subdividing.
  const R0 = minDim / (2 + 10 * clamp(p.crackDensity, 0, 1));

  const inFrame = (x: number, y: number): boolean => x >= x0 && x <= x1 && y >= y0 && y <= y1;

  const pushSegment = (tip: Tip, nx: number, ny: number): void => {
    const id = tip.crackId;
    grid.add(tip.x, tip.y, nx, ny, id, segCount[id]);
    segCount[id]++;
    (tip.end === 'A' ? partA : partB)[id].push({ x: nx, y: ny });
    tip.x = nx;
    tip.y = ny;
  };

  for (let g = 0; g < p.generations; g++) {
    const Rg = Math.max(step * 2, R0 * Math.pow(0.5, g));
    // Primaries hold their line; each finer generation meanders more.
    const turnRate = clamp((1 - p.straightness) * 0.3 * Math.pow(1.6, g), 0.02, 0.85);
    const budget = Math.round((0.55 * diag * Math.pow(0.5, g)) / step);
    const arrest = p.arrestThreshold * (1 - 0.15 * g);

    // ---- Nucleation: jittered grid of candidates, scored by screened stress.
    interface Candidate {
      x: number;
      y: number;
      score: number;
      idx: number;
      border: number; // heading if border-seeded, else NaN
    }
    const candidates: Candidate[] = [];
    let idx = 0;
    const gcols = Math.max(1, Math.floor(w / Rg));
    const grows = Math.max(1, Math.floor(h / Rg));
    const gw = w / gcols;
    const gh = h / grows;
    for (let gy = 0; gy < grows; gy++) {
      for (let gx = 0; gx < gcols; gx++) {
        const x = x0 + (gx + 0.5) * gw + (random() - 0.5) * gw * 0.8;
        const y = y0 + (gy + 0.5) * gh + (random() - 0.5) * gh * 0.8;
        if (!inFrame(x, y)) {
          idx++;
          continue;
        }
        const near = grid.nearest(x, y, Rg, -1, 0);
        const screen = near ? smoothstep(near.dist / Rg) : 1;
        candidates.push({ x, y, score: stress(x, y) * screen, idx, border: NaN });
        idx++;
      }
    }

    // Shatter: divert a fraction of gen-0 sites onto the border, heading inward.
    if (g === 0 && p.edgeNucleation > 0) {
      const borderCount = Math.round(candidates.length * clamp(p.edgeNucleation, 0, 1) * 0.5);
      const perim = 2 * (w + h);
      for (let i = 0; i < borderCount; i++) {
        const t = ((i + 0.5) / borderCount + (random() - 0.5) * (0.5 / borderCount)) * perim;
        let x: number;
        let y: number;
        let heading: number;
        if (t < w) {
          x = x0 + t;
          y = y0;
          heading = Math.PI / 2;
        } else if (t < w + h) {
          x = x1;
          y = y0 + (t - w);
          heading = Math.PI;
        } else if (t < 2 * w + h) {
          x = x1 - (t - w - h);
          y = y1;
          heading = -Math.PI / 2;
        } else {
          x = x0;
          y = y1 - (t - 2 * w - h);
          heading = 0;
        }
        candidates.push({ x, y, score: 1 + stress(x, y), idx: idx++, border: heading });
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);

    // ---- Greedy acceptance with spacing against cracks AND accepted peers.
    const accepted: Candidate[] = [];
    const capPerGen = Math.max(2, Math.round((w * h) / (Rg * Rg) * 0.6));
    const minSpace = 0.7 * Rg;
    const threshold = 0.35; // nucleation score floor
    for (const c of candidates) {
      if (accepted.length >= capPerGen || cracks.length + accepted.length >= MAX_CRACKS) break;
      if (c.score < threshold) break;
      const nearCrack = grid.nearest(c.x, c.y, minSpace, -1, 0);
      if (nearCrack && Number.isNaN(c.border)) continue;
      let clash = false;
      for (const a of accepted) {
        const dx = a.x - c.x;
        const dy = a.y - c.y;
        if (dx * dx + dy * dy < minSpace * minSpace) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      accepted.push(c);
    }

    // ---- Birth: one crack per site, two tips (border sites grow one way).
    const tips: Tip[] = [];
    const bendMax = 0.012 * (1 - p.straightness) + 0.002;
    for (const c of accepted) {
      const id = cracks.length;
      const isBorder = !Number.isNaN(c.border);
      const h0 = isBorder ? c.border + (random() - 0.5) * 0.4 : birthAxis();
      const bend = (random() - 0.5) * 2 * bendMax;
      cracks.push({ points: [], generation: g, endA: 'faded', endB: 'faded' });
      partA.push([]);
      partB.push([{ x: c.x, y: c.y }]);
      segCount.push(0);
      const perTip = clamp(Math.round(budget * (0.7 + 0.6 * random())), 4, MAX_STEPS_PER_TIP);
      tips.push({
        crackId: id,
        x: c.x,
        y: c.y,
        heading: h0,
        axis: h0,
        bend,
        stepsLeft: perTip,
        alive: true,
        end: 'B',
      });
      if (!isBorder) {
        tips.push({
          crackId: id,
          x: c.x,
          y: c.y,
          heading: h0 + Math.PI,
          axis: h0 + Math.PI,
          bend: -bend,
          stepsLeft: perTip,
          alive: true,
          end: 'A',
        });
      } else {
        cracks[id].endA = 'border';
      }
    }

    // ---- Round-robin growth: one step per living tip per pass, so
    // same-generation cracks screen and arrest each other symmetrically.
    let living = tips.filter((t) => t.alive).length;
    while (living > 0) {
      for (const tip of tips) {
        if (!tip.alive) continue;
        const crack = cracks[tip.crackId];
        const setEnd = (why: 'junction' | 'border' | 'faded'): void => {
          if (tip.end === 'A') crack.endA = why;
          else crack.endB = why;
          tip.alive = false;
          living--;
        };

        if (tip.stepsLeft-- <= 0) {
          setEnd('faded');
          continue;
        }

        // The crack holds its own line: the axis arcs by the per-tip bend and
        // a weak large-scale wander, and the heading is pulled back to it
        // after each jitter/capture excursion.
        tip.axis += tip.bend + wanderAt(tip.x, tip.y) * (1 - p.straightness) * 0.06;
        let heading = steer(tip.heading, tip.axis, turnRate);
        heading += (random() - 0.5) * p.jitter * 0.35;

        // Perpendicular capture: sense a nearby crack, turn toward its normal,
        // snap onto it on contact.
        const hit = grid.nearest(tip.x, tip.y, p.captureRadius, tip.crackId, segCount[tip.crackId] - 6);
        if (hit) {
          const toHit = Math.atan2(hit.py - tip.y, hit.px - tip.x);
          const perp =
            Math.abs(angleDelta(hit.angle + Math.PI / 2, toHit)) <= Math.PI / 2
              ? hit.angle + Math.PI / 2
              : hit.angle - Math.PI / 2;
          const pull = 1 - hit.dist / p.captureRadius;
          heading = steer(heading, perp, clamp(pull * 0.85, 0, 0.85));
          if (hit.dist <= step) {
            const arrive = hit.dist > 1e-6 ? Math.atan2(hit.py - tip.y, hit.px - tip.x) : heading;
            pushSegment(tip, hit.px, hit.py);
            junctions.push({
              x: hit.px,
              y: hit.py,
              angleDiffDeg: axialDiffDeg(arrive, hit.angle),
              generation: g,
            });
            setEnd('junction');
            continue;
          }
        }

        tip.heading = heading;
        const nx = tip.x + Math.cos(heading) * step;
        const ny = tip.y + Math.sin(heading) * step;

        if (!inFrame(nx, ny)) {
          // Clip the last segment to the frame border and stop there.
          const tx = clamp(nx, x0, x1);
          const ty = clamp(ny, y0, y1);
          if (tx !== tip.x || ty !== tip.y) pushSegment(tip, tx, ty);
          setEnd('border');
          continue;
        }
        if (stress(nx, ny) < arrest) {
          setEnd('faded');
          continue;
        }
        pushSegment(tip, nx, ny);
      }
    }

    // Join each crack's two half-polylines: A-end points reversed + seed + B run.
    for (let id = 0; id < cracks.length; id++) {
      if (cracks[id].points.length > 0) continue; // older generation, already joined
      const a = partA[id];
      const b = partB[id];
      cracks[id].points = [...a.slice().reverse(), ...b];
    }
  }

  // Drop stubs — cracks too short to read as anything but dust.
  const minLen = step * 3;
  const kept: FractureCrack[] = [];
  for (const c of cracks) {
    let len = 0;
    for (let i = 1; i < c.points.length; i++) {
      len += Math.hypot(c.points[i].x - c.points[i - 1].x, c.points[i].y - c.points[i - 1].y);
    }
    if (len >= minLen) kept.push(c);
  }

  return { cracks: kept, junctions };
}
