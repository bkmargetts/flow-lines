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
 * Stems are decorated (each toggleable) with leaves, spiral tendrils, and
 * flower rosettes. Every line is tagged with a `layer` (`stem` / `leaf` /
 * `tendril` / `flower`) so a caller can plot each element with its own pen.
 */
import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { createNoise, SimplexNoise } from './noise.js';
import { applyHandDrawnStyle } from './hand-drawn.js';

export type VineMode = 'growth' | 'colonization';
export type VineSeeding = 'painted' | 'scatter' | 'edges' | 'point';

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

  // — decorations —
  leaves?: boolean;
  leafSize?: number;
  /** Arc-length gap between leaves along a stem, px. */
  leafSpacing?: number;
  tendrils?: boolean;
  /** 0..1 chance of a tendril at each leaf node and at stem tips. */
  tendrilProb?: number;
  flowers?: boolean;
  /** 0..1 chance of a flower at a stem tip. */
  flowerProb?: number;
  flowerSize?: number;

  /** Hand-drawn wobble amplitude applied to stems, px (0 = off). */
  wobble?: number;
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

/** Total stems we'll ever produce — keeps branchy presets bounded & fast. */
const STEM_CAP = 4000;

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
    leaves = true,
    leafSize = 16,
    leafSpacing = 28,
    tendrils = true,
    tendrilProb = 0.25,
    flowers = true,
    flowerProb = 0.4,
    flowerSize = 14,
    wobble = 1.2,
  } = options;

  const rng = makeRandom(seed);
  const noise = createNoise(seed);

  const roots = makeRoots(seeding, { width, height, margin }, startPoints, seedCount, rng);

  const stems =
    mode === 'colonization'
      ? colonize(roots, { width, height, margin, stepLength, attractorCount, attractorRadius, killRadius }, rng)
      : growStems(roots, { width, height, margin, stepLength, maxLength, curl, noiseScale, gravitropism, branchProb, maxDepth }, rng, noise);

  // Stems wobble (drawn by hand); crisp decorations are added afterwards so the
  // small leaf/flower loops aren't smeared by the per-stroke wobble.
  const wobbled = applyHandDrawnStyle(
    { lines: stems, width, height, seed },
    { amplitude: wobble, seed }
  ).lines;

  const extras = decorate(stems, { leaves, leafSize, leafSpacing, tendrils, tendrilProb, flowers, flowerProb, flowerSize }, rng);

  return { lines: [...wobbled, ...extras], width, height, seed };
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
        // bottom — climb up
        x = margin + rng() * (width - 2 * margin);
        y = height - margin;
        angle = up;
      } else if (edge === 1) {
        // top — hang down
        x = margin + rng() * (width - 2 * margin);
        y = margin;
        angle = Math.PI / 2;
      } else if (edge === 2) {
        // left — grow right
        x = margin;
        y = margin + rng() * (height - 2 * margin);
        angle = 0;
      } else {
        // right — grow left
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

function growStems(roots: Root[], p: GrowthParams, rng: () => number, noise: SimplexNoise): FlowLine[] {
  const { width, height, margin, stepLength, curl, noiseScale, gravitropism, branchProb, maxDepth } = p;
  const up = -Math.PI / 2;
  const stems: FlowLine[] = [];

  interface Tip {
    x: number;
    y: number;
    angle: number;
    depth: number;
    maxLength: number;
  }
  const stack: Tip[] = roots.map((r) => ({ x: r.x, y: r.y, angle: r.angle, depth: 0, maxLength: p.maxLength }));

  const inBounds = (x: number, y: number) =>
    x >= margin && x <= width - margin && y >= margin && y <= height - margin;

  while (stack.length > 0 && stems.length < STEM_CAP) {
    const tip = stack.pop()!;
    const pts: Point[] = [{ x: tip.x, y: tip.y }];
    let { x, y, angle } = tip;
    const steps = Math.max(2, Math.ceil(tip.maxLength / stepLength));

    for (let i = 0; i < steps; i++) {
      // Curl: simplex value in [-1,1] gently turns the heading. Kept small so
      // the walk meanders instead of integrating into tight coils.
      const n = noise.noise2D(x * noiseScale, y * noiseScale);
      angle += n * curl * 0.3;
      // Gravitropism: a persistent restoring pull toward "up" — always present
      // (a small baseline) so a vine climbs and never spirals back on itself.
      angle = steer(angle, up, 0.04 + gravitropism * 0.13);

      const nx = x + Math.cos(angle) * stepLength;
      const ny = y + Math.sin(angle) * stepLength;
      if (!inBounds(nx, ny)) break;
      x = nx;
      y = ny;
      pts.push({ x, y });

      // Side-branch — turned away, shorter, one level deeper.
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
        });
      }
    }

    if (pts.length >= 2) stems.push({ points: pts, layer: 'stem' });
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

function colonize(roots: Root[], p: ColonizeParams, rng: () => number): FlowLine[] {
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
    // Each live attractor votes for its nearest node within range.
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

    // Grow one new node per influenced node, toward the mean attractor dir.
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

    // Consume attractors reached by any of the new nodes.
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

  return extractChains(nodes);
}

/** Walk the node tree into polylines: a chain starts at a root or just after a
 *  branch point and runs through single-child descendants to the next
 *  branch/tip, including the parent point so segments join. */
function extractChains(nodes: { x: number; y: number; parent: number }[]): FlowLine[] {
  const childCount = new Array(nodes.length).fill(0);
  for (const nd of nodes) if (nd.parent >= 0) childCount[nd.parent]++;
  const firstChild = new Array(nodes.length).fill(-1);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const par = nodes[i].parent;
    if (par >= 0) firstChild[par] = i;
  }

  const chains: FlowLine[] = [];
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
    if (pts.length >= 2) chains.push({ points: pts, layer: 'stem' });
  }
  return chains;
}

// ——— decorations ———

interface DecorParams {
  leaves: boolean;
  leafSize: number;
  leafSpacing: number;
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerProb: number;
  flowerSize: number;
}

/** Arc length of a polyline. */
function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

function decorate(stems: FlowLine[], d: DecorParams, rng: () => number): FlowLine[] {
  const extras: FlowLine[] = [];

  for (const stem of stems) {
    const pts = stem.points;
    if (pts.length < 2) continue;

    // Restraint: skip stubby twigs entirely so decorations stay sparse and
    // deliberate — without this, a dense colonization network (thousands of
    // short chains) buries the drawing under overlapping leaves and flowers.
    const stemLen = polylineLength(pts);
    if (stemLen < d.leafSpacing) continue;

    let arc = 0;
    let nextLeaf = d.leafSpacing * (0.5 + rng());
    let side: 1 | -1 = rng() < 0.5 ? 1 : -1;

    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      arc += seg;
      const dir = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);

      if ((d.leaves || d.tendrils) && arc >= nextLeaf) {
        side = (side === 1 ? -1 : 1) as 1 | -1;
        if (d.leaves) {
          extras.push(...makeLeaf(pts[i], dir, side, d.leafSize * (0.7 + rng() * 0.6)));
        }
        if (d.tendrils && rng() < d.tendrilProb) {
          extras.push(makeTendril(pts[i], dir, (-side) as 1 | -1, d.leafSize * (1 + rng()), rng));
        }
        nextLeaf += d.leafSpacing * (0.7 + rng() * 0.6);
      }
    }

    // Tip: a flower or a terminal tendril.
    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const tipDir = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    if (d.flowers && rng() < d.flowerProb) {
      extras.push(...makeFlower(tip, d.flowerSize * (0.75 + rng() * 0.5), rng));
    } else if (d.tendrils && rng() < d.tendrilProb) {
      extras.push(makeTendril(tip, tipDir, (rng() < 0.5 ? 1 : -1) as 1 | -1, d.leafSize * (1 + rng()), rng));
    }
  }

  return extras;
}

/** A simple leaf: a pointed teardrop outline plus a midrib, attached at `base`
 *  and angled off the stem on the given side. */
function makeLeaf(base: Point, stemDir: number, side: 1 | -1, size: number): FlowLine[] {
  const leafAngle = stemDir + side * (Math.PI / 3);
  const lx = Math.cos(leafAngle);
  const ly = Math.sin(leafAngle);
  const px = -ly;
  const py = lx;
  const halfWidth = size * 0.4;
  const N = 12;

  const outline: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const bulge = Math.sin(Math.PI * t) * halfWidth;
    outline.push({ x: base.x + lx * size * t + px * bulge, y: base.y + ly * size * t + py * bulge });
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const bulge = Math.sin(Math.PI * t) * halfWidth;
    outline.push({ x: base.x + lx * size * t - px * bulge, y: base.y + ly * size * t - py * bulge });
  }

  const midrib: Point[] = [
    { x: base.x, y: base.y },
    { x: base.x + lx * size, y: base.y + ly * size },
  ];

  return [
    { points: outline, layer: 'leaf' },
    { points: midrib, layer: 'leaf' },
  ];
}

/** A coiling tendril: a spiral that tightens as it curls inward. */
function makeTendril(base: Point, stemDir: number, side: 1 | -1, size: number, rng: () => number): FlowLine {
  const coils = 2 + rng() * 1.5;
  const steps = 48;
  const baseR = size * 0.5;
  // Spiral about a centre offset perpendicular from the stem.
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
  return { points: pts, layer: 'tendril' };
}

/** A small flower: a rosette of petal loops around a centre dot. */
function makeFlower(center: Point, size: number, rng: () => number): FlowLine[] {
  const petals = 5 + Math.floor(rng() * 2);
  const lines: FlowLine[] = [];
  const N = 10;

  for (let k = 0; k < petals; k++) {
    const ang = (k / petals) * 2 * Math.PI + rng() * 0.3;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const px = -dy;
    const py = dx;
    const loop: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const out = Math.sin(Math.PI * t) * size * 0.35;
      loop.push({ x: center.x + dx * size * t + px * out, y: center.y + dy * size * t + py * out });
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const out = Math.sin(Math.PI * t) * size * 0.35;
      loop.push({ x: center.x + dx * size * t - px * out, y: center.y + dy * size * t - py * out });
    }
    lines.push({ points: loop, layer: 'flower' });
  }

  // Centre dot (a small closed ring).
  const dot: Point[] = [];
  const dotR = Math.max(1, size * 0.12);
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * 2 * Math.PI;
    dot.push({ x: center.x + Math.cos(a) * dotR, y: center.y + Math.sin(a) * dotR });
  }
  lines.push({ points: dot, layer: 'flower' });

  return lines;
}
