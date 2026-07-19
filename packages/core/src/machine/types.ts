import type { SketchStyle } from '../sketch-styles.js';

/**
 * Machine — page-sized, hugely complex generative machines. Clusters of gear
 * trains grow across the whole sheet, tied together (or not) by belts, ropes
 * and cross-cluster meshes; gears mesh on exact pitch circles, belts run on
 * true common tangents, linkages are pose-solved; the machine as a whole is
 * cheerfully impossible. Single pen, stroked polylines, deterministic per seed.
 */
export interface MachineOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;
  /** 0..1 — one small mechanism at 0; the page packed to the margins at 1. */
  complexity?: number;
  /** 0..1 — 1: one interconnected mega-machine (every cluster tied into a
   *  single transmission network); 0: a wall of independent overlapping
   *  mechanisms at different depths (the engine-room cross-section). */
  connectivity?: number;
  /** Base mean big-wheel radius in px; sets the base gear module. */
  gearSize?: number;
  /** 0..1 — per-cluster module spread (0 = one tooth size everywhere,
   *  1 = clusters range ~0.55×–1.7× the base module). */
  scaleVariety?: number;
  /** 0..1 — per-cluster belt/linkage/spring/weight extras. */
  mechanisms?: number;
  /** 0..1 — timber scaffold density (interior posts, beam levels, braces). */
  frameDensity?: number;
  /** Section-cutaway wedges bitten from big wheels (0–3). */
  cutaways?: number;
  /** Physical-area growth vs the A4 tuning anchor (sheet area / A4 area),
   *  clamped to ≥1. Scales the part-count ceilings so big sheets fill with
   *  more mechanisms at the same physical gear size; 1 (the default) keeps
   *  the A4-tuned caps exactly. */
  sheetFactor?: number;
  /** Re-emit occluded part edges as dashed hidden lines. */
  hiddenLines?: boolean;
  /** Base hatch spacing in px (rim shading, section hatch, weight tone). */
  hatchSpacing?: number;
  /** 0..1 — how much shadow-side tone the parts carry. */
  shading?: number;
  penWidth?: number;
  /** Hand-drawn wobble amplitude in px (used when sketch is off). */
  wobble?: number;
  /** Multi-pass sketch overdraw intensity 0..1 (0 = single wobble pass). */
  sketch?: number;
  sketchStyle?: SketchStyle;
}

export const DEFAULTS = {
  complexity: 0.7,
  connectivity: 0.8,
  gearSize: 90,
  scaleVariety: 0.6,
  mechanisms: 0.7,
  frameDensity: 0.7,
  cutaways: 2,
  sheetFactor: 1,
  hiddenLines: true,
  hatchSpacing: 3.2,
  shading: 0.6,
  penWidth: 1.2,
  wobble: 0.8,
  sketch: 0.25,
  sketchStyle: 'loose' as SketchStyle,
};

export type ResolvedOptions = typeof DEFAULTS & {
  width: number;
  height: number;
  margin: number;
  seed?: number;
};

/* ------------------------------------------------------------------ *
 * The part graph — synthesis emits parts, renderers consume them.    *
 * All positions are page px; z is a small integer depth (0 = frame,  *
 * farthest). Nothing here is a line.                                 *
 * ------------------------------------------------------------------ */

/** One gear-train cluster: a seed point, its own tooth module (one module
 *  WITHIN a meshing train — the realism rule), and a depth band. */
export interface Cluster {
  id: number;
  cx: number;
  cy: number;
  module: number;
  zBand: number;
}

/** A realized transmission link between two clusters. */
export interface TransLink {
  kind: 'belt' | 'mesh' | 'rope';
  a: number;
  b: number;
}

export interface Gear {
  kind: 'gear';
  id: number;
  cx: number;
  cy: number;
  /** Tooth count; pitch radius = module * teeth / 2. */
  teeth: number;
  /** The cluster's gear module (px of pitch diameter per tooth). */
  module: number;
  /** Rotation of tooth 0's centre, radians. */
  phase: number;
  z: number;
  /** Cluster this gear belongs to. */
  cluster: number;
  /** Gear this one meshes with (tree parent), and the mesh direction from
   *  the parent's centre toward this gear's centre. */
  parent?: number;
  meshAngle?: number;
  /** Coaxial compound sibling (a pinion stacked on a wheel). */
  coaxialWith?: number;
  /** Wheel dressing so sixty wheels don't read as sixty copies. */
  variant?: 'plain' | 'flywheel' | 'ratchet' | 'crank' | 'sspoke';
}

export interface Pulley {
  kind: 'pulley';
  id: number;
  cx: number;
  cy: number;
  r: number;
  z: number;
  cluster: number;
}

/** A rope drum on a gear's shaft. */
export interface Drum {
  kind: 'drum';
  id: number;
  cx: number;
  cy: number;
  r: number;
  z: number;
  cluster: number;
}

export interface Belt {
  /** Part ids of the two wheels (gear pitch circle or pulley) it wraps. */
  a: number;
  b: number;
  crossed: boolean;
}

/** Crank + connecting rod + rocker (4-bar), pose-solved but frozen. */
export interface Linkage {
  /** Gear carrying the crank pin. */
  gearId: number;
  /** Crank pin position on the wheel face. */
  pin: { x: number; y: number };
  /** Coupler joint (solved). */
  joint: { x: number; y: number };
  /** Fixed rocker pivot on the frame. */
  pivot: { x: number; y: number };
  z: number;
}

export interface Rope {
  drumId: number;
  /** Polyline of the rope path from the drum tangent to the weight ring. */
  path: { x: number; y: number }[];
  /** Idler pulley id when the rope turns a corner. */
  idlerId?: number;
  z: number;
}

export interface Weight {
  /** Top-centre of the hanging weight (where the ring sits). */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export interface Spring {
  a: { x: number; y: number };
  b: { x: number; y: number };
  coils: number;
  r: number;
  z: number;
}

export interface Beam {
  a: { x: number; y: number };
  b: { x: number; y: number };
  /** Timber width in px. */
  w: number;
  kind: 'post' | 'beam' | 'brace' | 'ground';
}

/** A shaft's mounting: a pedestal / bracket / hanger from the axle to the
 *  nearest frame member, capped with a bearing block. */
export interface Bearing {
  x: number;
  y: number;
  /** Direction the support runs, toward the frame. */
  dir: 'down' | 'left' | 'right' | 'up';
  /** Length of the support arm in px. */
  len: number;
  /** Radius of the wheel hub it must clear. */
  hubR: number;
}

export interface Machine {
  gears: Gear[];
  pulleys: Pulley[];
  drums: Drum[];
  belts: Belt[];
  linkages: Linkage[];
  ropes: Rope[];
  weights: Weight[];
  springs: Spring[];
  frame: Beam[];
  bearings: Bearing[];
  clusters: Cluster[];
  /** Realized transmission links between clusters — the connectivity axis is
   *  testable from this graph (union-find over cluster ids). */
  links: TransLink[];
  /** Base module — the first cluster pins ~1.0× so `gearSize` stays honest. */
  module: number;
}

/** Any circular wheel (for belt tangency + clearance tests). */
export interface Circle {
  cx: number;
  cy: number;
  r: number;
}
