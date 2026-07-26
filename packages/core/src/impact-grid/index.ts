import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { lerp } from '../lib/math.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { densify } from '../lib/spatial.js';
import { smoothPolyline } from '../lib/polyline.js';
import { layoutSquares, squareAt } from './layout.js';
import { preparePath, squareResponse } from './impact.js';
import { shatterSquare } from './shatter.js';
import { concentricFill, hatchConvex } from './hatch.js';

/**
 * A page of hand-ruled squares — organic by default (variable sizes, jittered
 * positions and rotations, low-frequency size drift, hand wobble) — struck by
 * a drawn impact path. Squares near the path are pushed away, torqued and
 * compressed with distance falloff; close in they shatter into convex shards
 * that scatter as debris, the innermost pulverised away entirely. Optional
 * hatch fill darkens toward the scar. Two layouts: the page-filling grid and
 * a border frame with an empty centre. Single pen, deterministic per seed;
 * no path ⇒ the pristine grid, byte-identical run to run.
 */
export interface ImpactGridOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** 'grid' fills the framed page; 'frame' keeps only a border band of cells.
   *  Planned extension: further arrangements (rings, clusters) — the impact
   *  stage is layout-agnostic. */
  layout?: 'grid' | 'frame';
  /** Cells deep the 'frame' band runs, 1..6. */
  frameDepth?: number;

  // Grid (organic defaults)
  /** Mean cell pitch, px. Default: min(innerW, innerH) / 14. */
  cellSize?: number;
  /** 0..1 per-cell side-length jitter. */
  sizeVariation?: number;
  /** 0..1 centre jitter as a fraction of pitch. */
  positionJitter?: number;
  /** 0..1 per-cell rotation jitter (±10° at 1). */
  rotationJitter?: number;
  /** 0..0.6 mean gap between squares as a fraction of pitch. */
  gap?: number;

  // Impact — inert when the path is missing/short: pristine grid.
  /** Impact centreline in page px (the web layer passes the drawn path). */
  impactPath?: Point[];
  /** Falloff radius, px. Default: min(innerW, innerH) * 0.3. */
  impactRadius?: number;
  /** 0..1 overall push / torque / compression. */
  impactStrength?: number;
  /** 0..1 shatter-zone size, fragment count and spin. */
  shatter?: number;
  /** 0..1 fragment scatter distance as a fraction of the radius. */
  scatter?: number;
  /** 0..1 chance the innermost fragments vanish entirely — pulverised. */
  debris?: number;
  /** 0..1 rubble fineness: how deeply struck squares subdivide, deepest
   *  tight to the line. */
  crush?: number;
  /** 0..1 rubble drift along the line's direction of travel — the stroke
   *  ploughing through rather than blasting outward. */
  sweep?: number;

  // Marks
  /** 0..1 fill amount: fraction of cells carrying the fill marks, with
   *  shards darkening toward the impact. 0 = pure outlines. */
  fill?: number;
  /** What the fill marks are: parallel hatch, concentric nested rings (the
   *  plotter "solid"), or none. */
  fillStyle?: 'none' | 'hatch' | 'concentric';
  /** Ink the drawn path itself as a stroke (default false — the line is
   *  revealed by the destruction it causes). */
  inkPath?: boolean;
  penWidth?: number;
  wobble?: number;
  /** Reorder strokes to cut pen-up travel (default true) */
  optimize?: boolean;
}

// Defaults follow the Breakpoint read: a calm, near-ordered system, one line
// crushing what it touches in place — no displacement field, dense fills.
// The v1 "rip" (big push + far-flung debris) stays reachable via
// impactStrength / scatter / debris.
const DEFAULTS: Required<
  Omit<ImpactGridOptions, 'width' | 'height' | 'margin' | 'seed' | 'impactPath' | 'cellSize' | 'impactRadius'>
> = {
  layout: 'grid',
  frameDepth: 3,
  sizeVariation: 0.1,
  positionJitter: 0.06,
  rotationJitter: 0.05,
  gap: 0.12,
  impactStrength: 0,
  shatter: 0.85,
  scatter: 0.1,
  debris: 0.15,
  crush: 0.8,
  sweep: 0.15,
  fill: 0.6,
  fillStyle: 'concentric',
  inkPath: false,
  penWidth: 1.2,
  wobble: 0.5,
  optimize: true,
};

export function generateImpactGrid(options: ImpactGridOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const innerMin = Math.min(width - 2 * margin, height - 2 * margin);
  const cellSize = options.cellSize ?? innerMin / 14;
  const radius = options.impactRadius ?? innerMin * 0.3;

  const squares = layoutSquares({
    width,
    height,
    margin,
    seed,
    layout: o.layout,
    frameDepth: o.frameDepth,
    cellSize,
    sizeVariation: o.sizeVariation,
    positionJitter: o.positionJitter,
    rotationJitter: o.rotationJitter,
    gap: o.gap,
    penWidth: o.penWidth,
  });
  if (squares.length === 0) return { lines: [], width, height, seed };

  const field = preparePath(o.impactPath, radius);
  // Fill is committed in coherent regions, not per-cell coin flips: a
  // low-frequency noise field decides which neighbourhoods read solid, the
  // way Breakpoint-style compositions commit whole areas. (Per-cell LCG
  // draws also correlate across sequential sub-seeds — visible as filled
  // runs along rows.)
  const fillNoise = createNoise(subSeed(seed, 2));
  const lines: FlowLine[] = [];
  // The wobble bends strokes at existing points only — straight 2-point edges
  // would stay ruler-straight, so every mark is resampled first.
  const wobbleStep = Math.max(2, o.penWidth * 2);

  for (const sq of squares) {
    // Separate per-cell streams per stage: the layout stream stays untouched,
    // so drawing a path never reshuffles the resting grid. Adjacent cells'
    // sub-seeds differ by small deltas and an LCG's first draws correlate
    // across them, so each stream burns two draws before use.
    const impactRng = makeRandom(subSeed(seed, sq.index) + 17);
    impactRng();
    impactRng();
    const hatchRng = makeRandom(subSeed(seed, sq.index) + 41);
    hatchRng();
    hatchRng();

    const r = field
      ? squareResponse(
          field,
          sq.centre.x,
          sq.centre.y,
          sq.half,
          radius,
          o.impactStrength,
          o.shatter,
          impactRng
        )
      : null;
    const f = r?.f ?? 0;
    const half = sq.half * (r?.scale ?? 1);
    const rotation = sq.rotation + (r?.theta ?? 0);

    const hatchAngle = rotation + Math.PI / 4 + (2 * hatchRng() - 1) * (15 * Math.PI / 180);
    const fillSpacing = lerp(4 * o.penWidth, 2.5 * o.penWidth, f);
    const fillPoly = (poly: Point[]): Point[][] =>
      o.fillStyle === 'hatch'
        ? hatchConvex(poly, hatchAngle, fillSpacing, o.penWidth)
        : o.fillStyle === 'concentric'
          ? concentricFill(poly, fillSpacing, o.penWidth)
          : [];

    // Region-committed fill: this cell's neighbourhood reads solid when the
    // noise field sits below the fill amount. Shards additionally darken by
    // proximity to the line (rubble inherits mass toward the scar).
    const regionFilled =
      o.fill > 0 &&
      fillNoise.noise2D(sq.centre.x * 0.008, sq.centre.y * 0.008) * 0.5 + 0.5 < o.fill;

    if (r?.shattered) {
      const resting = squareAt(sq.centre, half, rotation);
      const hit = field!.nearest(sq.centre.x, sq.centre.y);
      const shards = shatterSquare(
        resting,
        half,
        {
          f,
          ux: r.ux,
          uy: r.uy,
          dx: r.dx,
          dy: r.dy,
          radius,
          shatter: o.shatter,
          scatter: o.scatter,
          debris: o.debris,
          crush: o.crush,
          sweep: o.sweep,
          tx: hit.tx,
          ty: hit.ty,
          d: hit.d,
          penWidth: o.penWidth,
        },
        impactRng
      );
      for (const shard of shards) {
        lines.push({ points: densify(shard, wobbleStep), pen: 'fine', layer: 'shard' });
        if (regionFilled || (o.fill > 0 && hatchRng() < 0.6 * f)) {
          for (const span of fillPoly(shard)) {
            lines.push({ points: densify(span, wobbleStep), pen: 'fine', layer: 'fill' });
          }
        }
      }
    } else {
      const centre = { x: sq.centre.x + (r?.dx ?? 0), y: sq.centre.y + (r?.dy ?? 0) };
      const ring = squareAt(centre, half, rotation);
      lines.push({ points: densify(ring, wobbleStep), pen: 'fine', layer: 'grid' });
      if (regionFilled) {
        for (const span of fillPoly(ring)) {
          lines.push({ points: densify(span, wobbleStep), pen: 'fine', layer: 'fill' });
        }
      }
    }
  }

  // The wandering line itself, inked on request — smoothed so raw drag
  // points read as one confident stroke.
  if (o.inkPath && field) {
    const stroke = smoothPolyline(field.points, 2);
    if (stroke.length >= 2) lines.push({ points: stroke, pen: 'fine', layer: 'path' });
  }

  // Hand finish: the wobble every generator gets, shaking harder near the
  // impact; the fill passes are damped so hatch lines never cross.
  const finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    {
      amplitude: o.wobble,
      wavelength: 30,
      seed,
      layerAmplitude: { fill: 0.5, path: 0.6 },
      amplitudeScale: field
        ? (x, y) => 1 + o.impactStrength * field.falloff(field.nearest(x, y).d)
        : undefined,
    }
  ).lines;

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Discrete shapes: reorder only — chaining would fuse separate outlines.
  return o.optimize ? orderPlot(result) : result;
}
