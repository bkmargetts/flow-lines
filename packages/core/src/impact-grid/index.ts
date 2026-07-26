import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { clamp01, lerp } from '../lib/math.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { densify } from '../lib/spatial.js';
import { layoutSquares, squareAt } from './layout.js';
import { preparePath, squareResponse } from './impact.js';
import { shatterSquare } from './shatter.js';
import { hatchConvex } from './hatch.js';

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

  // Marks
  /** 0..1 hatch-fill amount: a light scatter of toned squares, and shards
   *  that darken toward the impact. 0 = pure outlines. */
  fill?: number;
  penWidth?: number;
  wobble?: number;
  /** Reorder strokes to cut pen-up travel (default true) */
  optimize?: boolean;
}

const DEFAULTS: Required<
  Omit<ImpactGridOptions, 'width' | 'height' | 'margin' | 'seed' | 'impactPath' | 'cellSize' | 'impactRadius'>
> = {
  layout: 'grid',
  frameDepth: 3,
  sizeVariation: 0.35,
  positionJitter: 0.25,
  rotationJitter: 0.3,
  gap: 0.15,
  impactStrength: 0.7,
  shatter: 0.6,
  scatter: 0.5,
  debris: 0.3,
  fill: 0.2,
  penWidth: 1.2,
  wobble: 0.8,
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
  const lines: FlowLine[] = [];
  // The wobble bends strokes at existing points only — straight 2-point edges
  // would stay ruler-straight, so every mark is resampled first.
  const wobbleStep = Math.max(2, o.penWidth * 2);

  for (const sq of squares) {
    // Separate per-cell streams per stage: the layout stream stays untouched,
    // so drawing a path never reshuffles the resting grid.
    const impactRng = makeRandom(subSeed(seed, sq.index) + 17);
    const hatchRng = makeRandom(subSeed(seed, sq.index) + 41);

    const r = field
      ? squareResponse(field, sq.centre.x, sq.centre.y, radius, o.impactStrength, o.shatter, impactRng)
      : null;
    const f = r?.f ?? 0;
    const half = sq.half * (r?.scale ?? 1);
    const rotation = sq.rotation + (r?.theta ?? 0);

    const hatchAngle = rotation + Math.PI / 4 + (2 * hatchRng() - 1) * (15 * Math.PI / 180);
    const hatchSpacing = lerp(5 * o.penWidth, 2.5 * o.penWidth, f);

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
          d: hit.d,
          penWidth: o.penWidth,
        },
        impactRng
      );
      for (const shard of shards) {
        lines.push({ points: densify(shard, wobbleStep), pen: 'fine', layer: 'shard' });
        if (hatchRng() < (o.fill > 0 ? clamp01(o.fill + 0.6 * f) : 0)) {
          for (const span of hatchConvex(shard, hatchAngle, hatchSpacing, o.penWidth)) {
            lines.push({ points: densify(span, wobbleStep), pen: 'fine', layer: 'fill' });
          }
        }
      }
    } else {
      const centre = { x: sq.centre.x + (r?.dx ?? 0), y: sq.centre.y + (r?.dy ?? 0) };
      const ring = squareAt(centre, half, rotation);
      lines.push({ points: densify(ring, wobbleStep), pen: 'fine', layer: 'grid' });
      if (hatchRng() < o.fill * 0.6 + 0.6 * f * clamp01(o.fill * 4)) {
        for (const span of hatchConvex(ring, hatchAngle, hatchSpacing, o.penWidth)) {
          lines.push({ points: densify(span, wobbleStep), pen: 'fine', layer: 'fill' });
        }
      }
    }
  }

  // Hand finish: the wobble every generator gets, shaking harder near the
  // impact; the fill passes are damped so hatch lines never cross.
  const finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    {
      amplitude: o.wobble,
      wavelength: 30,
      seed,
      layerAmplitude: { fill: 0.5 },
      amplitudeScale: field
        ? (x, y) => 1 + o.impactStrength * field.falloff(field.nearest(x, y).d)
        : undefined,
    }
  ).lines;

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Discrete shapes: reorder only — chaining would fuse separate outlines.
  return o.optimize ? orderPlot(result) : result;
}
