import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LENIA_PRESETS, PHYSARUM_PRESETS, RD_PRESETS } from '@flow-lines/core';
import { randomFlowGenome } from '../projects/flow-field/Controls';
import { randomCityGenome } from '../projects/city-generator/presets';
import { randomGestureGenome } from '../projects/gesture/Controls';
import { randomConwayGenome } from '../projects/conway/Controls';
import { randomComplexFlowGenome } from '../projects/complex-flow/Controls';
import { randomRDGenome } from '../projects/reaction-diffusion/Controls';
import { randomLeniaGenome } from '../projects/lenia/Controls';
import { randomPhysarumGenome } from '../projects/physarum/Controls';
import { randomColorFieldGenome } from '../projects/color-field/Controls';
import { randomInkFieldGenome } from '../projects/ink-field/Controls';
import { randomStickmenGenome } from '../projects/stickmen/Controls';
import { randomSportsBallsGenome } from '../projects/sports-balls/Controls';
import { randomHeartsGenome } from '../projects/hearts/Controls';
import { randomTanglesGenome } from '../projects/tangles/Controls';
import { randomImageInkGenome } from '../projects/image-ink/genome';
import { randomGratingGenome } from '../textures/grating/shared';
import { randomMarblingGenome } from '../projects/marbling/presets';
import { randomMeanderGenome } from '../projects/meander/Controls';
import { randomCoralGenome } from '../projects/coral/Controls';
import { randomWarpGridGenome } from '../projects/warp-grid/presets';
import { randomHarmonographGenome } from '../projects/harmonograph/presets';
import { randomImpactGridGenome } from '../projects/impact-grid/types';
import { randomLapidaryGenome } from '../projects/lapidary/presets';
import { randomTerracesGenome } from '../projects/terraces/presets';
import { randomMachineGenome } from '../projects/machine/presets';
import { randomRibbonGenome } from '../projects/ribbon-weave/presets';
import { randomPlanetGenome } from '../projects/planet-generator/presets';
import { randomLandscapeGenome } from '../projects/landscape-generator/presets';
import { randomBotanicalGenome } from '../projects/botanical-generator/presets';

/**
 * Every randomise-all genome must stay inside its sliders' ranges, pick enum
 * fields from the real union values, and leave the seed, user data (painted
 * points, masks, accents), quality prefs and pen/ink aesthetics alone. One
 * table drives the shared assertions; module-specific invariants (threshold
 * ordering, preset-anchored physics) follow as targeted cases.
 */
interface GenomeSpec {
  name: string;
  genome: (rng: () => number) => Record<string, unknown>;
  /** Numeric fields: [slider min, slider max]. */
  bounds: Record<string, [number, number]>;
  /** Fields that must be integers. */
  ints?: string[];
  /** Fields that must be booleans. */
  bools?: string[];
  /** Enum fields: the allowed values. */
  enums?: Record<string, readonly string[]>;
  /** Fields the genome must never touch. */
  forbidden: string[];
}

const ART_TREATMENT_BOUNDS: Record<string, [number, number]> = {
  contourLevels: [2, 12],
  fillThreshold: [0.1, 0.8],
  blurSigma: [0.4, 3],
  wobble: [0, 3],
  hatchAngle: [-90, 90],
  crossHatchAmount: [0, 1],
  hatchJitter: [0, 1],
  valueBands: [0, 8],
  vignette: [0, 1],
};

/**
 * The three scene generators build their genome by crossing two whole curated
 * presets, and a preset's state includes its `palette` — so unlike the
 * slider-rolling modules (which must leave ink choice alone) these three
 * deliberately re-roll the palette, for variety beyond the two parents'.
 *
 * Listed explicitly so the omission of `palette` from their forbidden lists
 * reads as a decision rather than an oversight, and so a *new* module can't
 * quietly join them.
 */
// Lapidary joins for the impact-grid reason: its identity is multi-pen
// interplay (strokes interleaved across 2-4 pens within every texture), so a
// surprise that never re-dealt the pen set wouldn't be one. Most rolls deal a
// NAMED palette from its curated table; a slice invents one through
// `randomLapidaryPalette` (seeded, ink-plausible colours). Either way the
// palette fixes `pens` to its size and carries the vein accent.
const PALETTE_ROLLERS = [
  'botanical-generator',
  'landscape-generator',
  'planet-generator',
  'impact-grid',
  'lapidary',
  'terraces',
];

const SPECS: GenomeSpec[] = [
  {
    name: 'marbling',
    genome: randomMarblingGenome,
    bounds: {
      drops: [10, 150],
      dropSizeMm: [5, 40],
      ringsPerDrop: [1, 6],
      dropJitter: [0, 1],
      combSpacingMm: [1.5, 12],
      swirl: [0, 1],
      falloffMm: [0.3, 6],
      wavy: [0, 1],
      vortex: [0, 1],
    },
    ints: ['drops', 'ringsPerDrop'],
    enums: { preset: ['stone', 'nonpareil', 'feather', 'bouquet', 'vortex'] },
    forbidden: [
      'seed',
      'detailMm',
      'penWidthMm',
      'wobbleMm',
      'inkGroups',
      'strokeColor',
      'ink2Color',
      'ink3Color',
      'ink4Color',
    ],
  },
  {
    name: 'warp-grid',
    genome: randomWarpGridGenome,
    bounds: {
      spacingMm: [1.5, 8],
      angle: [0, 180],
      waveAmp: [0, 1],
      wavelengthMm: [10, 60],
      deformers: [0, 8],
      strength: [0, 1],
      relief: [0, 1],
      scale: [0.1, 0.6],
      noiseScale: [0.1, 0.8],
      dropFloor: [0, 1],
      edgeCalm: [0, 1],
    },
    ints: ['deformers', 'angle'],
    bools: ['occlude'],
    enums: {
      preset: ['dome', 'current', 'vortex', 'relief', 'pinch', 'blaze'],
      pattern: ['lines', 'waves', 'circles', 'rays'],
    },
    forbidden: ['seed', 'detailMm', 'penWidthMm', 'wobbleMm', 'strokeColor'],
  },
  {
    name: 'harmonograph',
    genome: randomHarmonographGenome,
    bounds: {
      scale: [0.3, 1],
      jitter: [0, 1],
      ratioNum: [1, 9],
      ratioDen: [1, 9],
      detune: [0, 0.05],
      damping: [0, 1],
      rotary: [0, 1],
      phaseDeg: [0, 180],
      periods: [2, 120],
      lobes: [3, 24],
      wheelOrder: [1, 12],
      penOffset: [0, 1.5],
      nest: [1, 24],
      nestShrink: [0.5, 1],
      rings: [4, 80],
      waves: [3, 48],
      waveAmp: [0, 1],
      phaseAdvanceDeg: [0, 45],
      innerHole: [0, 0.9],
      waves2: [0, 12],
      wave2Amp: [0, 1],
    },
    ints: ['ratioNum', 'ratioDen', 'periods', 'lobes', 'wheelOrder', 'nest', 'rings', 'waves', 'waves2'],
    enums: {
      preset: ['pendulum', 'lissajous', 'rotary', 'spiro', 'wheelwork', 'rosette', 'engine-turn'],
      mode: ['harmonograph', 'spirograph', 'rosette'],
    },
    forbidden: [
      'seed',
      'detailMm',
      'penWidthMm',
      'wobbleMm',
      'inkGroups',
      'strokeColor',
      'ink2Color',
      'ink3Color',
      'ink4Color',
    ],
  },
  {
    name: 'impact-grid',
    genome: randomImpactGridGenome,
    bounds: {
      frameDepth: [1, 6],
      cellSizeMm: [3, 20],
      sizeVariation: [0, 1],
      positionJitter: [0, 1],
      rotationJitter: [0, 1],
      gap: [0, 0.6],
      impactRadiusMm: [10, 150],
      impactStrength: [0, 1],
      shatter: [0, 1],
      scatter: [0, 1],
      debris: [0, 1],
      crush: [0, 1],
      sweep: [0, 1],
      fill: [0, 1],
      toneRange: [0, 1],
      inkBalance: [0, 1],
      paneStress: [0, 1],
      energy: [0, 1],
      focus: [0, 1],
      drift: [0, 1],
      granularity: [0, 1],
    },
    ints: ['frameDepth', 'impactRadiusMm'],
    bools: ['inkPath'],
    enums: {
      layout: ['mosaic', 'grid', 'frame', 'bars'],
      region: ['slab', 'band', 'disc', 'full'],
      fillStyle: ['texture', 'none', 'hatch', 'concentric'],
      inkMode: ['regions', 'damage'],
    },
    // maskPath / drawMode are user data — the drawn strike survives a
    // reroll. `look` is the preset label, not a knob. Ink fields are absent
    // from forbidden by design: impact-grid is in PALETTE_ROLLERS and rolls
    // a NAMED palette (inkColors/pathColor come from the table, never
    // generated colours).
    forbidden: ['seed', 'penWidthMm', 'wobbleMm', 'maskPath', 'drawMode'],
  },
  {
    name: 'lapidary',
    genome: randomLapidaryGenome,
    bounds: {
      bands: [2, 10],
      irregularity: [0, 1],
      coverage: [0.4, 1],
      centerX: [-0.5, 0.5],
      centerY: [-0.5, 0.5],
      haloMm: [0.8, 5],
      spacingMm: [0.6, 3],
      angleDeg: [0, 180],
      angleDriftDeg: [0, 60],
      densityContrast: [0, 1],
      waviness: [0, 1],
      patchiness: [0, 1],
      taper: [0, 1],
      jitterDeg: [0, 3],
      toneStrength: [0, 1],
      lightAngleDeg: [-180, 180],
      sheetToneStrength: [0, 1],
      outlineEmphasis: [1, 3],
      pens: [1, 4],
      faults: [0, 4],
      spiralWidth: [0.15, 1],
      spiralTaper: [-1, 1],
      spiralPulse: [0, 1],
    },
    ints: ['bands', 'angleDriftDeg', 'pens', 'faults', 'lightAngleDeg', 'outlineEmphasis'],
    bools: ['outlines', 'field', 'veins'],
    enums: {
      // 'custom' resets the Look picker's label — a rolled state is no
      // preset's reference artwork.
      preset: ['custom'],
      mode: ['agate', 'breccia', 'strata', 'spiral'],
      shapes: ['organic', 'angular', 'mixed'],
      toneShape: ['none', 'seam', 'core', 'light', 'noise'],
      sheetTone: ['none', 'light', 'vignette'],
      textureMix: [
        'specimen',
        'geode',
        'fortification',
        'facet',
        'ammonite',
        'linework',
        'tonal',
        'shuffle',
      ],
      penAssignment: ['interleave', 'per-region'],
      spiralForm: ['circular', 'rectangular', 'page'],
      spiralDirection: ['inward', 'outward'],
      spiralJoin: ['cells', 'blend'],
    },
    // Ink fields are absent from forbidden by design: lapidary is in
    // PALETTE_ROLLERS and rolls the palette — strokeColor/ink2..4Color,
    // `pens` and the `veinColor` accent come from the curated table or, on a
    // slice of rolls, from `randomLapidaryPalette`'s invented pen set.
    forbidden: ['seed', 'penWidthMm', 'wobbleMm'],
  },
  {
    name: 'terraces',
    genome: randomTerracesGenome,
    bounds: {
      bands: [2, 10],
      irregularity: [0, 1],
      steppiness: [0, 1],
      faults: [0, 6],
      faultThrow: [0, 2],
      faultIncline: [-1, 1],
      haloMm: [0.8, 5],
      spacingMm: [0.6, 3],
      angleDeg: [0, 180],
      angleDriftDeg: [0, 60],
      densityContrast: [0, 1],
      waviness: [0, 1],
      patchiness: [0, 1],
      taper: [0, 1],
      jitterDeg: [0, 3],
      toneStrength: [0, 1],
      lightAngleDeg: [-180, 180],
      sheetToneStrength: [0, 1],
      outlineEmphasis: [1, 3],
      pens: [1, 4],
    },
    ints: ['bands', 'angleDriftDeg', 'pens', 'faults', 'lightAngleDeg', 'outlineEmphasis'],
    bools: ['outlines', 'continuous'],
    enums: {
      // 'custom' resets the Look picker's label — a rolled state is no
      // preset's reference artwork.
      preset: ['custom'],
      toneShape: ['none', 'seam', 'core', 'light', 'noise'],
      sheetTone: ['none', 'light', 'vignette'],
      textureMix: ['fortification', 'linework', 'tonal', 'shuffle'],
      penAssignment: ['interleave', 'per-region'],
    },
    // Ink fields are absent from forbidden by design: terraces is in
    // PALETTE_ROLLERS and rolls the palette (lapidary's curated table or an
    // invented pen set) — strokeColor/ink2..4Color and `pens` ride it.
    forbidden: ['seed', 'penWidthMm', 'wobbleMm'],
  },
  {
    name: 'meander',
    genome: randomMeanderGenome,
    bounds: {
      iterations: [60, 800],
      migration: [0, 1],
      bendScale: [0.04, 0.2],
      valleyWidth: [0.2, 1],
      flowAngleDeg: [0, 180],
      jitter: [0, 1],
      channelWidthMm: [1.5, 10],
      traces: [0, 60],
      fade: [0, 1],
      flowLines: [0, 5],
      boldPasses: [1, 6],
      wobble: [0, 3],
    },
    ints: ['iterations', 'traces', 'flowLines', 'boldPasses'],
    bools: ['oxbows'],
    forbidden: [
      'seed',
      'preset',
      'strokeColor',
      'penWidthMm',
      'multiInk',
      'channelColor',
      'traceColor',
      'oxbowColor',
    ],
  },
  {
    name: 'coral',
    genome: randomCoralGenome,
    bounds: {
      iterations: [100, 1200],
      growth: [0.05, 1],
      foldDiv: [12, 40],
      maxNodes: [800, 6000],
      noiseScale: [0.06, 0.4],
      patchiness: [0, 1],
      curvatureBias: [0, 1],
      jitter: [0, 0.8],
      blobs: [2, 6],
      rings: [0, 40],
      fade: [0, 1],
      boldPasses: [1, 6],
      wobble: [0, 3],
    },
    ints: ['iterations', 'foldDiv', 'maxNodes', 'blobs', 'rings', 'boldPasses'],
    enums: { seedShape: ['circle', 'polygon', 'line', 'blobs'] },
    forbidden: [
      'seed',
      'preset',
      'strokeColor',
      'penWidthMm',
      'multiInk',
      'edgeColor',
      'ringColor',
      'relicColor',
    ],
  },
  {
    name: 'flow-field',
    genome: randomFlowGenome,
    bounds: {
      lineCount: [10, 3000],
      lineSpacingMm: [0.5, 10],
      stepLength: [1, 10],
      maxSteps: [50, 1000],
      noiseScale: [0.001, 0.02],
      octaves: [1, 8],
      persistence: [0.1, 0.9],
      lacunarity: [1, 4],
    },
    ints: ['lineCount', 'octaves', 'maxSteps'],
    bools: ['denseFill'],
    forbidden: [
      'seed',
      'minLineLength',
      'strokeColor',
      'penWidthMm',
      'paintMode',
      'paintedPoints',
      'showDots',
    ],
  },
  {
    name: 'city-generator',
    genome: randomCityGenome,
    bounds: {
      order: [0, 1],
      density: [0.3, 1],
      downtown: [0, 1],
      blockCols: [2, 14],
      blockRows: [2, 14],
      lotSizeMm: [6, 26],
      streetMm: [1, 14],
      heightMm: [8, 80],
      heightVariance: [0, 1],
      storeyMm: [1.5, 7],
      tiers: [0, 1],
      lean: [0, 1],
      windows: [0, 1],
      windowMm: [1.2, 5],
      shadeStrength: [0, 1],
      hatchSpacingMm: [0.5, 4],
    },
    ints: ['blockCols', 'blockRows', 'heightMm'],
    enums: {
      style: ['towers', 'greek-villa', 'old-town', 'brownstone', 'brutalist', 'mixed'],
      lightSide: ['left', 'right'],
    },
    forbidden: [
      'seed',
      'preset',
      'zoom',
      'penWidthMm',
      'wobbleMm',
      'sketch',
      'sketchStyle',
      'contourColor',
      'windowColor',
      'hatchColor',
    ],
  },
  {
    name: 'gesture',
    genome: randomGestureGenome,
    bounds: {
      energy: [0, 1],
      inkWeight: [0, 1],
      dryness: [0, 1],
      gestures: [0, 5],
      whips: [-1, 12],
      knots: [-1, 3],
      spatter: [0, 1],
      drips: [0, 1],
      coverage: [0.1, 0.7],
      balance: [0, 1],
      negativeSpace: [0, 1],
    },
    ints: ['gestures', 'whips', 'knots'],
    forbidden: ['seed', 'preset', 'penWidthMm', 'wobble', 'strokeColor'],
  },
  {
    name: 'conway',
    genome: randomConwayGenome,
    bounds: {
      seedCount: [1, 12],
      generations: [20, 1200],
      decay: [0.8, 0.98],
      cellSize: [1, 4],
      gamma: [0.2, 1],
      faintThreshold: [0, 0.4],
      mediumThreshold: [0.1, 0.6],
      solidThreshold: [0.4, 0.9],
      residueMaxCells: [1, 20],
      wobble: [0, 3],
      haloMm: [0, 4],
      contourLevels: [2, 10],
      slipstreamSpacing: [0.5, 2],
      stippleDensity: [2, 16],
      hatchAngle: [-90, 90],
      crossHatchAmount: [0, 1],
      hatchJitter: [0, 1],
      valueBands: [0, 6],
      offCenter: [0, 1],
      vignette: [0, 1],
    },
    ints: ['seedCount', 'generations', 'residueMaxCells', 'contourLevels', 'stippleDensity', 'valueBands'],
    enums: { style: ['marks', 'contour', 'streaks', 'slipstream', 'embers'] },
    forbidden: [
      'seed',
      'artStyle',
      'massCore',
      'multiInk',
      'strokeColor',
      'presentColor',
      'ghostColor',
      'trailColor',
      'penWidthMm',
    ],
  },
  {
    name: 'complex-flow',
    genome: randomComplexFlowGenome,
    bounds: {
      zeroCount: [1, 8],
      poleCount: [0, 8],
      singularitySpread: [0.1, 1],
      fieldRotationDeg: [0, 360],
      planeScale: [0.5, 2.5],
      seedCount: [100, 5000],
      stepsPerDir: [20, 400],
      stepLength: [0.5, 6],
      stepJitter: [0, 1],
      wobble: [0, 3],
    },
    ints: ['zeroCount', 'poleCount', 'seedCount', 'stepsPerDir'],
    enums: {
      zeroLayout: ['ring', 'grid', 'parabola', 'random'],
      poleLayout: ['ring', 'grid', 'parabola', 'random'],
      seedLayout: ['multiRing', 'rings', 'random', 'lines', 'grid'],
    },
    forbidden: [
      'seed',
      'placeMode',
      'placeBrush',
      'manualZeros',
      'manualPoles',
      'showSingularities',
      'palette',
      'customRamp',
      'layerCount',
      'layerBy',
      'penWidthMm',
      'handDrawn',
      'speedClampMax',
      'minLineLength',
    ],
  },
  {
    name: 'reaction-diffusion',
    genome: randomRDGenome,
    bounds: {
      ...ART_TREATMENT_BOUNDS,
      feed: [0.01, 0.09],
      kill: [0.03, 0.07],
      steps: [1000, 6000],
      gridCols: [64, 250],
      seedSpots: [1, 40],
    },
    ints: ['contourLevels', 'steps', 'gridCols', 'seedSpots', 'valueBands'],
    enums: {
      preset: Object.keys(RD_PRESETS),
      style: ['contour', 'hatch', 'dual'],
      seedLayout: ['scatter', 'center', 'grid'],
    },
    forbidden: [
      'seed',
      'artStyle',
      'du',
      'dv',
      'isoLow',
      'isoHigh',
      'multiInk',
      'strokeColor',
      'coreColor',
      'midColor',
      'rimColor',
      'penWidthMm',
    ],
  },
  {
    name: 'lenia',
    genome: randomLeniaGenome,
    bounds: {
      ...ART_TREATMENT_BOUNDS,
      steps: [100, 700],
      gridCols: [72, 180],
      seedSpots: [1, 6],
      decay: [0.9, 0.998],
      gamma: [0.3, 1],
      kernelRadius: [6, 18],
      mu: [0.05, 0.4],
      sigma: [0.008, 0.06],
      timeRes: [2, 20],
    },
    ints: ['contourLevels', 'steps', 'gridCols', 'seedSpots', 'valueBands', 'kernelRadius', 'timeRes'],
    enums: { preset: Object.keys(LENIA_PRESETS), style: ['contour', 'hatch', 'dual'] },
    forbidden: [
      'seed',
      'artStyle',
      'isoLow',
      'isoHigh',
      'multiInk',
      'strokeColor',
      'coreColor',
      'midColor',
      'rimColor',
      'penWidthMm',
    ],
  },
  {
    name: 'physarum',
    genome: randomPhysarumGenome,
    bounds: {
      ...ART_TREATMENT_BOUNDS,
      steps: [50, 1000],
      gridCols: [80, 240],
      agentCount: [500, 30000],
      pathFraction: [0.01, 1],
      sampleEvery: [1, 8],
      minPathLength: [2, 40],
      sensorAngleDeg: [5, 60],
      sensorDistance: [2, 30],
      rotationAngleDeg: [5, 90],
      stepSize: [0.3, 3],
      depositAmount: [1, 20],
      decay: [0.01, 0.3],
      diffuseRate: [0, 1],
    },
    ints: ['contourLevels', 'steps', 'gridCols', 'agentCount', 'sampleEvery', 'minPathLength', 'valueBands'],
    enums: {
      preset: Object.keys(PHYSARUM_PRESETS),
      style: ['paths', 'contour', 'hatch', 'dual'],
      startLayout: ['scatter', 'center', 'ring'],
    },
    forbidden: [
      'seed',
      'artStyle',
      'multiInk',
      'strokeColor',
      'coreColor',
      'midColor',
      'rimColor',
      'penWidthMm',
    ],
  },
  {
    name: 'color-field',
    genome: randomColorFieldGenome,
    bounds: {
      angleDeg: [0, 180],
      lineLengthPct: [0.1, 1],
      spacingMm: [0.5, 8],
      fill: [0.3, 1],
      gradientAngleDeg: [0, 360],
      focalXPct: [0, 1],
      focalYPct: [0, 1],
      gradientRadiusPct: [0.2, 1.5],
      blend: [0.5, 3],
      gradientNoiseAmpMm: [0, 40],
      gradientNoiseScale: [0.001, 0.02],
      ditherScale: [0.01, 0.1],
      crossHatch: [1, 3],
      inkAngleSpreadDeg: [0, 60],
      jitterMm: [0, 1],
      wobbleAmpMm: [0, 3],
    },
    ints: ['crossHatch', 'gradientNoiseAmpMm'],
    enums: { gradientMode: ['linear', 'radial'] },
    forbidden: [
      'seed',
      'palette',
      'customRamp',
      'colorCount',
      'blendInks',
      'accents',
      'minSegmentLengthMm',
      'wobbleWavelengthMm',
      'penWidthMm',
    ],
  },
  {
    name: 'ink-field',
    genome: randomInkFieldGenome,
    bounds: {
      pitchMm: [0.4, 2],
      angleDeg: [0, 180],
      inkPhase: [0, 0.8],
      inkPitchDelta: [0, 0.08],
      phaseDrift: [0, 3],
      misregisterMm: [0, 1],
      wobbleAmpMm: [0, 0.3],
      bandWidthMm: [10, 70],
      ribbonSegments: [2, 8],
      planeCount: [0, 4],
      insetPatches: [0, 2],
      baseDensity: [0.1, 0.8],
      planeDensity: [0.5, 1],
      stripeCount: [2, 16],
      stripeSoftness: [0.1, 0.8],
      blockDuty: [0.3, 0.7],
    },
    ints: ['ribbonSegments', 'planeCount', 'insetPatches', 'stripeCount', 'bandWidthMm'],
    bools: ['stripeBlocks'],
    enums: { style: ['ribbon', 'lattice', 'stripes'] },
    forbidden: [
      'seed',
      'palette',
      'customRamp',
      'colorCount',
      'blendInks',
      'penTests',
      'wearOrder',
      'wearAngleDeg',
      'minSegmentLengthMm',
      'wobbleWavelengthMm',
      'jitterMm',
      'penWidthMm',
    ],
  },
  {
    name: 'grating (noise-texture + texture)',
    genome: randomGratingGenome,
    bounds: {
      spacingMm: [0.5, 8],
      angleDeg: [0, 180],
      lineLengthPct: [0.1, 1],
      phaseDriftAcrossMm: [0, 6],
      phaseDriftAlongMm: [0, 6],
      phaseNoiseAmpMm: [0, 4],
      phaseNoiseScale: [0.001, 0.05],
      edgeSmoothMm: [0, 40],
      jitterMm: [0, 1],
      wobbleAmpMm: [0, 3],
    },
    ints: ['edgeSmoothMm'],
    forbidden: [
      'seed',
      'palette',
      'customRamp',
      'colorCount',
      'maskMode',
      'stripAngleDeg',
      'stripWidthMm',
      'stripGapMm',
      'bandWidthMm',
      'maskPath',
      'drawMode',
      'maskWidthPct',
      'maskHeightPct',
      'maskIrregularity',
      'wobbleWavelengthMm',
      'penWidthMm',
    ],
  },
  {
    name: 'stickmen',
    genome: randomStickmenGenome,
    bounds: {
      count: [10, 800],
      poseEnergy: [0, 1],
      limbCurve: [0, 1],
      spread: [0.2, 2],
      clustering: [0, 1],
      minSeparationMm: [0, 12],
      scaleVariance: [0, 0.6],
      proportionVariance: [0, 1],
      depthGrade: [0, 1],
      figureHeightMm: [6, 40],
      facingAngleDeg: [0, 360],
      facingJitterDeg: [0, 180],
      regionSize: [0.2, 1],
      regionX: [0, 1],
      regionY: [0, 1],
      regionInner: [0.1, 0.9],
    },
    ints: ['count'],
    bools: ['occlude', 'groundContact'],
    forbidden: ['seed', 'penWidthMm', 'strokeColor', 'wobble', 'boldness', 'zoom'],
  },
  {
    name: 'sports-balls',
    genome: randomSportsBallsGenome,
    bounds: {
      count: [1, 250],
      clustering: [0, 1],
      spacingMm: [0, 20],
      ballSizeMm: [6, 40],
      sizeVariance: [0, 0.6],
      trueSizes: [0, 1],
      depthGrade: [0, 1],
      spin: [0, 1],
      shading: [0, 1],
      castShadows: [0, 1],
      lightAngleDeg: [0, 360],
      regionSize: [0.2, 1],
      regionX: [0, 1],
      regionY: [0, 1],
      regionInner: [0.1, 0.9],
    },
    ints: ['count'],
    bools: ['occlude', 'regionSoftEdge'],
    forbidden: ['seed', 'mix', 'penWidthMm', 'strokeColor', 'wobble', 'zoom'],
  },
  {
    name: 'tangles',
    genome: randomTanglesGenome,
    bounds: {
      count: [1, 16],
      radiusMinMm: [2, 8],
      radiusMaxMm: [3, 14],
      wander: [0, 1],
      cuffChance: [0, 1],
      clearanceMm: [0, 5],
      ringDensity: [0, 1],
      ringCurve: [0, 1],
      shading: [0, 1],
      lightAngleDeg: [0, 360],
      shadowHatch: [0, 1],
      weaveBias: [0, 1],
      twists: [0, 1],
    },
    ints: ['count', 'lightAngleDeg'],
    enums: { material: ['hose', 'lace'] },
    forbidden: ['seed', 'penWidthMm', 'strokeColor', 'wobbleMm', 'wobble', 'gapMm', 'zoom'],
  },
  {
    name: 'hearts',
    genome: randomHeartsGenome,
    bounds: {
      count: [1, 300],
      clustering: [0, 1],
      spacingMm: [0, 40],
      heartSizeMm: [6, 50],
      sizeVariance: [0, 0.8],
      depthGrade: [0, 0.5],
      plumpness: [0, 1],
      plumpVariance: [0, 0.6],
      tilt: [0, 1],
      age: [3, 18],
      fillDensity: [0.1, 1],
      hatchAngleDeg: [-90, 90],
      hatchJitter: [0, 1],
      arrows: [0, 1],
      boldOutline: [0, 1],
      shading: [0, 1],
      lightAngleDeg: [0, 360],
      regionSize: [0.15, 1],
      regionX: [0, 1],
      regionY: [0, 1],
      regionInner: [0.1, 0.9],
    },
    ints: ['count', 'hatchAngleDeg', 'lightAngleDeg', 'age'],
    bools: ['occlude', 'regionSoftEdge'],
    enums: { regionShape: ['full', 'ellipse', 'ring', 'diamond', 'star', 'heart', 'blob'] },
    forbidden: ['seed', 'mix', 'penWidthMm', 'strokeColor', 'wobbleMm', 'wobble', 'zoom'],
  },
  {
    name: 'image-ink',
    genome: randomImageInkGenome,
    bounds: {
      hatchAngle: [-90, 90],
      wobble: [0, 3],
      layers: [1, 5],
      minSpacing: [1, 6],
      maxSpacing: [6, 30],
      toneGamma: [0.5, 2.5],
      textureStrokes: [0, 1],
      maxStrokeLength: [0, 200],
      detailEmphasis: [0, 1],
    },
    ints: ['layers', 'maxSpacing', 'maxStrokeLength'],
    bools: ['crossContour', 'skyStipple'],
    enums: { textureStyle: ['ticks', 'stipple', 'scribble'] },
    forbidden: [
      'seed',
      'strokeColor',
      'penWidthMm',
      'workingSize',
      'focusRadiusPct',
      'focusStrength',
      'maskStrength',
      'skinLightening',
      'featureLines',
      'fieldSmoothing',
      'formStrength',
      'depthIsolation',
      'calmWater',
      'followTone',
      'drawOutlines',
      'autoStyle',
      'richBlacks',
      'solidBlacks',
      'outlinePasses',
      'outlineThreshold',
      'contourHalo',
      'counterchange',
      'lineSwell',
      'scribbleTone',
      'strokeBudget',
      'strokeWeight',
      'whiteCutoff',
    ],
  },
  {
    name: 'machine',
    genome: randomMachineGenome,
    bounds: {
      complexity: [0, 1],
      connectivity: [0, 1],
      gearSizeMm: [12, 42],
      scaleVariety: [0, 1],
      mechanisms: [0, 1],
      frameDensity: [0, 1],
      cutaways: [0, 3],
      hatchMm: [0.5, 2.5],
      shading: [0, 1],
      sketch: [0, 1],
      wobbleMm: [0, 1.2],
    },
    ints: ['cutaways'],
    bools: ['hiddenLines'],
    enums: { sketchStyle: ['loose', 'fine', 'gestural'] },
    forbidden: ['seed', 'palette', 'strokeColor', 'penWidthMm', 'zoom'],
  },
  {
    name: 'ribbon-weave',
    genome: randomRibbonGenome,
    bounds: {
      order: [0, 1],
      cellMm: [8, 40],
      bandMm: [1.5, 12],
      breaks: [0, 1],
      shading: [0, 1],
      meander: [0, 1],
      twists: [0, 1],
      rungs: [0, 1],
      rungCurve: [0, 1],
      shadowHatch: [0, 1],
      lightAngleDeg: [-180, 180],
      wobbleMm: [0, 1.2],
      sketch: [0, 1],
    },
    ints: ['lightAngleDeg'],
    enums: {
      style: ['band', 'silk'],
      edge: ['closed', 'bleed'],
      sketchStyle: ['loose', 'fine', 'gestural'],
    },
    forbidden: ['seed', 'palette', 'strokeColor', 'penWidthMm', 'gapMm', 'zoom'],
  },
  {
    name: 'planet-generator',
    genome: randomPlanetGenome,
    bounds: {
      lightAngle: [-180, 180],
      lightElevation: [0, 90],
      radiusFrac: [0.15, 0.95],
      lumpiness: [0, 0.25],
      terrainScale: [0.6, 3.5],
      terrainContrast: [0.6, 2.5],
      crossHatchLayers: [1, 5],
      ringTilt: [2, 45],
      oblateness: [0, 0.15],
      moonAngle: [-180, 180],
      rivers: [0, 12],
      rilles: [0, 8],
    },
    ints: ['crossHatchLayers', 'rivers', 'rilles'],
    bools: ['rings', 'iceCaps', 'aurora', 'starfield', 'moon'],
    // `palette` is absent from forbidden by design — see PALETTE_ROLLERS below.
    forbidden: ['seed', 'strokeColor', 'penWidthMm', 'wobbleMm', 'zoom'],
  },
  {
    name: 'landscape-generator',
    genome: randomLandscapeGenome,
    bounds: {
      horizonFrac: [0.15, 0.8],
      horizonWobbleMm: [0, 20],
      sunXFrac: [0.1, 0.9],
      sunYFrac: [0.08, 0.6],
      sunRadiusMm: [4, 30],
      ridgeCount: [1, 8],
      ridgeAmpMm: [2, 36],
      ridgeHatchAngle: [0, 90],
      ridgeSharpness: [0, 1],
      atmosphere: [0, 1],
      toneContrast: [0, 1],
      crossHatch: [0, 2],
      headlands: [0, 5],
      foreground: [0, 1],
      focus: [0, 1],
      clouds: [0, 1],
      trees: [0, 12],
      birds: [0, 10],
      rocks: [0, 8],
    },
    ints: ['ridgeCount', 'headlands', 'trees', 'birds', 'rocks'],
    bools: ['sun', 'sunRays', 'reflection', 'formFollow', 'slopeFollow'],
    enums: {
      foregroundSide: ['left', 'right'],
      treeStyle: ['mixed', 'round', 'conifer', 'scrub'],
    },
    // `palette` is absent from forbidden by design — see PALETTE_ROLLERS below.
    forbidden: ['seed', 'strokeColor', 'penWidthMm', 'wobbleMm', 'zoom'],
  },
  {
    name: 'botanical-generator',
    genome: randomBotanicalGenome,
    // Bounds are empty on purpose: this genome crosses two whole curated
    // presets rather than rolling sliders one at a time, so its numeric fields
    // are whatever the parents held. The forbidden list is the part that
    // matters here — a crossover must still not carry a seed or a pen setting
    // across. (`palette` is deliberately absent — see PALETTE_ROLLERS below.)
    bounds: {},
    forbidden: ['seed', 'strokeColor', 'penWidthMm', 'wobbleMm', 'zoom'],
  },
];

const ROLLS = 50;

describe.each(SPECS)('$name genome', (spec) => {
  it('never touches seed, user data, or the aesthetic prefs', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = spec.genome(Math.random);
      for (const key of spec.forbidden) {
        expect(g, `forbidden key ${key}`).not.toHaveProperty(key);
      }
    }
  });

  it('keeps every rolled knob inside its slider bounds', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = spec.genome(Math.random);
      for (const [key, [lo, hi]] of Object.entries(spec.bounds)) {
        const v = g[key];
        if (v === undefined) continue;
        expect(typeof v, `${key} is numeric`).toBe('number');
        expect(v, `${key} >= ${lo}`).toBeGreaterThanOrEqual(lo);
        expect(v, `${key} <= ${hi}`).toBeLessThanOrEqual(hi);
      }
      for (const key of spec.ints ?? []) {
        if (g[key] === undefined) continue;
        expect(Number.isInteger(g[key]), `${key} is an integer`).toBe(true);
      }
      for (const key of spec.bools ?? []) {
        expect(typeof g[key], `${key} is boolean`).toBe('boolean');
      }
      for (const [key, allowed] of Object.entries(spec.enums ?? {})) {
        expect(allowed, `${key} value ${String(g[key])}`).toContain(g[key]);
      }
    }
  });
});

describe('module-specific genome invariants', () => {
  it('conway fade thresholds always order faint < medium < solid', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomConwayGenome(Math.random);
      expect(g.faintThreshold!).toBeLessThan(g.mediumThreshold!);
      expect(g.mediumThreshold!).toBeLessThan(g.solidThreshold!);
    }
  });

  it('tangles always rolls the thinnest hose thinner than the fattest', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomTanglesGenome(Math.random);
      expect(g.radiusMinMm!).toBeLessThan(g.radiusMaxMm!);
    }
  });

  it('reaction-diffusion anchors feed/kill near its rolled preset', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomRDGenome(Math.random);
      const { f, k } = RD_PRESETS[g.preset!];
      expect(Math.abs(g.feed! - f)).toBeLessThanOrEqual(0.0016);
      expect(Math.abs(g.kill! - k)).toBeLessThanOrEqual(0.0016);
    }
  });

  it('lenia carries its rolled preset rule bundle verbatim', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomLeniaGenome(Math.random);
      const p = LENIA_PRESETS[g.preset!];
      expect(g.kernelRadius).toBe(p.R);
      expect(g.mu).toBe(p.mu);
      expect(g.sigma).toBe(p.sigma);
      expect(g.timeRes).toBe(p.T);
      expect(g.beta).toBe(p.beta);
      expect(g.seedPattern).toBe(p.seedPattern);
      expect(g.longExposure).toBe(p.longExposure);
    }
  });

  it('physarum derives the agent count from its rolled grid at preset density', () => {
    for (let i = 0; i < ROLLS; i++) {
      const g = randomPhysarumGenome(Math.random);
      const p = PHYSARUM_PRESETS[g.preset!];
      const ideal = p.agentDensity * g.gridCols! * g.gridCols!;
      expect(g.agentCount! % 500).toBe(0);
      // Within one 500-agent rounding step of the density-derived ideal,
      // unless the slider clamp kicked in.
      if (g.agentCount! > 500 && g.agentCount! < 30000) {
        expect(Math.abs(g.agentCount! - ideal)).toBeLessThanOrEqual(250);
      }
    }
  });
});

/**
 * Coverage guardrail: no genome may ship without a test.
 *
 * The SPECS table above is hand-maintained, and nothing used to notice when a
 * new module's `random<X>Genome` was never added to it — `machine` and
 * `ribbon-weave` both shipped with zero coverage that way. CLAUDE.md warns
 * that this step "gets forgotten"; this test is what stops it.
 *
 * Every exported `random<X>Genome` in the web source must be either imported
 * by this file (and so driven through the shared assertions) or listed in
 * COVERED_ELSEWHERE, which has to name a real test file that actually
 * references the symbol.
 */
const COVERED_ELSEWHERE: Record<string, string> = {
  randomFractureGenome: '../projects/fracture/genome.test.ts',
  randomClassicGenome: '../textures/classic/genome.test.ts',
};

describe('only the scene generators re-roll the palette', () => {
  for (const spec of SPECS) {
    it(`${spec.name} ${PALETTE_ROLLERS.includes(spec.name) ? 'may' : 'must not'} roll palette`, () => {
      const rolls = Array.from({ length: ROLLS }, () => spec.genome(Math.random));
      const touches = rolls.some((g) => 'palette' in g);
      if (PALETTE_ROLLERS.includes(spec.name)) {
        expect(touches, `${spec.name} is listed as a palette roller but never rolls one`).toBe(true);
      } else {
        expect(touches, `${spec.name} rolled a palette — ink choice is the user's`).toBe(false);
      }
    });
  }
});

describe('every genome is covered by a test', () => {
  const webSrc = fileURLToPath(new URL('..', import.meta.url));
  const selfPath = fileURLToPath(import.meta.url);

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(p));
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }

  const genomeRe = /export\s+(?:function|const)\s+(random[A-Za-z]*Genome)\b/g;
  const declared = new Set<string>();
  for (const file of sourceFiles(webSrc)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(genomeRe)) declared.add(m[1]);
  }

  const selfSrc = readFileSync(selfPath, 'utf8');
  const importedHere = new Set(
    [...selfSrc.matchAll(/import\s+\{\s*(random[A-Za-z]*Genome)\s*\}/g)].map((m) => m[1])
  );

  it('finds the genomes to check (sanity)', () => {
    expect(declared.size).toBeGreaterThan(15);
  });

  for (const name of [...declared].sort()) {
    it(`${name} is in SPECS or documented as covered elsewhere`, () => {
      if (importedHere.has(name)) return;
      const where = COVERED_ELSEWHERE[name];
      expect(
        where,
        `${name} has no coverage. Add it to SPECS in this file, or to ` +
          `COVERED_ELSEWHERE naming the test that covers it.`
      ).toBeTruthy();
      // The allowlist must point at a test that genuinely exercises it.
      const covering = join(webSrc, 'modules', where);
      const src = readFileSync(covering, 'utf8');
      expect(src, `${where} does not reference ${name}`).toContain(name);
    });
  }
});
