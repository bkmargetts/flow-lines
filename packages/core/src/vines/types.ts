import { Point } from '../flow-lines.js';
import { type SketchStyle } from '../sketch-styles.js';

export type VineMode = 'growth' | 'colonization';
export type VineSeeding = 'painted' | 'scatter' | 'edges' | 'point';
export type VineComposition = 'specimen' | 'free' | 'wreath' | 'border' | 'bouquet' | 'trellis' | 'fill' | 'guide';
/** A drawn support the climbers wrap (trellis composition). */
export type VineSupport = 'none' | 'lattice' | 'arch' | 'obelisk';
/** A drawn container the arrangement rises out of (bouquet/specimen). */
export type VineVessel = 'none' | 'vase' | 'pot' | 'jar' | 'urn' | 'amphora' | 'bud-vase' | 'mason-jar' | 'bowl';
/** Region a `fill` composition grows into. */
export type FillShape = 'circle' | 'oval' | 'heart' | 'diamond' | 'painted';
/** How a vine body is inked. */
export type VineFill = 'shaded' | 'solid' | 'outline' | 'highlight';
/** How a leaf is inked. */
export type LeafStyle = 'shaded' | 'veined' | 'outline' | 'solid';
export type LeafType = 'ovate' | 'lance' | 'cordate' | 'lobed' | 'serrate' | 'mixed';
/** How a (thick) stem's tube is shaded. */
export type StemShade = 'none' | 'along' | 'cross';
/** Surface texture drawn on thick (woody) stems. */
export type StemTexture = 'none' | 'bark';
/** Flower species. */
export type VineFlower = 'rose' | 'daisy' | 'bell' | 'bud' | 'mixed';
/** Character of the hand-sketched overdraw (shared with the Planet Generator). */
export type { SketchStyle };
/** How leaflets are arranged into a single (possibly compound) leaf. */
export type LeafArrangement = 'simple' | 'pinnate' | 'bipinnate' | 'palmate' | 'trifoliate';
/** How successive leaves are inserted along a stem. */
export type Phyllotaxis = 'alternate' | 'opposite' | 'whorled' | 'spiral';
/** A multi-flower structure carried at a stem tip (or along a stem). */
export type Inflorescence = 'none' | 'raceme' | 'umbel' | 'spike' | 'corymb';
/** A fruiting body borne on the stems. */
export type FruitType = 'none' | 'berry' | 'grape' | 'rosehip' | 'pod' | 'catkin';

export interface VinesOptions {
  width: number;
  height: number;
  margin?: number;
  seed?: number;
  mode?: VineMode;
  /** Page arrangement: a designed single specimen, or free growth from roots. */
  composition?: VineComposition;
  /** Shape a `fill` composition grows into. */
  fillShape?: FillShape;
  seeding?: VineSeeding;
  startPoints?: Point[];
  seedCount?: number;

  // — page composition —
  /** Guide polylines the stems grow along ('guide' composition). Normalized or
   *  pixel coordinates accepted; callers pass page-pixel points. */
  guidePaths?: Point[][];
  /** A drawn support the climbers wrap, for the 'trellis' composition. */
  support?: VineSupport;
  /** A drawn container the stems rise out of (bouquet/specimen); 'none' off. */
  vessel?: VineVessel;
  /** Draw a hand-drawn ground line under the arrangement. */
  groundLine?: boolean;
  /** 0..1 deliberate negative space: hold one region of the page clear and
   *  swell the mass elsewhere (notan), instead of filling evenly. */
  negativeSpace?: number;
  /** 0..1 light-driven tonal massing: commit the arrangement into a few value
   *  masses — foliage gathers and hatches heavier on the shadow side (away from
   *  `lightAngle`) and opens on the lit side — so it reads as a lit illustration
   *  rather than an evenly-filled diagram. 0 = off (byte-identical). */
  tonalMassing?: number;
  /** Posterize the tonal-massing field into this many value bands (>= 2) so the
   *  canopy reads as a few decisive shapes; 0/1 = smooth (no banding). */
  valueBands?: number;

  // — growth model —
  stepLength?: number;
  maxLength?: number;
  curl?: number;
  noiseScale?: number;
  gravitropism?: number;
  branchProb?: number;
  maxDepth?: number;

  // — space colonization —
  attractorCount?: number;
  attractorRadius?: number;
  killRadius?: number;

  // — vine body —
  stemWidth?: number;
  penWidth?: number;
  taper?: number;
  vineFill?: VineFill;
  avoidOverlap?: boolean;
  spacing?: number;

  // — form shading —
  /** Light source direction, degrees (0 = +x; default top-left). */
  lightAngle?: number;
  /** 0..1 how much shadow hatching to lay down. */
  shadeDensity?: number;
  /** Tube shading style on thick stems. */
  stemShade?: StemShade;
  /** Surface texture on thick (woody) stems: 'none' or 'bark' striations. */
  stemTexture?: StemTexture;
  /** Allow overlap and remove hidden lines for depth (vs flat). */
  occlude?: boolean;
  /** 0..1 hand-sketched overdraw: repeats every line with small variation. */
  sketch?: number;
  /** Character of the sketch overdraw. */
  sketchStyle?: SketchStyle;
  /** 0..1 contact shadows cast by overlapping elements onto what's behind. */
  castShadow?: number;

  // — decorations —
  /** 0..1 overall foliage density (leaf clusters, spacing, bloom frequency). */
  density?: number;
  leaves?: boolean;
  leafStyle?: LeafStyle;
  leafType?: LeafType;
  veins?: boolean;
  leafSize?: number;
  leafWidthRatio?: number;
  leafSpacing?: number;
  /** Compound-leaf arrangement; 'simple' = one blade per site (default). */
  leafArrangement?: LeafArrangement;
  /** Leaflets per compound leaf (pinnate pairs + terminal, palmate spokes). */
  leafletCount?: number;
  /** How successive leaves are inserted along a stem; 'alternate' = legacy. */
  phyllotaxis?: Phyllotaxis;
  /** Leaves per node when phyllotaxis is 'whorled'. */
  whorlCount?: number;
  tendrils?: boolean;
  tendrilProb?: number;
  flowers?: boolean;
  flowerType?: VineFlower;
  flowerProb?: number;
  flowerSize?: number;
  /** Multi-flower structure at a stem tip; 'none' = single bloom (default). */
  inflorescence?: Inflorescence;
  /** Florets per inflorescence. */
  floretCount?: number;
  /** Bear thorns along the stems (roses, brambles). */
  thorns?: boolean;
  /** Per-arc-step thorn probability when `thorns` is on. */
  thornProb?: number;
  /** Fruiting bodies; 'none' = off (default). Reuses the `flower` pen layer. */
  fruitType?: FruitType;
  /** Per-site probability a fruit cluster is borne when `fruitType` is set. */
  fruitProb?: number;
  /** Scatter dewdrop highlights on the foliage. */
  dewdrops?: boolean;
  /** Per-site dewdrop probability when `dewdrops` is on. */
  dewdropProb?: number;

  /** Hand-drawn wobble amplitude applied to stem centerlines, px (0 = off). */
  wobble?: number;
}

/** A grown stem: a centerline, the half-width it carries at its base, and
 *  whether it's a side-branch (tapered to a point where it joins its parent). */
export interface Stem {
  points: Point[];
  baseHalf: number;
  branch: boolean;
}

/** A growth root: position, initial heading, the width/length it starts with,
 *  and an optional guide curve (the composed master gesture). */
export interface Root {
  x: number;
  y: number;
  angle: number;
  half: number;
  maxLength: number;
  guide?: Point[];
  /** Cap on side-branch length (keeps wreath foliage hugging the ring). */
  branchMaxLen?: number;
}
