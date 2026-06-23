import { generateVines, type VinesOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { VineState } from './types';

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

  const options: VinesOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    mode: state.mode,
    composition: state.composition,
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
    // Fill passes pack at the plotted pen width so the body inks solid.
    penWidth: state.penWidthMm * mm,
    taper: state.taper,
    vineFill: state.vineFill,
    avoidOverlap: state.avoidOverlap,

    lightAngle: state.lightAngle,
    shadeDensity: state.shadeDensity,
    occlude: state.occlude,

    leaves: state.leaves,
    leafStyle: state.leafStyle,
    leafType: state.leafType,
    veins: state.veins,
    leafSize: state.leafSizeMm * mm,
    leafWidthRatio: state.leafWidthRatio,
    leafSpacing: Math.max(1, state.leafSpacingMm * mm),
    tendrils: state.tendrils,
    tendrilProb: state.tendrilProb,
    flowers: state.flowers,
    flowerProb: state.flowerProb,
    flowerSize: state.flowerSizeMm * mm,

    wobble: state.wobbleMm * mm,
  };

  const result = generateVines(options);

  return {
    lines: result.lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors: {
      stem: state.strokeColor,
      tendril: state.strokeColor,
      leaf: state.leafColor,
      flower: state.flowerColor,
    },
  };
}
