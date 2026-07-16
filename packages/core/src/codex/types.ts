import type { SketchStyle } from '../sketch-styles.js';

/**
 * Impossible Machine Codex — da Vinci-style procedural contraptions drawn as
 * a codex/patent plate. Gears mesh on exact pitch circles, belts run on true
 * common tangents, linkages are pose-solved; the machine as a whole is
 * cheerfully impossible. Single pen, stroked polylines, deterministic per seed.
 */
export interface MachineCodexOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;
  /** 0..1 — one lone wheel at 0, a full contraption at 1 (headline slider). */
  complexity?: number;
  /** Mean big-wheel radius in px; sets the shared gear module (tooth size). */
  gearSize?: number;
  /** 0..1 — ceiling on the belt/linkage/spring/weight extras. */
  mechanisms?: number;
  /** 0..1 — dimension lines, leader callouts, centerline density. */
  annotations?: number;
  /** 0..1 — asemic script coverage in the margin blocks. */
  marginalia?: number;
  /** Detail insets (0, 1 or 2): zoomed mesh contact / exploded hub. */
  detailInsets?: number;
  /** Re-emit occluded part edges as dashed hidden lines. */
  hiddenLines?: boolean;
  /** Bite one section cutaway (45° hatch) out of a wheel or drum. */
  cutaway?: boolean;
  /** Base hatch spacing in px (rim shading, section hatch, weight tone). */
  hatchSpacing?: number;
  /** 0..1 — how much shadow-side tone the parts carry. */
  shading?: number;
  /** Aged codex (asemic marginalia, rough rule) vs ruled patent plate. */
  style?: 'codex' | 'patent';
  /** Plate title; empty string disables, undefined invents one per seed. */
  title?: string;
  penWidth?: number;
  /** Hand-drawn wobble amplitude in px (used when sketch is off). */
  wobble?: number;
  /** Multi-pass sketch overdraw intensity 0..1 (0 = single wobble pass). */
  sketch?: number;
  sketchStyle?: SketchStyle;
}

export const DEFAULTS = {
  complexity: 0.65,
  gearSize: 90,
  mechanisms: 0.7,
  annotations: 0.6,
  marginalia: 0.6,
  detailInsets: 1,
  hiddenLines: true,
  cutaway: true,
  hatchSpacing: 3.2,
  shading: 0.6,
  style: 'codex' as 'codex' | 'patent',
  title: undefined as string | undefined,
  penWidth: 1.2,
  wobble: 0.8,
  sketch: 0.25,
  sketchStyle: 'loose' as SketchStyle,
};

export type ResolvedOptions = Omit<typeof DEFAULTS, 'title'> & {
  width: number;
  height: number;
  margin: number;
  seed?: number;
  title?: string;
};

/* ------------------------------------------------------------------ *
 * The part graph — synthesis emits parts, renderers consume them.    *
 * All positions are page px; z is a small integer depth (0 = frame,  *
 * farthest). Nothing here is a line.                                 *
 * ------------------------------------------------------------------ */

export interface Gear {
  kind: 'gear';
  id: number;
  cx: number;
  cy: number;
  /** Tooth count; pitch radius = module * teeth / 2. */
  teeth: number;
  /** Shared gear module (px of pitch diameter per tooth). */
  module: number;
  /** Rotation of tooth 0's centre, radians. */
  phase: number;
  z: number;
  /** Gear this one meshes with (tree parent), and the mesh direction from
   *  the parent's centre toward this gear's centre. */
  parent?: number;
  meshAngle?: number;
  /** Coaxial compound sibling (a pinion stacked on a wheel). */
  coaxialWith?: number;
}

export interface Pulley {
  kind: 'pulley';
  id: number;
  cx: number;
  cy: number;
  r: number;
  z: number;
}

/** A rope drum on a gear's shaft. */
export interface Drum {
  kind: 'drum';
  id: number;
  cx: number;
  cy: number;
  r: number;
  z: number;
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

/** A shaft's mounting: a pedestal / bracket from the axle to the nearest
 *  frame member, capped with a bearing block. */
export interface Bearing {
  x: number;
  y: number;
  /** Direction the support runs, toward the frame. */
  dir: 'down' | 'left' | 'right';
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
  /** Shared module — one tooth size for the whole machine. */
  module: number;
}

/** Any circular wheel (for belt tangency + clearance tests). */
export interface Circle {
  cx: number;
  cy: number;
  r: number;
}
