import { PEN_INK_STYLES, type PenInkStyle, type PortraitOptions } from '@flow-lines/core';
import { randomSeed } from '../../lib/random';

/**
 * Per-image ink settings. The page frame (paper, orientation, resolution,
 * margin, fit) lives in the shared FrameContext, not here — these are the
 * marks themselves.
 */
export interface InkSettings {
  seed: number;
  layers: number;
  minSpacing: number;
  maxSpacing: number;
  whiteCutoff: number;
  hatchAngle: number;
  followTone: boolean;
  drawOutlines: boolean;
  contourHalo: number;
  wobble: number;
  strokeColor: string;
  /** Pen width in millimetres (plotted line weight) */
  penWidthMm: number;
  detailEmphasis: number;
  focusRadiusPct: number;
  focusStrength: number;
  maskStrength: number;
  toneGamma: number;
  valueBands: number;
  /** Composition-aware value massing, 0..1 (needs valueBands >= 2) */
  massing: number;
  hatchPatchiness: number;
  workingSize: number;
  skinLightening: number;
  featureLines: boolean;
  textureStrokes: number;
  textureStyle: 'ticks' | 'stipple' | 'scribble';
  /** 'auto' defers to the scene labels: stipple when a sky is in frame */
  skyStipple: boolean | 'auto';
  /** 'auto' defers to the scene labels: calm water when water is in frame */
  calmWater: boolean | 'auto';
  richBlacks: boolean;
  /** Ink the darkest value band as committed solid fill (needs valueBands >= 2) */
  solidBlacks: boolean;
  /** Single-pen passes used to build bold contour outlines (1-4) */
  outlinePasses: number;
  /** Edge strength needed for outlines, 0-1 */
  outlineThreshold: number;
  counterchange: number;
  crossContour: boolean;
  /** Swelling line weight: hatch thickens through shadow, thins in light (0-1) */
  lineSwell: number;
  /** Continuous ballpoint scribble as the tone engine; replaces hatching (0-1) */
  scribbleTone: number;
  /** Stroke economy: cap drawn length at this multiple of the canvas diagonal (0 = off) */
  strokeBudget: number;
  /** Pen passes per surviving long stroke under the budget (1 = single pass) */
  strokeWeight: number;
  facetHatch: boolean;
  maxStrokeLength: number;
  fieldSmoothing: number;
  formStrength: number;
  depthIsolation: number;
  autoStyle: boolean;
}

/**
 * The serialisable per-layer state for an Image → Ink layer. Only the marks
 * settings + the chosen preset live here; the heavy per-photo ML state
 * (source image, depth/labels/mask/faces/focus) is owned by the mounted
 * instance hook's local React state, not the layer state.
 */
export interface ImageInkLayerState {
  settings: InkSettings;
  preset: string;
}

export type SegmentStatus = 'idle' | 'loading' | 'error';
export type PortraitStatus = 'idle' | 'loading' | 'error' | 'none';
export type DepthStatus = 'idle' | 'loading' | 'error';
export type LabelStatus = 'idle' | 'loading' | 'error';

export interface PortraitState {
  faceCount: number;
  portrait: Pick<PortraitOptions, 'faceOvals' | 'featureRegions' | 'featureStrokes'>;
}

export const defaultInkSettings: InkSettings = {
  seed: randomSeed(),
  layers: 3,
  minSpacing: 2.5,
  maxSpacing: 14,
  whiteCutoff: 0.08,
  hatchAngle: -45,
  followTone: true,
  drawOutlines: true,
  contourHalo: 2.2,
  wobble: 0.8,
  strokeColor: '#000000',
  penWidthMm: 0.3,
  detailEmphasis: 0.3,
  focusRadiusPct: 25,
  focusStrength: 0.85,
  maskStrength: 1,
  toneGamma: 1.3,
  valueBands: 4,
  massing: 0.5,
  hatchPatchiness: 0.35,
  workingSize: 720,
  skinLightening: 0.55,
  featureLines: true,
  textureStrokes: 0.6,
  textureStyle: 'ticks',
  skyStipple: 'auto',
  calmWater: 'auto',
  richBlacks: true,
  solidBlacks: false,
  outlinePasses: 2,
  outlineThreshold: 0.35,
  counterchange: 0.5,
  crossContour: false,
  lineSwell: 0,
  scribbleTone: 0,
  strokeBudget: 0,
  strokeWeight: 1,
  facetHatch: false,
  maxStrokeLength: 0,
  fieldSmoothing: 4,
  formStrength: 0.8,
  depthIsolation: 0.5,
  autoStyle: true,
};

/**
 * Map a core artist style's option bundle onto the web layer's InkSettings.
 * Field names are shared for everything a style may set except the label
 * auto-toggles, which the web models as an explicit 'auto' state where core
 * models them as "unset".
 */
export function styleToInkSettings(style: PenInkStyle): Partial<InkSettings> {
  const o = style.options;
  const settings: Partial<InkSettings> = {};
  const shared = [
    'layers', 'minSpacing', 'maxSpacing', 'whiteCutoff', 'toneGamma', 'valueBands',
    'massing', 'hatchPatchiness', 'detailEmphasis', 'textureStrokes', 'textureStyle',
    'wobble', 'workingSize', 'crossContour', 'facetHatch', 'maxStrokeLength',
    'fieldSmoothing', 'hatchAngle', 'followTone', 'drawOutlines', 'contourHalo',
    'richBlacks', 'counterchange', 'solidBlacks', 'outlinePasses', 'outlineThreshold',
    'lineSwell', 'scribbleTone', 'strokeBudget', 'strokeWeight',
  ] as const;
  for (const key of shared) {
    if (o[key] !== undefined) {
      (settings as Record<string, unknown>)[key] = o[key];
    }
  }
  settings.skyStipple = o.skyStipple === undefined ? 'auto' : o.skyStipple;
  settings.calmWater = o.calmWater === undefined ? 'auto' : o.calmWater;
  return settings;
}

/**
 * Fields the standard presets reset so switching away from an artist style
 * never inherits its committed choices (each artist style sets its own).
 */
const PRESET_BASE: Partial<InkSettings> = {
  contourHalo: 2.2,
  solidBlacks: false,
  outlinePasses: 2,
  outlineThreshold: 0.35,
  lineSwell: 0,
  scribbleTone: 0,
  strokeBudget: 0,
  strokeWeight: 1,
  richBlacks: true,
};

/** Curated parameter bundles — the only decision most users need to make.
 *  Entries flagged `artist` are whole artist styles from core, rendered as
 *  their own picker row; `hint` carries the style's one-line philosophy. */
export const PRESETS: Record<
  string,
  { label: string; settings: Partial<InkSettings>; artist?: boolean; hint?: string }
> = {
  classic: {
    label: 'Classic',
    settings: {
      ...PRESET_BASE,
      layers: 3,
      minSpacing: 2.5,
      maxSpacing: 14,
      whiteCutoff: 0.08,
      toneGamma: 1.3,
      valueBands: 4,
      massing: 0.5,
      hatchPatchiness: 0.35,
      detailEmphasis: 0.3,
      textureStrokes: 0.6,
      wobble: 0.8,
      workingSize: 720,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 4,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  portrait: {
    label: 'Portrait',
    settings: {
      ...PRESET_BASE,
      layers: 3,
      minSpacing: 2.5,
      maxSpacing: 14,
      toneGamma: 1.7,
      valueBands: 0,
      massing: 0,
      hatchPatchiness: 0.35,
      detailEmphasis: 0.35,
      textureStrokes: 0.4,
      wobble: 0.9,
      workingSize: 800,
      skinLightening: 0.6,
      whiteCutoff: 0.08,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 4,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  pet: {
    label: 'Pet',
    settings: {
      ...PRESET_BASE,
      layers: 2,
      minSpacing: 2.5,
      maxSpacing: 12,
      toneGamma: 1.45,
      valueBands: 4,
      massing: 0.4,
      hatchPatchiness: 0.35,
      detailEmphasis: 0.35,
      textureStrokes: 1,
      wobble: 1,
      workingSize: 800,
      whiteCutoff: 0.08,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 4,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  landscape: {
    label: 'Landscape',
    settings: {
      ...PRESET_BASE,
      layers: 5,
      minSpacing: 1.8,
      maxSpacing: 16,
      toneGamma: 1,
      valueBands: 4,
      massing: 0.4,
      hatchPatchiness: 0.7,
      detailEmphasis: 0.45,
      textureStrokes: 0.7,
      wobble: 0.9,
      workingSize: 800,
      whiteCutoff: 0.14,
      hatchAngle: 0,
      skyStipple: true,
      calmWater: true,
      crossContour: false,
      facetHatch: true,
      maxStrokeLength: 70,
      fieldSmoothing: 5,
      textureStyle: 'ticks',
    },
  },
  sketch: {
    label: 'Sketch',
    settings: {
      ...PRESET_BASE,
      layers: 1,
      minSpacing: 3.2,
      maxSpacing: 24,
      toneGamma: 1.35,
      valueBands: 3,
      massing: 0.5,
      hatchPatchiness: 0.6,
      detailEmphasis: 0.4,
      textureStrokes: 0.8,
      wobble: 2.2,
      workingSize: 720,
      whiteCutoff: 0.1,
      crossContour: false,
      facetHatch: false,
      maxStrokeLength: 0,
      fieldSmoothing: 3,
      hatchAngle: -30,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'scribble',
    },
  },
  etching: {
    label: 'Etching',
    settings: {
      ...PRESET_BASE,
      layers: 2,
      minSpacing: 2.8,
      maxSpacing: 14,
      whiteCutoff: 0.15,
      toneGamma: 1.8,
      valueBands: 5,
      massing: 0.5,
      hatchPatchiness: 0.5,
      detailEmphasis: 0.35,
      textureStrokes: 0.15,
      wobble: 0.4,
      workingSize: 800,
      crossContour: true,
      facetHatch: true,
      maxStrokeLength: 48,
      fieldSmoothing: 8,
      hatchAngle: -45,
      skyStipple: 'auto',
      calmWater: 'auto',
      textureStyle: 'ticks',
    },
  },
  comic: {
    label: PEN_INK_STYLES.comic.label,
    hint: PEN_INK_STYLES.comic.description,
    artist: true,
    settings: styleToInkSettings(PEN_INK_STYLES.comic),
  },
  dore: {
    label: PEN_INK_STYLES.dore.label,
    hint: PEN_INK_STYLES.dore.description,
    artist: true,
    settings: styleToInkSettings(PEN_INK_STYLES.dore),
  },
  ballpoint: {
    label: PEN_INK_STYLES.ballpoint.label,
    hint: PEN_INK_STYLES.ballpoint.description,
    artist: true,
    settings: styleToInkSettings(PEN_INK_STYLES.ballpoint),
  },
  sumie: {
    label: PEN_INK_STYLES.sumie.label,
    hint: PEN_INK_STYLES.sumie.description,
    artist: true,
    settings: styleToInkSettings(PEN_INK_STYLES.sumie),
  },
};
