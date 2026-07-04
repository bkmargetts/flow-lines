import { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig, type SketchStyle } from '../sketch-styles.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clipPolylineToRect } from '../lib/polyline.js';
import { buildMorph } from './morph.js';
import { layoutCity, fitCity } from './layout.js';
import { drawIsoCity } from './buildings.js';
import { drawSkyline } from './skyline.js';

/**
 * Abstract cities of buildings, drawn as plottable pen-and-ink. The whole
 * module hangs on one idea: a master `order` slider (0 = flowing/organic,
 * 1 = rigid/robotic) that morphs a single city continuously — curved leaning
 * towers with wavy parapets and drifting windows at one end, ruled prisms
 * with perfect grids at the other. Every organic quantity is a per-building
 * random attribute drawn once from a stable cell genome and *scaled* by the
 * slider (see morph.ts), so the same seed reads as the same city sliding
 * along the axis, never a re-roll.
 *
 * Two viewpoints share the facade machinery: 'isometric' (2:1 pixel-iso
 * blocks, painter's-algorithm occlusion back-to-front) and 'skyline'
 * (front-on elevation rows receding like the landscape's ridge stack).
 * A top-down map viewpoint is a deliberate later seam — it is a
 * street-network problem and shares none of the face machinery.
 *
 * Everything is single-pen stroked polylines, deterministic per seed — bold
 * is repeated offset passes, tone is spacing. Buildings only: no ground, sky
 * or streets; paper does that work. Mirrors the Landscape / Planet / Vine
 * Generators: heavy algorithm here in core, a thin web/CLI wrapper feeds it.
 */

export type CityViewpoint = 'isometric' | 'skyline';
export type CityLightSide = 'left' | 'right';

export interface CityOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  viewpoint?: CityViewpoint;
  /** THE slider: 0 = flowing/organic/artistic, 1 = rigid/robotic. */
  order?: number;

  // Layout
  blockCols?: number;
  blockRows?: number;
  lotSize?: number; // px
  street?: number; // px
  density?: number; // 0..1 lot occupancy
  downtown?: number; // 0..1 centre-height envelope strength

  // Buildings
  buildingHeight?: number; // px mean height
  heightVariance?: number; // 0..1
  storey?: number; // px per storey
  tiers?: number; // 0..1 setback probability
  lean?: number; // 0..1 ceiling on the lean/bow family

  // Windows
  windows?: number; // 0..1 density (0 = off)
  windowSize?: number; // px column pitch

  // Tone
  shadeStrength?: number; // 0..1 shadow-face darkness
  hatchSpacing?: number; // px at full darkness
  lightSide?: CityLightSide;

  // Skyline
  skylineRows?: number;

  // Pen / finishing
  penWidth?: number;
  wobble?: number;
  sketch?: number;
  sketchStyle?: SketchStyle;
}

const DEFAULTS: Required<Omit<CityOptions, 'width' | 'height' | 'margin' | 'seed'>> = {
  viewpoint: 'isometric',
  order: 0.5,
  blockCols: 7,
  blockRows: 7,
  lotSize: 39,
  street: 15,
  density: 0.85,
  downtown: 0.5,
  buildingHeight: 84,
  heightVariance: 0.6,
  storey: 9.6,
  tiers: 0.3,
  lean: 0.6,
  windows: 0.7,
  windowSize: 7.2,
  shadeStrength: 0.6,
  hatchSpacing: 3.2,
  lightSide: 'left',
  skylineRows: 3,
  penWidth: 1.35,
  wobble: 0.9,
  sketch: 0,
  sketchStyle: 'loose',
};

/** The city keeps its window allowance plot-friendly however dense the knobs. */
const WINDOW_BUDGET = 12000;

/**
 * Generate a pen-and-ink city. Returns plain stroked polylines tagged by
 * layer (`contour` / `edge` / `roof` / `window` / `hatch`), deterministic
 * per seed.
 */
export function generateCity(options: CityOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  const morph = buildMorph(o.order, o.lean);
  const noise = createNoise(subSeed(seed, 5));
  const budget = { left: WINDOW_BUDGET };

  // The occlusion margin must cover the finish pass's peak displacement
  // (wobble amplitude + whole-stroke misregistration), or the hand pass
  // bends erased strokes back through the buildings in front of them.
  const sketchCfg = o.sketch > 0.01 ? getSketchStyleConfig(o.sketchStyle, o.sketch) : null;
  const finishReach = sketchCfg
    ? sketchCfg.amplitude + sketchCfg.jitter
    : o.wobble * morph.wobbleScale * 1.6;
  const inflatePx = 1.0 + finishReach;

  let lines: FlowLine[];
  if (o.viewpoint === 'skyline') {
    lines = drawSkyline(morph, noise, {
      x0,
      y0,
      x1,
      y1,
      seed,
      rows: o.skylineRows,
      lot: o.lotSize,
      street: o.street,
      heightMean: o.buildingHeight,
      heightVariance: o.heightVariance,
      storey: o.storey,
      tiers: o.tiers,
      downtown: o.downtown,
      lightSide: o.lightSide,
      windows: o.windows,
      windowPitch: o.windowSize,
      shadeStrength: o.shadeStrength,
      hatchSpacing: o.hatchSpacing,
      penWidth: o.penWidth,
      inflatePx,
    }, budget);
  } else {
    const specs = layoutCity(
      {
        cols: Math.max(1, Math.round(o.blockCols)),
        rows: Math.max(1, Math.round(o.blockRows)),
        lot: o.lotSize,
        street: o.street,
        density: o.density,
        downtown: o.downtown,
        heightMean: o.buildingHeight,
        heightVariance: o.heightVariance,
        storey: o.storey,
        tiers: o.tiers,
      },
      morph,
      seed
    );
    const { scale, proj } = fitCity(specs, morph, { x0, y0, x1, y1 });
    lines = drawIsoCity(specs, proj, morph, noise, {
      lightSide: o.lightSide,
      windows: o.windows,
      windowPitch: o.windowSize * scale,
      shadeStrength: o.shadeStrength,
      hatchSpacing: o.hatchSpacing,
      penWidth: o.penWidth,
      heightMean: o.buildingHeight * scale,
      inflatePx,
    }, budget);
  }

  // Hand finish: the wobble is order-scaled — at order 1 with the knob at 0
  // the city is truly ruled. Sketch passes trade that for overdraw looseness.
  let finished: FlowLine[];
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, p);
      const styled = applyHandDrawnStyle({ lines, width, height, seed: pseed }, { amplitude, wavelength, jitter, seed: pseed }).lines;
      for (const l of styled) acc.push(l);
    }
    finished = acc;
  } else {
    finished = applyHandDrawnStyle(
      { lines, width, height, seed },
      { amplitude: o.wobble * morph.wobbleScale, wavelength: 42, seed }
    ).lines;
  }

  finished = finished.flatMap((l) =>
    clipPolylineToRect(l.points, x0, y0, x1, y1).map((pts) => ({ ...l, points: pts }))
  );

  return { lines: finished, width, height, seed };
}
