import { generateVines, type VinesOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { VineState, Season } from './types';
import { getVinePalette } from './palettes';

/** Per-season target multipliers on the foliage knobs (palette is untouched).
 *  Blended from neutral (1) by `seasonStrength`. Winter rides the strength
 *  slider from leafy (0) to bare (1). */
const SEASON_FACTORS: Record<Season, { density: number; leafSize: number; flowerProb: number }> = {
  spring: { density: 0.9, leafSize: 0.85, flowerProb: 1.1 },
  summer: { density: 1.15, leafSize: 1.05, flowerProb: 1.0 },
  autumn: { density: 0.65, leafSize: 1.0, flowerProb: 0.3 },
  winter: { density: 0.05, leafSize: 0.7, flowerProb: 0.0 },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Pure render for the Vine Generator: state + page → lines. mm settings convert
 * to px at the page density; painted points (already in page px from the
 * canvas) seed the roots. Shared finishing (border, density, hold-off) is the
 * compositor's job. Multi-ink: `layerColors` maps the leaf/flower pen layers to
 * their own inks, with the stem colour as the fallback.
 */
export function renderVineGenerator(state: VineState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;
  const zoom = Math.max(0.2, state.zoom);

  // Season modulates foliage amounts/sizes (not colour), blended by strength.
  const sf = SEASON_FACTORS[state.season];
  const t = state.seasonStrength;
  const seasonDensity = state.density * lerp(1, sf.density, t);
  const seasonLeafSize = state.leafSizeMm * lerp(1, sf.leafSize, t);
  const seasonFlowerProb = state.flowerProb * lerp(1, sf.flowerProb, t);

  const options: VinesOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    mode: state.mode,
    composition: state.composition,
    fillShape: state.fillShape,
    seeding: state.seeding,
    startPoints: state.maskPath,
    seedCount: state.seedCount,

    stepLength: Math.max(1, state.stepLengthMm * mm),
    maxLength: state.maxLengthMm * mm,
    curl: state.curl,
    noiseScale: state.noiseScale,
    gravitropism: state.gravitropism,
    branchProb: state.branchProb,
    maxDepth: state.maxDepth,

    attractorCount: state.attractorCount,
    attractorRadius: state.attractorRadiusMm * mm,
    killRadius: state.killRadiusMm * mm,

    stemWidth: state.stemWidthMm * mm,
    // Fill passes pack at the plotted pen width so the body inks solid. The
    // generator works in "world" units divided by zoom, so after the zoom
    // transform below the on-page fill spacing lands back at the real pen.
    penWidth: (state.penWidthMm * mm) / zoom,
    taper: state.taper,
    vineFill: state.vineFill,
    avoidOverlap: state.avoidOverlap,

    lightAngle: state.lightAngle,
    shadeDensity: state.shadeDensity,
    stemShade: state.stemShade,
    occlude: state.occlude,
    sketch: state.sketch,
    sketchStyle: state.sketchStyle,
    castShadow: state.castShadow,

    density: seasonDensity,
    leaves: state.leaves,
    leafStyle: state.leafStyle,
    leafType: state.leafType,
    veins: state.veins,
    leafSize: seasonLeafSize * mm,
    leafWidthRatio: state.leafWidthRatio,
    leafSpacing: Math.max(1, state.leafSpacingMm * mm),
    tendrils: state.tendrils,
    tendrilProb: state.tendrilProb,
    flowers: state.flowers,
    flowerType: state.flowerType,
    flowerProb: seasonFlowerProb,
    flowerSize: state.flowerSizeMm * mm,

    wobble: state.wobbleMm * mm,
  };

  const result = generateVines(options);

  // Zoom: scale the whole plot about the page centre. >1 magnifies (and the
  // sheet crops to it); <1 shrinks it within the page. The pen width was
  // pre-divided by zoom so fills land back at the true pen after this scale.
  const lines =
    zoom === 1
      ? result.lines
      : result.lines.map((ln) => ({
          ...ln,
          points: ln.points.map((p) => ({
            x: page.widthPx / 2 + (p.x - page.widthPx / 2) * zoom,
            y: page.heightPx / 2 + (p.y - page.heightPx / 2) * zoom,
          })),
        }));

  // A curated palette maps each pen layer to its own ink; 'custom' uses the
  // per-element colour pickers.
  const pal = getVinePalette(state.palette);
  const layerColors = pal
    ? { stem: pal.stem, tendril: pal.stem, leaf: pal.leaf, vein: pal.vein, flower: pal.flower, shadow: pal.shadow }
    : { stem: state.strokeColor, tendril: state.strokeColor, leaf: state.leafColor, vein: state.leafColor, flower: state.flowerColor, shadow: state.strokeColor };

  return {
    lines,
    strokeColor: pal ? pal.stem : state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
