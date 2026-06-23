/**
 * Vine generator — procedurally grown, plottable pen-and-ink vines. Pure,
 * ML-free, DOM-free, deterministic per seed (like every other core generator).
 *
 * Two growth models, switchable:
 *   - `growth`        — recursive tip-growth steered by a simplex curl field,
 *                       with an upward gravitropism bias and stochastic
 *                       side-branches. The classic climbing-vine look.
 *   - `colonization`  — Runions-style space colonization: attractor points pull
 *                       branches toward them and are consumed as they're
 *                       reached, growing a space-filling venation/ivy network.
 *
 * Vines and leaves are drawn as *solid filled ribbons*: every shape is an axis
 * polyline plus a half-width profile, rendered the plottable way — a continuous
 * tapered outline plus parallel single-pen fill passes between the two edges
 * (never stroke-width). Vines taper thick→thin from base to tip; leaves are
 * organic, varied, filled silhouettes attached to the stem by a stalk. Growth
 * and decoration both avoid existing geometry so marks don't overlap.
 *
 * Every line is tagged with a `layer` (`stem` / `leaf` / `tendril` / `flower`)
 * so a caller can plot each element with its own pen.
 */
import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { createNoise, SimplexNoise } from './noise.js';
import { applyHandDrawnStyle } from './hand-drawn.js';

export type VineMode = 'growth' | 'colonization';
export type VineSeeding = 'painted' | 'scatter' | 'edges' | 'point';
/** How a vine body is inked: `solid` filled, `outline` (hollow cane/tube), or
 *  `highlight` (filled but for a thin uninked line down one side). */
export type VineFill = 'solid' | 'outline' | 'highlight';
/** How a leaf is inked: `solid` filled silhouette, `outline` only, or `veined`
 *  (outline with a midrib + side veins). */
export type LeafStyle = 'solid' | 'outline' | 'veined';

export interface VinesOptions {
  width: number;
  height: number;
  /** Clean-paper border kept clear of growth, in px. */
  margin?: number;
  seed?: number;
  mode?: VineMode;
  seeding?: VineSeeding;
  /** Roots for `painted`/`point` seeding, in px (page coordinates). */
  startPoints?: Point[];
  /** Roots scattered / placed along edges for `scatter`/`edges`. */
  seedCount?: number;

  // — growth model —
  /** Distance advanced per growth step, px. */
  stepLength?: number;
  /** Arc length a primary stem grows before stopping, px. */
  maxLength?: number;
  /** 0..1 how strongly the curl field bends the stem (wiggliness). */
  curl?: number;
  /** Spatial frequency of the curl field (per px). */
  noiseScale?: number;
  /** 0..1 upward bias — vines climb toward the top of the sheet. */
  gravitropism?: number;
  /** 0..1 per-step chance of spawning a side-branch. */
  branchProb?: number;
  /** Maximum branch recursion depth. */
  maxDepth?: number;

  // — space colonization —
  attractorCount?: number;
  /** Influence radius: an attractor only pulls nodes within this, px. */
  attractorRadius?: number;
  /** A node within this of an attractor consumes it, px. */
  killRadius?: number;

  // — vine body —
  /** Full vine width at the base (px); tapers to ~one pen toward the tip. */
  stemWidth?: number;
  /** Pen line width / fill-pass spacing (px) — solid fill packs at this gap. */
  penWidth?: number;
  /** 0..1 how aggressively the vine narrows toward the tip. */
  taper?: number;
  /** How the vine body is inked (solid / hollow outline / highlight). */
  vineFill?: VineFill;

  // — overlap avoidance —
  avoidOverlap?: boolean;
  /** Minimum gap kept between separate vine centerlines, px. */
  spacing?: number;

  // — decorations —
  leaves?: boolean;
  /** How leaves are inked (solid / outline / veined). */
  leafStyle?: LeafStyle;
  /** Leaf blade length, px. */
  leafSize?: number;
  /** Leaf width as a fraction of its length (0..1). */
  leafWidthRatio?: number;
  /** Arc-length gap between leaves along a stem, px. */
  leafSpacing?: number;
  tendrils?: boolean;
  /** 0..1 chance of a tendril at each leaf node and at stem tips. */
  tendrilProb?: number;
  flowers?: boolean;
  /** 0..1 chance of a flower at a stem tip. */
  flowerProb?: number;
  flowerSize?: number;

  /** Hand-drawn wobble amplitude applied to stem centerlines, px (0 = off). */
  wobble?: number;
}

/** A grown stem: a centerline plus the half-width it carries at its base. */
interface Stem {
  points: Point[];
  baseHalf: number;
}

/** A growth root: a position and an initial heading (radians, screen space —
 *  −π/2 is straight up). */
interface Root {
  x: number;
  y: number;
  angle: number;
}

/** Deterministic LCG, the same one used across the core generators. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Steer `angle` a fraction `amount` toward `target`, by the short way round. */
function steer(angle: number, target: number, amount: number): number {
  let d = target - angle;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return angle + d * amount;
}

/** A uniform spatial-hash grid for "is anything within `dist` of here?"
 *  queries — the same proximity test the evenly-spaced streamliner uses
 *  (flow-lines.ts). Cell size = the query distance, so a check touches a 3×3
 *  neighbourhood. */
class ProximityGrid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: Point[][];

  constructor(width: number, height: number, cell: number) {
    this.cell = Math.max(1, cell);
    this.cols = Math.max(1, Math.ceil(width / this.cell));
    this.rows = Math.max(1, Math.ceil(height / this.cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  add(p: Point): void {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / this.cell)));
    this.buckets[cy * this.cols + cx].push(p);
  }

  /** True if any stored point lies within `dist` of (x, y). */
  hasNear(x: number, y: number, dist: number): boolean {
    const d2 = dist * dist;
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        for (const p of this.buckets[gy * this.cols + gx]) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  }
}

/** Resample a polyline to ~`step`-spaced points (endpoints kept). */
function densify(points: Point[], step: number): Point[] {
  if (points.length === 0) return [];
  const s = Math.max(0.5, step);
  const out: Point[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(segLen / s));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Light moving-average smoothing with fixed endpoints — turns the stepped
 *  growth tracks into flowing curves. */
function smoothPolyline(points: Point[], iterations: number): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Point[] = new Array(pts.length);
    out[0] = { ...pts[0] };
    out[pts.length - 1] = { ...pts[pts.length - 1] };
    for (let i = 1; i < pts.length - 1; i++) {
      out[i] = {
        x: (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4,
        y: (pts[i - 1].y + 2 * pts[i].y + pts[i + 1].y) / 4,
      };
    }
    pts = out;
  }
  return pts;
}

/** Per-point unit normals (perpendicular to the local tangent). */
function normalsOf(points: Point[]): Point[] {
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = { x: -ty / len, y: tx / len };
  }
  return out;
}

/** Polyline arc length. */
function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/**
 * Render an axis + half-width profile as a filled shape: a continuous tapered
 * outline plus, for `solid`/`highlight`, parallel single-pen fill passes between
 * the two edges. `halfWidthAt(t)` takes a normalized arc position t∈[0,1].
 * Everything stays plottable with one pen — the "thickness" is built geometry,
 * not stroke width.
 *   - `solid`     — outline + full fill.
 *   - `outline`   — the tapered outline only (hollow).
 *   - `highlight` — solid, but a thin uninked margin is left inside the +normal
 *                   edge (a woodcut/engraving highlight suggesting roundness).
 */
function ribbon(
  axis: Point[],
  halfWidthAt: (t: number) => number,
  penPx: number,
  layer: string,
  mode: VineFill = 'solid'
): FlowLine[] {
  const samples = densify(axis, penPx);
  const n = samples.length;
  if (n < 2) return [];

  const cum: number[] = new Array(n);
  cum[0] = 0;
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  const total = cum[n - 1] || 1;
  const normals = normalsOf(samples);
  const w: number[] = new Array(n);
  let maxHalf = 0;
  for (let i = 0; i < n; i++) {
    w[i] = Math.max(0, halfWidthAt(cum[i] / total));
    if (w[i] > maxHalf) maxHalf = w[i];
  }

  const lines: FlowLine[] = [];

  // Continuous tapered outline (left edge forward, right edge back, closed).
  const outline: Point[] = new Array(2 * n + 1);
  for (let i = 0; i < n; i++) {
    outline[i] = { x: samples[i].x + normals[i].x * w[i], y: samples[i].y + normals[i].y * w[i] };
    const j = n - 1 - i;
    outline[n + i] = { x: samples[j].x - normals[j].x * w[j], y: samples[j].y - normals[j].y * w[j] };
  }
  outline[2 * n] = { ...outline[0] };
  lines.push({ points: outline, layer, pen: 'bold' });

  if (mode === 'outline') return lines;

  // Solid fill: the centerline (d=0) plus offset passes either side, each broken
  // into the runs where the local width still supports that offset — so passes
  // shorten toward the tip and the taper falls out for free. For `highlight`,
  // positive-side passes within a pen of the edge are dropped, leaving a thin
  // uninked highlight line down that side.
  const gap = mode === 'highlight' ? penPx * 1.6 : 0;
  for (let k = 0; k * penPx <= maxHalf + 1e-6; k++) {
    const offsets = k === 0 ? [0] : [k * penPx, -k * penPx];
    for (const d of offsets) {
      const ad = Math.abs(d);
      let run: Point[] = [];
      for (let i = 0; i < n; i++) {
        const fits = ad <= w[i] + 1e-6 && !(d > 0 && gap > 0 && w[i] - d < gap);
        if (fits) {
          run.push({ x: samples[i].x + normals[i].x * d, y: samples[i].y + normals[i].y * d });
        } else if (run.length >= 2) {
          lines.push({ points: run, layer, pen: 'bold' });
          run = [];
        } else {
          run = [];
        }
      }
      if (run.length >= 2) lines.push({ points: run, layer, pen: 'bold' });
    }
  }

  return lines;
}

/** Total fill lines we'll ever emit — keeps dense presets bounded & fast. */
const STEM_CAP = 4000;
const LINE_CAP = 80000;

export function generateVines(options: VinesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 20,
    seed = Math.floor(Math.random() * 1000000),
    mode = 'growth',
    seeding = 'scatter',
    startPoints = [],
    seedCount = 6,
    stepLength = 6,
    maxLength = 320,
    curl = 0.5,
    noiseScale = 0.004,
    gravitropism = 0.4,
    branchProb = 0.04,
    maxDepth = 4,
    attractorCount = 600,
    attractorRadius = 90,
    killRadius = 16,
    stemWidth = 6,
    penWidth = 1,
    taper = 0.85,
    vineFill = 'solid',
    avoidOverlap = true,
    leaves = true,
    leafStyle = 'solid',
    leafSize = 22,
    leafWidthRatio = 0.5,
    leafSpacing = 30,
    tendrils = true,
    tendrilProb = 0.12,
    flowers = true,
    flowerProb = 0.2,
    flowerSize = 12,
    wobble = 1.2,
  } = options;

  const penPx = Math.max(0.6, penWidth);
  const baseHalf = Math.max(penPx, stemWidth / 2);
  const spacing = options.spacing ?? stemWidth + penPx * 2;

  const rng = makeRandom(seed);
  const noise = createNoise(seed);

  const roots = makeRoots(seeding, { width, height, margin }, startPoints, seedCount, rng);

  // Growth-time avoidance grid (growth mode self/other-stem separation).
  const growthGrid = new ProximityGrid(width, height, Math.max(1, spacing));

  const rawStems: Stem[] =
    mode === 'colonization'
      ? colonize(
          roots,
          { width, height, margin, stepLength, attractorCount, attractorRadius, killRadius },
          rng,
          baseHalf,
          penPx,
          maxLength
        )
      : growStems(
          roots,
          { width, height, margin, stepLength, maxLength, curl, noiseScale, gravitropism, branchProb, maxDepth },
          rng,
          noise,
          baseHalf,
          avoidOverlap ? growthGrid : null,
          spacing
        );

  // Smooth then wobble the centerlines (so all fill passes share one wobble),
  // before thickening them into solid ribbons.
  const centerlines = rawStems.map((s) => smoothPolyline(s.points, 2));
  const wobbled = applyHandDrawnStyle(
    { lines: centerlines.map((points) => ({ points })), width, height, seed },
    { amplitude: wobble, seed }
  ).lines;

  // Occupancy grid for decoration placement: built from the final vine bodies so
  // leaves/tendrils/flowers don't sit on top of stems — or each other.
  const decorGrid = new ProximityGrid(width, height, Math.max(1, penPx * 2));

  const stemLines: FlowLine[] = [];
  centerlines.forEach((_, i) => {
    const center = wobbled[i].points;
    const base = rawStems[i].baseHalf;
    const tipHalf = Math.max(penPx * 0.5, base * 0.12);
    const fill = ribbon(center, (t) => base + (tipHalf - base) * smoothstep(Math.pow(t, 1 - taper * 0.5)), penPx, 'stem', vineFill);
    for (const ln of fill) {
      stemLines.push(ln);
      for (const p of ln.points) decorGrid.add(p);
    }
  });

  const extras = decorate(
    wobbled.map((l) => l.points),
    { leaves, leafStyle, leafSize, leafWidthRatio, leafSpacing, tendrils, tendrilProb, flowers, flowerProb, flowerSize, penPx },
    rng,
    decorGrid
  );

  return { lines: [...stemLines, ...extras], width, height, seed };
}

/** Smoothstep ease 0..1. */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// ——— seeding ———

function makeRoots(
  seeding: VineSeeding,
  page: { width: number; height: number; margin: number },
  startPoints: Point[],
  seedCount: number,
  rng: () => number
): Root[] {
  const { width, height, margin } = page;
  const up = -Math.PI / 2;
  const jitter = () => (rng() - 0.5) * 0.5;

  if (seeding === 'painted') {
    return startPoints.map((p) => ({ x: p.x, y: p.y, angle: up + jitter() }));
  }
  if (seeding === 'point') {
    const p = startPoints[0] ?? { x: width / 2, y: height - margin };
    return [{ x: p.x, y: p.y, angle: up }];
  }
  if (seeding === 'edges') {
    const roots: Root[] = [];
    for (let i = 0; i < seedCount; i++) {
      const edge = Math.floor(rng() * 4);
      let x: number;
      let y: number;
      let angle: number;
      if (edge === 0) {
        x = margin + rng() * (width - 2 * margin);
        y = height - margin;
        angle = up;
      } else if (edge === 1) {
        x = margin + rng() * (width - 2 * margin);
        y = margin;
        angle = Math.PI / 2;
      } else if (edge === 2) {
        x = margin;
        y = margin + rng() * (height - 2 * margin);
        angle = 0;
      } else {
        x = width - margin;
        y = margin + rng() * (height - 2 * margin);
        angle = Math.PI;
      }
      roots.push({ x, y, angle: angle + jitter() });
    }
    return roots;
  }
  // scatter
  const roots: Root[] = [];
  for (let i = 0; i < seedCount; i++) {
    roots.push({
      x: margin + rng() * (width - 2 * margin),
      y: margin + rng() * (height - 2 * margin),
      angle: up + jitter(),
    });
  }
  return roots;
}

// ——— growth model: recursive tip-growth ———

interface GrowthParams {
  width: number;
  height: number;
  margin: number;
  stepLength: number;
  maxLength: number;
  curl: number;
  noiseScale: number;
  gravitropism: number;
  branchProb: number;
  maxDepth: number;
}

function growStems(
  roots: Root[],
  p: GrowthParams,
  rng: () => number,
  noise: SimplexNoise,
  baseHalf: number,
  grid: ProximityGrid | null,
  spacing: number
): Stem[] {
  const { width, height, margin, stepLength, curl, noiseScale, gravitropism, branchProb, maxDepth } = p;
  const up = -Math.PI / 2;
  const stems: Stem[] = [];

  interface Tip {
    x: number;
    y: number;
    angle: number;
    depth: number;
    maxLength: number;
    half: number;
  }
  const stack: Tip[] = roots.map((r) => ({ x: r.x, y: r.y, angle: r.angle, depth: 0, maxLength: p.maxLength, half: baseHalf }));

  const inBounds = (x: number, y: number) =>
    x >= margin && x <= width - margin && y >= margin && y <= height - margin;

  // A growing tip ignores collisions until it has cleared its origin (so a fresh
  // branch can leave its parent stem before it starts avoiding geometry).
  const clearDist = spacing * 1.6;
  const sepDist = spacing * 0.5;

  while (stack.length > 0 && stems.length < STEM_CAP) {
    const tip = stack.pop()!;
    const pts: Point[] = [{ x: tip.x, y: tip.y }];
    let { x, y, angle } = tip;
    const startX = tip.x;
    const startY = tip.y;
    const steps = Math.max(2, Math.ceil(tip.maxLength / stepLength));
    const toInsert: Point[] = [];

    for (let i = 0; i < steps; i++) {
      const n = noise.noise2D(x * noiseScale, y * noiseScale);
      angle += n * curl * 0.3;
      angle = steer(angle, up, 0.04 + gravitropism * 0.13);

      const nx = x + Math.cos(angle) * stepLength;
      const ny = y + Math.sin(angle) * stepLength;
      if (!inBounds(nx, ny)) break;

      const cleared = Math.hypot(nx - startX, ny - startY) > clearDist;
      if (grid && cleared && grid.hasNear(nx, ny, sepDist)) break;

      x = nx;
      y = ny;
      pts.push({ x, y });
      if (grid && cleared) toInsert.push({ x, y });

      if (
        tip.depth < maxDepth &&
        stack.length + stems.length < STEM_CAP &&
        rng() < branchProb
      ) {
        const turn = (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.6);
        stack.push({
          x,
          y,
          angle: angle + turn,
          depth: tip.depth + 1,
          maxLength: tip.maxLength * (0.5 + rng() * 0.25),
          half: Math.max(0.6, tip.half * 0.62),
        });
      }
    }

    if (pts.length >= 2) {
      stems.push({ points: pts, baseHalf: tip.half });
      // Register the whole accepted stem so later stems avoid all of it.
      if (grid) for (const q of toInsert) grid.add(q);
    }
  }

  return stems;
}

// ——— space colonization (Runions) ———

interface ColonizeParams {
  width: number;
  height: number;
  margin: number;
  stepLength: number;
  attractorCount: number;
  attractorRadius: number;
  killRadius: number;
}

function colonize(
  roots: Root[],
  p: ColonizeParams,
  rng: () => number,
  baseHalf: number,
  penPx: number,
  maxLength: number
): Stem[] {
  const { width, height, margin, stepLength } = p;
  const attractorCount = Math.min(p.attractorCount, 1500);
  const arSq = p.attractorRadius * p.attractorRadius;
  const krSq = p.killRadius * p.killRadius;

  const attractors: { x: number; y: number; alive: boolean }[] = [];
  for (let i = 0; i < attractorCount; i++) {
    attractors.push({
      x: margin + rng() * (width - 2 * margin),
      y: margin + rng() * (height - 2 * margin),
      alive: true,
    });
  }

  interface Node {
    x: number;
    y: number;
    parent: number;
  }
  const nodes: Node[] = roots.map((r) => ({ x: r.x, y: r.y, parent: -1 }));

  const MAX_ITER = 600;
  const NODE_CAP = 6000;
  for (let iter = 0; iter < MAX_ITER && nodes.length < NODE_CAP; iter++) {
    const influence = new Map<number, { dx: number; dy: number }>();
    let any = false;
    for (const a of attractors) {
      if (!a.alive) continue;
      let best = -1;
      let bestD = arSq;
      for (let n = 0; n < nodes.length; n++) {
        const dx = a.x - nodes[n].x;
        const dy = a.y - nodes[n].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      if (best >= 0) {
        any = true;
        const nd = nodes[best];
        let dx = a.x - nd.x;
        let dy = a.y - nd.y;
        const L = Math.hypot(dx, dy) || 1;
        dx /= L;
        dy /= L;
        const inf = influence.get(best) ?? { dx: 0, dy: 0 };
        inf.dx += dx;
        inf.dy += dy;
        influence.set(best, inf);
      }
    }
    if (!any) break;

    const base = nodes.length;
    for (const [ni, inf] of influence) {
      const L = Math.hypot(inf.dx, inf.dy) || 1;
      const nd = nodes[ni];
      nodes.push({
        x: nd.x + (inf.dx / L) * stepLength,
        y: nd.y + (inf.dy / L) * stepLength,
        parent: ni,
      });
      if (nodes.length >= NODE_CAP) break;
    }

    for (const a of attractors) {
      if (!a.alive) continue;
      for (let n = base; n < nodes.length; n++) {
        const dx = a.x - nodes[n].x;
        const dy = a.y - nodes[n].y;
        if (dx * dx + dy * dy < krSq) {
          a.alive = false;
          break;
        }
      }
    }
  }

  return extractChains(nodes, baseHalf, penPx, maxLength);
}

/** Walk the node tree into polylines: a chain starts at a root or just after a
 *  branch point and runs through single-child descendants to the next
 *  branch/tip. Width scales with chain length (longer chains read as trunks). */
function extractChains(
  nodes: { x: number; y: number; parent: number }[],
  baseHalf: number,
  penPx: number,
  longLen: number
): Stem[] {
  const childCount = new Array(nodes.length).fill(0);
  for (const nd of nodes) if (nd.parent >= 0) childCount[nd.parent]++;
  const firstChild = new Array(nodes.length).fill(-1);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const par = nodes[i].parent;
    if (par >= 0) firstChild[par] = i;
  }

  const stems: Stem[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const par = nodes[i].parent;
    const beginsBranch = par < 0 || childCount[par] > 1;
    if (!beginsBranch) continue;

    const pts: Point[] = [];
    if (par >= 0) pts.push({ x: nodes[par].x, y: nodes[par].y });
    let cur = i;
    pts.push({ x: nodes[cur].x, y: nodes[cur].y });
    while (childCount[cur] === 1) {
      cur = firstChild[cur];
      pts.push({ x: nodes[cur].x, y: nodes[cur].y });
    }
    if (pts.length >= 2) {
      const len = polylineLength(pts);
      const frac = Math.min(1, Math.sqrt(len / Math.max(1, longLen)));
      stems.push({ points: pts, baseHalf: penPx + (baseHalf - penPx) * frac });
    }
  }
  return stems;
}

// ——— decorations ———

interface DecorParams {
  leaves: boolean;
  leafStyle: LeafStyle;
  leafSize: number;
  leafWidthRatio: number;
  leafSpacing: number;
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerProb: number;
  flowerSize: number;
  penPx: number;
}

function decorate(stems: Point[][], d: DecorParams, rng: () => number, grid: ProximityGrid): FlowLine[] {
  const extras: FlowLine[] = [];

  for (const pts of stems) {
    if (pts.length < 2) continue;
    const stemLen = polylineLength(pts);
    // Restraint: skip stubby twigs so dense networks stay sparse and deliberate.
    if (stemLen < d.leafSpacing) continue;

    let arc = 0;
    let nextLeaf = d.leafSpacing * (0.5 + rng());
    let side: 1 | -1 = rng() < 0.5 ? 1 : -1;

    for (let i = 1; i < pts.length && extras.length < LINE_CAP; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      arc += seg;
      const dir = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);

      if (arc >= nextLeaf) {
        side = (side === 1 ? -1 : 1) as 1 | -1;
        // Leaves larger near the base, smaller toward the tip.
        const along = arc / stemLen;
        const sizeScale = 0.6 + 0.6 * (1 - along);

        if (d.leaves) {
          placeLeaf(extras, grid, pts[i], dir, side, d, sizeScale, rng);
        }
        if (d.tendrils && rng() < d.tendrilProb) {
          placeTendril(extras, grid, pts[i], dir, (-side) as 1 | -1, d.leafSize * (1 + rng()), d.penPx, rng);
        }
        nextLeaf += d.leafSpacing * (0.7 + rng() * 0.6);
      }
    }

    // Tip: a flower or a terminal tendril.
    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const tipDir = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    if (d.flowers && rng() < d.flowerProb) {
      placeFlower(extras, grid, tip, d.flowerSize * (0.75 + rng() * 0.5), d.penPx, rng);
    } else if (d.tendrils && rng() < d.tendrilProb) {
      placeTendril(extras, grid, tip, tipDir, (rng() < 0.5 ? 1 : -1) as 1 | -1, d.leafSize * (1 + rng()), d.penPx, rng);
    }
  }

  return extras;
}

/** Test a set of points against the grid (ignoring those near `anchor`, which
 *  legitimately touch the stem), and register them all if clear. */
function tryPlace(
  lines: FlowLine[],
  grid: ProximityGrid,
  candidate: FlowLine[],
  anchor: Point,
  anchorSkip: number,
  clearance: number
): boolean {
  const skip2 = anchorSkip * anchorSkip;
  for (const ln of candidate) {
    for (const p of ln.points) {
      const dx = p.x - anchor.x;
      const dy = p.y - anchor.y;
      if (dx * dx + dy * dy < skip2) continue;
      if (grid.hasNear(p.x, p.y, clearance)) return false;
    }
  }
  for (const ln of candidate) {
    lines.push(ln);
    for (const p of ln.points) grid.add(p);
  }
  return true;
}

/** Place an organic filled leaf, retrying once smaller before giving up. */
function placeLeaf(
  lines: FlowLine[],
  grid: ProximityGrid,
  base: Point,
  stemDir: number,
  side: 1 | -1,
  d: DecorParams,
  sizeScale: number,
  rng: () => number
): void {
  // Per-leaf organic variation.
  const spread = (Math.PI / 3) * (0.8 + rng() * 0.6);
  const curl = (rng() - 0.5) * 0.9;
  const widthRatio = d.leafWidthRatio * (0.8 + rng() * 0.5);
  const sharp = 0.6 + rng() * 0.5;

  for (const scale of [sizeScale, sizeScale * 0.6]) {
    const len = d.leafSize * scale;
    if (len < d.penPx * 3) break;
    const leaf = makeLeaf(base, stemDir, side, len, spread, curl, widthRatio, sharp, d.penPx, d.leafStyle);
    if (tryPlace(lines, grid, leaf, base, d.penPx * 2.5, d.penPx)) return;
  }
}

/** A leaf as a ribbon: a short stalk into an asymmetric pointed blade. Inked
 *  solid, outline-only, or with a midrib + side veins per `style`. */
function makeLeaf(
  base: Point,
  stemDir: number,
  side: 1 | -1,
  len: number,
  spread: number,
  curl: number,
  widthRatio: number,
  sharp: number,
  penPx: number,
  style: LeafStyle
): FlowLine[] {
  const baseAngle = stemDir + side * spread;
  const M = 16;
  const axis: Point[] = [{ x: base.x, y: base.y }];
  let x = base.x;
  let y = base.y;
  for (let j = 1; j <= M; j++) {
    const t = j / M;
    const ang = baseAngle + curl * t; // gentle curl gives organic asymmetry
    const step = len / M;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    axis.push({ x, y });
  }

  const maxHalf = len * widthRatio * 0.5;
  const pet = 0.16; // petiole fraction (thin stalk attaching to the stem)
  const halfWidthAt = (t: number): number => {
    if (t < pet) return Math.max(penPx * 0.5, maxHalf * 0.12 * (t / pet));
    const u = (t - pet) / (1 - pet);
    // Pointed-leaf bump: wide mid, tapering to a point at the tip.
    return maxHalf * Math.pow(Math.sin(Math.PI * Math.pow(u, sharp)), 0.85);
  };

  // Solid → filled ribbon; otherwise the outline, plus veins for `veined`.
  const lines = ribbon(axis, halfWidthAt, penPx, 'leaf', style === 'solid' ? 'solid' : 'outline');
  if (style !== 'veined') return lines;

  const samples = densify(axis, penPx);
  const normals = normalsOf(samples);
  const last = samples.length - 1;
  // Midrib (the stalk + spine).
  lines.push({ points: samples.map((p) => ({ ...p })), layer: 'leaf' });
  // A few side veins angling from the midrib toward the blade edge.
  for (const t of [0.32, 0.52, 0.72]) {
    const i = Math.max(1, Math.min(last - 1, Math.round(t * last)));
    const half = halfWidthAt(i / last) * 0.8;
    if (half < penPx) continue;
    const tx = samples[Math.min(i + 1, last)].x - samples[i - 1].x;
    const ty = samples[Math.min(i + 1, last)].y - samples[i - 1].y;
    const tl = Math.hypot(tx, ty) || 1;
    for (const s of [1, -1]) {
      const ex = samples[i].x + normals[i].x * s * half + (tx / tl) * half * 0.5;
      const ey = samples[i].y + normals[i].y * s * half + (ty / tl) * half * 0.5;
      lines.push({ points: [{ x: samples[i].x, y: samples[i].y }, { x: ex, y: ey }], layer: 'leaf' });
    }
  }
  return lines;
}

/** A coiling tendril (thin single line that tightens as it curls inward). */
function placeTendril(
  lines: FlowLine[],
  grid: ProximityGrid,
  base: Point,
  stemDir: number,
  side: 1 | -1,
  size: number,
  penPx: number,
  rng: () => number
): void {
  const coils = 2 + rng() * 1.5;
  const steps = 48;
  const baseR = size * 0.5;
  const cx = base.x + Math.cos(stemDir + side * (Math.PI / 2)) * baseR;
  const cy = base.y + Math.sin(stemDir + side * (Math.PI / 2)) * baseR;
  const phi0 = Math.atan2(base.y - cy, base.x - cx);

  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const phi = phi0 + side * coils * 2 * Math.PI * t;
    const r = baseR * (1 - 0.75 * t);
    pts.push({ x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r });
  }
  tryPlace(lines, grid, [{ points: smoothPolyline(pts, 1), layer: 'tendril' }], base, penPx * 2.5, penPx);
}

/** A small flower: a rosette of filled petals around a filled centre. */
function placeFlower(
  lines: FlowLine[],
  grid: ProximityGrid,
  center: Point,
  size: number,
  penPx: number,
  rng: () => number
): void {
  const petals = 5 + Math.floor(rng() * 2);
  const candidate: FlowLine[] = [];
  const petalLen = size;
  const petalHalf = size * 0.32;

  for (let k = 0; k < petals; k++) {
    const ang = (k / petals) * 2 * Math.PI + rng() * 0.25;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const axis: Point[] = [
      { x: center.x + dx * size * 0.2, y: center.y + dy * size * 0.2 },
      { x: center.x + dx * petalLen, y: center.y + dy * petalLen },
    ];
    candidate.push(...ribbon(axis, (t) => petalHalf * Math.sin(Math.PI * t), penPx, 'flower', 'solid'));
  }
  // Filled centre.
  candidate.push(...filledDisc(center, Math.max(penPx, size * 0.28), penPx, 'flower'));

  // The flower sits on the stem tip, so its whole footprint overlaps that stem
  // end — skip the anchor region (its own radius) and only guard against other
  // decorations beyond it.
  tryPlace(lines, grid, candidate, center, petalLen * 1.2, penPx);
}

/** A solid filled disc as concentric pen rings. */
function filledDisc(center: Point, radius: number, penPx: number, layer: string): FlowLine[] {
  const lines: FlowLine[] = [];
  for (let r = radius; r > 0; r -= penPx) {
    const segs = Math.max(8, Math.round(r * 2));
    const ring: Point[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * 2 * Math.PI;
      ring.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    lines.push({ points: ring, layer, pen: 'bold' });
  }
  return lines;
}
