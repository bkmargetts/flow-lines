import { describe, it, expect } from 'vitest';
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
import { randomStickmenGenome } from '../projects/stickmen/Controls';
import { randomSportsBallsGenome } from '../projects/sports-balls/Controls';
import { randomImageInkGenome } from '../projects/image-ink/genome';
import { randomGratingGenome } from '../textures/grating/shared';
import { randomMarblingGenome } from '../projects/marbling/presets';
import { randomMeanderGenome } from '../projects/meander/Controls';
import { randomCoralGenome } from '../projects/coral/Controls';

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
