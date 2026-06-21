import { createNoise } from './noise.js';
import { bandLayerName } from './overlapped-lines.js';
import { optimizePlot } from './optimize.js';
import type { FlowLine, FlowLinesResult, Point } from './flow-lines.js';

/**
 * Leaf venation — open-network space colonization (Runions et al. 2005).
 *
 * Scatter "auxin" attractor sources across a region, then grow a branching
 * tree of nodes: each iteration every attractor pulls its nearest node a step
 * closer, and an attractor is removed once a node reaches it. The result is a
 * connected dendritic network — leaf veins, coral, a bare tree — emitted as
 * long stroked polylines, deterministic per seed and fully plottable.
 *
 * Pure data in, plain `FlowLine[]` out: the web/CLI layer scales millimetres
 * to the page-px this module works in and picks the inks.
 */

export type VenationRegion = 'rect' | 'ellipse' | 'leaf';

export interface VenationOptions {
  /** Page width, px. */
  width: number;
  /** Page height, px. */
  height: number;
  /** Clear border, px (attractors and growth stay inside). Default 0. */
  margin?: number;
  /** Seed for deterministic output. */
  seed?: number;

  /** Auxin attractor sources scattered in the region. Default 800. */
  attractorCount?: number;
  /** Scatter-mask shape. Default 'ellipse'. */
  region?: VenationRegion;

  /** Segment length grown per iteration, px. Default 4. */
  growthStep?: number;
  /** Influence range: an attractor only pulls nodes within this, px. Default 36. */
  attractionDist?: number;
  /** Kill radius: an attractor is consumed when a node is this close, px. Default 8. */
  killDist?: number;
  /** Hard iteration cap so growth always terminates. Default 1500. */
  maxIterations?: number;

  /** Explicit start nodes (e.g. painted). Default: `rootCount` at the region base. */
  roots?: Point[];
  /** Roots scattered along the region base when `roots` is unset. Default 1. */
  rootCount?: number;

  /** Pull growth toward a noise field (0 = pure space colonization). Default 0. */
  directionBias?: number;
  /** Spatial frequency of the bias noise. Default 0.004. */
  biasNoiseScale?: number;

  /** Pen layers (band-NN) that vein depth maps onto. Default 1 (single pen). */
  layerCount?: number;
  /** Tag the trunk-most band 'bold' so it plots thicker. Default true. */
  boldTrunk?: boolean;
  /** Drop polylines shorter than this, px. Default 0. */
  minBranchLength?: number;
  /** Chain + reorder strokes to cut pen-up travel. Default true. */
  optimize?: boolean;
}

interface VNode {
  x: number;
  y: number;
  /** Index into `nodes`, or -1 for a root. */
  parent: number;
  /** Hops from the root, for vein-order colouring. */
  depth: number;
}

/** Deterministic LCG, matching the convention used across the toolbox. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * A spatial hash over node positions, bucketed at the attraction distance so
 * "nearest node to this attractor" only touches the 3×3 neighbouring cells.
 * Mirrors the ProximityGrid pattern in flow-lines.ts, but returns the index of
 * the nearest stored node rather than a boolean.
 */
class NodeGrid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: number[][];

  constructor(width: number, height: number, cell: number) {
    this.cell = Math.max(1, cell);
    this.cols = Math.max(1, Math.ceil(width / this.cell));
    this.rows = Math.max(1, Math.ceil(height / this.cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  private cx(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
  }
  private cy(y: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
  }

  add(index: number, x: number, y: number): void {
    this.buckets[this.cy(y) * this.cols + this.cx(x)].push(index);
  }

  /** Index of the nearest stored node within `maxDist` of (x, y), or -1, with
   *  its squared distance in `out`. */
  nearest(x: number, y: number, maxDist: number, nodes: VNode[], out: { d2: number }): number {
    const cx = this.cx(x);
    const cy = this.cy(y);
    const max2 = maxDist * maxDist;
    let best = -1;
    let bestD2 = max2;
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        for (const idx of this.buckets[gy * this.cols + gx]) {
          const dx = nodes[idx].x - x;
          const dy = nodes[idx].y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = idx;
          }
        }
      }
    }
    out.d2 = bestD2;
    return best;
  }
}

/** Is point (x, y) inside the scatter region of an inset box? */
function inRegion(region: VenationRegion, x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (region === 'rect') return true;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  if (rx <= 0 || ry <= 0) return false;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  if (region === 'ellipse') return nx * nx + ny * ny <= 1;
  // 'leaf': a lens pointed at top and bottom — half-width follows sin(π·t).
  const t = (ny + 1) / 2; // 0 at top tip, 1 at bottom tip
  return Math.abs(nx) <= Math.sin(Math.PI * t);
}

export function generateVenation(options: VenationOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 0,
    seed = Math.floor(Math.random() * 1000000),
    attractorCount = 800,
    region = 'ellipse',
    growthStep = 4,
    attractionDist = 36,
    killDist = 8,
    maxIterations = 1500,
    roots,
    rootCount = 1,
    directionBias = 0,
    biasNoiseScale = 0.004,
    layerCount = 1,
    boldTrunk = true,
    minBranchLength = 0,
    optimize = true,
  } = options;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  const empty: FlowLinesResult = { lines: [], width, height, seed };
  if (x1 <= x0 || y1 <= y0) return empty;

  const rand = makeRandom(seed);
  const noise = directionBias > 0 ? createNoise(seed) : null;

  // 1. Scatter attractors uniformly, rejection-masked by the region.
  const attractors: { x: number; y: number; reached: boolean }[] = [];
  const maxTries = attractorCount * 40;
  let tries = 0;
  while (attractors.length < attractorCount && tries < maxTries) {
    tries++;
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    if (inRegion(region, x, y, x0, y0, x1, y1)) attractors.push({ x, y, reached: false });
  }
  if (attractors.length === 0) return empty;

  // 2. Seed roots along the region base (bottom), or use the explicit ones.
  const nodes: VNode[] = [];
  const grid = new NodeGrid(width, height, Math.max(attractionDist, 1));
  const addNode = (x: number, y: number, parent: number, depth: number): number => {
    const idx = nodes.length;
    nodes.push({ x, y, parent, depth });
    grid.add(idx, x, y);
    return idx;
  };
  if (roots && roots.length > 0) {
    for (const r of roots) addNode(r.x, r.y, -1, 0);
  } else {
    const n = Math.max(1, rootCount);
    const baseY = y1 - 1e-3;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (x0 + x1) / 2 : x0 + ((i + 1) / (n + 1)) * (x1 - x0);
      addNode(x, baseY, -1, 0);
    }
  }

  // 3. Grow. Each iteration: every live attractor pulls its nearest node; each
  //    influenced node sprouts one child toward the summed pull. Attractors
  //    within killDist are consumed. Terminates when nothing grows.
  const out = { d2: 0 };
  for (let iter = 0; iter < maxIterations; iter++) {
    const pull = new Map<number, { x: number; y: number }>();
    let live = 0;
    for (const a of attractors) {
      if (a.reached) continue;
      live++;
      const near = grid.nearest(a.x, a.y, attractionDist, nodes, out);
      if (near < 0) continue;
      if (out.d2 <= killDist * killDist) {
        a.reached = true;
        continue;
      }
      const node = nodes[near];
      const dx = a.x - node.x;
      const dy = a.y - node.y;
      const len = Math.hypot(dx, dy) || 1;
      const acc = pull.get(near) ?? { x: 0, y: 0 };
      acc.x += dx / len;
      acc.y += dy / len;
      pull.set(near, acc);
    }
    if (live === 0) break;

    let grew = false;
    for (const [idx, acc] of pull) {
      let dx = acc.x;
      let dy = acc.y;
      let len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      dx /= len;
      dy /= len;
      if (noise) {
        const node = nodes[idx];
        const angle = noise.noise2D(node.x * biasNoiseScale, node.y * biasNoiseScale) * Math.PI;
        const bx = Math.cos(angle);
        const by = Math.sin(angle);
        dx = dx * (1 - directionBias) + bx * directionBias;
        dy = dy * (1 - directionBias) + by * directionBias;
        len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
      }
      const parent = nodes[idx];
      const nx = Math.max(x0, Math.min(x1, parent.x + dx * growthStep));
      const ny = Math.max(y0, Math.min(y1, parent.y + dy * growthStep));
      addNode(nx, ny, idx, parent.depth + 1);
      grew = true;
    }
    if (!grew) break;
  }

  // 4. Walk the tree into long polylines: a chain runs from a root (or a branch
  //    off-shoot) through single-child nodes until the next branch or tip. Each
  //    off-shoot prepends its parent point so the network stays connected.
  const children: number[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].parent >= 0) children[nodes[i].parent].push(i);
  }
  let maxDepth = 0;
  for (const node of nodes) if (node.depth > maxDepth) maxDepth = node.depth;

  const bandFor = (depth: number): number => {
    if (layerCount <= 1 || maxDepth <= 0) return 0;
    return Math.min(layerCount - 1, Math.floor((depth / maxDepth) * layerCount));
  };

  const lines: FlowLine[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isStart = node.parent < 0 || children[node.parent].length > 1;
    if (!isStart) continue;
    const pts: Point[] = [];
    if (node.parent >= 0) pts.push({ x: nodes[node.parent].x, y: nodes[node.parent].y });
    let cur = i;
    pts.push({ x: nodes[cur].x, y: nodes[cur].y });
    while (children[cur].length === 1) {
      cur = children[cur][0];
      pts.push({ x: nodes[cur].x, y: nodes[cur].y });
    }
    if (pts.length < 2) continue;
    if (minBranchLength > 0) {
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      if (len < minBranchLength) continue;
    }
    const band = bandFor(node.depth);
    const line: FlowLine = { points: pts, layer: bandLayerName(band) };
    if (boldTrunk && band === 0) line.pen = 'bold';
    lines.push(line);
  }

  const result: FlowLinesResult = { lines, width, height, seed };
  return optimize ? optimizePlot(result, { mergeTolerance: growthStep * 0.6 }) : result;
}
