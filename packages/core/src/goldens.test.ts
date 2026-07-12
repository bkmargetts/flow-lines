import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { generateFlowLines, generateFlowLinesGrid, generateFlowLinesEven } from './flow-lines.js';
import { generateOverlappedLines } from './overlapped-lines.js';
import { generateColorField } from './color-field.js';
import { generateConwayExposure } from './conway/index.js';
import { generateReactionDiffusion } from './reaction-diffusion.js';
import { generateLenia } from './lenia.js';
import { generatePhysarum } from './physarum.js';
import { generateComplexFlow, type ComplexFlowOptions } from './complex-flow.js';
import { generateBotanical } from './botanical/index.js';
import { generatePlanet } from './planet/index.js';
import { generateLandscape } from './landscape/index.js';
import { generateCity } from './city/index.js';
import { generateStickmen } from './stickmen/index.js';
import { generateSportsBalls } from './sports-balls/index.js';
import { generateRibbonWeave } from './ribbons/index.js';
import { generateGesture } from './gesture/index.js';
import { generateTexture, type TextureOptions } from './texture.js';
import { imageToPenInk, resolvePenInkStyle } from './pen-ink/index.js';
import { toSVG } from './svg.js';
import { optimizePlot } from './optimize.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import { pageBorder } from './page-frame.js';
import type { GrayscaleImage } from './image.js';

/**
 * Golden-output regression suite.
 *
 * Every generator is rendered at fixed seeds/sizes and the full result is
 * hashed against `goldens.json`. Unlike the per-module determinism tests
 * (which compare two runs of the *same* build), these hashes pin today's
 * output across refactors: any change to an RNG call order, a default, or a
 * geometric helper shows up as a hash mismatch.
 *
 * A mismatch means the drawing changed. If the change is intentional,
 * regenerate the goldens with
 *
 *     UPDATE_GOLDENS=1 pnpm --filter @flow-lines/core test
 *
 * but ONLY after re-rendering the galleries (`node scripts/gallery.mjs`,
 * `botanical-gallery.mjs`, `planet-gallery.mjs`) and eyeball-diffing them against
 * the previous output — the hashes are the guardrail, the album is the judge.
 *
 * Hashes are sha256 over JSON.stringify of the result. V8's float printing is
 * shortest-round-trip and stable for a given Node major (CI pins Node 20);
 * values are never pre-rounded, so no real regression can hide inside a
 * rounding tolerance.
 */

const GOLDENS_PATH = fileURLToPath(new URL('./goldens.json', import.meta.url));

/** Deterministic synthetic photo: a diagonal luminance ramp with a dark disk
 *  (gives pen-ink tone, edges, and a contour to chew on — no file I/O). */
function syntheticImage(width = 96, height = 128): GrayscaleImage {
  const data = new Float32Array(width * height);
  const cx = width * 0.62;
  const cy = height * 0.4;
  const r = Math.min(width, height) * 0.22;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ramp = 0.25 + 0.7 * ((x / (width - 1) + y / (height - 1)) / 2);
      const d = Math.hypot(x - cx, y - cy);
      const disk = d < r ? 0.15 : 1;
      data[y * width + x] = Math.min(ramp, disk === 1 ? 1 : disk);
    }
  }
  return { width, height, data };
}

const complexBase: ComplexFlowOptions = {
  width: 300,
  height: 400,
  zeroCount: 3,
  poleCount: 2,
  zeroLayout: 'ring',
  poleLayout: 'ring',
  singularitySpread: 0.7,
  planeScale: 1,
  fieldRotation: 0,
  seedCount: 120,
  seedLayout: 'multiRing',
  stepsPerDir: 100,
  stepLength: 2,
  stepJitter: 0.5,
  wobble: 0,
  speedClampMax: 1e3,
  minLineLength: 8,
  margin: 20,
  layerCount: 5,
  layerBy: 'seedBand',
};

const textureBase: TextureOptions = {
  width: 300,
  height: 400,
  margin: 20,
  pxPerMm: 3,
  style: 'hatch',
  spacingMm: 4,
  angleDeg: 45,
  scale: 1,
  jitter: 0.2,
  density: 0.5,
  crossHatch: false,
  seed: 42,
};

const SEEDS = [42, 1337] as const;

/** Every entry renders one deterministic drawing. Small canvases keep the
 *  whole suite in seconds; two seeds catch seed-plumbing bugs. */
const CASES: Record<string, () => unknown> = {};

for (const seed of SEEDS) {
  CASES[`flow-lines/${seed}`] = () =>
    generateFlowLines({ width: 300, height: 400, lineCount: 40, seed });
  CASES[`flow-lines-grid/${seed}`] = () =>
    generateFlowLinesGrid({ width: 300, height: 400, gridSpacing: 24, seed });
  CASES[`flow-lines-even/${seed}`] = () =>
    generateFlowLinesEven({ width: 300, height: 400, separation: 12, seed });
  CASES[`overlapped-lines/${seed}`] = () =>
    generateOverlappedLines({ width: 300, height: 400, seed });
  CASES[`color-field/${seed}`] = () => generateColorField({ width: 300, height: 400, seed });
  CASES[`conway/marks/${seed}`] = () =>
    generateConwayExposure({ width: 300, height: 400, seed });
  CASES[`reaction-diffusion/${seed}`] = () =>
    generateReactionDiffusion({ width: 300, height: 400, seed });
  CASES[`lenia/orbium/${seed}`] = () => generateLenia({ width: 300, height: 400, seed });
  CASES[`physarum/network/${seed}`] = () => generatePhysarum({ width: 300, height: 400, seed });
  CASES[`complex-flow/${seed}`] = () => generateComplexFlow({ ...complexBase, seed });
  CASES[`botanical/default/${seed}`] = () => generateBotanical({ width: 300, height: 400, seed });
  CASES[`planet/terrestrial/${seed}`] = () =>
    generatePlanet({ width: 300, height: 400, margin: 20, seed });
  CASES[`landscape/default/${seed}`] = () =>
    generateLandscape({ width: 300, height: 400, margin: 20, seed });
  CASES[`city/default/${seed}`] = () =>
    generateCity({ width: 300, height: 400, margin: 20, seed });
  CASES[`stickmen/default/${seed}`] = () =>
    generateStickmen({ width: 300, height: 400, margin: 20, seed });
  CASES[`sports-balls/default/${seed}`] = () =>
    generateSportsBalls({ width: 300, height: 400, margin: 20, seed });
  CASES[`ribbons/default/${seed}`] = () =>
    generateRibbonWeave({ width: 300, height: 400, margin: 20, seed });
  CASES[`gesture/default/${seed}`] = () =>
    generateGesture({ width: 300, height: 400, margin: 20, seed });
  CASES[`texture/hatch/${seed}`] = () => generateTexture({ ...textureBase, seed });
  CASES[`pen-ink/synthetic/${seed}`] = () =>
    imageToPenInk(syntheticImage(), { width: 300, seed });
}

// Style/preset variants (single seed — the second seed above covers plumbing).
CASES['pen-ink/solid-blacks/42'] = () =>
  imageToPenInk(syntheticImage(), { width: 300, seed: 42, valueBands: 2, solidBlacks: true });
CASES['pen-ink/style-comic/42'] = () =>
  imageToPenInk(syntheticImage(), { width: 300, seed: 42, ...resolvePenInkStyle('comic') });
CASES['pen-ink/style-dore/42'] = () =>
  imageToPenInk(syntheticImage(), { width: 300, seed: 42, ...resolvePenInkStyle('dore') });
CASES['pen-ink/style-ballpoint/42'] = () =>
  imageToPenInk(syntheticImage(), { width: 300, seed: 42, ...resolvePenInkStyle('ballpoint') });
CASES['pen-ink/style-sumie/42'] = () =>
  imageToPenInk(syntheticImage(), { width: 300, seed: 42, ...resolvePenInkStyle('sumie') });
CASES['conway/streaks/42'] = () =>
  generateConwayExposure({ width: 300, height: 400, seed: 42, style: 'streaks' });
CASES['reaction-diffusion/coral/42'] = () =>
  generateReactionDiffusion({ width: 300, height: 400, seed: 42, preset: 'coral' });
CASES['lenia/cells/42'] = () =>
  generateLenia({ width: 300, height: 400, seed: 42, preset: 'cells' });
CASES['physarum/veins/42'] = () =>
  generatePhysarum({ width: 300, height: 400, seed: 42, preset: 'veins' });
CASES['botanical/wreath/42'] = () =>
  generateBotanical({ width: 300, height: 400, seed: 42, composition: 'wreath' });
CASES['stickmen/energetic/42'] = () =>
  generateStickmen({ width: 300, height: 400, margin: 20, seed: 42, poseEnergy: 1, count: 90 });
CASES['stickmen/region-ellipse/42'] = () =>
  generateStickmen({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    count: 80,
    region: { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.35, ry: 0.3 },
  });
CASES['stickmen/library/42'] = () =>
  generateStickmen({ width: 300, height: 400, margin: 20, seed: 42, count: 80, poseMode: 'library' });
CASES['sports-balls/shaded/42'] = () =>
  generateSportsBalls({ width: 300, height: 400, margin: 20, seed: 42, shading: 0.7 });
CASES['sports-balls/soccer-only/42'] = () =>
  generateSportsBalls({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    count: 20,
    ballScale: 80,
    minSeparation: 60,
    mix: { soccer: 1 },
  });
CASES['sports-balls/no-shadows/42'] = () =>
  generateSportsBalls({ width: 300, height: 400, margin: 20, seed: 42, castShadows: 0 });
CASES['sports-balls/region-ellipse/42'] = () =>
  generateSportsBalls({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    count: 50,
    minSeparation: 14,
    region: { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.35, ry: 0.3 },
  });
CASES['planet/gas-giant/42'] = () =>
  generatePlanet({ width: 300, height: 400, margin: 20, seed: 42, planetType: 'gas-giant' });
CASES['planet/ringed/42'] = () =>
  generatePlanet({ width: 300, height: 400, margin: 20, seed: 42, planetType: 'ringed' });
CASES['city/rigid/42'] = () =>
  generateCity({ width: 300, height: 400, margin: 20, seed: 42, order: 1, wobble: 0 });
CASES['city/greek-villa/42'] = () =>
  generateCity({ width: 300, height: 400, margin: 20, seed: 42, style: 'greek-villa' });
CASES['city/old-town/42'] = () =>
  generateCity({ width: 300, height: 400, margin: 20, seed: 42, style: 'old-town' });
CASES['city/brownstone/42'] = () =>
  generateCity({ width: 300, height: 400, margin: 20, seed: 42, style: 'brownstone' });
CASES['city/brutalist/42'] = () =>
  generateCity({ width: 300, height: 400, margin: 20, seed: 42, style: 'brutalist' });
CASES['city/mixed/42'] = () =>
  generateCity({ width: 300, height: 400, margin: 20, seed: 42, style: 'mixed' });
CASES['ribbons/plait/42'] = () =>
  generateRibbonWeave({ width: 300, height: 400, margin: 20, seed: 42, order: 1, breaks: 0, wobble: 0 });
CASES['ribbons/tangle/42'] = () =>
  generateRibbonWeave({ width: 300, height: 400, margin: 20, seed: 42, order: 0, edge: 'bleed' });
CASES['ribbons/twists/42'] = () =>
  generateRibbonWeave({ width: 300, height: 400, margin: 20, seed: 42, twists: 1, inkGroups: 2 });
CASES['ribbons/silk/42'] = () =>
  generateRibbonWeave({ width: 300, height: 400, margin: 20, seed: 42, style: 'silk', twists: 0.3 });
CASES['gesture/kline/42'] = () =>
  generateGesture({ width: 300, height: 400, margin: 20, seed: 42, preset: 'kline' });
CASES['gesture/sumi/42'] = () =>
  generateGesture({ width: 300, height: 400, margin: 20, seed: 42, preset: 'sumi' });
CASES['gesture/hartung/42'] = () =>
  generateGesture({ width: 300, height: 400, margin: 20, seed: 42, preset: 'hartung' });
CASES['gesture/tangle/42'] = () =>
  generateGesture({ width: 300, height: 400, margin: 20, seed: 42, preset: 'tangle' });
// Rings and craters need coverage of their own: with defaults the ringed case
// above renders identically to the gas giant (rings/bands are off).
CASES['planet/ringed-rings/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    planetType: 'ringed',
    rings: true,
    bands: true,
    radiusFrac: 0.5,
  });
CASES['planet/moon-craters/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    planetType: 'moon',
    craters: true,
    stipple: 0.5,
  });
CASES['planet/labeled-moon/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    planetType: 'moon',
    craters: true,
    featureLabels: true,
    plateFrame: true,
  });
CASES['planet/atlas-orbital/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    layout: 'orbital',
    orbitLabels: true,
    asteroidBelt: true,
  });
CASES['planet/asteroid/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    planetType: 'asteroid',
    craters: true,
    stipple: 0.5,
  });
CASES['planet/comet/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    planetType: 'comet',
    radiusFrac: 0.2,
    starfield: true,
  });
CASES['planet/rivers/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    rivers: 5,
    mountains: true,
  });
CASES['planet/oblate-ringed/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    planetType: 'ringed',
    rings: true,
    bands: true,
    oblateness: 0.1,
    radiusFrac: 0.5,
  });
// Celestial phenomena in one plate: eclipse shadow, aurora, haze atmosphere.
CASES['planet/phenomena/42'] = () =>
  generatePlanet({
    width: 300,
    height: 400,
    margin: 20,
    seed: 42,
    lightElevation: 20,
    moon: true,
    eclipse: true,
    aurora: true,
    atmosphere: 2,
    atmosphereStyle: 'haze',
  });
CASES['texture/shapes/42'] = () =>
  generateTexture({ ...textureBase, style: 'shapes', seed: 42 });
CASES['texture/dashes/42'] = () =>
  generateTexture({ ...textureBase, style: 'dashes', seed: 42 });

// Post-processing stages, applied to a fixed base drawing.
CASES['optimize/flow-lines/42'] = () =>
  optimizePlot(generateFlowLines({ width: 300, height: 400, lineCount: 40, seed: 42 }));
CASES['hand-drawn/flow-lines/42'] = () =>
  applyHandDrawnStyle(generateFlowLines({ width: 300, height: 400, lineCount: 40, seed: 42 }));
CASES['page-border/rounded'] = () =>
  pageBorder({ width: 300, height: 400, marginPx: 24, cornerRadiusPx: 16 });
CASES['svg/flow-lines/42'] = () =>
  toSVG(generateFlowLines({ width: 300, height: 400, lineCount: 40, seed: 42 }));

function serialize(name: string, value: unknown): string {
  const json = JSON.stringify(value);
  // A degenerate (near-empty) drawing would still hash stably but guard
  // nothing — fail loudly instead so the case gets fixed.
  if (json.length < 500) throw new Error(`${name}: suspiciously small output (${json.length} chars)`);
  return json;
}

function hashOf(name: string, value: unknown): string {
  return createHash('sha256').update(serialize(name, value)).digest('hex');
}

describe('golden output hashes', () => {
  if (process.env.UPDATE_GOLDENS) {
    it('regenerates goldens.json', () => {
      const next: Record<string, string> = {};
      for (const [name, render] of Object.entries(CASES)) next[name] = hashOf(name, render());
      writeFileSync(GOLDENS_PATH, JSON.stringify(next, null, 2) + '\n');
      expect(Object.keys(next).length).toBe(Object.keys(CASES).length);
    });
    return;
  }

  const goldens: Record<string, string> = existsSync(GOLDENS_PATH)
    ? JSON.parse(readFileSync(GOLDENS_PATH, 'utf8'))
    : {};

  it('goldens.json covers exactly the current case list', () => {
    expect(Object.keys(goldens).sort()).toEqual(Object.keys(CASES).sort());
  });

  for (const [name, render] of Object.entries(CASES)) {
    it(name, () => {
      expect(
        hashOf(name, render()),
        `${name}: output changed. If intentional, eyeball-diff the galleries, then UPDATE_GOLDENS=1.`,
      ).toBe(goldens[name]);
    });
  }
});
