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
import { getSketchStyleConfig, type SketchStyle } from './sketch-styles.js';
import { makeRandom, randomSeed, subSeed } from './lib/rng.js';

export type VineMode = 'growth' | 'colonization';
export type VineSeeding = 'painted' | 'scatter' | 'edges' | 'point';
export type VineComposition = 'specimen' | 'free' | 'wreath' | 'border' | 'bouquet' | 'trellis' | 'fill' | 'guide';
/** A drawn support the climbers wrap (trellis composition). */
export type VineSupport = 'none' | 'lattice' | 'arch' | 'obelisk';
/** A drawn container the arrangement rises out of (bouquet/specimen). */
export type VineVessel = 'none' | 'vase' | 'pot' | 'jar' | 'urn' | 'amphora' | 'bud-vase' | 'mason-jar' | 'bowl';
/** Region a `fill` composition grows into. */
export type FillShape = 'circle' | 'oval' | 'heart' | 'diamond' | 'painted';
/** How a vine body is inked. */
export type VineFill = 'shaded' | 'solid' | 'outline' | 'highlight';
/** How a leaf is inked. */
export type LeafStyle = 'shaded' | 'veined' | 'outline' | 'solid';
export type LeafType = 'ovate' | 'lance' | 'cordate' | 'lobed' | 'serrate' | 'mixed';
/** How a (thick) stem's tube is shaded. */
export type StemShade = 'none' | 'along' | 'cross';
/** Surface texture drawn on thick (woody) stems. */
export type StemTexture = 'none' | 'bark';
/** Flower species. */
export type VineFlower = 'rose' | 'daisy' | 'bell' | 'bud' | 'mixed';
/** Character of the hand-sketched overdraw (shared with the Planet Generator). */
export type { SketchStyle };
/** How leaflets are arranged into a single (possibly compound) leaf. */
export type LeafArrangement = 'simple' | 'pinnate' | 'bipinnate' | 'palmate' | 'trifoliate';
/** How successive leaves are inserted along a stem. */
export type Phyllotaxis = 'alternate' | 'opposite' | 'whorled' | 'spiral';
/** A multi-flower structure carried at a stem tip (or along a stem). */
export type Inflorescence = 'none' | 'raceme' | 'umbel' | 'spike' | 'corymb';
/** A fruiting body borne on the stems. */
export type FruitType = 'none' | 'berry' | 'grape' | 'rosehip' | 'pod' | 'catkin';

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

  // — page composition —
  /** Guide polylines the stems grow along ('guide' composition). Normalized or
   *  pixel coordinates accepted; callers pass page-pixel points. */
  guidePaths?: Point[][];
  /** A drawn support the climbers wrap, for the 'trellis' composition. */
  support?: VineSupport;
  /** A drawn container the stems rise out of (bouquet/specimen); 'none' off. */
  vessel?: VineVessel;
  /** Draw a hand-drawn ground line under the arrangement. */
  groundLine?: boolean;
  /** 0..1 deliberate negative space: hold one region of the page clear and
   *  swell the mass elsewhere (notan), instead of filling evenly. */
  negativeSpace?: number;
  /** 0..1 light-driven tonal massing: commit the arrangement into a few value
   *  masses — foliage gathers and hatches heavier on the shadow side (away from
   *  `lightAngle`) and opens on the lit side — so it reads as a lit illustration
   *  rather than an evenly-filled diagram. 0 = off (byte-identical). */
  tonalMassing?: number;
  /** Posterize the tonal-massing field into this many value bands (>= 2) so the
   *  canopy reads as a few decisive shapes; 0/1 = smooth (no banding). */
  valueBands?: number;

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
  /** Surface texture on thick (woody) stems: 'none' or 'bark' striations. */
  stemTexture?: StemTexture;
  /** Allow overlap and remove hidden lines for depth (vs flat). */
  occlude?: boolean;
  /** 0..1 hand-sketched overdraw: repeats every line with small variation. */
  sketch?: number;
  /** Character of the sketch overdraw. */
  sketchStyle?: SketchStyle;
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
  /** Compound-leaf arrangement; 'simple' = one blade per site (default). */
  leafArrangement?: LeafArrangement;
  /** Leaflets per compound leaf (pinnate pairs + terminal, palmate spokes). */
  leafletCount?: number;
  /** How successive leaves are inserted along a stem; 'alternate' = legacy. */
  phyllotaxis?: Phyllotaxis;
  /** Leaves per node when phyllotaxis is 'whorled'. */
  whorlCount?: number;
  tendrils?: boolean;
  tendrilProb?: number;
  flowers?: boolean;
  flowerType?: VineFlower;
  flowerProb?: number;
  flowerSize?: number;
  /** Multi-flower structure at a stem tip; 'none' = single bloom (default). */
  inflorescence?: Inflorescence;
  /** Florets per inflorescence. */
  floretCount?: number;
  /** Bear thorns along the stems (roses, brambles). */
  thorns?: boolean;
  /** Per-arc-step thorn probability when `thorns` is on. */
  thornProb?: number;
  /** Fruiting bodies; 'none' = off (default). Reuses the `flower` pen layer. */
  fruitType?: FruitType;
  /** Per-site probability a fruit cluster is borne when `fruitType` is set. */
  fruitProb?: number;
  /** Scatter dewdrop highlights on the foliage. */
  dewdrops?: boolean;
  /** Per-site dewdrop probability when `dewdrops` is on. */
  dewdropProb?: number;

  /** Hand-drawn wobble amplitude applied to stem centerlines, px (0 = off). */
  wobble?: number;
}

/** A grown stem: a centerline, the half-width it carries at its base, and
 *  whether it's a side-branch (tapered to a point where it joins its parent). */
interface Stem {
  points: Point[];
  baseHalf: number;
  branch: boolean;
}

/** A growth root: position, initial heading, the width/length it starts with,
 *  and an optional guide curve (the composed master gesture). */
interface Root {
  x: number;
  y: number;
  angle: number;
  half: number;
  maxLength: number;
  guide?: Point[];
  /** Cap on side-branch length (keeps wreath foliage hugging the ring). */
  branchMaxLen?: number;
}

/** A drawable element: its marks and a closed silhouette for occlusion. Draw
 *  order is plain creation order (stems first, then foliage in front); each
 *  element's index is its z, so every element occludes its neighbours cleanly. */
interface Element {
  lines: FlowLine[];
  silhouette: Point[][];
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

/** Close a blade/body silhouette from its two offset edges: down one edge and
 *  back up the other (left forward, right reversed). */
function outlineFromEdges(left: Point[], right: Point[]): Point[] {
  return [...left, ...right.slice().reverse()];
}

/** Total fill lines we'll ever emit — keeps dense presets bounded & fast. */
const STEM_CAP = 4000;
const LINE_CAP = 90000;

export function generateVines(options: VinesOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 20,
    seed = randomSeed(),
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
    stemTexture = 'none',
    occlude = true,
    sketch = 0,
    sketchStyle = 'loose',
    castShadow = 0.35,
    density = 0.45,
    leaves = true,
    leafStyle = 'shaded',
    leafType = 'ovate',
    veins = true,
    leafSize = 26,
    leafWidthRatio = 0.5,
    leafSpacing = 30,
    leafArrangement = 'simple',
    leafletCount = 5,
    phyllotaxis = 'alternate',
    whorlCount = 3,
    tendrils = true,
    tendrilProb = 0.12,
    flowers = true,
    flowerType = 'rose',
    flowerProb = 0.2,
    flowerSize = 18,
    inflorescence = 'none',
    floretCount = 8,
    thorns = false,
    thornProb = 0.15,
    fruitType = 'none',
    fruitProb = 0.2,
    dewdrops = false,
    dewdropProb = 0.15,
    wobble = 0.6,
    vessel = 'none',
    groundLine = false,
    negativeSpace = 0,
    tonalMassing = 0,
    valueBands = 0,
    guidePaths,
    support = 'none',
  } = options;

  const penPx = Math.max(0.6, penWidth);
  const baseHalf = Math.max(penPx, stemWidth / 2);
  const spacing = options.spacing ?? stemWidth + penPx * 2;
  const lr = (lightAngle * Math.PI) / 180;
  const light: Point = { x: Math.cos(lr), y: Math.sin(lr) };

  // Reserve a decoration border: leaves/flowers are placed *at* stem points and
  // reach outward from them, so the skeleton (roots, guides, growth bounds) is
  // composed inside `growMargin` — far enough from the true margin that the
  // foliage hung off it lands inside the page rather than being clipped at the
  // edge on every plot. Sized for the typical leaf / single bloom (compound
  // leaves reach further); capped so small pages aren't over-inset. Rare large
  // inflorescences / focal-boosted blooms may still touch and get clipped by the
  // final margin clip — the accepted edge case. Deterministic (no rng).
  const leafReach = leaves ? leafSize * (leafArrangement === 'simple' ? 1.5 : 2.0) : 0;
  const flowerReach = flowers ? flowerSize * 1.6 : 0;
  const decorReserve = Math.min(Math.max(leafReach, flowerReach), Math.min(width, height) * 0.15);
  const growMargin = margin + decorReserve;

  const rng = makeRandom(seed);
  const noise = createNoise(seed);

  const growthGrid = new ProximityGrid(width, height, Math.max(1, spacing));

  // The scene value field: one scalar mass-weight over the page (1 = full mass /
  // dense / dark, →0 = thin / open / lit). It folds together deliberate negative
  // space (notan: hold a third clear) and light-driven tonal massing (swell the
  // shadow side, open the lit side, commit a few value masses). Null when both
  // are off, so the rng sequence — and every existing render — is byte-identical
  // unless one is dialled up.
  const weightAt = makeValueField(width, height, margin, seed, light, negativeSpace, tonalMassing, valueBands);
  // Growth and root placement follow *only* the notan component, not the light
  // gradient: tonal massing concentrates foliage and tone, but the architecture
  // (stem length, branching, where roots start) stays even — as in real
  // botanical drawing, where the canopy masses tonally while the branches don't
  // retreat from the lit side. A broad light gradient driving the growth
  // early-stop would otherwise truncate the whole gesture on its lit half. Null
  // when negative space is off, so this is byte-identical to a non-notan render.
  const growthWeightAt = makeMassWeight(width, height, margin, seed, negativeSpace);

  // A drawn vessel the arrangement rises out of (bouquet/specimen): the stems
  // are based at its mouth, and it occludes their lower ends.
  const vesselSpec = vessel !== 'none' ? VESSEL_SPECS[vessel as Exclude<VineVessel, 'none'>] : undefined;
  const wantsVessel = !!vesselSpec && (composition === 'bouquet' || composition === 'specimen');
  let baseOverride: Point | undefined;
  let vesselBuilt: { lines: FlowLine[]; silhouette: Point[][] } | null = null;
  let vesselShadow: FlowLine[] = [];
  let vesselBottomY = height - margin;
  if (wantsVessel) {
    const spec = vesselSpec!;
    vesselBottomY = height - margin;
    // Sized to anchor the arrangement; per-vessel factors keep proportions
    // (a bowl is wide and low, an amphora tall and narrow).
    const vesselH = Math.min(height * 0.26, (height - 2 * margin) * 0.34) * spec.h;
    const topY = vesselBottomY - vesselH;
    const cx = startPoints[0]?.x ?? width / 2;
    const mouthHalf = Math.max(20, (width - 2 * margin) * 0.13) * spec.w;
    baseOverride = { x: cx, y: topY };
    const v = buildVessel(cx, topY, vesselBottomY, mouthHalf, vessel, light, penPx, shadeDensity, castShadow, seed);
    vesselBuilt = { lines: v.lines, silhouette: v.silhouette };
    vesselShadow = v.shadow;
  }

  // Composition routes the growth: `fill` colonizes a region; `free` respects
  // the mode/seeding; everything else grows along composed guide curves.
  let rawStems: Stem[];
  let focal: Point | null = null;
  if (composition === 'fill') {
    const region = buildRegion(fillShape, startPoints, width, height, growMargin);
    const fillRoots: Root[] = region.seeds.map((p) => ({ x: p.x, y: p.y, angle: -Math.PI / 2, half: baseHalf, maxLength }));
    rawStems = colonize(fillRoots, { width, height, margin: growMargin, stepLength, attractorCount: Math.max(attractorCount, 700), attractorRadius, killRadius }, rng, baseHalf, penPx, maxLength, region.inside);
  } else if (composition === 'free' && mode === 'colonization') {
    const roots = makeRoots({ width, height, margin: growMargin, mode, composition, seeding, startPoints, seedCount, baseHalf, maxLength, weightAt: growthWeightAt }, rng);
    rawStems = colonize(roots, { width, height, margin: growMargin, stepLength, attractorCount, attractorRadius, killRadius }, rng, baseHalf, penPx, maxLength, undefined);
  } else {
    const roots = makeRoots({ width, height, margin: growMargin, mode, composition, seeding, startPoints, seedCount, baseHalf, maxLength, weightAt: growthWeightAt, baseOverride, guidePaths }, rng);
    // The specimen's focal point is the end of its master gesture.
    if (composition === 'specimen' && roots[0]?.guide) focal = roots[0].guide[roots[0].guide.length - 1];
    // A wreath's arcs — and a 'guide' composition's traced paths — are *designed*
    // to overlap (a closed ring, a self-crossing letterform), so the proximity
    // break (which would stop each stem as it nears another and tear the shape)
    // is disabled for them.
    const useGrid = avoidOverlap && composition !== 'wreath' && composition !== 'guide' ? growthGrid : null;
    rawStems = growStems(roots, { width, height, margin: growMargin, stepLength, curl, noiseScale, gravitropism, branchProb, maxDepth }, rng, noise, useGrid, spacing, growthWeightAt);
  }

  // Smooth (heavily, for flowing curves) then add a touch of wobble.
  const centerlines = rawStems.map((s) => smoothPolyline(s.points, 3));
  const wobbled = applyHandDrawnStyle(
    { lines: centerlines.map((points) => ({ points })), width, height, seed },
    { amplitude: wobble, wavelength: 90, seed }
  ).lines.map((l) => l.points);

  const elements: Element[] = [];
  const add = (lines: FlowLine[], silhouette: Point[][]): void => {
    elements.push({ lines, silhouette });
  };

  // Page furniture sits behind everything: a trellis support (no silhouette, so
  // the climbers draw over it), the ground line, then the vessel, then the
  // stems and foliage in front.
  if (composition === 'trellis' && support !== 'none') {
    const sup = applyHandDrawnStyle(
      { lines: buildSupport(support, width, height, margin), width, height, seed: seed + 333 },
      { amplitude: Math.max(wobble, 0.4), wavelength: 80, seed: seed + 333 }
    ).lines;
    add(sup, []);
  }
  if (groundLine) {
    const g = applyHandDrawnStyle(
      { lines: [buildGround(width, height, margin, wantsVessel ? vesselBottomY : undefined, wobble)], width, height, seed: seed + 511 },
      { amplitude: wobble, wavelength: 120, seed: seed + 511 }
    ).lines;
    add(g, []);
  }
  // The vessel's cast shadow lies on the ground behind it (no silhouette, so the
  // vessel occludes the part beneath its foot) — this grounds the whole
  // arrangement in space, which is what stops the vines reading as flat.
  if (vesselShadow.length > 0) {
    const sl = applyHandDrawnStyle(
      { lines: vesselShadow, width, height, seed: seed + 911 },
      { amplitude: Math.max(wobble * 0.5, 0.3), wavelength: 70, seed: seed + 911 }
    ).lines;
    add(sl, []);
  }
  if (vesselBuilt) {
    // Run the vessel through the same hand-drawn wobble the vine centerlines
    // get, so its outline and cross-contour hatching share the vines' line
    // quality instead of reading as a clean, pasted-in object.
    const wl = applyHandDrawnStyle(
      { lines: vesselBuilt.lines, width, height, seed: seed + 701 },
      { amplitude: Math.max(wobble, 0.5), wavelength: 44, seed: seed + 701 }
    ).lines;
    add(wl, vesselBuilt.silhouette);
  }

  // Stems (created first, so they sit behind the foliage). Thorns ride on the
  // stem element so they share the cane's depth (and only draw when enabled, so
  // the rng sequence is otherwise byte-identical to a thornless render).
  wobbled.forEach((center, i) => {
    const st = rawStems[i];
    const built = buildStem(center, st.baseHalf, { penPx, taper, vineFill, light, shadeDensity, stemShade, stemTexture, branch: st.branch });
    const thornLines = thorns ? makeThorns(center, st.baseHalf, thornProb, penPx, rng) : [];
    add([...built.lines, ...thornLines], built.silhouette);
  });

  const focalR = Math.min(width, height) * 0.24;

  // Decorations, created after their stem so they draw (and occlude) in front.
  decorate(
    wobbled.map((points) => ({ points })),
    {
      leaves, leafStyle, leafType, veins, leafSize, leafWidthRatio, leafSpacing,
      leafArrangement, leafletCount, phyllotaxis, whorlCount,
      tendrils, tendrilProb, flowers, flowerType, flowerProb, flowerSize, penPx, light, shadeDensity,
      inflorescence, floretCount, fruitType, fruitProb, dewdrops, dewdropProb,
      focal, focalR, density, weightAt, shadeMass: tonalMassing,
    },
    rng,
    add
  );

  // Hidden-line removal: treat every element as a solid object — rasterize its
  // silhouette into a z-buffer in creation order (each element's index is its
  // z, distinct integers so neighbours occlude cleanly) and drop any line
  // beneath a covered area, so things in front cleanly hide what's behind.
  let outLines: FlowLine[];
  if (occlude) {
    const zbuf = new ZBuffer(width, height, Math.max(1, penPx * 0.75));
    for (let id = 0; id < elements.length; id++) for (const poly of elements[id].silhouette) zbuf.fill(poly, id);
    outLines = [];
    for (let id = 0; id < elements.length; id++) {
      const el = elements[id];
      for (const ln of el.lines) {
        for (const run of clipHidden(ln.points, id, zbuf)) {
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
  // The style sets the character (passes / wobble wavelength / amplitude /
  // jitter); `sketch` is the intensity.
  if (sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(sketchStyle, sketch);
    if (outLines.length * passes < LINE_CAP) {
      const acc: FlowLine[] = [];
      for (let p = 0; p < passes; p++) {
        const styled = applyHandDrawnStyle(
          { lines: outLines, width, height, seed: subSeed(seed, p) },
          { amplitude, wavelength, jitter, seed: subSeed(seed, p) }
        ).lines;
        for (const l of styled) acc.push(l);
      }
      outLines = acc;
    }
  }

  // Keep the margin clear: clip every line to the inner box so foliage, blooms
  // and wobble that overhang the stems' growth bounds don't spill into the
  // plotter's clear border. Done last, after wobble/sketch have moved points.
  if (margin > 0) {
    const x0 = margin;
    const y0 = margin;
    const x1 = width - margin;
    const y1 = height - margin;
    const clipped: FlowLine[] = [];
    for (const ln of outLines) {
      for (const run of clipPolylineToRect(ln.points, x0, y0, x1, y1)) {
        clipped.push({ ...ln, points: run });
      }
    }
    outLines = clipped;
  }

  return { lines: outLines, width, height, seed };
}

/** Liang–Barsky clip of one segment to an axis-aligned rect; null if outside. */
function clipSegmentToRect(
  a: Point,
  b: Point,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // parallel and outside
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
  ];
}

/** Clip a polyline to a rect, splitting it into the runs that lie inside — so
 *  the plot keeps the margin clear instead of letting foliage spill past it. */
function clipPolylineToRect(pts: Point[], x0: number, y0: number, x1: number, y1: number): Point[][] {
  if (pts.length < 2) return [];
  const runs: Point[][] = [];
  let run: Point[] = [];
  const eps = 1e-6;
  for (let i = 1; i < pts.length; i++) {
    const seg = clipSegmentToRect(pts[i - 1], pts[i], x0, y0, x1, y1);
    if (!seg) {
      if (run.length >= 2) runs.push(run);
      run = [];
      continue;
    }
    const [a, b] = seg;
    if (run.length === 0) {
      run.push(a);
    } else {
      const last = run[run.length - 1];
      // Segment re-entered the rect somewhere new → start a fresh run.
      if (Math.hypot(a.x - last.x, a.y - last.y) > eps) {
        if (run.length >= 2) runs.push(run);
        run = [a];
      }
    }
    run.push(b);
    // Segment exited the rect (clipped end ≠ the real vertex) → end the run.
    if (Math.hypot(b.x - pts[i].x, b.y - pts[i].y) > eps) {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
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
    // Smooth the drawn outline; the even-odd test closes it implicitly.
    const poly = smoothPolyline(startPoints, 2);
    inside = (x, y) => pointInPolygon(poly, x, y);
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
  // Also seed the region's extremities so colonization grows *into* its lobes
  // and points — a heart's two top lobes and bottom tip, a diamond's corners —
  // instead of radiating from a central cluster and rounding the silhouette off
  // into a blob. A coarse grid scan finds the topmost point of each half plus
  // the four cardinal extremes. (Deterministic; no shared rng touched.)
  const GRID = 48;
  let top: Point | null = null, bottom: Point | null = null, leftP: Point | null = null, rightP: Point | null = null, lobeL: Point | null = null, lobeR: Point | null = null;
  for (let iy = 0; iy <= GRID; iy++) {
    const y = margin + (iy / GRID) * (height - 2 * margin);
    for (let ix = 0; ix <= GRID; ix++) {
      const x = margin + (ix / GRID) * (width - 2 * margin);
      if (!inside(x, y)) continue;
      if (!top || y < top.y) top = { x, y };
      if (!bottom || y > bottom.y) bottom = { x, y };
      if (!leftP || x < leftP.x) leftP = { x, y };
      if (!rightP || x > rightP.x) rightP = { x, y };
      if (x < cx && (!lobeL || y < lobeL.y)) lobeL = { x, y };
      if (x > cx && (!lobeR || y < lobeR.y)) lobeR = { x, y };
    }
  }
  for (const e of [top, bottom, leftP, rightP, lobeL, lobeR]) if (e) seeds.push(e);
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
  /** Negative-space mass weight (1 everywhere when off); biases roots away from
   *  the held-clear region. */
  weightAt?: ((x: number, y: number) => number) | null;
  /** When a vessel is drawn, the arrangement is based at its mouth. */
  baseOverride?: Point;
  /** Guide polylines the stems follow ('guide' composition). */
  guidePaths?: Point[][];
}

/** Build the negative-space mass weight: 1 everywhere when off, else low inside
 *  a deterministically-chosen clear third of the page and 1 well away from it.
 *  Returns null when off so callers can keep their rng sequence byte-identical. */
function makeMassWeight(
  width: number,
  height: number,
  margin: number,
  seed: number,
  ns: number
): ((x: number, y: number) => number) | null {
  if (ns <= 0.001) return null;
  // A rule-of-thirds intersection, picked from the seed, is held clear.
  const thirds = [
    { fx: 1 / 3, fy: 1 / 3 }, { fx: 2 / 3, fy: 1 / 3 },
    { fx: 1 / 3, fy: 2 / 3 }, { fx: 2 / 3, fy: 2 / 3 },
  ];
  const ci = (Math.imul(seed >>> 0, 2654435761) >>> 0) % 4;
  const cc = {
    x: margin + thirds[ci].fx * (width - 2 * margin),
    y: margin + thirds[ci].fy * (height - 2 * margin),
  };
  const clearR = 0.5 * Math.min(width, height);
  const strength = Math.min(1, ns);
  return (x, y) => {
    const reduce = smoothstep(1 - Math.hypot(x - cc.x, y - cc.y) / clearR);
    return 1 - strength * reduce;
  };
}

/** The lit side never goes fully bald — it keeps this fraction of the mass so
 *  airy passages still carry a few marks. */
const LIT_FLOOR = 0.15;

/**
 * The scene value field: one scalar mass-weight closure (1 = full mass / dense /
 * dark, →`LIT_FLOOR` = thin / open / lit) that every density, size and
 * shade-intensity site reads from. It folds two illustrator controls into one
 * field so they compose without doubling the rng-gated plumbing:
 *
 *  - **Negative space** (notan) — hold a deterministically-chosen third clear.
 *  - **Tonal massing** — a light-driven gradient (swell the shadow side away
 *    from `light`, open the lit side), then a contrast-commit + optional
 *    posterize borrowed in spirit from the image pipeline's `composeMassPlan`,
 *    so the canopy reads as a few decisive value masses instead of an even veil.
 *
 * Returns null when both are off, so the rng sequence stays byte-identical to a
 * render that never asked for either. When only negative space is on it returns
 * the *exact* legacy notan closure (`makeMassWeight`), so existing notan seeds
 * reproduce. Pure analytic closures — no per-pixel raster/blur — so it's O(1)
 * per query and cheap to rebuild on every render.
 */
function makeValueField(
  width: number,
  height: number,
  margin: number,
  seed: number,
  light: Point,
  negativeSpace: number,
  tonalMassing: number,
  valueBands: number
): ((x: number, y: number) => number) | null {
  const notan = makeMassWeight(width, height, margin, seed, negativeSpace);
  // Massing off → the field is exactly the legacy notan closure (or null). This
  // is what guarantees every existing render is byte-identical.
  if (tonalMassing <= 0.001) return notan;

  const tm = Math.min(1, tonalMassing);
  const cx = width / 2;
  const cy = height / 2;
  // Project page position onto the light axis, normalized by the page half-span,
  // so the centre is tonally neutral and the corners commit. dot > 0 is the lit
  // side (toward `light`), dot < 0 the shadow side.
  const halfSpan = 0.5 * Math.hypot(width - 2 * margin, height - 2 * margin) || 1;
  const bands = Math.round(valueBands);
  const posterize = bands >= 2;

  return (x, y) => {
    const proj = Math.max(-1, Math.min(1, ((x - cx) * light.x + (y - cy) * light.y) / halfSpan));
    // 1 deep in shadow, 0 in full light.
    const shadowBias = smoothstep(0.5 - proj * 0.5);
    // Open the lit side toward the floor; the shadow side stays at full mass.
    let w = 1 - tm * (1 - shadowBias) * (1 - LIT_FLOOR);
    // Commit values: push apart from the mid so a few decisive masses read,
    // rather than a continuous gradation (mirrors composeMassPlan).
    w = 0.5 + (w - 0.5) * (1 + 0.45 * tm);
    if (posterize) {
      const band = Math.max(0, Math.min(bands - 1, Math.floor(w * bands)));
      w = band / (bands - 1);
    }
    w = Math.max(LIT_FLOOR, Math.min(1, w));
    // A held-clear notan region still clears, even under massing.
    if (notan) w *= notan(x, y);
    return w;
  };
}

function makeRoots(o: RootOpts, rng: () => number): Root[] {
  const { width, height, margin, baseHalf, maxLength } = o;
  const up = -Math.PI / 2;
  const jitter = () => (rng() - 0.5) * 0.5;

  // A designed single specimen: a master gesture from a base in the lower third
  // sweeping to a focal point on a rule-of-thirds intersection, leaving the
  // opposite side as negative space.
  if (o.composition === 'specimen' && o.mode === 'growth') {
    const leftFocal = rng() < 0.5;
    const fx = margin + (leftFocal ? 1 / 3 : 2 / 3) * (width - 2 * margin);
    const fy = margin + (0.22 + rng() * 0.16) * (height - 2 * margin);
    const baseFromPaint = o.seeding === 'painted' || o.seeding === 'point' ? o.startPoints[0] : undefined;
    const bx = o.baseOverride?.x ?? baseFromPaint?.x ?? margin + (leftFocal ? 0.62 : 0.38) * (width - 2 * margin);
    const by = o.baseOverride?.y ?? baseFromPaint?.y ?? height - margin * 1.3;
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
    const roots: Root[] = [{ x: bx, y: by, angle: startAngle, half: baseHalf * 1.5, maxLength: maxLength * 1.7, guide }];
    // A shorter subordinate cane from the same base sweeping into the opposite
    // (weak) quadrant, so the frame reads as a balanced specimen rather than one
    // gesture beside a bare void. Capped shorter and thinner so it stays
    // subordinate to the master gesture, and held back from the focal side.
    const sfx = margin + (leftFocal ? 0.74 : 0.26) * (width - 2 * margin);
    const sfy = margin + (0.5 + rng() * 0.16) * (height - 2 * margin);
    const smx = (bx + sfx) / 2 + (leftFocal ? -1 : 1) * width * 0.06;
    const smy = (by + sfy) / 2;
    const subGuide = smoothPolyline([{ x: bx, y: by }, { x: smx, y: smy }, { x: sfx, y: sfy }], 1);
    const subAngle = Math.atan2(subGuide[1].y - by, subGuide[1].x - bx);
    roots.push({ x: bx, y: by, angle: subAngle, half: baseHalf * 1.05, maxLength: maxLength * 0.9, guide: subGuide, branchMaxLen: maxLength * 0.5 });
    return roots;
  }

  // Build a guided root: a stem that follows a smoothed guide curve. An
  // optional branch cap keeps its foliage from shooting off the guide.
  const guided = (guide: Point[], half: number, branchMaxLen?: number): Root => {
    const g = smoothPolyline(guide, 1);
    return { x: g[0].x, y: g[0].y, angle: Math.atan2(g[1].y - g[0].y, g[1].x - g[0].x), half, maxLength: polylineLength(g) * 1.3, guide: g, branchMaxLen };
  };

  if (o.composition === 'wreath') {
    // Stems run around a ring, each covering an arc that overlaps its
    // neighbour's start so the ring always closes (no angular jitter — gaps
    // read as a broken wreath); side branches are kept short so the foliage
    // hugs the ring. Radius still wobbles slightly for a hand-drawn ring.
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width - 2 * margin, height - 2 * margin) * 0.42;
    const n = Math.max(3, o.seedCount);
    const step = (2 * Math.PI) / n;
    const span = step * 1.34; // each arc reaches ~34% into the next, so they meet with even overlap
    const roots: Root[] = [];
    for (let k = 0; k < n; k++) {
      const a0 = k * step;
      const guide: Point[] = [];
      const steps = 14;
      for (let s = 0; s <= steps; s++) {
        const a = a0 + span * (s / steps);
        const rr = R * (1 + 0.02 * Math.sin(a * 3));
        guide.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
      }
      roots.push(guided(guide, baseHalf, maxLength * 0.4));
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
    // A fan of stems from one low base point (the vessel mouth when present).
    const bx = o.baseOverride?.x ?? o.startPoints[0]?.x ?? width / 2;
    const by = o.baseOverride?.y ?? o.startPoints[0]?.y ?? height - margin * 1.2;
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

  if (o.composition === 'guide') {
    // Grow a stem along each supplied guide polyline (a traced SVG path, a
    // letterform, or the freehand painted stroke). Falls back to the painted
    // points as one path so the paint tool "just works".
    const paths = (o.guidePaths && o.guidePaths.length > 0)
      ? o.guidePaths
      : o.startPoints.length >= 2
        ? [o.startPoints]
        : [];
    const roots: Root[] = [];
    for (const path of paths) {
      if (path.length < 2) continue;
      // Short side-branches so the foliage hugs the traced shape and the
      // silhouette stays legible rather than bushing out into a thicket.
      roots.push(guided(path, baseHalf, maxLength * 0.22));
    }
    return roots;
  }

  const base = (x: number, y: number, angle: number): Root => ({ x, y, angle: angle + jitter(), half: baseHalf, maxLength });

  if (o.seeding === 'painted') return o.startPoints.map((p) => base(p.x, p.y, up));
  if (o.seeding === 'point') {
    const p = o.startPoints[0] ?? { x: width / 2, y: height - margin };
    return [base(p.x, p.y, up)];
  }
  // Rejection-accept a candidate against the negative-space weight (1 when off,
  // so the loop below stays byte-identical). A few tries, then take what we got.
  const accept = (x: number, y: number): boolean =>
    !o.weightAt || rng() <= o.weightAt(x, y);
  if (o.seeding === 'edges') {
    const roots: Root[] = [];
    for (let i = 0; i < o.seedCount; i++) {
      for (let t = 0; t < 6; t++) {
        const edge = Math.floor(rng() * 4);
        let x: number, y: number, ang: number;
        if (edge === 0) { x = margin + rng() * (width - 2 * margin); y = height - margin; ang = up; }
        else if (edge === 1) { x = margin + rng() * (width - 2 * margin); y = margin; ang = Math.PI / 2; }
        else if (edge === 2) { x = margin; y = margin + rng() * (height - 2 * margin); ang = 0; }
        else { x = width - margin; y = margin + rng() * (height - 2 * margin); ang = Math.PI; }
        if (t === 5 || accept(x, y)) { roots.push(base(x, y, ang)); break; }
      }
    }
    return roots;
  }
  const roots: Root[] = [];
  for (let i = 0; i < o.seedCount; i++) {
    for (let t = 0; t < 6; t++) {
      const x = margin + rng() * (width - 2 * margin);
      const y = margin + rng() * (height - 2 * margin);
      if (t === 5 || accept(x, y)) { roots.push(base(x, y, up)); break; }
    }
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
  spacing: number,
  weightAt: ((x: number, y: number) => number) | null = null
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
    branchMaxLen: number;
    /** A child branch starts tangent to its parent and curves away over the
     *  first few steps; this is the per-step turn applied during that ease-in,
     *  so the fork reads as a smooth crotch instead of a sharp angular V. */
    easeTurn: number;
  }
  const stack: Tip[] = roots.map((r) => ({ x: r.x, y: r.y, angle: r.angle, depth: 0, maxLength: r.maxLength, half: r.half, guide: r.guide, gi: 1, branch: false, branchMaxLen: r.branchMaxLen ?? Infinity, easeTurn: 0 }));
  const minBranchLen = stepLength * 6;
  const EASE_STEPS = 5; // steps over which a new branch eases away from its parent

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
        // Steer with two noise octaves offset per-branch by its start position,
        // so each cane wanders on its own slice of the field (neighbours don't
        // bend alike) — a low-frequency sweep plus a higher-frequency meander
        // that keeps short side-branches from reading as straight twigs.
        // Deterministic: derived from geometry, no new rng draws.
        const ox = startX * 0.013;
        const oy = startY * 0.017;
        const lf = noise.noise2D(x * noiseScale + ox, y * noiseScale + oy);
        const hf = noise.noise2D(x * noiseScale * 6.5 + ox + 50, y * noiseScale * 6.5 + oy + 50);
        angle += lf * curl * 0.28 + hf * curl * 0.5;
        // Gentle upward habit, softened — and weaker still on side-branches, so
        // they curl and wander instead of being pulled straight to vertical.
        angle = steer(angle, up, (0.03 + gravitropism * 0.09) * (tip.branch ? 0.5 : 1));
      }

      // Ease a new branch away from its parent: spread its divergence over the
      // first few steps so the fork is a smooth crotch, not a sharp angular kink.
      if (tip.easeTurn !== 0 && i < EASE_STEPS) angle += tip.easeTurn;

      const nx = x + Math.cos(angle) * stepLength;
      const ny = y + Math.sin(angle) * stepLength;
      if (!inBounds(nx, ny)) break;
      const cleared = Math.hypot(nx - startX, ny - startY) > clearDist;
      if (grid && cleared && grid.hasNear(nx, ny, sepDist)) break;

      x = nx;
      y = ny;
      pts.push({ x, y });
      if (grid && cleared) toInsert.push({ x, y });

      // Thin growth out as it enters the held-clear region (notan negative
      // space). Guarded so the rng sequence is untouched when massing is off.
      if (weightAt && cleared && rng() < (1 - weightAt(x, y)) * 0.5) break;

      const effBranchProb = weightAt ? branchProb * weightAt(x, y) : branchProb;
      if (tip.depth < maxDepth && stack.length + stems.length < STEM_CAP && rng() < effBranchProb) {
        const childMax = Math.min(tip.branchMaxLen, tip.maxLength * (0.5 + rng() * 0.28));
        // Skip stubby branches — they read as thorns, not growth.
        if (childMax >= minBranchLen) {
          // Asymmetric bias gives a more designed, less even branch pattern.
          // A shallow fork angle (~18°–42°) so branches diverge gently and the
          // junction flows — a wide kink reads as a snapped twig, not growth.
          const dir = rng() < 0.62 ? 1 : -1;
          const turn = dir * (0.32 + rng() * 0.42);
          // Continuous taper: a branch starts near the parent's *local* width.
          const parentLocal = tip.half * (1 - 0.5 * (i / steps));
          stack.push({
            x, y,
            // Start tangent to the parent; the divergence is spread over the
            // first EASE_STEPS via easeTurn, so the crotch curves rather than kinks.
            angle,
            depth: tip.depth + 1,
            maxLength: childMax,
            half: Math.max(0.6, parentLocal * 0.82),
            gi: 0,
            branch: true,
            branchMaxLen: tip.branchMaxLen,
            easeTurn: turn / EASE_STEPS,
          });
        }
      }
    }

    // Drop stubby branch fragments; keep all trunk/guide stems.
    if (pts.length >= 2 && (!tip.branch || polylineLength(pts) >= minBranchLen * 0.6)) {
      stems.push({ points: pts, baseHalf: tip.half, branch: tip.branch });
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
  region?: (x: number, y: number) => boolean
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

  return extractChains(nodes, baseHalf, penPx, maxLength, stepLength, rng);
}

function extractChains(
  nodes: { x: number; y: number; parent: number }[],
  baseHalf: number,
  penPx: number,
  longLen: number,
  stepLength: number,
  rng: () => number
): Stem[] {
  const childCount = new Array(nodes.length).fill(0);
  for (const nd of nodes) if (nd.parent >= 0) childCount[nd.parent]++;
  const firstChild = new Array(nodes.length).fill(-1);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const par = nodes[i].parent;
    if (par >= 0) firstChild[par] = i;
  }

  // Terminal spurs shorter than this read as spiky noise on the network rather
  // than growth, so they're dropped — the single biggest legibility win for the
  // colonized 'fill' shapes (the heart was a thicket of stubs).
  const minTerminal = stepLength * 3;

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
      const terminal = childCount[cur] === 0;
      if (terminal && par >= 0 && len < minTerminal) continue;
      const frac = Math.min(1, Math.sqrt(len / Math.max(1, longLen)));
      stems.push({ points: pts, baseHalf: penPx + (baseHalf - penPx) * frac, branch: par >= 0 });
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
  stemTexture?: StemTexture;
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
function buildGround(width: number, height: number, margin: number, baseY: number | undefined, wobble: number): FlowLine {
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
 *  vines so they read as climbing it. */
function buildSupport(support: VineSupport, width: number, height: number, margin: number): FlowLine[] {
  if (support === 'none') return [];
  const lines: FlowLine[] = [];
  const x0 = margin * 1.6;
  const x1 = width - margin * 1.6;
  const yTop = margin * 1.6;
  const yBot = height - margin * 1.4;
  if (support === 'lattice') {
    const step = (x1 - x0) / 7;
    const within = (p: Point) => p.y >= yTop && p.y <= yBot;
    // Two diagonal families (slope ±1) crossing into diamonds, clipped to the
    // panel; the offset `c` slides each diagonal across the frame.
    for (let d = -14; d <= 14; d++) {
      const c = d * step;
      const a: Point[] = [];
      const b: Point[] = [];
      for (let s = 0; s <= 1.0001; s += 0.05) {
        const px = x0 + (x1 - x0) * s;
        a.push({ x: px, y: yTop + (px - x0) + c });
        b.push({ x: px, y: yBot - (px - x0) - c });
      }
      const ca = a.filter(within);
      const cb = b.filter(within);
      if (ca.length >= 2) lines.push({ points: ca, layer: 'stem' });
      if (cb.length >= 2) lines.push({ points: cb, layer: 'stem' });
    }
    // A frame.
    lines.push({ points: [{ x: x0, y: yTop }, { x: x1, y: yTop }, { x: x1, y: yBot }, { x: x0, y: yBot }, { x: x0, y: yTop }], layer: 'stem' });
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
interface VesselSpec { profile: [number, number][]; h: number; w: number; }
const VESSEL_SPECS: Record<Exclude<VineVessel, 'none'>, VesselSpec> = {
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
 *  hatching keyed to the same `light` as the vines, held in a light value key,
 *  and the caller wobbles it through the same hand-drawn pass + sketch overdraw,
 *  so it reads as the same hand and grounds the arrangement instead of flattening
 *  it. The silhouette occludes the stem bases; the cast shadow is returned
 *  separately to sit on the ground behind the vessel. */
function buildVessel(
  cx: number,
  topY: number,
  bottomY: number,
  mouthHalf: number,
  type: VineVessel,
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
  // independent of the vine rng.)
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
      let run: Point[] = [];
      for (let y = topY + H * u0; y <= bottomY - penPx; y += penPx) {
        const u = (y - topY) / H;
        const hw = hwOf(u);
        if (hw < penPx * 1.6) {
          if (run.length >= 2) lines.push({ points: run, layer: 'stem' });
          run = [];
          continue;
        }
        const jx = (jit() - 0.5) * penPx * 0.4;
        run.push({ x: cx + shadowSign * hw * f + jx, y });
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
  leafArrangement: LeafArrangement;
  leafletCount: number;
  phyllotaxis: Phyllotaxis;
  whorlCount: number;
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerType: VineFlower;
  flowerProb: number;
  flowerSize: number;
  inflorescence: Inflorescence;
  floretCount: number;
  fruitType: FruitType;
  fruitProb: number;
  dewdrops: boolean;
  dewdropProb: number;
  penPx: number;
  light: Point;
  shadeDensity: number;
  /** Composition focal point — foliage and blooms swell and concentrate near
   *  it (the visual "event"); null for free/colonization growth. */
  focal: Point | null;
  focalR: number;
  /** 0..1 overall foliage density — scales leaf clusters, spacing and blooms. */
  density: number;
  /** Negative-space mass weight (1 everywhere when off); thins foliage in the
   *  held-clear region. */
  weightAt?: ((x: number, y: number) => number) | null;
  /** 0..1 tonal-massing strength. >0 couples leaf shade-intensity to the value
   *  field (the shadow side hatches heavier); 0 leaves hatching untouched so
   *  non-massed renders (incl. notan-only) stay byte-identical. */
  shadeMass: number;
}

/** The golden angle (≈137.5°), the divergence of spiral phyllotaxis. */
const GOLDEN_ANGLE = 2.39996323;

/** One leaf insertion at a node: which side, an angular offset off the stem
 *  tangent, and a foreshortening factor (back leaves of a whorl read shorter). */
interface LeafInsertion {
  side: 1 | -1;
  angOff: number;
  fore: number;
}

/** Resolve a node's leaf insertions for a phyllotaxis mode. `alternate` returns
 *  the legacy single alternating blade; the others place pairs / rings / a
 *  golden-angle spiral, faking the around-stem third dimension in 2D with an
 *  angular spread and a cosine foreshortening. */
function phyllotaxisSites(
  mode: Phyllotaxis,
  node: number,
  side: 1 | -1,
  whorlN: number,
  theta: number
): LeafInsertion[] {
  switch (mode) {
    case 'opposite':
      return [
        { side: 1, angOff: 0, fore: 1 },
        { side: -1, angOff: 0, fore: 1 },
      ];
    case 'whorled': {
      const n = Math.max(2, Math.min(6, Math.round(whorlN)));
      const out: LeafInsertion[] = [];
      for (let k = 0; k < n; k++) {
        // Spread the ring across ±0.7 rad of the tangent; back leaves shorten.
        const a = (k / (n - 1) - 0.5) * 1.4;
        out.push({ side: a < 0 ? -1 : 1, angOff: a, fore: 0.5 + 0.5 * Math.abs(Math.cos(a)) });
      }
      return out;
    }
    case 'spiral': {
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      return [{ side: c < 0 ? -1 : 1, angOff: s * 0.6, fore: 0.55 + 0.45 * Math.abs(c) }];
    }
    case 'alternate':
    default:
      void node;
      return [{ side, angOff: 0, fore: 1 }];
  }
}

function decorate(
  stems: { points: Point[] }[],
  d: DecorParams,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void
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
  // Compound leaves carry many blades per node, so a compound canopy needs the
  // *nodes* spread further apart or it packs into a solid mass (a bipinnate fern
  // at simple-leaf spacing renders ~63 blades per node into a black blob).
  // Exactly 1 for the legacy `simple` arrangement, so that path stays byte-identical.
  const arrSpacing =
    d.leafArrangement === 'bipinnate' ? 3.2 :
    d.leafArrangement === 'pinnate' ? 1.5 :
    d.leafArrangement === 'palmate' || d.leafArrangement === 'trifoliate' ? 1.2 :
    1;
  // Reserve the very end of each cane for the terminal bloom/fruit, so a leaf
  // isn't grown right where the flower opens and then pokes out through the gaps
  // between its petals. Only when a tip decoration is actually in play.
  const hasTipBloom = d.flowers || d.inflorescence !== 'none' || d.fruitType !== 'none';
  const tipReserve = hasTipBloom ? d.flowerSize * 1.4 : 0;

  // Terminal blooms/fruit are buffered and emitted AFTER every cane's foliage,
  // so a flower always sits on top of leaves — a leaf from another cane can't
  // poke through the gaps between its petals. The geometry (and its rng draws)
  // is still computed inline, so only the draw/z order changes, not the stream.
  const deferredBlooms: { lines: FlowLine[]; sils: Point[][] }[] = [];
  const bloomAdd = (lines: FlowLine[], sils: Point[][]): void => { deferredBlooms.push({ lines, sils }); };

  for (const stem of stems) {
    const pts = stem.points;
    if (pts.length < 2) continue;
    const stemLen = polylineLength(pts);
    if (stemLen < d.leafSpacing) continue;

    // Every leaf keeps its full style/detail.
    const effStyle: LeafStyle = d.leafStyle;

    // The "legacy" placement (one alternating blade per site) is preserved
    // byte-for-byte; anything else is a gated new path so existing renders are
    // untouched until a botanical-structure option is dialled up.
    const legacyLeaves = d.leafArrangement === 'simple' && d.phyllotaxis === 'alternate';

    let arc = 0;
    let nextLeaf = d.leafSpacing * spacingFactor * (0.5 + rng()) * arrSpacing;
    let side: 1 | -1 = rng() < 0.5 ? 1 : -1;
    // Spiral phyllotaxis carries a rotating insertion phase; only drawn (so the
    // rng sequence only shifts) when spiral is actually selected.
    let theta = d.phyllotaxis === 'spiral' ? rng() * Math.PI * 2 : 0;
    let node = 0;

    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      arc += seg;
      const dir = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);

      if (arc >= nextLeaf) {
        side = (side === 1 ? -1 : 1) as 1 | -1;
        const along = arc / stemLen;
        const nf = nearFocal(pts[i]);
        // Negative-space weight (1 when off): foliage shrinks and thins toward
        // the held-clear region so it reads as a deliberate empty passage.
        const massW = d.weightAt ? d.weightAt(pts[i].x, pts[i].y) : 1;
        // Leaves swell gently toward the focal point, and with depth.
        const sizeScale = (0.7 + 0.4 * (1 - along)) * (1 + 0.4 * nf) * (0.4 + 0.6 * massW);
        // Leaf *presence* now scales with density (it used to only affect
        // clustering, so a node always bore a leaf — which left winter / density-0
        // plants fully leafed). Below ~0.45 density, sites drop out toward bare;
        // at/above it the canopy is full. A small per-leaf angle jitter further
        // breaks the regular fishbone.
        // rng() is drawn first (left-to-right) so the reserve only flips the
        // result, never the random stream.
        const present = d.leaves && rng() < Math.min(1, dens * 2.2) * massW && (stemLen - arc) > tipReserve;
        const jit = (rng() - 0.5) * 0.5;
        if (present && legacyLeaves) {
          // Extra leaves cluster the canopy near the focal point.
          const cluster = 1 + (rng() < dens * massW ? 1 : 0) + (rng() < (dens - 0.4 + 0.6 * nf) * massW ? 1 : 0);
          for (let c = 0; c < cluster; c++) {
            const s: 1 | -1 = c === 0 ? side : ((rng() < 0.5 ? 1 : -1) as 1 | -1);
            const leaf = makeLeaf(pts[i], dir + jit, s, d.leafSize * sizeScale * (0.8 + rng() * 0.5), d, effStyle, rng);
            add(leaf.lines, leaf.silhouette);
          }
        } else if (present) {
          // Phyllotaxis places one or more insertions at this node; each is a
          // single blade or a whole compound leaf.
          const sites = phyllotaxisSites(d.phyllotaxis, node, side, d.whorlCount, theta);
          const compound = d.leafArrangement !== 'simple';
          for (const ins of sites) {
            const ldir = dir + ins.angOff + jit;
            if (compound) {
              const clen = d.leafSize * sizeScale * 2.2 * ins.fore * (0.85 + rng() * 0.3);
              makeCompoundLeaf(pts[i], ldir, ins.side, clen, d, effStyle, rng, add, 0);
            } else {
              const llen = d.leafSize * sizeScale * ins.fore * (0.8 + rng() * 0.5);
              const leaf = makeLeaf(pts[i], ldir, ins.side, llen, d, effStyle, rng);
              add(leaf.lines, leaf.silhouette);
            }
          }
        }
        if (d.tendrils && rng() < d.tendrilProb) {
          const t = makeTendril(pts[i], dir, (-side) as 1 | -1, d.leafSize * (0.8 + rng()), rng);
          add([t], []);
        }
        // Fruit borne along the cane (grapes hang from the vine, not just tips).
        // Gated on a non-'none' type, so it never perturbs a fruitless render.
        if (d.fruitType !== 'none' && rng() < d.fruitProb * 0.35 * (0.5 + dens) * massW) {
          const fr = makeFruit(pts[i], d.fruitType, d.flowerSize * (0.9 + rng() * 0.5), d.penPx, d.light, rng, add);
          add(fr.lines, fr.silhouette);
        }
        // A dewdrop catching the light, near the leaf base. Gated, so it never
        // perturbs a dewless render's rng sequence.
        if (d.dewdrops && rng() < d.dewdropProb) {
          const r = d.penPx * (1.6 + rng() * 1.6);
          const ox = pts[i].x + (rng() - 0.5) * d.leafSize * 0.3;
          const oy = pts[i].y + (rng() - 0.5) * d.leafSize * 0.3;
          add(makeDewdrop({ x: ox, y: oy }, r, d.light), []);
        }
        // Internodes vary widely and lengthen toward the base (foliage gathers
        // near the growing tip, longer bare stretches lower down) so the rhythm
        // reads hand-grown rather than metronomic.
        nextLeaf += d.leafSpacing * spacingFactor * (0.5 + rng() * 1.0) * (1.3 - 0.5 * along) * (1 - 0.25 * nf) * arrSpacing;
        theta += GOLDEN_ANGLE;
        node++;
      }
    }

    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const tipDir = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const nfTip = nearFocal(tip);
    const massWTip = d.weightAt ? d.weightAt(tip.x, tip.y) : 1;
    const flowerChance = Math.min(1, d.flowerProb * (0.6 + 0.8 * dens) * (1 + 2 * nfTip) * massWTip);
    const legacyTip = d.inflorescence === 'none' && d.fruitType === 'none';
    if (legacyTip) {
      if (d.flowers && rng() < flowerChance) {
        // A bloom cluster, larger and more numerous toward the focal point.
        const blooms = 1 + (rng() < 0.3 * dens + 0.4 * nfTip ? 1 : 0) + (rng() < 0.5 * nfTip ? 1 : 0);
        for (let b = 0; b < blooms; b++) {
          const jx = b === 0 ? 0 : (rng() - 0.5) * d.flowerSize * 2.4;
          const jy = b === 0 ? 0 : (rng() - 0.5) * d.flowerSize * 2.4;
          makeFlower({ x: tip.x + jx, y: tip.y + jy }, d.flowerSize * (0.7 + rng() * 0.6) * (1 + 0.5 * nfTip), d.penPx, d.flowerType, d.light, rng, bloomAdd, tipDir);
        }
      } else if (d.tendrils && rng() < d.tendrilProb) {
        const t = makeTendril(tip, tipDir, (rng() < 0.5 ? 1 : -1) as 1 | -1, d.leafSize * (0.8 + rng()), rng);
        add([t], []);
      }
    } else {
      // New tip path: an inflorescence and/or a fruit cluster.
      if (d.inflorescence !== 'none') {
        if (d.flowers && rng() < flowerChance) {
          makeInflorescence(d.inflorescence, tip, tipDir, d.flowerSize * (1.4 + 1.2 * nfTip), d, rng, bloomAdd);
        }
      } else if (d.flowers && rng() < flowerChance) {
        makeFlower(tip, d.flowerSize * (0.7 + rng() * 0.6) * (1 + 0.5 * nfTip), d.penPx, d.flowerType, d.light, rng, bloomAdd, tipDir);
      }
      if (d.fruitType !== 'none' && rng() < Math.min(1, d.fruitProb * (0.6 + 0.8 * dens) * massWTip)) {
        const fr = makeFruit(tip, d.fruitType, d.flowerSize * 1.15 * (0.85 + 0.4 * nfTip), d.penPx, d.light, rng, bloomAdd);
        bloomAdd(fr.lines, fr.silhouette);
      }
    }
  }

  // Emit every terminal bloom on top of the whole canopy (see deferredBlooms).
  for (const b of deferredBlooms) add(b.lines, b.sils);
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
      // Deeper sinuses between broader lobes so ivy/maple/grape read as palmate
      // lobed blades, not faintly rippled ovals.
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85) * (0.58 + 0.42 * Math.cos(lobes * Math.PI * u));
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
    if (serrate && t > pet) h *= 1 + 0.24 * Math.sin(i * 2.2);
    left.push({ x: axis[i].x + normals[i].x * h, y: axis[i].y + normals[i].y * h });
    right.push({ x: axis[i].x - normals[i].x * h, y: axis[i].y - normals[i].y * h });
  }
  const poly = outlineFromEdges(left, right);

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
    // Couple hatch density to the scene value field: leaves on the shadow side
    // (high mass) hatch tighter, the lit side opens up — so the canopy carries a
    // committed value structure, not a flat even tone. Purely deterministic
    // geometry (no rng), and inert (effShade === d.shadeDensity) when massing is
    // off, so non-massed renders stay byte-identical.
    let effShade = d.shadeDensity;
    if (d.shadeMass > 0 && d.weightAt) {
      const m = d.weightAt(base.x, base.y); // 1 = dense/shadow, →LIT_FLOOR = lit
      effShade = Math.max(0, Math.min(1, d.shadeDensity * (1 + 0.5 * d.shadeMass * (m - 0.6))));
    }
    const hatchStep = penPx * (2 + (1 - effShade) * 5);
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

/** A compound leaf: many `makeLeaf` blades sharing one petiole/rachis. Each
 *  leaflet is `add`ed as its own occluding element (so siblings overlap
 *  correctly); the rachis is added first so it sits behind them. */
function makeCompoundLeaf(
  base: Point,
  stemDir: number,
  side: 1 | -1,
  len: number,
  d: DecorParams,
  style: LeafStyle,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void,
  depth = 0
): void {
  const penPx = d.penPx;
  const arrangement = d.leafArrangement;
  const spread = (Math.PI / 4) * (0.85 + rng() * 0.4);
  const baseAngle = stemDir + side * spread;

  // Palmate / trifoliate: leaflets radiate from one point, no rachis.
  if (arrangement === 'palmate' || arrangement === 'trifoliate') {
    const n = arrangement === 'trifoliate' ? 3 : Math.max(3, Math.min(9, Math.round(d.leafletCount)));
    const fan = arrangement === 'trifoliate' ? 0.5 : 0.85;
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0.5 : k / (n - 1);
      const a = baseAngle + (u - 0.5) * 2 * fan;
      const m = 1 - Math.abs(u - 0.5) * (arrangement === 'trifoliate' ? 0.7 : 0.85);
      const lf = makeLeaf(base, a, u < 0.5 ? -1 : 1, len * (0.55 + 0.4 * m) * (0.9 + rng() * 0.2), d, style, rng);
      add(lf.lines, lf.silhouette);
    }
    return;
  }

  // Pinnate / bipinnate: a gently curved rachis with paired leaflets + terminal.
  const M = 14;
  const axis: Point[] = [{ x: base.x, y: base.y }];
  let x = base.x;
  let y = base.y;
  const curl = (rng() - 0.5) * 0.5;
  for (let j = 1; j <= M; j++) {
    const t = j / M;
    const ang = baseAngle + curl * t;
    const step = len / M;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    axis.push({ x, y });
  }
  const rachis = smoothPolyline(axis, 1);
  const dn = densify(rachis, penPx);
  const rib = ribbon(dn, normalsOf(dn), dn.map(() => penPx * 0.9), penPx, 'stem', 'solid');
  add(rib, rib.length ? [rib[0].points] : []);

  const total = Math.max(3, Math.min(11, Math.round(d.leafletCount)));
  const pairs = Math.max(1, Math.floor((total - 1) / 2));
  const leafletLen = len * (depth === 0 ? 0.4 : 0.5);
  const recurse = depth === 0 && arrangement === 'bipinnate';
  // A bipinnate frond's pinnules read as small simple blades; drawing each as a
  // full veined/shaded leaf packs them into a black mass. Render the sub-pinnae's
  // leaflets as light outlines and thin their count so a fern reads as fronds.
  const SUB_LEAFLETS = 5;
  const subStyle: LeafStyle = 'outline';
  for (let p = 1; p <= pairs; p++) {
    const t = p / (pairs + 1);
    const idx = Math.max(1, Math.min(rachis.length - 1, Math.round(t * (rachis.length - 1))));
    const segNext = rachis[Math.min(idx + 1, rachis.length - 1)];
    const segPrev = rachis[idx - 1];
    const tang = Math.atan2(segNext.y - segPrev.y, segNext.x - segPrev.x);
    const sizeGrad = 0.7 + 0.3 * (1 - t);
    for (const s of [1, -1] as const) {
      const ll = leafletLen * sizeGrad * (0.85 + rng() * 0.3);
      if (recurse) {
        makeCompoundLeaf(rachis[idx], tang, s, ll * 1.6, { ...d, leafArrangement: 'pinnate', leafletCount: SUB_LEAFLETS }, subStyle, rng, add, 1);
      } else {
        const lf = makeLeaf(rachis[idx], tang, s, ll, d, style, rng);
        add(lf.lines, lf.silhouette);
      }
    }
  }
  // Terminal leaflet at the rachis tip.
  const tip = rachis[rachis.length - 1];
  const tprev = rachis[rachis.length - 2];
  const tdir = Math.atan2(tip.y - tprev.y, tip.x - tprev.x);
  const tl = leafletLen * (0.85 + rng() * 0.3);
  if (recurse) {
    makeCompoundLeaf(tip, tdir, 1, tl * 1.6, { ...d, leafArrangement: 'pinnate', leafletCount: SUB_LEAFLETS }, subStyle, rng, add, 1);
  } else {
    const lf = makeLeaf(tip, tdir, 1, tl, d, style, rng);
    add(lf.lines, lf.silhouette);
  }
}

// ——— tendrils & flowers ———

/** A dewdrop: a small ring with the lit quadrant left open and a short
 *  highlight tick inside, so it reads as a glistening bead of water. */
function makeDewdrop(center: Point, r: number, light: Point): FlowLine[] {
  const la = Math.atan2(light.y, light.x);
  const ring: Point[] = [];
  // Leave a ~70° gap on the lit side (the rim catches the light).
  for (let s = 0; s <= 28; s++) {
    const a = la + 0.6 + (s / 28) * (2 * Math.PI - 1.2);
    ring.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  const hx = center.x + Math.cos(la) * r * 0.4;
  const hy = center.y + Math.sin(la) * r * 0.4;
  return [
    { points: ring, layer: 'vein' },
    { points: [{ x: hx - Math.cos(la) * r * 0.15, y: hy - Math.sin(la) * r * 0.15 }, { x: hx + Math.cos(la) * r * 0.15, y: hy + Math.sin(la) * r * 0.15 }], layer: 'vein' },
  ];
}

function makeTendril(base: Point, stemDir: number, side: 1 | -1, size: number, rng: () => number): FlowLine {
  // A graceful tendril: a tangent lead-in off the cane easing into an open coil
  // that spirals *inward* to a tight centre — a climbing-vine curl, not a
  // detached bullseye ring floating beside the stem.
  const lead = size * (0.7 + rng() * 0.5);
  const leadAng = stemDir + side * 0.5;
  const lx = Math.cos(leadAng);
  const ly = Math.sin(leadAng);
  const tipX = base.x + lx * lead;
  const tipY = base.y + ly * lead;
  // Lead-in carries a midpoint so, once smoothed, the coil reads as growing out
  // of the cane rather than as a ring dropped next to it.
  const pts: Point[] = [
    { x: base.x, y: base.y },
    { x: base.x + lx * lead * 0.5, y: base.y + ly * lead * 0.5 },
    { x: tipX, y: tipY },
  ];

  const coils = 0.55 + rng() * 0.6; // ~0.55–1.15 turns: an open hook, never a full O
  const steps = 40;
  const baseR = size * 0.42;
  // Coil centre sits perpendicular to the lead so the first arc leaves the tip
  // tangentially (no kink at the junction).
  const perpAng = leadAng + side * (Math.PI / 2);
  const cx = tipX + Math.cos(perpAng) * baseR;
  const cy = tipY + Math.sin(perpAng) * baseR;
  const phi0 = Math.atan2(tipY - cy, tipX - cx);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const phi = phi0 + side * coils * 2 * Math.PI * t;
    const r = baseR * Math.pow(1 - t, 1.3); // spirals in to a tight centre
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

/** A single berry as an engraved sphere rather than a hollow ring: the rim is
 *  drawn with a small gap on the lit side (a reserved-white catchlight), and
 *  one or two nested crescent arcs on the shadow side give it volume. Every
 *  berry jitters its catchlight, gap, crescents and a slight squash+tilt off
 *  `rng`, so a cluster reads as hand-drawn individuals, not a stamped pattern. */
function makeBerry(center: Point, radius: number, light: Point, rng: () => number): { lines: FlowLine[]; sil: Point[] } {
  // Catchlight roughly toward the light, but nudged per berry; the gap and the
  // berry's squash/tilt vary too.
  const la = Math.atan2(light.y, light.x) + (rng() - 0.5) * 0.7;
  const sa = la + Math.PI;
  const gap = 0.32 + rng() * 0.3;
  const squash = 0.88 + rng() * 0.2; // minor-axis fraction
  const tilt = (rng() - 0.5) * 0.8;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // Map a unit-circle angle to the tilted, squashed berry surface.
  const at = (a: number, rr: number): Point => {
    const ex = Math.cos(a) * rr;
    const ey = Math.sin(a) * rr * squash;
    return { x: center.x + ex * ct - ey * st, y: center.y + ex * st + ey * ct };
  };
  const segs = Math.max(14, Math.round(radius * 2.6));
  const lines: FlowLine[] = [];
  const sil: Point[] = [];
  const rim: Point[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = la + gap + (i / segs) * (2 * Math.PI - 2 * gap);
    rim.push(at(a, radius));
  }
  lines.push({ points: rim, layer: 'flower' });
  for (let i = 0; i <= segs; i++) sil.push(at((i / segs) * 2 * Math.PI, radius));
  // One or two shadow-side crescents (riper berries get the second), each a
  // little different in reach and span.
  const crescents = rng() < 0.6 ? 2 : 1;
  for (let k = 1; k <= crescents; k++) {
    const rr = radius * (0.46 + 0.2 * k + (rng() - 0.5) * 0.1);
    const span = 1.8 - 0.3 * k + (rng() - 0.5) * 0.4;
    const arc: Point[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) arc.push(at(sa - span / 2 + (i / steps) * span, rr));
    lines.push({ points: arc, layer: 'flower' });
  }
  return { lines, sil };
}

/** A flower as botanical line-work, varied by species — matching the leaves'
 *  outline-and-detail treatment rather than a solid blob. Each petal (and the
 *  centre detail) is `add`ed as its OWN occluding element, in draw order, so a
 *  front petal hides the part of the petal behind it — the overlap reads as
 *  layered petals, not transparent crossing loops. The petal silhouettes are the
 *  actual closed shapes (not a bounding disc), so the gaps between petals stay
 *  open (no circular halo) while the bloom still occludes the foliage behind. */
function makeFlower(
  center: Point,
  size: number,
  penPx: number,
  type: VineFlower,
  light: Point,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void,
  dir?: number
): void {
  const t: VineFlower = type === 'mixed' ? FLOWER_TYPES[Math.floor(rng() * FLOWER_TYPES.length)] : type;
  const rot = rng() * Math.PI * 2;

  if (t === 'rose') {
    const petals = 5 + Math.floor(rng() * 2);
    // A silhouette-only central disc (no drawn line) so foliage or stem sitting
    // behind the bloom's centre is occluded instead of poking through the gaps
    // between petals. Added before the petals so it occludes earlier elements
    // (the leaves/stem) without clipping the petals drawn over it.
    const hub: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      hub.push({ x: center.x + Math.cos(a) * size * 0.6, y: center.y + Math.sin(a) * size * 0.6 });
    }
    add([], [hub]);
    // Each petal its own element, so the next overlapping petal occludes it.
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * 2 * Math.PI;
      const pl = petalOutline(center, ang, size, size * 0.42, penPx);
      add([pl], [pl.points]);
    }
    // A few short stamen ticks at the centre, on top of the petals.
    const stamens: FlowLine[] = [];
    for (let k = 0; k < 4; k++) {
      const a = rot + rng() * Math.PI * 2;
      stamens.push({ points: [{ x: center.x, y: center.y }, { x: center.x + Math.cos(a) * size * 0.22, y: center.y + Math.sin(a) * size * 0.22 }], layer: 'flower' });
    }
    add(stamens, []);
  } else if (t === 'daisy') {
    const petals = 11 + Math.floor(rng() * 5);
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * 2 * Math.PI;
      const pl = petalOutline(center, ang, size, size * 0.12, penPx);
      add([pl], [pl.points]);
    }
    const ring = ringOutline(center, size * 0.28, 'flower');
    add([ring], [ring.points]);
  } else if (t === 'bell') {
    // A bell / foxglove bloom built from rounded petal lobes (the same
    // primitive as the rose) flaring from a common throat, with the throat set
    // back from the centre so the petals form a deep cupped trumpet rather than
    // a flat star. Petals read as a soft flower — not a geometric pentagon.
    // Open along the stem (away from where it joins) when a direction is given,
    // so the throat sits on the stem tip and the petals flare outward — not a
    // bloom floating off to one side.
    const face = dir ?? rot;                 // direction the bloom opens toward
    const petals = 5;
    const spread = 2.0;                      // fan of the petal lobes (radians)
    // Throat behind the centre (back toward the stem), so petals splay forward.
    const throat = { x: center.x - Math.cos(face) * size * 0.5, y: center.y - Math.sin(face) * size * 0.5 };
    for (let k = 0; k < petals; k++) {
      const f = k / (petals - 1);
      const ang = face + (f - 0.5) * spread;
      const plen = size * (0.95 + 0.2 * Math.sin(f * Math.PI)); // centre petals longer
      const pl = petalOutline(throat, ang, plen, size * 0.3, penPx);
      add([pl], [pl.points]);
    }
    // A short calyx/tube where it joins the pedicel, on top of the petal bases.
    add([{ points: [throat, { x: throat.x - Math.cos(face) * size * 0.35, y: throat.y - Math.sin(face) * size * 0.35 }], layer: 'flower' }], []);
  } else {
    // bud: a closed teardrop with two sepal strokes at its base; points along
    // the stem (away from the join) when a direction is given.
    const a = dir ?? rot;
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
    // A bud is one closed teardrop with two sepal strokes — no internal petal
    // overlap, so it's a single element.
    const budLines: FlowLine[] = [{ points: bud, layer: 'flower' }];
    for (const s of [1, -1] as const) {
      budLines.push({ points: [{ x: center.x, y: center.y }, { x: center.x + dx * size * 0.4 + px * s * size * 0.22, y: center.y + dy * size * 0.4 + py * s * size * 0.22 }], layer: 'flower' });
    }
    add(budLines, [bud]);
  }
  void light;
}

// ——— inflorescences, thorns & fruit ———

/** A multi-flower structure borne at a tip: each floret is a `makeFlower` added
 *  as its own occluding element. Racemes/spikes grade from open florets at the
 *  base to buds at the tip; umbels/corymbs radiate from one point. */
function makeInflorescence(
  type: Inflorescence,
  base: Point,
  axisDir: number,
  size: number,
  d: DecorParams,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void
): void {
  if (type === 'none') return;
  const penPx = d.penPx;
  const n = Math.max(3, Math.min(16, Math.round(d.floretCount)));
  const dx = Math.cos(axisDir);
  const dy = Math.sin(axisDir);
  const px = -dy;
  const py = dx;

  if (type === 'umbel' || type === 'corymb') {
    // Florets gathered on slender, gently *curving* pedicels — a rounded posy
    // (umbel) or flat-topped head (corymb). Curved, varied-length pedicels and
    // small florets read as a natural cluster instead of a stiff umbrella of
    // straight radial spokes.
    const m = Math.max(4, Math.min(11, n));
    const stalk = size * (type === 'umbel' ? 1.7 : 2.0);
    for (let k = 0; k < m; k++) {
      const u = m === 1 ? 0.5 : k / (m - 1);
      const a = axisDir + (u - 0.5) * 1.1 + (rng() - 0.5) * 0.3;
      const len = type === 'umbel'
        ? stalk * (0.78 + rng() * 0.35)
        : stalk * (0.55 + Math.abs(u - 0.5) * 0.9 + rng() * 0.2);
      const fx = base.x + Math.cos(a) * len;
      const fy = base.y + Math.sin(a) * len;
      // Bow the pedicel sideways so it arcs rather than spoking out straight.
      const bow = (rng() - 0.5) * 0.5;
      const mx = (base.x + fx) / 2 + Math.cos(a + Math.PI / 2) * len * bow;
      const my = (base.y + fy) / 2 + Math.sin(a + Math.PI / 2) * len * bow;
      const ped = smoothPolyline([base, { x: mx, y: my }, { x: fx, y: fy }], 1);
      add([{ points: ped, layer: 'stem' }], []);
      makeFlower({ x: fx, y: fy }, size * (0.5 + rng() * 0.25), penPx, d.flowerType, d.light, rng, add, a);
    }
    return;
  }

  // Raceme / spike: florets strung along a leaning/hanging axis.
  const L = size * (type === 'raceme' ? 5 : 4);
  const axis: Point[] = [];
  const bend = (rng() - 0.5) * 0.6;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    axis.push({ x: base.x + dx * L * t + px * bend * L * t * t, y: base.y + dy * L * t + py * bend * L * t * t });
  }
  const ax = smoothPolyline(axis, 1);
  add([{ points: ax, layer: 'stem' }], []);
  for (let k = 0; k < n; k++) {
    const t = k / Math.max(1, n - 1); // 0 = base, 1 = tip
    const idx = Math.max(1, Math.min(ax.length - 1, Math.round(t * (ax.length - 1))));
    const at = ax[idx];
    const maturity = 1 - t; // base most open, tip still in bud
    const fsize = size * (0.55 + 0.5 * maturity);
    const ftype: VineFlower = maturity > 0.5 ? d.flowerType : 'bud';
    if (type === 'raceme') {
      const ped = size * 0.7;
      const fx = at.x + px * (k % 2 ? 1 : -1) * ped * 0.4 + dx * ped * 0.3;
      const fy = at.y + py * (k % 2 ? 1 : -1) * ped * 0.4 + dy * ped * 0.3;
      add([{ points: [at, { x: fx, y: fy }], layer: 'stem' }], []);
      makeFlower({ x: fx, y: fy }, fsize, penPx, ftype, d.light, rng, add, Math.atan2(fy - at.y, fx - at.x));
    } else {
      makeFlower(at, fsize * 0.8, penPx, ftype, d.light, rng, add, axisDir + Math.PI / 2);
    }
  }
}

/** Recurved thorns spaced along a cane, on the stem layer, pointing back toward
 *  the base. Returned as plain lines to append onto the stem element so they
 *  share the cane's depth. Only invoked when thorns are enabled. */
function makeThorns(stemPts: Point[], baseHalf: number, prob: number, penPx: number, rng: () => number): FlowLine[] {
  const out: FlowLine[] = [];
  if (stemPts.length < 2) return out;
  const spacing = Math.max(6, penPx * 12 * (1 - Math.min(0.9, prob)));
  let acc = 0;
  let side: 1 | -1 = 1;
  for (let i = 1; i < stemPts.length; i++) {
    acc += Math.hypot(stemPts[i].x - stemPts[i - 1].x, stemPts[i].y - stemPts[i - 1].y);
    if (acc < spacing) continue;
    acc = 0;
    side = (side === 1 ? -1 : 1) as 1 | -1;
    if (rng() > prob * 3) continue;
    const dir = Math.atan2(stemPts[i].y - stemPts[i - 1].y, stemPts[i].x - stemPts[i - 1].x);
    const nx = -Math.sin(dir) * side;
    const ny = Math.cos(dir) * side;
    const len = Math.max(penPx * 2.5, baseHalf * (1.1 + rng() * 0.7));
    const root = stemPts[i];
    // Out along the normal then hooked back toward the cane base — a recurve.
    const tipx = root.x + nx * len - Math.cos(dir) * len * 0.7;
    const tipy = root.y + ny * len - Math.sin(dir) * len * 0.7;
    const midx = root.x + nx * len * 0.5 - Math.cos(dir) * len * 0.1;
    const midy = root.y + ny * len * 0.5 - Math.sin(dir) * len * 0.1;
    out.push({ points: [{ x: root.x, y: root.y }, { x: midx, y: midy }, { x: tipx, y: tipy }], layer: 'stem' });
  }
  return out;
}

/** A fruiting body on the `flower` pen layer. Cluster fruits (grape / berry)
 *  `add` each berry as its own occluding element and return the stalk; single
 *  bodies (rosehip / pod / catkin) are returned whole. */
function makeFruit(
  center: Point,
  type: FruitType,
  size: number,
  penPx: number,
  light: Point,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void
): { lines: FlowLine[]; silhouette: Point[][] } {
  void penPx;
  if (type === 'grape' || type === 'berry') {
    const big = type === 'grape';
    const count = big ? 9 + Math.floor(rng() * 10) : 3 + Math.floor(rng() * 4);
    const r = size * (big ? 0.36 : 0.42);
    const rows = big ? Math.ceil(Math.sqrt(count)) : 2;
    // Pack snugly so the berries kiss and overlap into a solid hanging bunch
    // (widest at the shoulders, tapering to a point) rather than a loose bead
    // ladder. Each berry is shaded as a sphere and added as its own element so
    // the front ones occlude those behind. Tighter pitch + row spacing than a
    // bounding grid; the per-berry rng draws (bx, by, radius) are unchanged in
    // order and count so determinism holds.
    const pitch = r * 1.12;
    const rowPitch = pitch * 0.8;
    let placed = 0;
    for (let row = 0; row < rows && placed < count; row++) {
      const inRow = big ? Math.max(1, rows - row) : Math.max(1, count - placed);
      const rowW = (inRow - 1) * pitch;
      // Stagger alternate rows like real bunches.
      const stagger = row % 2 ? pitch * 0.5 : 0;
      for (let c = 0; c < inRow && placed < count; c++) {
        const bx = center.x + (c * pitch - rowW / 2) + stagger + (rng() - 0.5) * r * 0.25;
        const by = center.y + row * rowPitch + (rng() - 0.5) * r * 0.2 + size * 0.4;
        const berry = makeBerry({ x: bx, y: by }, r * (0.82 + rng() * 0.36), light, rng);
        add(berry.lines, [berry.sil]);
        placed++;
      }
    }
    return { lines: [{ points: [center, { x: center.x, y: center.y + size * 0.4 }], layer: 'stem' }], silhouette: [] };
  }
  if (type === 'rosehip') {
    // An engraved hip, not a hollow ring: the rim breaks for a lit-side
    // catchlight, shadow-side crescents give it volume, and a little sepal crown
    // at the calyx end reads it as a rosehip (so it never reads as a stray O).
    // Deterministic (catchlight follows the light) so it perturbs no rng stream.
    const N = 18;
    const w = size * 0.55;
    const h = size * 0.78;
    const la = Math.atan2(light.y, light.x);
    const sil: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI;
      sil.push({ x: center.x + Math.cos(a) * w, y: center.y + Math.sin(a) * h });
    }
    const gap = 0.5; // catchlight on the lit side
    const rim: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const a = la + gap + (i / N) * (2 * Math.PI - 2 * gap);
      rim.push({ x: center.x + Math.cos(a) * w, y: center.y + Math.sin(a) * h });
    }
    const lines: FlowLine[] = [{ points: rim, layer: 'flower' }];
    const sa = la + Math.PI; // shadow side
    for (let k = 1; k <= 2; k++) {
      const span = 1.7 - 0.3 * k;
      const rr = 0.5 + 0.18 * k;
      const arc: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = sa - span / 2 + (i / 8) * span;
        arc.push({ x: center.x + Math.cos(a) * w * rr, y: center.y + Math.sin(a) * h * rr });
      }
      lines.push({ points: arc, layer: 'flower' });
    }
    // Sepal crown: a small fan of ticks radiating from the calyx (lower) end.
    const by = center.y + h * 0.95;
    for (let s = -2; s <= 2; s++) {
      const ta = Math.PI / 2 + s * 0.34;
      lines.push({ points: [{ x: center.x, y: by }, { x: center.x + Math.cos(ta) * w * 0.55, y: by + Math.sin(ta) * h * 0.3 }], layer: 'flower' });
    }
    return { lines, silhouette: [sil] };
  }
  if (type === 'pod') {
    const a = -Math.PI / 2 + (rng() - 0.5) * 0.6;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    const L = size * 2.1;
    const N = 12;
    const pod: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.36;
      pod.push({ x: center.x + dx * L * u + px * wb, y: center.y + dy * L * u + py * wb });
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.36;
      pod.push({ x: center.x + dx * L * u - px * wb, y: center.y + dy * L * u - py * wb });
    }
    const seam: Point[] = [{ x: center.x, y: center.y }, { x: center.x + dx * L, y: center.y + dy * L }];
    return { lines: [{ points: pod, layer: 'flower' }, { points: seam, layer: 'flower' }], silhouette: [pod] };
  }
  // catkin: a soft drooping lozenge — narrow at the stalk, swelling, then
  // tapering to the tip — textured with short diagonal scales. (The old version
  // was a bare axis with symmetric perpendicular ticks, which read as a stiff
  // ladder rather than a fuzzy catkin.)
  const a = Math.PI / 2 + (rng() - 0.5) * 0.5; // droops downward
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const L = size * 2.5;
  const N = 16;
  const bend = (rng() - 0.5) * 0.4;
  const axis: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    axis.push({ x: center.x + dx * L * t + px * bend * L * t * t, y: center.y + dy * L * t + py * bend * L * t * t });
  }
  const ax = smoothPolyline(axis, 1);
  const halfAt = (t: number): number => Math.sin(Math.PI * Math.pow(t, 0.6)) * size * 0.36 * (1 - 0.35 * t);
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < ax.length; i++) {
    const t = i / (ax.length - 1);
    const h = halfAt(t);
    left.push({ x: ax[i].x + px * h, y: ax[i].y + py * h });
    right.push({ x: ax[i].x - px * h, y: ax[i].y - py * h });
  }
  const outline = outlineFromEdges(left, right);
  const lines: FlowLine[] = [{ points: outline, layer: 'flower' }];
  // Short diagonal scale-ticks, alternating sides, angled toward the tip.
  for (let i = 1; i < ax.length - 1; i++) {
    const t = i / (ax.length - 1);
    const h = halfAt(t);
    if (h < size * 0.06) continue;
    const s = i % 2 ? 1 : -1;
    lines.push({
      points: [
        { x: ax[i].x, y: ax[i].y },
        { x: ax[i].x + px * s * h * 0.85 + dx * h * 0.4, y: ax[i].y + py * s * h * 0.85 + dy * h * 0.4 },
      ],
      layer: 'flower',
    });
  }
  return { lines, silhouette: [outline] };
}

