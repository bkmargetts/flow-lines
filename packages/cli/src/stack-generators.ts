import {
  generateBotanical,
  generateCity,
  generateColorField,
  generateComplexFlow,
  generateConwayExposure,
  generateCoral,
  generateFlowLinesEven,
  generateFlowLinesGrid,
  generateFracture,
  generateGesture,
  generateHarmonograph,
  generateHearts,
  generateImpactGrid,
  generateInkField,
  generateLandscape,
  generateLapidary,
  generateLenia,
  generateMachine,
  generateLifeTerraces,
  generateMarbling,
  generateMeander,
  generateOverlappedLines,
  generatePhysarum,
  generatePlanet,
  generateReactionDiffusion,
  generateRibbonWeave,
  generateSportsBalls,
  generateStickmen,
  generateTangles,
  generateTerraces,
  generateTexture,
  generateWarpGrid,
  type FlowLine,
} from '@flow-lines/core';

/** The page context every stack layer renders into. */
export interface StackGeneratorContext {
  width: number;
  height: number;
  marginPx: number;
  pxPerMm: number;
}

/** Adapters return bare lines — generators disagree on their envelope
 *  (`FlowLinesResult`, `{lines, width, height}`, or a plain `FlowLine[]`),
 *  and the stack pipeline only composites the strokes. */
type StackGenerator = (
  options: Record<string, unknown>,
  ctx: StackGeneratorContext
) => FlowLine[];

/**
 * One adapter per core generator: the recipe's `options` are the generator's
 * own core option object, with `width`/`height` always taken from the page
 * (that's the point of a shared sheet) and `margin` defaulting to the page
 * margin. Adapters that must satisfy required fields carry small defaults —
 * everything a recipe specifies wins over them.
 *
 * Not here (v1): `image` / pen-ink — it needs per-layer raster IO
 * (photo + depth/label sidecars); planned as a follow-up.
 */
export const STACK_GENERATORS: Record<string, StackGenerator> = {
  'flow-field': (o, c) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateFlowLinesEven({ separation: 12, margin: c.marginPx, ...o, width: c.width, height: c.height } as any).lines,
  'flow-grid': (o, c) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateFlowLinesGrid({ gridSpacing: 25, margin: c.marginPx, ...o, width: c.width, height: c.height } as any).lines,
  texture: (o, c) =>
    generateTexture({
      pxPerMm: c.pxPerMm,
      style: 'hatch',
      spacingMm: 3,
      angleDeg: 45,
      scale: 1,
      jitter: 0.15,
      density: 0.5,
      crossHatch: false,
      seed: 42,
      margin: c.marginPx,
      ...o,
      width: c.width,
      height: c.height,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
  'complex-flow': (o, c) =>
    generateComplexFlow({
      // The web module's defaults, so a bare layer draws something worth
      // looking at (core has no defaults — every field is required).
      zeroCount: 3,
      poleCount: 2,
      zeroLayout: 'ring',
      poleLayout: 'ring',
      singularitySpread: 0.7,
      planeScale: 1,
      fieldRotation: 0,
      seedLayout: 'multiRing',
      seedCount: 1200,
      stepsPerDir: 180,
      stepLength: 2,
      stepJitter: 0.5,
      wobble: 0,
      speedClampMax: 1000,
      minLineLength: 12,
      layerCount: 5,
      layerBy: 'seedBand',
      margin: c.marginPx,
      ...o,
      width: c.width,
      height: c.height,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).lines,
  ...simple('conway', generateConwayExposure),
  ...simple('botanical', generateBotanical),
  ...simple('planet', generatePlanet),
  ...simple('landscape', generateLandscape),
  ...simple('city', generateCity),
  ...simple('stickmen', generateStickmen),
  ...simple('sports-balls', generateSportsBalls),
  ...simple('hearts', generateHearts),
  ...simple('impact-grid', generateImpactGrid),
  ...simple('ribbon-weave', generateRibbonWeave),
  ...simple('tangles', generateTangles),
  ...simple('gesture', generateGesture),
  ...simple('machine', generateMachine),
  ...simple('marbling', generateMarbling),
  ...simple('lapidary', generateLapidary),
  ...simple('terraces', generateTerraces),
  ...simple('life-terraces', generateLifeTerraces),
  ...simple('harmonograph', generateHarmonograph),
  ...simple('fracture', generateFracture),
  ...simple('meander', generateMeander),
  ...simple('coral', generateCoral),
  ...simple('warp-grid', generateWarpGrid),
  ...simple('ink-field', generateInkField),
  ...simple('color-field', generateColorField),
  ...simple('grating', generateOverlappedLines),
  ...simple('reaction-diffusion', generateReactionDiffusion),
  ...simple('lenia', generateLenia),
  ...simple('physarum', generatePhysarum),
};

export const STACK_GENERATOR_NAMES: ReadonlySet<string> = new Set(Object.keys(STACK_GENERATORS));

/** The standard adapter: inject page dims, default the margin. */
function simple(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generate: (options: any) => { lines: FlowLine[] }
): Record<string, StackGenerator> {
  return {
    [name]: (o, c) =>
      generate({ margin: c.marginPx, ...o, width: c.width, height: c.height }).lines,
  };
}
