/**
 * Semantic region labels for mark dispatch.
 *
 * A segmentation model (browser or CLI side — core never runs ML) labels the
 * photo with scene classes; those collapse onto a small taxonomy of materials
 * the renderer knows how to ink: sky, water, foliage, ground, building,
 * person, object. Labels replace the brittle geometric heuristics ("smooth
 * region in the lower half of the frame is water") wherever they are
 * confident, and the heuristics remain the fallback when no labels exist.
 */

import { gaussianBlur, sampleBilinear, type GrayscaleImage } from './image.js';

/**
 * Core-side label taxonomy. Index in this array is the raster id; 0 means
 * "no data", so an all-zero raster behaves exactly like no raster at all.
 */
export const SEMANTIC_LABELS = [
  'unknown',
  'sky',
  'water',
  'foliage',
  'ground',
  'building',
  'person',
  'object',
] as const;

export type SemanticLabel = (typeof SEMANTIC_LABELS)[number];

/** Row-major raster of taxonomy ids (see SEMANTIC_LABELS). */
export interface LabelImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Taxonomy id for a label name, or 0 if unrecognised. */
export function semanticId(label: SemanticLabel): number {
  const id = SEMANTIC_LABELS.indexOf(label);
  return id < 0 ? 0 : id;
}

/**
 * ADE20K class name → taxonomy label, keyed by lowercased name rather than
 * class index: transformers.js returns named masks, and names survive
 * id2label ordering surprises. Some checkpoints publish compound names
 * ("windowpane;window") — normalize with `normalizeAdeName` before lookup.
 * Anything unmapped is a generic `object`.
 */
export const ADE20K_TO_SEMANTIC: Record<string, SemanticLabel> = {
  sky: 'sky',

  water: 'water',
  sea: 'water',
  river: 'water',
  lake: 'water',
  'swimming pool': 'water',
  waterfall: 'water',
  fountain: 'water',

  tree: 'foliage',
  grass: 'foliage',
  plant: 'foliage',
  field: 'foliage',
  flower: 'foliage',
  palm: 'foliage',

  floor: 'ground',
  road: 'ground',
  sidewalk: 'ground',
  earth: 'ground',
  mountain: 'ground',
  sand: 'ground',
  path: 'ground',
  hill: 'ground',
  rock: 'ground',
  'dirt track': 'ground',
  land: 'ground',
  runway: 'ground',

  wall: 'building',
  building: 'building',
  ceiling: 'building',
  windowpane: 'building',
  door: 'building',
  house: 'building',
  fence: 'building',
  railing: 'building',
  column: 'building',
  skyscraper: 'building',
  stairs: 'building',
  stairway: 'building',
  bridge: 'building',
  hovel: 'building',
  tower: 'building',
  awning: 'building',
  bannister: 'building',

  person: 'person',
};

/**
 * ADE20K checkpoints disagree on exact label strings — some publish
 * "windowpane;window", some "windowpane". Keep the first token.
 */
export function normalizeAdeName(name: string): string {
  return name.toLowerCase().split(';')[0].trim();
}

/** Taxonomy label for an ADE20K class name (generic object if unmapped). */
export function adeNameToSemantic(name: string): SemanticLabel {
  return ADE20K_TO_SEMANTIC[normalizeAdeName(name)] ?? 'object';
}

/** One binary class mask from a segmentation pipeline, with its class name */
export interface NamedMask {
  label: string;
  mask: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
}

/**
 * Composite the per-class masks an ADE20K segmentation pipeline returns
 * (disjoint, full input resolution) into a taxonomy id raster.
 */
export function labelsFromAdeMasks(masks: NamedMask[]): LabelImage {
  if (masks.length === 0) {
    return { width: 1, height: 1, data: new Uint8Array(1) };
  }

  const { width, height } = masks[0].mask;
  const data = new Uint8Array(width * height);

  for (const { label, mask } of masks) {
    const id = semanticId(adeNameToSemantic(label));
    if (id === 0) continue;
    for (let i = 0; i < data.length; i++) {
      if (mask.data[i] > 127) data[i] = id;
    }
  }

  return { width, height, data };
}

// Confidence planes live at a small fixed resolution: the model runs at
// ~512px, so nothing finer exists to preserve, and 8 planes at 256 max-dim
// stay well under phone memory budgets.
const PLANE_MAX_DIM = 256;

/**
 * Canvas-space view over a label raster.
 *
 * The raster is majority-vote downsampled, then each present label gets a
 * blurred one-hot confidence plane. Gates sample the blurred confidence, not
 * the hard id — a 512px segmentation can't be trusted to the pixel, so label
 * boundaries feather over ~1% of the frame instead of snapping mark styles
 * along a jagged model edge.
 */
export class SemanticMap {
  private readonly planes = new Map<SemanticLabel, GrayscaleImage>();
  private readonly coverageByLabel = new Map<SemanticLabel, number>();
  private readonly scaleX: number;
  private readonly scaleY: number;
  private readonly present: SemanticLabel[] = [];

  constructor(labels: LabelImage, canvasWidth: number, canvasHeight: number) {
    const raster = downsampleMajority(labels, PLANE_MAX_DIM);
    this.scaleX = raster.width / Math.max(1, canvasWidth);
    this.scaleY = raster.height / Math.max(1, canvasHeight);

    const counts = new Array<number>(SEMANTIC_LABELS.length).fill(0);
    for (let i = 0; i < raster.data.length; i++) {
      const id = raster.data[i];
      if (id < SEMANTIC_LABELS.length) counts[id]++;
    }

    const total = raster.data.length;
    const sigma = Math.max(1.5, Math.max(raster.width, raster.height) / 100);

    for (let id = 1; id < SEMANTIC_LABELS.length; id++) {
      if (counts[id] === 0) continue;
      const label = SEMANTIC_LABELS[id];
      this.coverageByLabel.set(label, counts[id] / total);
      this.present.push(label);

      const plane = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        plane[i] = raster.data[i] === id ? 1 : 0;
      }
      this.planes.set(
        label,
        gaussianBlur({ width: raster.width, height: raster.height, data: plane }, sigma)
      );
    }
  }

  /** Feathered confidence for a label at a canvas position, in [0, 1]. */
  confidence(x: number, y: number, label: SemanticLabel): number {
    const plane = this.planes.get(label);
    if (!plane) return 0;
    return sampleBilinear(plane, x * this.scaleX, y * this.scaleY);
  }

  /** Most confident label at a canvas position (unknown where nothing wins). */
  labelAt(x: number, y: number): SemanticLabel {
    let best: SemanticLabel = 'unknown';
    let bestConf = 0.2;
    for (const label of this.present) {
      const c = this.confidence(x, y, label);
      if (c > bestConf) {
        best = label;
        bestConf = c;
      }
    }
    return best;
  }

  /** Fraction of the frame carrying this label (before feathering). */
  coverage(label: SemanticLabel): number {
    return this.coverageByLabel.get(label) ?? 0;
  }

  /** Whether the label covers enough of the frame to matter (>0.5%). */
  has(label: SemanticLabel): boolean {
    return this.coverage(label) > 0.005;
  }
}

/**
 * Downsample a label raster so its largest dimension is at most maxDim,
 * each output pixel taking the most common id in its source box. Averaging
 * is meaningless for categorical ids.
 */
function downsampleMajority(labels: LabelImage, maxDim: number): LabelImage {
  const scale = maxDim / Math.max(labels.width, labels.height);
  if (scale >= 1) {
    return { width: labels.width, height: labels.height, data: new Uint8Array(labels.data) };
  }

  const width = Math.max(1, Math.round(labels.width * scale));
  const height = Math.max(1, Math.round(labels.height * scale));
  const data = new Uint8Array(width * height);
  const invScale = 1 / scale;
  const counts = new Array<number>(SEMANTIC_LABELS.length);

  for (let y = 0; y < height; y++) {
    const sy0 = Math.floor(y * invScale);
    const sy1 = Math.min(labels.height, Math.max(sy0 + 1, Math.floor((y + 1) * invScale)));

    for (let x = 0; x < width; x++) {
      const sx0 = Math.floor(x * invScale);
      const sx1 = Math.min(labels.width, Math.max(sx0 + 1, Math.floor((x + 1) * invScale)));

      counts.fill(0);
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const id = labels.data[sy * labels.width + sx];
          if (id < counts.length) counts[id]++;
        }
      }

      let best = 0;
      for (let id = 1; id < counts.length; id++) {
        if (counts[id] > counts[best]) best = id;
      }
      data[y * width + x] = best;
    }
  }

  return { width, height, data };
}
