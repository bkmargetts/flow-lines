import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { lerp } from '../lib/math.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { densify } from '../lib/spatial.js';
import { smoothPolyline } from '../lib/polyline.js';
import { layoutCells, rectAt } from './layout.js';
import { preparePath, squareResponse } from './impact.js';
import { shatterCell } from './shatter.js';
import { concentricFill, hatchConvex } from './hatch.js';
import { TEXTURES, textureFill } from './textures.js';

/**
 * A dense mosaic of texture-filled cells — packed squares, a border frame,
 * or tall stacked bars — struck along a drawn trajectory. The line sweeps
 * its channel clean: struck cells shear into shards that cascade along the
 * stroke's direction of travel, textures intact, densest at the flanks and
 * fading down the flow; the innermost shards pulverise away. The mosaic
 * splits across two pen layers ('ink' / 'accent') in coherent regions, and
 * the trajectory itself can be inked with a terminal dot. Everything is
 * plain stroked paths, single pen width per layer, deterministic per seed;
 * no path ⇒ the pristine mosaic.
 */
export interface ImpactGridOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** 'grid' packs the framed page; 'frame' keeps a border band; 'bars'
   *  builds tall columns of stacked segments with ragged ends. */
  layout?: 'grid' | 'frame' | 'bars';
  /** Cells deep the 'frame' band runs, 1..6. */
  frameDepth?: number;

  // Mosaic
  /** Mean cell pitch, px. Default: min(innerW, innerH) / 16. */
  cellSize?: number;
  /** 0..1 per-cell size jitter. */
  sizeVariation?: number;
  /** 0..1 centre jitter as a fraction of pitch. */
  positionJitter?: number;
  /** 0..1 per-cell rotation jitter. */
  rotationJitter?: number;
  /** 0..0.6 mean gap between cells as a fraction of pitch. */
  gap?: number;

  // Impact — inert when the path is missing/short: pristine mosaic.
  /** Impact trajectory in page px (the web layer passes the drawn path). */
  impactPath?: Point[];
  /** Falloff radius, px. Default: min(innerW, innerH) * 0.3. */
  impactRadius?: number;
  /** 0..1 radial push / torque / compression of intact cells (0 = the
   *  mosaic stands still right up to the swept channel). */
  impactStrength?: number;
  /** 0..1 shatter-zone width around the channel. */
  shatter?: number;
  /** 0..1 sideways spread of the cascade off the centreline. */
  scatter?: number;
  /** 0..1 chance the innermost shards vanish entirely — pulverised. */
  debris?: number;
  /** 0..1 shard fineness: how deeply struck cells subdivide near the line. */
  crush?: number;
  /** 0..1 how far shards are carried along the stroke's direction of travel
   *  — also how hard the channel is swept clean. */
  sweep?: number;

  // Marks
  /** 0..1 fraction of cells carrying fill marks (region-committed). */
  fill?: number;
  /** The fill vocabulary: 'texture' draws each cell in one of eight fill
   *  patterns (hatch, scales, waves, dots…); 'hatch' and 'concentric' are
   *  single-style fills; 'none' leaves outlines. */
  fillStyle?: 'texture' | 'hatch' | 'concentric' | 'none';
  /** 0..1 fraction of the mosaic drawn in the 'accent' pen layer, committed
   *  in coherent regions. 0 = single ink. */
  inkSplit?: number;
  /** Ink the trajectory itself as a thin stroke with a terminal dot. */
  inkPath?: boolean;
  penWidth?: number;
  wobble?: number;
  /** Reorder strokes to cut pen-up travel (default true) */
  optimize?: boolean;
}

// Defaults follow the Breakpoint read: a dense, near-ordered, fully
// textured mosaic; the drawn line sweeps its channel clean and the debris
// cascades along the stroke, crisp and unwobbled. The v1 organic/rip looks
// remain reachable via the jitter, strength and scatter knobs.
const DEFAULTS: Required<
  Omit<ImpactGridOptions, 'width' | 'height' | 'margin' | 'seed' | 'impactPath' | 'cellSize' | 'impactRadius'>
> = {
  layout: 'grid',
  frameDepth: 3,
  sizeVariation: 0.15,
  positionJitter: 0.03,
  rotationJitter: 0.02,
  gap: 0.06,
  impactStrength: 0,
  shatter: 0.85,
  scatter: 0.35,
  debris: 0.25,
  crush: 0.7,
  sweep: 0.7,
  fill: 1,
  fillStyle: 'texture',
  inkSplit: 0.35,
  inkPath: true,
  penWidth: 1.2,
  wobble: 0,
  optimize: true,
};

export function generateImpactGrid(options: ImpactGridOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const innerMin = Math.min(width - 2 * margin, height - 2 * margin);
  const cellSize = options.cellSize ?? innerMin / 16;
  const radius = options.impactRadius ?? innerMin * 0.3;
  const channel = Math.max(cellSize * 0.5, radius * 0.12);

  const cells = layoutCells({
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
  if (cells.length === 0) return { lines: [], width, height, seed };

  const field = preparePath(o.impactPath, radius);
  // Region-committing noise fields: which neighbourhoods carry fill, and
  // which sit in the accent ink. (Per-cell LCG first draws correlate across
  // sequential sub-seeds, so region decisions never ride on them.)
  const fillNoise = createNoise(subSeed(seed, 2));
  const inkNoise = createNoise(subSeed(seed, 4));
  const lines: FlowLine[] = [];
  const wobbleStep = Math.max(2, o.penWidth * 2);
  const push = (points: Point[], layer: string) => {
    lines.push({ points: o.wobble > 0 ? densify(points, wobbleStep) : points, pen: 'fine', layer });
  };

  for (const cell of cells) {
    const extent = Math.max(cell.hx, cell.hy);
    // Separate per-cell streams per stage (layout untouched by the impact),
    // each burning two draws — adjacent sub-seeds' first LCG draws correlate.
    const impactRng = makeRandom(subSeed(seed, cell.index) + 17);
    impactRng();
    impactRng();
    const cellRng = makeRandom(subSeed(seed, cell.index) + 41);
    cellRng();
    cellRng();

    const r = field
      ? squareResponse(
          field,
          cell.centre.x,
          cell.centre.y,
          extent,
          radius,
          o.impactStrength,
          o.shatter,
          impactRng
        )
      : null;
    const f = r?.f ?? 0;
    const scale = r?.scale ?? 1;
    const rotation = cell.rotation + (r?.theta ?? 0);

    const ink =
      o.inkSplit > 0 &&
      inkNoise.noise2D(cell.centre.x * 0.006, cell.centre.y * 0.006) * 0.5 + 0.5 < o.inkSplit
        ? 'accent'
        : 'ink';
    const regionFilled =
      o.fill > 0 &&
      fillNoise.noise2D(cell.centre.x * 0.008, cell.centre.y * 0.008) * 0.5 + 0.5 < o.fill;
    const texture = TEXTURES[Math.floor(cellRng() * TEXTURES.length) % TEXTURES.length];
    const fillSpacing = Math.max(2 * o.penWidth, cellSize * 0.15);
    const fillPoly = (poly: Point[]): Point[][] => {
      switch (o.fillStyle) {
        case 'texture':
          return textureFill(poly, texture, fillSpacing, o.penWidth, cellRng);
        case 'hatch':
          return hatchConvex(
            poly,
            rotation + Math.PI / 4,
            lerp(4 * o.penWidth, 2.5 * o.penWidth, f),
            o.penWidth
          );
        case 'concentric':
          return concentricFill(poly, lerp(4 * o.penWidth, 2.5 * o.penWidth, f), o.penWidth);
        default:
          return [];
      }
    };

    if (r?.shattered) {
      const resting = rectAt(cell.centre, cell.hx * scale, cell.hy * scale, rotation);
      const hit = field!.nearest(cell.centre.x, cell.centre.y);
      const shards = shatterCell(
        resting,
        extent,
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
          channel,
          d: hit.d,
          penWidth: o.penWidth,
        },
        impactRng
      );
      for (const shard of shards) {
        push(shard, ink);
        if (regionFilled) for (const span of fillPoly(shard)) push(span, ink);
      }
    } else {
      const centre = { x: cell.centre.x + (r?.dx ?? 0), y: cell.centre.y + (r?.dy ?? 0) };
      const ring = rectAt(centre, cell.hx * scale, cell.hy * scale, rotation);
      push(ring, ink);
      if (regionFilled) for (const span of fillPoly(ring)) push(span, ink);
    }
  }

  // The trajectory itself: a thin confident stroke ending in a dot — the
  // "playful line" made visible.
  if (o.inkPath && field) {
    const stroke = smoothPolyline(field.points, 2);
    if (stroke.length >= 2) {
      lines.push({ points: stroke, pen: 'fine', layer: 'path' });
      const end = stroke[stroke.length - 1];
      const dotR = o.penWidth * 1.6;
      const dot: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        dot.push({ x: end.x + dotR * Math.cos(a), y: end.y + dotR * Math.sin(a) });
      }
      lines.push({ points: dot, pen: 'fine', layer: 'path' });
    }
  }

  // Optional hand finish — off by default: the Breakpoint read is crisp,
  // the chaos lives in the displacement, not the pen.
  const finished =
    o.wobble > 0
      ? applyHandDrawnStyle(
          { lines, width, height, seed },
          {
            amplitude: o.wobble,
            wavelength: 30,
            seed,
            layerAmplitude: { path: 0.5 },
            amplitudeScale: field
              ? (x, y) => 1 + field.falloff(field.nearest(x, y).d)
              : undefined,
          }
        ).lines
      : lines;

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Discrete shapes: reorder only — chaining would fuse separate outlines.
  return o.optimize ? orderPlot(result) : result;
}
