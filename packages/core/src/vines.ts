/**
 * Vine generator — procedurally grown, plottable pen-and-ink vines aimed at a
 * botanical-illustration look. Pure, ML-free, DOM-free, deterministic per seed.
 *
 * Two growth models, switchable:
 *   - `growth`        — recursive tip-growth steered by a simplex curl field
 *                       (optionally along a composed master gesture) with an
 *                       upward gravitropism bias and stochastic side-branches.
 *   - `colonization`  — Runions-style space colonization: attractor points pull
 *                       branches toward them and are consumed as they're reached.
 *
 * Rendering follows the toolbox's "hatching follows form" house style rather
 * than flat fills. Every drawn thing is an *element* with a closed silhouette
 * and a depth order; a final pass models form with light-directional hatching
 * and removes hidden lines so overlaps read as real depth:
 *   - Stems are rounded tubes: tapered outline + along-axis hatching on the
 *     shadow side.
 *   - Leaves are curved blades with a species shape, branching veins, optional
 *     foreshortening, and shadow hatching.
 *   - The page is composed (a master gesture to a focal point, with negative
 *     space) for the `specimen` composition.
 *
 * Lines are tagged with a `layer` (`stem` / `leaf` / `vein` / `tendril` /
 * `flower`) so a caller can plot each element with its own pen.
 */
import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { createNoise, SimplexNoise } from './noise.js';
import { applyHandDrawnStyle } from './hand-drawn.js';

export type VineMode = 'growth' | 'colonization';
export type VineSeeding = 'painted' | 'scatter' | 'edges' | 'point';
export type VineComposition = 'specimen' | 'free' | 'wreath' | 'border' | 'bouquet' | 'trellis' | 'fill';
/** Region a `fill` composition grows into. */
export type FillShape = 'circle' | 'oval' | 'heart' | 'diamond' | 'painted';
/** How a vine body is inked. */
export type VineFill = 'shaded' | 'solid' | 'outline' | 'highlight';
/** How a leaf is inked. */
export type LeafStyle = 'shaded' | 'veined' | 'outline' | 'solid';
export type LeafType = 'ovate' | 'lance' | 'cordate' | 'lobed' | 'serrate' | 'mixed';
/** How a (thick) stem's tube is shaded. */
export type StemShade = 'none' | 'along' | 'cross';
/** Flower species. */
export type VineFlower = 'rose' | 'daisy' | 'bell' | 'bud' | 'mixed';

export interface VinesOptions {
  width: number;
  height: number;
  margin?: number;
  seed?: number;
  mode?: VineMode;
  /** Page arrangement: a designed single specimen, or free growth from roots. */
  composition?: VineComposition;
  /** Shape a `fill` composition grows into. */
  fillShape?: FillShape;
  seeding?: VineSeeding;
  startPoints?: Point[];
  seedCount?: number;

  // — growth model —
  stepLength?: number;
  maxLength?: number;
  curl?: number;
  noiseScale?: number;
  gravitropism?: number;
  branchProb?: number;
  maxDepth?: number;

  // — space colonization —
  attractorCount?: number;
  attractorRadius?: number;
  killRadius?: number;

  // — vine body —
  stemWidth?: number;
  penWidth?: number;
  taper?: number;
  vineFill?: VineFill;
  avoidOverlap?: boolean;
  spacing?: number;

  // — form shading —
  /** Light source direction, degrees (0 = +x; default top-left). */
  lightAngle?: number;
  /** 0..1 how much shadow hatching to lay down. */
  shadeDensity?: number;
  /** Tube shading style on thick stems. */
  stemShade?: StemShade;
  /** Allow overlap and remove hidden lines for depth (vs flat). */
  occlude?: boolean;
  /** 0..1 hand-sketched overdraw: repeats every line with small variation. */
  sketch?: number;
  /** 0..1 atmospheric perspective: near stems grow larger/bolder/in-front,
   *  far ones smaller/lighter/behind. 0 = flat. */
  perspective?: number;
  /** 0..1 how wide the front→back depth range of the stems is. */
  depthSpread?: number;
  /** 0..1 contact shadows cast by overlapping elements onto what's behind. */
  castShadow?: number;

  // — decorations —
  /** 0..1 overall foliage density (leaf clusters, spacing, bloom frequency). */
  density?: number;
  leaves?: boolean;
  leafStyle?: LeafStyle;
  leafType?: LeafType;
  veins?: boolean;
  leafSize?: number;
  leafWidthRatio?: number;
  leafSpacing?: number;
  tendrils?: boolean;
  tendrilProb?: number;
  flowers?: boolean;
  flowerType?: VineFlower;
  flowerProb?: number;
  flowerSize?: number;

  /** Hand-drawn wobble amplitude applied to stem centerlines, px (0 = off). */
  wobble?: number;
}

/** A grown stem: a centerline, the half-width it carries at its base, whether
 *  it's a side-branch, and its scene depth (0 far … 1 near) for perspective. */
interface Stem {
  points: Point[];
  baseHalf: number;
  branch: boolean;
  zdepth: number;
}

/** A growth root: position, initial heading, the width/length it starts with,
 *  an optional guide curve (the composed master gesture), and scene depth. */
interface Root {
  x: number;
  y: number;
  angle: number;
  half: number;
  maxLength: number;
  guide?: Point[];
  zdepth: number;
}

/** A drawable element: its marks, a closed silhouette for occlusion, and a
 *  depth order (higher = nearer the viewer). */
interface Element {
  lines: FlowLine[];
  silhouette: Point[][];
  z: number;
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

/** Smoothstep ease 0..1. */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** A uniform spatial-hash grid for proximity ("anything within `dist`?") tests
 *  — the evenly-spaced-streamline pattern (flow-lines.ts). */
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

/** A depth buffer of element ids: rasterize silhouettes (front wins), then ask
 *  whether a point is hidden by something nearer. Drives hidden-line removal. */
class ZBuffer {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly z: Float32Array;

  constructor(width: number, height: number, cell: number) {
    this.cell = Math.max(1, cell);
    this.cols = Math.max(1, Math.ceil(width / this.cell));
    this.rows = Math.max(1, Math.ceil(height / this.cell));
    this.z = new Float32Array(this.cols * this.rows).fill(-1);
  }

  /** Scanline-fill a closed polygon, keeping the max z per cell. */
  fill(poly: Point[], z: number): void {
    if (poly.length < 3) return;
    const c = this.cell;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const r0 = Math.max(0, Math.floor(minY / c));
    const r1 = Math.min(this.rows - 1, Math.floor(maxY / c));
    const xs: number[] = [];
    for (let r = r0; r <= r1; r++) {
      const yc = (r + 0.5) * c;
      xs.length = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
          xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const cx0 = Math.max(0, Math.floor(xs[k] / c));
        const cx1 = Math.min(this.cols - 1, Math.floor(xs[k + 1] / c));
        for (let cx = cx0; cx <= cx1; cx++) {
          const idx = r * this.cols + cx;
          if (z > this.z[idx]) this.z[idx] = z;
        }
      }
    }
  }

  /** Stamp only a polygon's outline as a thick band (radius `r` px), keeping
   *  the max z. Background lines then break with just a small gap where they
   *  cross a nearer element's edge — the botanical "interrupt at crossings"
   *  look — instead of a whole filled shape punching a large hole. */
  stampOutline(poly: Point[], z: number, r: number): void {
    const cell = this.cell;
    const rad = Math.max(1, Math.ceil(r / cell));
    const mark = (x: number, y: number) => {
      const ci = Math.floor(x / cell);
      const cj = Math.floor(y / cell);
      for (let dj = -rad; dj <= rad; dj++) {
        const cy = cj + dj;
        if (cy < 0 || cy >= this.rows) continue;
        for (let di = -rad; di <= rad; di++) {
          const cx = ci + di;
          if (cx < 0 || cx >= this.cols) continue;
          if (di * di + dj * dj > rad * rad) continue;
          const idx = cy * this.cols + cx;
          if (z > this.z[idx]) this.z[idx] = z;
        }
      }
    };
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / cell));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        mark(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
  }

  /** True if a point is hidden by an element nearer than `z`. */
  hidden(x: number, y: number, z: number): boolean {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return false;
    return this.z[cy * this.cols + cx] > z + 0.5;
  }

  /** The nearest element's z covering a point, or -1 on bare paper. */
  zAt(x: number, y: number): number {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return -1;
    return this.z[cy * this.cols + cx];
  }
}

/** Contact shadows: where a nearer element sits between a surface and the light,
 *  lay short hatch strokes on that surface (the away-from-light side of the
 *  occluder), so overlapping elements read as casting shadows onto each other. */
function castShadows(
  zbuf: ZBuffer,
  light: Point,
  width: number,
  height: number,
  penPx: number,
  strength: number,
  cap: number
): FlowLine[] {
  const lines: FlowLine[] = [];
  const ang = Math.atan2(light.y, light.x) + Math.PI / 2; // strokes run along the shadow edge
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const dist = penPx * (2.5 + strength * 6); // how far an occluder's shadow reaches
  const spacing = penPx * (1.4 + (1 - strength) * 2.4);
  const cx = width / 2;
  const cy = height / 2;
  const half = Math.hypot(width, height) / 2 + spacing;
  for (let v = -half; v <= half && lines.length < cap; v += spacing) {
    let run: Point[] = [];
    for (let u = -half; u <= half; u += penPx) {
      const x = cx + dx * u + nx * v;
      const y = cy + dy * u + ny * v;
      const zp = zbuf.zAt(x, y);
      const shadowed = zp >= 0 && zbuf.zAt(x + light.x * dist, y + light.y * dist) > zp + 0.5;
      if (shadowed) {
        run.push({ x, y });
      } else if (run.length >= 2) {
        lines.push({ points: run, layer: 'shadow' });
        run = [];
      } else {
        run = [];
      }
    }
    if (run.length >= 2) lines.push({ points: run, layer: 'shadow' });
  }
  return lines;
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

/** Moving-average smoothing with fixed endpoints — flowing curves. */
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

/** Total fill lines we'll ever emit — keeps dense presets bounded & fast. */
const STEM_CAP = 4000;
const LINE_CAP = 90000;

export function generateVines(options: VinesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 20,
    seed = Math.floor(Math.random() * 1000000),
    mode = 'growth',
    composition = 'specimen',
    fillShape = 'circle',
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
    stemWidth = 8,
    penWidth = 1,
    taper = 0.85,
    vineFill = 'shaded',
    avoidOverlap = true,
    lightAngle = -135,
    shadeDensity = 0.5,
    stemShade = 'along',
    occlude = true,
    sketch = 0,
    perspective = 0.4,
    depthSpread = 0.6,
    castShadow = 0.35,
    density = 0.45,
    leaves = true,
    leafStyle = 'shaded',
    leafType = 'ovate',
    veins = true,
    leafSize = 26,
    leafWidthRatio = 0.5,
    leafSpacing = 30,
    tendrils = true,
    tendrilProb = 0.12,
    flowers = true,
    flowerType = 'rose',
    flowerProb = 0.2,
    flowerSize = 12,
    wobble = 0.6,
  } = options;

  const penPx = Math.max(0.6, penWidth);
  const baseHalf = Math.max(penPx, stemWidth / 2);
  const spacing = options.spacing ?? stemWidth + penPx * 2;
  const lr = (lightAngle * Math.PI) / 180;
  const light: Point = { x: Math.cos(lr), y: Math.sin(lr) };

  const rng = makeRandom(seed);
  const noise = createNoise(seed);

  const growthGrid = new ProximityGrid(width, height, Math.max(1, spacing));

  // Composition routes the growth: `fill` colonizes a region; `free` respects
  // the mode/seeding; everything else grows along composed guide curves.
  let rawStems: Stem[];
  let focal: Point | null = null;
  if (composition === 'fill') {
    const region = buildRegion(fillShape, startPoints, width, height, margin);
    const fillRoots: Root[] = region.seeds.map((p) => ({ x: p.x, y: p.y, angle: -Math.PI / 2, half: baseHalf, maxLength, zdepth: 0.5 }));
    rawStems = colonize(fillRoots, { width, height, margin, stepLength, attractorCount: Math.max(attractorCount, 700), attractorRadius, killRadius }, rng, baseHalf, penPx, maxLength, region.inside, depthSpread);
  } else if (composition === 'free' && mode === 'colonization') {
    const roots = makeRoots({ width, height, margin, mode, composition, seeding, startPoints, seedCount, baseHalf, maxLength, depthSpread }, rng);
    rawStems = colonize(roots, { width, height, margin, stepLength, attractorCount, attractorRadius, killRadius }, rng, baseHalf, penPx, maxLength, undefined, depthSpread);
  } else {
    const roots = makeRoots({ width, height, margin, mode, composition, seeding, startPoints, seedCount, baseHalf, maxLength, depthSpread }, rng);
    // The specimen's focal point is the end of its master gesture.
    if (composition === 'specimen' && roots[0]?.guide) focal = roots[0].guide[roots[0].guide.length - 1];
    rawStems = growStems(roots, { width, height, margin, stepLength, curl, noiseScale, gravitropism, branchProb, maxDepth }, rng, noise, avoidOverlap ? growthGrid : null, spacing);
  }

  // Smooth (heavily, for flowing curves) then add a touch of wobble.
  const centerlines = rawStems.map((s) => smoothPolyline(s.points, 3));
  const wobbled = applyHandDrawnStyle(
    { lines: centerlines.map((points) => ({ points })), width, height, seed },
    { amplitude: wobble, wavelength: 90, seed }
  ).lines.map((l) => l.points);

  const elements: Element[] = [];
  // Depth → draw order: with perspective, nearer (higher zdepth) elements sit in
  // front; a small per-add increment breaks ties so a decoration sits over the
  // stem it grew from. Without perspective, plain creation order (stems behind
  // foliage). Depth → scale: nearer elements are larger, farther smaller.
  let zc = 0;
  const zOf = (zdepth: number): number =>
    perspective > 0.01 ? zdepth * 1000 + zc++ * 0.001 : zc++;
  const depthScale = (zdepth: number): number =>
    perspective > 0.01 ? Math.max(0.4, 1 + perspective * (zdepth - 0.5) * 1.1) : 1;
  const add = (lines: FlowLine[], silhouette: Point[][], z: number): void => {
    elements.push({ lines, silhouette, z });
  };

  // Stems (drawn behind the foliage), width scaled by depth.
  wobbled.forEach((center, i) => {
    const st = rawStems[i];
    const built = buildStem(center, st.baseHalf * depthScale(st.zdepth), { penPx, taper, vineFill, light, shadeDensity, stemShade, branch: st.branch });
    add(built.lines, built.silhouette, zOf(st.zdepth));
  });

  const focalR = Math.min(width, height) * 0.24;

  // Decorations (in front of the stem they grew from).
  decorate(
    rawStems.map((s, i) => ({ points: wobbled[i], zdepth: s.zdepth })),
    {
      leaves, leafStyle, leafType, veins, leafSize, leafWidthRatio, leafSpacing,
      tendrils, tendrilProb, flowers, flowerType, flowerProb, flowerSize, penPx, light, shadeDensity,
      focal, focalR, density, perspective,
    },
    rng,
    add,
    depthScale,
    zOf
  );

  // Hidden-line removal: treat every element as a solid object — rasterize its
  // silhouette into a z-buffer (nearest wins) and drop any line beneath a
  // covered area, so things in front cleanly hide what's behind them.
  let outLines: FlowLine[];
  if (occlude) {
    const zbuf = new ZBuffer(width, height, Math.max(1, penPx * 0.75));
    for (const el of elements) for (const poly of el.silhouette) zbuf.fill(poly, el.z);
    outLines = [];
    for (const el of elements) {
      for (const ln of el.lines) {
        for (const run of clipHidden(ln.points, el.z, zbuf)) {
          outLines.push({ ...ln, points: run });
          if (outLines.length >= LINE_CAP) break;
        }
      }
    }
    // Contact shadows from overlapping elements, drawn on top of the surfaces
    // they fall on (they're not themselves occluded).
    if (castShadow > 0.01 && outLines.length < LINE_CAP) {
      for (const s of castShadows(zbuf, light, width, height, penPx, castShadow, LINE_CAP - outLines.length)) {
        outLines.push(s);
      }
    }
  } else {
    outLines = elements.flatMap((el) => el.lines);
  }

  // Sketchy overdraw: redraw every line a few times with low-frequency wobble.
  if (sketch > 0.01 && outLines.length * 3 < LINE_CAP) {
    const passes = 1 + Math.round(sketch * 2);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const styled = applyHandDrawnStyle(
        { lines: outLines, width, height, seed: seed + p * 9301 + 7 },
        { amplitude: 0.5 + sketch * 1.6, wavelength: 28, jitter: sketch * 1.3, seed: seed + p * 9301 + 7 }
      ).lines;
      for (const l of styled) acc.push(l);
    }
    outLines = acc;
  }

  return { lines: outLines, width, height, seed };
}

/** Split a polyline into the runs whose points are not hidden by nearer ones. */
function clipHidden(points: Point[], z: number, zbuf: ZBuffer): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (zbuf.hidden(p.x, p.y, z)) {
      if (run.length >= 2) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

// ——— composition & seeding ———

/** Even-odd point-in-polygon test. */
function pointInPolygon(poly: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** An inside-test + interior seed points for a `fill` composition's region:
 *  a centred built-in shape, or the painted polygon (auto-closed). */
function buildRegion(
  shape: FillShape,
  startPoints: Point[],
  width: number,
  height: number,
  margin: number
): { inside: (x: number, y: number) => boolean; seeds: Point[] } {
  const cx = width / 2;
  const cy = height / 2;
  const rx = (width - 2 * margin) * 0.46;
  const ry = (height - 2 * margin) * 0.46;

  let inside: (x: number, y: number) => boolean;
  if (shape === 'painted' && startPoints.length >= 3) {
    inside = (x, y) => pointInPolygon(startPoints, x, y);
  } else if (shape === 'circle' || shape === 'oval') {
    const ax = shape === 'circle' ? Math.min(rx, ry) : rx;
    const ay = shape === 'circle' ? Math.min(rx, ry) : ry;
    inside = (x, y) => ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2 <= 1;
  } else if (shape === 'diamond') {
    inside = (x, y) => Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
  } else {
    // Heart curve: (x²+y²−1)³ − x²y³ ≤ 0 in normalised, y-up coordinates.
    inside = (x, y) => {
      const nx = (x - cx) / (rx * 1.1);
      const ny = -(y - cy) / (ry * 1.1) + 0.25;
      const a = nx * nx + ny * ny - 1;
      return a * a * a - nx * nx * ny * ny * ny <= 0;
    };
  }

  // Seed points inside the region (centre + interior samples for a stable start).
  const seeds: Point[] = [];
  if (inside(cx, cy)) seeds.push({ x: cx, y: cy });
  let s = 12345;
  for (let i = 0; i < 400 && seeds.length < 4; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = margin + (s / 0x7fffffff) * (width - 2 * margin);
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const y = margin + (s / 0x7fffffff) * (height - 2 * margin);
    if (inside(x, y)) seeds.push({ x, y });
  }
  if (seeds.length === 0) seeds.push({ x: cx, y: cy });
  return { inside, seeds };
}

interface RootOpts {
  width: number;
  height: number;
  margin: number;
  mode: VineMode;
  composition: VineComposition;
  seeding: VineSeeding;
  startPoints: Point[];
  seedCount: number;
  baseHalf: number;
  maxLength: number;
  depthSpread: number;
}

function makeRoots(o: RootOpts, rng: () => number): Root[] {
  const { width, height, margin, baseHalf, maxLength } = o;
  const up = -Math.PI / 2;
  const jitter = () => (rng() - 0.5) * 0.5;
  // A scene depth (0 far … 1 near) spread around the middle by `depthSpread`.
  const zd = () => Math.max(0, Math.min(1, 0.5 + (rng() - 0.5) * o.depthSpread));

  // A designed single specimen: a master gesture from a base in the lower third
  // sweeping to a focal point on a rule-of-thirds intersection, leaving the
  // opposite side as negative space.
  if (o.composition === 'specimen' && o.mode === 'growth') {
    const leftFocal = rng() < 0.5;
    const fx = margin + (leftFocal ? 1 / 3 : 2 / 3) * (width - 2 * margin);
    const fy = margin + (0.22 + rng() * 0.16) * (height - 2 * margin);
    const baseFromPaint = o.seeding === 'painted' || o.seeding === 'point' ? o.startPoints[0] : undefined;
    const bx = baseFromPaint?.x ?? margin + (leftFocal ? 0.62 : 0.38) * (width - 2 * margin);
    const by = baseFromPaint?.y ?? height - margin * 1.3;
    // A bowed guide curve base → focal (control point pushed to one side).
    const mx = (bx + fx) / 2 + (leftFocal ? 1 : -1) * (width * 0.12);
    const my = (by + fy) / 2;
    const guide = smoothPolyline([
      { x: bx, y: by },
      { x: (bx + mx) / 2, y: (by + my) / 2 },
      { x: mx, y: my },
      { x: (mx + fx) / 2, y: (my + fy) / 2 },
      { x: fx, y: fy },
    ], 1);
    const startAngle = Math.atan2(guide[1].y - by, guide[1].x - bx);
    // A woody trunk that tapers up the gesture.
    return [{ x: bx, y: by, angle: startAngle, half: baseHalf * 1.5, maxLength: maxLength * 1.7, guide, zdepth: 0.62 }];
  }

  // Build a guided root: a stem that follows a smoothed guide curve.
  const guided = (guide: Point[], half: number): Root => {
    const g = smoothPolyline(guide, 1);
    return { x: g[0].x, y: g[0].y, angle: Math.atan2(g[1].y - g[0].y, g[1].x - g[0].x), half, maxLength: polylineLength(g) * 1.3, guide: g, zdepth: zd() };
  };

  if (o.composition === 'wreath') {
    // Stems run around a ring, each covering an overlapping arc.
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width - 2 * margin, height - 2 * margin) * 0.42;
    const n = Math.max(3, o.seedCount);
    const roots: Root[] = [];
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * 2 * Math.PI + jitter() * 0.3;
      const span = (2 * Math.PI / n) * 1.5;
      const guide: Point[] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const a = a0 + span * (s / steps);
        const rr = R * (1 + 0.05 * Math.sin(a * 3));
        guide.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
      }
      roots.push(guided(guide, baseHalf));
    }
    return roots;
  }

  if (o.composition === 'border') {
    // One stem per edge, running just inside the margin (corners meet). Inset a
    // little extra so the guide stays clear of the in-bounds edge.
    const pad = margin + baseHalf * 2 + 6;
    const x0 = pad;
    const y0 = pad;
    const x1 = width - pad;
    const y1 = height - pad;
    const corners = [
      [{ x: x0, y: y1 }, { x: x0, y: y0 }],
      [{ x: x0, y: y0 }, { x: x1, y: y0 }],
      [{ x: x1, y: y0 }, { x: x1, y: y1 }],
      [{ x: x1, y: y1 }, { x: x0, y: y1 }],
    ];
    return corners.map(([a, b]) => {
      const guide: Point[] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) guide.push({ x: a.x + (b.x - a.x) * (s / steps), y: a.y + (b.y - a.y) * (s / steps) });
      return guided(guide, baseHalf);
    });
  }

  if (o.composition === 'bouquet') {
    // A fan of stems from one low base point.
    const bx = o.startPoints[0]?.x ?? width / 2;
    const by = o.startPoints[0]?.y ?? height - margin * 1.2;
    const n = Math.max(2, o.seedCount);
    const roots: Root[] = [];
    for (let k = 0; k < n; k++) {
      const fx = margin + ((k + 0.5) / n) * (width - 2 * margin);
      const fy = margin + (0.15 + rng() * 0.25) * (height - 2 * margin);
      const mx = (bx + fx) / 2 + (rng() - 0.5) * width * 0.1;
      const my = (by + fy) / 2;
      const guide = smoothPolyline([{ x: bx, y: by }, { x: mx, y: my }, { x: fx, y: fy }], 1);
      roots.push(guided(guide, baseHalf * (1.2 - 0.3 * Math.abs(k - (n - 1) / 2) / n)));
    }
    return roots;
  }

  if (o.composition === 'trellis') {
    // Several vertical climbers on a soft grid.
    const n = Math.max(2, o.seedCount);
    const roots: Root[] = [];
    for (let k = 0; k < n; k++) {
      const x = margin + ((k + 0.5) / n) * (width - 2 * margin);
      const guide: Point[] = [];
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        guide.push({ x: x + Math.sin(t * Math.PI * 2 + k) * width * 0.03, y: (height - margin) + ((margin) - (height - margin)) * t });
      }
      roots.push(guided(guide, baseHalf));
    }
    return roots;
  }

  const base = (x: number, y: number, angle: number): Root => ({ x, y, angle: angle + jitter(), half: baseHalf, maxLength, zdepth: zd() });

  if (o.seeding === 'painted') return o.startPoints.map((p) => base(p.x, p.y, up));
  if (o.seeding === 'point') {
    const p = o.startPoints[0] ?? { x: width / 2, y: height - margin };
    return [base(p.x, p.y, up)];
  }
  if (o.seeding === 'edges') {
    const roots: Root[] = [];
    for (let i = 0; i < o.seedCount; i++) {
      const edge = Math.floor(rng() * 4);
      if (edge === 0) roots.push(base(margin + rng() * (width - 2 * margin), height - margin, up));
      else if (edge === 1) roots.push(base(margin + rng() * (width - 2 * margin), margin, Math.PI / 2));
      else if (edge === 2) roots.push(base(margin, margin + rng() * (height - 2 * margin), 0));
      else roots.push(base(width - margin, margin + rng() * (height - 2 * margin), Math.PI));
    }
    return roots;
  }
  const roots: Root[] = [];
  for (let i = 0; i < o.seedCount; i++) {
    roots.push(base(margin + rng() * (width - 2 * margin), margin + rng() * (height - 2 * margin), up));
  }
  return roots;
}

// ——— growth model: recursive tip-growth ———

interface GrowthParams {
  width: number;
  height: number;
  margin: number;
  stepLength: number;
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
    guide?: Point[];
    gi: number;
    branch: boolean;
    zdepth: number;
  }
  const stack: Tip[] = roots.map((r) => ({ x: r.x, y: r.y, angle: r.angle, depth: 0, maxLength: r.maxLength, half: r.half, guide: r.guide, gi: 1, branch: false, zdepth: r.zdepth }));
  const minBranchLen = stepLength * 6;

  const inBounds = (x: number, y: number) => x >= margin && x <= width - margin && y >= margin && y <= height - margin;
  const clearDist = spacing * 1.6;
  const sepDist = spacing * 0.5;

  while (stack.length > 0 && stems.length < STEM_CAP) {
    const tip = stack.pop()!;
    const pts: Point[] = [{ x: tip.x, y: tip.y }];
    let { x, y, angle, gi } = tip;
    const startX = tip.x;
    const startY = tip.y;
    const steps = Math.max(2, Math.ceil(tip.maxLength / stepLength));
    const toInsert: Point[] = [];

    for (let i = 0; i < steps; i++) {
      if (tip.guide) {
        // Follow the composed master gesture: steer toward the active guide
        // point, advancing along the guide as we reach each.
        let target = tip.guide[Math.min(gi, tip.guide.length - 1)];
        if (Math.hypot(target.x - x, target.y - y) < stepLength * 2 && gi < tip.guide.length - 1) {
          gi++;
          target = tip.guide[gi];
        }
        const want = Math.atan2(target.y - y, target.x - x);
        angle = steer(angle, want, 0.25);
        angle += noise.noise2D(x * noiseScale, y * noiseScale) * curl * 0.18;
        if (gi >= tip.guide.length - 1 && Math.hypot(target.x - x, target.y - y) < stepLength * 1.5) break;
      } else {
        angle += noise.noise2D(x * noiseScale, y * noiseScale) * curl * 0.3;
        angle = steer(angle, up, 0.04 + gravitropism * 0.13);
      }

      const nx = x + Math.cos(angle) * stepLength;
      const ny = y + Math.sin(angle) * stepLength;
      if (!inBounds(nx, ny)) break;
      const cleared = Math.hypot(nx - startX, ny - startY) > clearDist;
      if (grid && cleared && grid.hasNear(nx, ny, sepDist)) break;

      x = nx;
      y = ny;
      pts.push({ x, y });
      if (grid && cleared) toInsert.push({ x, y });

      if (tip.depth < maxDepth && stack.length + stems.length < STEM_CAP && rng() < branchProb) {
        const childMax = tip.maxLength * (0.5 + rng() * 0.28);
        // Skip stubby branches — they read as thorns, not growth.
        if (childMax >= minBranchLen) {
          // Asymmetric bias gives a more designed, less even branch pattern.
          const dir = rng() < 0.62 ? 1 : -1;
          const turn = dir * (0.5 + rng() * 0.6);
          // Continuous taper: a branch starts near the parent's *local* width.
          const parentLocal = tip.half * (1 - 0.5 * (i / steps));
          stack.push({
            x, y,
            angle: angle + turn,
            depth: tip.depth + 1,
            maxLength: childMax,
            half: Math.max(0.6, parentLocal * 0.82),
            gi: 0,
            branch: true,
            // Inherit the parent's depth with a small jitter, kept in [0,1].
            zdepth: Math.max(0, Math.min(1, tip.zdepth + (rng() - 0.5) * 0.2)),
          });
        }
      }
    }

    // Drop stubby branch fragments; keep all trunk/guide stems.
    if (pts.length >= 2 && (!tip.branch || polylineLength(pts) >= minBranchLen * 0.6)) {
      stems.push({ points: pts, baseHalf: tip.half, branch: tip.branch, zdepth: tip.zdepth });
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
  maxLength: number,
  region?: (x: number, y: number) => boolean,
  depthSpread = 0.6
): Stem[] {
  const { width, height, margin, stepLength } = p;
  const attractorCount = Math.min(p.attractorCount, 1500);
  const arSq = p.attractorRadius * p.attractorRadius;
  const krSq = p.killRadius * p.killRadius;

  // Scatter attractors; for a `fill` composition keep only those inside the
  // target region so the network grows into its shape.
  const attractors: { x: number; y: number; alive: boolean }[] = [];
  let tries = 0;
  while (attractors.length < attractorCount && tries < attractorCount * 20) {
    tries++;
    const x = margin + rng() * (width - 2 * margin);
    const y = margin + rng() * (height - 2 * margin);
    if (region && !region(x, y)) continue;
    attractors.push({ x, y, alive: true });
  }

  interface Node { x: number; y: number; parent: number; }
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
        if (d < bestD) { bestD = d; best = n; }
      }
      if (best >= 0) {
        any = true;
        const nd = nodes[best];
        let dx = a.x - nd.x;
        let dy = a.y - nd.y;
        const L = Math.hypot(dx, dy) || 1;
        const inf = influence.get(best) ?? { dx: 0, dy: 0 };
        inf.dx += dx / L;
        inf.dy += dy / L;
        influence.set(best, inf);
      }
    }
    if (!any) break;

    const base = nodes.length;
    for (const [ni, inf] of influence) {
      const L = Math.hypot(inf.dx, inf.dy) || 1;
      const nd = nodes[ni];
      nodes.push({ x: nd.x + (inf.dx / L) * stepLength, y: nd.y + (inf.dy / L) * stepLength, parent: ni });
      if (nodes.length >= NODE_CAP) break;
    }

    for (const a of attractors) {
      if (!a.alive) continue;
      for (let n = base; n < nodes.length; n++) {
        const dx = a.x - nodes[n].x;
        const dy = a.y - nodes[n].y;
        if (dx * dx + dy * dy < krSq) { a.alive = false; break; }
      }
    }
  }

  return extractChains(nodes, baseHalf, penPx, maxLength, rng, depthSpread);
}

function extractChains(
  nodes: { x: number; y: number; parent: number }[],
  baseHalf: number,
  penPx: number,
  longLen: number,
  rng: () => number,
  depthSpread: number
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
      const zdepth = Math.max(0, Math.min(1, 0.5 + (rng() - 0.5) * depthSpread));
      stems.push({ points: pts, baseHalf: penPx + (baseHalf - penPx) * frac, branch: par >= 0, zdepth });
    }
  }
  return stems;
}

// ——— stem rendering (rounded tube) ———

interface StemRenderOpts {
  penPx: number;
  taper: number;
  vineFill: VineFill;
  light: Point;
  shadeDensity: number;
  stemShade: StemShade;
  branch: boolean;
}

function buildStem(center: Point[], baseHalf: number, o: StemRenderOpts): { lines: FlowLine[]; silhouette: Point[][] } {
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
  if (o.vineFill !== 'shaded') {
    return { lines: ribbon(samples, normals, w, penPx, 'stem', o.vineFill), silhouette: [poly] };
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

  return { lines, silhouette: [poly] };
}

/** Offset a polyline perpendicular to its local tangent (pen-ink.ts pattern). */
function offsetPolyline(points: Point[], distance: number): Point[] {
  if (Math.abs(distance) < 1e-6) return points.map((p) => ({ ...p }));
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = { x: points[i].x + (-ty / len) * distance, y: points[i].y + (tx / len) * distance };
  }
  return out;
}

/** Drop a fraction of arc length from each end (tapered ends). */
function trimPolyline(points: Point[], fraction: number): Point[] {
  if (points.length < 3) return points;
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = cum[cum.length - 1];
  const trim = Math.min(total * fraction, 12);
  const start = cum.findIndex((c) => c >= trim);
  let end = points.length - 1;
  while (end > 0 && cum[end] > total - trim) end--;
  if (start < 0 || end - start < 1) return points;
  return points.slice(start, end + 1);
}

/** Filled / outline ribbon (the non-botanical fill modes). */
function ribbon(
  samples: Point[],
  normals: Point[],
  w: number[],
  penPx: number,
  layer: string,
  mode: VineFill
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

// ——— decorations ———

interface DecorParams {
  leaves: boolean;
  leafStyle: LeafStyle;
  leafType: LeafType;
  veins: boolean;
  leafSize: number;
  leafWidthRatio: number;
  leafSpacing: number;
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerType: VineFlower;
  flowerProb: number;
  flowerSize: number;
  penPx: number;
  light: Point;
  shadeDensity: number;
  /** Composition focal point — foliage and blooms swell and concentrate near
   *  it (the visual "event"); null for free/colonization growth. */
  focal: Point | null;
  focalR: number;
  /** 0..1 overall foliage density — scales leaf clusters, spacing and blooms. */
  density: number;
  /** 0..1 atmospheric perspective (drives detail falloff on far foliage). */
  perspective: number;
}

function decorate(
  stems: { points: Point[]; zdepth: number }[],
  d: DecorParams,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][], z: number) => void,
  depthScale: (zdepth: number) => number,
  zOf: (zdepth: number) => number
): void {
  // 0..1 nearness to the composition focal point (0 when there's no focal).
  const nearFocal = (p: Point): number => {
    if (!d.focal) return 0;
    const dist = Math.hypot(p.x - d.focal.x, p.y - d.focal.y);
    return smoothstep(1 - dist / d.focalR);
  };

  // Foliage density (0..1) sets how packed the leaves are: low → spread out,
  // single leaves; high → tight, multi-leaf clusters. Each leaf keeps its full
  // detail either way.
  const dens = Math.max(0, Math.min(1, d.density));
  const spacingFactor = 1.7 - dens; // ~1.7× spacing at 0 → ~0.7× at 1

  for (const stem of stems) {
    const pts = stem.points;
    if (pts.length < 2) continue;
    const stemLen = polylineLength(pts);
    if (stemLen < d.leafSpacing) continue;

    // Perspective: nearer foliage is larger; far foliage drops to plain
    // outlines (detail falloff) and sits behind via its depth-ordered z.
    const ds = depthScale(stem.zdepth);
    const z = zOf(stem.zdepth);
    const effStyle: LeafStyle = d.perspective > 0.01 && stem.zdepth < 0.4 ? 'outline' : d.leafStyle;

    let arc = 0;
    let nextLeaf = d.leafSpacing * spacingFactor * (0.5 + rng());
    let side: 1 | -1 = rng() < 0.5 ? 1 : -1;

    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      arc += seg;
      const dir = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);

      if (arc >= nextLeaf) {
        side = (side === 1 ? -1 : 1) as 1 | -1;
        const along = arc / stemLen;
        const nf = nearFocal(pts[i]);
        // Leaves swell gently toward the focal point, and with depth.
        const sizeScale = (0.7 + 0.4 * (1 - along)) * (1 + 0.4 * nf) * ds;
        if (d.leaves) {
          // Cluster size driven by density (and a touch more near the focal).
          const cluster = 1 + (rng() < dens ? 1 : 0) + (rng() < (dens - 0.4 + 0.6 * nf) ? 1 : 0);
          for (let c = 0; c < cluster; c++) {
            const s: 1 | -1 = c === 0 ? side : ((rng() < 0.5 ? 1 : -1) as 1 | -1);
            const leaf = makeLeaf(pts[i], dir, s, d.leafSize * sizeScale * (0.8 + rng() * 0.5), d, effStyle, rng);
            add(leaf.lines, leaf.silhouette, z);
          }
        }
        if (d.tendrils && rng() < d.tendrilProb) {
          const t = makeTendril(pts[i], dir, (-side) as 1 | -1, d.leafSize * (0.8 + rng()) * ds, rng);
          add([t], [], z);
        }
        nextLeaf += d.leafSpacing * spacingFactor * (0.7 + rng() * 0.6) * (1 - 0.3 * nf);
      }
    }

    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const tipDir = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const nfTip = nearFocal(tip);
    const flowerChance = Math.min(1, d.flowerProb * (0.6 + 0.8 * dens) * (1 + 2 * nfTip));
    if (d.flowers && rng() < flowerChance) {
      // A bloom cluster, larger and more numerous toward the focal point.
      const blooms = 1 + (rng() < 0.3 * dens + 0.4 * nfTip ? 1 : 0) + (rng() < 0.5 * nfTip ? 1 : 0);
      for (let b = 0; b < blooms; b++) {
        const jx = b === 0 ? 0 : (rng() - 0.5) * d.flowerSize * 2.4;
        const jy = b === 0 ? 0 : (rng() - 0.5) * d.flowerSize * 2.4;
        const f = makeFlower({ x: tip.x + jx, y: tip.y + jy }, d.flowerSize * (0.7 + rng() * 0.6) * (1 + 0.5 * nfTip) * ds, d.penPx, d.flowerType, d.light, rng);
        add(f.lines, f.silhouette, z);
      }
    } else if (d.tendrils && rng() < d.tendrilProb) {
      const t = makeTendril(tip, tipDir, (rng() < 0.5 ? 1 : -1) as 1 | -1, d.leafSize * (0.8 + rng()) * ds, rng);
      add([t], [], z);
    }
  }
}

// ——— leaves ———

const LEAF_TYPES: LeafType[] = ['ovate', 'lance', 'cordate', 'lobed', 'serrate'];

/** Half-width profile fraction (0..1) along the blade for a leaf species. */
function leafProfile(type: LeafType, u: number, lobes: number): number {
  switch (type) {
    case 'lance':
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 1.35)), 1.15);
    case 'cordate':
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.7);
    case 'lobed':
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85) * (0.72 + 0.28 * Math.cos(lobes * Math.PI * u));
    case 'ovate':
    case 'serrate':
    default:
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85);
  }
}

function makeLeaf(
  base: Point,
  stemDir: number,
  side: 1 | -1,
  len: number,
  d: DecorParams,
  style: LeafStyle,
  rng: () => number
): { lines: FlowLine[]; silhouette: Point[][] } {
  const type: LeafType = d.leafType === 'mixed' ? LEAF_TYPES[Math.floor(rng() * LEAF_TYPES.length)] : d.leafType;
  const penPx = d.penPx;
  const spread = (Math.PI / 3) * (0.85 + rng() * 0.5);
  const curl = (rng() - 0.5) * 0.8;
  // Foreshortening: a tilted leaf is narrower; a steep one folds edge-on.
  const tilt = rng();
  const widthRatio = d.leafWidthRatio * (0.85 + rng() * 0.4) * (1 - 0.7 * tilt);
  const lobes = 2 + Math.floor(rng() * 2); // 2–3 lobe pairs
  const serrate = type === 'serrate';

  const baseAngle = stemDir + side * spread;
  const M = 22;
  const axis: Point[] = [{ x: base.x, y: base.y }];
  let x = base.x;
  let y = base.y;
  for (let j = 1; j <= M; j++) {
    const t = j / M;
    const ang = baseAngle + curl * t;
    const step = len / M;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    axis.push({ x, y });
  }
  const normals = normalsOf(axis);
  const maxHalf = Math.max(penPx, len * widthRatio * 0.5);
  const pet = 0.16; // petiole fraction
  const halfAt = (t: number): number => {
    if (t < pet) return Math.max(penPx * 0.4, maxHalf * 0.1 * (t / pet));
    const u = (t - pet) / (1 - pet);
    return Math.max(0, maxHalf * leafProfile(type, u, lobes));
  };

  // Light/shadow side of the blade.
  const mid = Math.floor(axis.length / 2);
  const litIsPlus = normals[mid].x * d.light.x + normals[mid].y * d.light.y > 0;
  const shadowSign = litIsPlus ? -1 : 1;

  const lines: FlowLine[] = [];

  // Outline edges (closed silhouette). Serrate margins get small teeth.
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < axis.length; i++) {
    const t = i / (axis.length - 1);
    let h = halfAt(t);
    if (serrate && t > pet) h *= 1 + 0.16 * Math.sin(i * 1.7);
    left.push({ x: axis[i].x + normals[i].x * h, y: axis[i].y + normals[i].y * h });
    right.push({ x: axis[i].x - normals[i].x * h, y: axis[i].y - normals[i].y * h });
  }
  const poly = [...left, ...right.slice().reverse()];

  if (tilt > 0.78) {
    // Edge-on: just a folded sickle (one edge + optional midrib).
    lines.push({ points: left, layer: 'leaf' });
    if (d.veins && style !== 'outline') lines.push({ points: axis.map((p) => ({ ...p })), layer: 'vein' });
    return { lines, silhouette: [poly] };
  }

  if (style === 'solid') {
    return { lines: ribbon(densify(axis, penPx), normalsOf(densify(axis, penPx)), densify(axis, penPx).map((_, i, arr) => halfAt(i / (arr.length - 1))), penPx, 'leaf', 'solid'), silhouette: [poly] };
  }

  // Outline: shadow edge slightly heavier.
  lines.push({ points: litIsPlus ? left : right, layer: 'leaf' });
  lines.push({ points: (litIsPlus ? right : left), layer: 'leaf', pen: 'bold' });

  // Veins: a midrib plus secondary veins curving toward the tip.
  if (d.veins && style !== 'outline') {
    lines.push({ points: axis.map((p) => ({ ...p })), layer: 'vein' }); // midrib
    const veinN = Math.max(3, Math.round(len / (penPx * 12)));
    for (let v = 1; v <= veinN; v++) {
      const t = pet + (v / (veinN + 1)) * (1 - pet);
      const i = Math.max(1, Math.min(axis.length - 2, Math.round(t * (axis.length - 1))));
      const h = halfAt(t) * 0.82;
      if (h < penPx) continue;
      const tx = axis[Math.min(i + 1, axis.length - 1)].x - axis[i - 1].x;
      const ty = axis[Math.min(i + 1, axis.length - 1)].y - axis[i - 1].y;
      const tl = Math.hypot(tx, ty) || 1;
      for (const s of [1, -1] as const) {
        // Curve the vein toward the tip.
        const ex = axis[i].x + normals[i].x * s * h + (tx / tl) * h * 0.55;
        const ey = axis[i].y + normals[i].y * s * h + (ty / tl) * h * 0.55;
        const mxp = axis[i].x + normals[i].x * s * h * 0.5 + (tx / tl) * h * 0.15;
        const myp = axis[i].y + normals[i].y * s * h * 0.5 + (ty / tl) * h * 0.15;
        lines.push({ points: [{ x: axis[i].x, y: axis[i].y }, { x: mxp, y: myp }, { x: ex, y: ey }], layer: 'vein' });
      }
    }
  }

  // Shadow hatching: fine cross strokes from the midrib to the shadow edge.
  if (style === 'shaded' && d.shadeDensity > 0.01) {
    const hatchStep = penPx * (2 + (1 - d.shadeDensity) * 5);
    let acc = 0;
    for (let i = 1; i < axis.length; i++) {
      acc += Math.hypot(axis[i].x - axis[i - 1].x, axis[i].y - axis[i - 1].y);
      if (acc < hatchStep) continue;
      acc = 0;
      const t = i / (axis.length - 1);
      const h = halfAt(t) * 0.86;
      if (h < penPx * 1.5) continue;
      const fromX = axis[i].x + normals[i].x * shadowSign * h * 0.18;
      const fromY = axis[i].y + normals[i].y * shadowSign * h * 0.18;
      const toX = axis[i].x + normals[i].x * shadowSign * h;
      const toY = axis[i].y + normals[i].y * shadowSign * h;
      lines.push({ points: [{ x: fromX, y: fromY }, { x: toX, y: toY }], layer: 'leaf' });
    }
  }

  return { lines, silhouette: [poly] };
}

// ——— tendrils & flowers ———

function makeTendril(base: Point, stemDir: number, side: 1 | -1, size: number, rng: () => number): FlowLine {
  // A graceful tendril: a straight lead-in off the stem easing into an open
  // coil that gently tightens — not a mechanical bullseye.
  const lead = size * (0.5 + rng() * 0.4);
  const lx = Math.cos(stemDir + side * 0.5);
  const ly = Math.sin(stemDir + side * 0.5);
  const pts: Point[] = [{ x: base.x, y: base.y }];
  const tipX = base.x + lx * lead;
  const tipY = base.y + ly * lead;
  pts.push({ x: tipX, y: tipY });

  const coils = 1.1 + rng() * 0.9;
  const steps = 40;
  const baseR = size * 0.55;
  const cx = tipX + Math.cos(stemDir + side * (Math.PI / 2)) * baseR;
  const cy = tipY + Math.sin(stemDir + side * (Math.PI / 2)) * baseR;
  const phi0 = Math.atan2(tipY - cy, tipX - cx);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const phi = phi0 + side * coils * 2 * Math.PI * t;
    const r = baseR * (1 - 0.45 * t); // tightens gently, stays open
    pts.push({ x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r });
  }
  return { points: smoothPolyline(pts, 2), layer: 'tendril' };
}

const FLOWER_TYPES: VineFlower[] = ['rose', 'daisy', 'bell', 'bud'];

/** A petal as an outline loop (no fill) — botanical line-work to match leaves. */
function petalOutline(center: Point, ang: number, len: number, half: number, penPx: number): FlowLine {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const px = -dy;
  const py = dx;
  const N = 10;
  const loop: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const out = Math.sin(Math.PI * t) * half;
    loop.push({ x: center.x + dx * len * t + px * out, y: center.y + dy * len * t + py * out });
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const out = Math.sin(Math.PI * t) * half;
    loop.push({ x: center.x + dx * len * t - px * out, y: center.y + dy * len * t - py * out });
  }
  void penPx;
  return { points: loop, layer: 'flower' };
}

function ringOutline(center: Point, radius: number, layer: string): FlowLine {
  const segs = Math.max(10, Math.round(radius * 2.2));
  const ring: Point[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * 2 * Math.PI;
    ring.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
  }
  return { points: ring, layer };
}

/** A flower as botanical line-work, varied by species — matching the leaves'
 *  outline-and-detail treatment rather than a solid blob. */
function makeFlower(
  center: Point,
  size: number,
  penPx: number,
  type: VineFlower,
  light: Point,
  rng: () => number
): { lines: FlowLine[]; silhouette: Point[][] } {
  const t: VineFlower = type === 'mixed' ? FLOWER_TYPES[Math.floor(rng() * FLOWER_TYPES.length)] : type;
  const lines: FlowLine[] = [];
  const rot = rng() * Math.PI * 2;
  let reach = size;

  if (t === 'rose') {
    const petals = 5 + Math.floor(rng() * 2);
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * 2 * Math.PI;
      lines.push(petalOutline(center, ang, size, size * 0.42, penPx));
    }
    // A few short stamen ticks at the centre.
    for (let k = 0; k < 4; k++) {
      const a = rot + rng() * Math.PI * 2;
      lines.push({ points: [{ x: center.x, y: center.y }, { x: center.x + Math.cos(a) * size * 0.22, y: center.y + Math.sin(a) * size * 0.22 }], layer: 'flower' });
    }
  } else if (t === 'daisy') {
    const petals = 11 + Math.floor(rng() * 5);
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * 2 * Math.PI;
      lines.push(petalOutline(center, ang, size, size * 0.12, penPx));
    }
    lines.push(ringOutline(center, size * 0.28, 'flower'));
    reach = size * 1.05;
  } else if (t === 'bell') {
    // One or two hanging bells: a tapered cup with a scalloped rim.
    const bells = 1 + (rng() < 0.5 ? 1 : 0);
    for (let bnum = 0; bnum < bells; bnum++) {
      const a = rot + (bnum - (bells - 1) / 2) * 0.5 + Math.PI / 2; // hang downward-ish
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const px = -dy;
      const py = dx;
      const L = size * 1.1;
      const cup: Point[] = [];
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const wmouth = size * 0.5 * (0.25 + 0.75 * u); // narrow at base, wide at mouth
        const scallop = u > 0.92 ? Math.sin(i * 2.5) * size * 0.08 : 0;
        cup.push({ x: center.x + dx * L * u + px * (wmouth + scallop), y: center.y + dy * L * u + py * (wmouth + scallop) });
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N;
        const wmouth = size * 0.5 * (0.25 + 0.75 * u);
        const scallop = u > 0.92 ? Math.sin(i * 2.5) * size * 0.08 : 0;
        cup.push({ x: center.x + dx * L * u - px * (wmouth + scallop), y: center.y + dy * L * u - py * (wmouth + scallop) });
      }
      lines.push({ points: cup, layer: 'flower' });
    }
    reach = size * 1.2;
  } else {
    // bud: a closed teardrop with two sepal strokes at its base.
    const a = rot;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    const L = size * 1.1;
    const N = 12;
    const bud: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.4;
      bud.push({ x: center.x + dx * L * u + px * wb, y: center.y + dy * L * u + py * wb });
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.4;
      bud.push({ x: center.x + dx * L * u - px * wb, y: center.y + dy * L * u - py * wb });
    }
    lines.push({ points: bud, layer: 'flower' });
    for (const s of [1, -1] as const) {
      lines.push({ points: [{ x: center.x, y: center.y }, { x: center.x + dx * size * 0.4 + px * s * size * 0.22, y: center.y + dy * size * 0.4 + py * s * size * 0.22 }], layer: 'flower' });
    }
    reach = size * 0.7;
  }
  void light;

  // Tight silhouette (no oversized occlusion halo around the bloom).
  const sil: Point[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * Math.PI;
    sil.push({ x: center.x + Math.cos(a) * reach, y: center.y + Math.sin(a) * reach });
  }
  return { lines, silhouette: [sil] };
}

