import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { optimizePlot } from '../optimize.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { buildRegions, LayoutConfig, Region, RegionRadial, TUNING_DIM } from './layout.js';
import { fillRegion } from './textures.js';
import { carveRegions, PenAssignment } from './carve.js';

export type {
  LapidaryMode,
  LapidaryTexture,
  BandTexture,
  LapidaryShape,
  LapidaryShapes,
  SpiralForm,
  SpiralDirection,
  SpiralJoin,
} from './layout.js';
export type { PenAssignment } from './carve.js';
import type {
  LapidaryMode,
  LapidaryTexture,
  BandTexture,
  LapidaryShapes,
  SpiralForm,
  SpiralDirection,
  SpiralJoin,
} from './layout.js';

/** The kintsugi veins' dedicated accent pen layer — separate from the
 *  ink-0..ink-3 pens so the veins can be plotted in their own ink (gold)
 *  without spending one of the four region pens. */
export const VEIN_LAYER = 'vein';

/**
 * Lapidary — layered pattern artworks in the style of a cut and polished
 * stone cross-section: organic regions, each filled with its own line
 * texture (ruled lines, wavy combing, concentric contour banding, dense
 * hatch, mottled patchy hatch, shallow cross-hatch, stipple, interwoven
 * grating mottle, flowing grain dashes, or held paper), separated by
 * clean reserved-paper seams the way stacked stencil layers hold off one
 * another.
 *
 * Four arrangements: `agate` nests concentric blob bands around a centre
 * (the reference piece), `breccia` scatters overlapping fragments over the
 * field, `strata` splits the sheet into noisy horizontal beds, `spiral`
 * winds one textured ribbon from the rim into the centre (or outward from
 * it), chopped into cells that either carve seams or blend into one
 * another.
 *
 * Ink: strokes are tagged `ink-<group>` (`inkLayerName`) across 1–4 pens,
 * either interleaved stroke-by-stroke within each region (the hand-fed
 * two-pen alternation of the reference) or one pen per region.
 */
export interface LapidaryOptions {
  /** Page width in px */
  width: number;
  /** Page height in px */
  height: number;
  /** Clear paper border in px (default 0) */
  margin?: number;
  /** Seed: controls silhouettes, texture deal, angles, interleave */
  seed?: number;
  /**
   * Reference min dimension in px — clamps the dimension feature sizes
   * (seam width, line pitch, wobble, detail sampling) derive from, so the
   * pattern keeps its tuned physical scale on sheets larger than the tuning
   * anchor. Same contract as marbling's / fracture's.
   */
  refMinDim?: number;

  // ---- Arrangement ----
  /** Layout mode (default 'agate') */
  mode?: LapidaryMode;
  /** Region count incl. the background field when present: agate bands /
   *  breccia fragments+field / strata beds / spiral windings. 2..10
   *  (default 5) */
  bands?: number;
  /** Draw the full-frame background band (default true). Off, the layered
   *  shapes float on clean paper. Agate/breccia only — strata partitions
   *  the whole sheet. */
  field?: boolean;
  /** Silhouette language: 'organic' blobs (default), 'angular'
   *  straight-edged facets/shards (stepped terraces in strata), or 'mixed'
   *  (seeded per-band deal). Each band can override via
   *  `BandTexture.shape`. */
  shapes?: LapidaryShapes;
  /** Silhouette irregularity 0..1 (default 0.55) */
  irregularity?: number;
  /** Vertical fault planes thrown across the strata stack, 0..4 (default 0).
   *  Every bed boundary shifts by the fault's displacement on one side of a
   *  slightly inclined fault line — the near-vertical scarp is the
   *  geological tell. Strata only. */
  faults?: number;
  /** Trace the reserved-paper seams between breccia fragments as strokes on
   *  the dedicated `VEIN_LAYER` accent pen (default false) — load it with
   *  gold for the kintsugi look. Breccia only. */
  veins?: boolean;
  /** Outermost silhouette size as a fraction of the frame, 0.4..1 (default
   *  0.9). For the spiral this is where the outermost winding starts. */
  coverage?: number;
  /** Composition centre offset as a fraction of the half-extents, -0.5..0.5 */
  centerX?: number;
  centerY?: number;
  /** Spiral cross-section (default 'circular'): a round coil, or a
   *  'rectangular' superellipse coil that squares off to the sheet's
   *  aspect. Spiral only. */
  spiralForm?: SpiralForm;
  /** Which end of the ribbon leads (default 'inward'): 'inward' winds from
   *  the rim into the centre; 'outward' unwinds from the centre, loosening
   *  toward the page edge. Flips the taper, the texture deal's origin, and
   *  which end is drawn on top. Spiral only. */
  spiralDirection?: SpiralDirection;
  /** How the ribbon's patterns meet (default 'cells'): 'cells' carves a
   *  reserved-paper seam at every cut; 'blend' lets abutting cells' textures
   *  morph into one another with no seam. Spiral only. */
  spiralJoin?: SpiralJoin;
  /** Ribbon width as a fraction of the local winding pitch, 0.15..1
   *  (default 0.55) — self-scaling with the turn count and sheet. The
   *  reserved inter-winding paper collapses as this approaches 1: at full
   *  width the coil closes up and covers the page, the carved halo (cells)
   *  or a hairline gap (blend) supplying the seam. Pair with a low turn
   *  count for bands that claim real acreage. Edges are clamped against
   *  each neighbouring winding's true centreline, so they can meet but
   *  never cross. Spiral only. */
  spiralWidth?: number;
  /** Signed width taper toward the leading end, -1..1 (default 0.35):
   *  positive thins the ribbon as it approaches the leading end, negative
   *  grows it. Spiral only. */
  spiralTaper?: number;
  /** Low-frequency organic width modulation along the arc, 0..1 (default
   *  0.35) — the ribbon breathes instead of holding a drafted width.
   *  Spiral only. */
  spiralPulse?: number;

  // ---- Seams ----
  /** Reserved-paper seam width between regions in px (default sizingDim/110) */
  haloPx?: number;
  /** Ink each region silhouette as a stroke (default false — in the
   *  reference the seam itself does the work). The full-frame background
   *  band is never outlined — its silhouette is the page edge. */
  outlines?: boolean;

  // ---- Textures ----
  /** Explicit outer→inner band textures, cycled if shorter than `bands`.
   *  Omitted = seeded deal that opens with 'lines' and never repeats a
   *  kind on adjacent bands. */
  textures?: Array<LapidaryTexture | BandTexture>;
  /** Base stroke direction in degrees (default 90 — the reference's ruled
   *  vertical field) */
  baseAngleDeg?: number;
  /** Seeded per-band drift off the base angle in degrees (default 25);
   *  the background band never drifts */
  angleDriftDeg?: number;
  /** Base line pitch in px (default sizingDim/150) */
  spacingPx?: number;
  /** 0..1 spread between dense and sparse bands (default 0.6) */
  densityContrast?: number;
  /** Line undulation 0..1 (default 0.5): wavy-texture amplitude, how far
   *  contour bands drift off the silhouette they echo, and how hard grain
   *  dashes bend off the band angle */
  waviness?: number;
  /** Patchy/cross hole amount and mottle weave amount, 0..1 (default
   *  0.55); cross keeps its second family legible by flooring its gate at
   *  0.25 */
  patchiness?: number;

  // ---- Pens ----
  /** Pen count 1..4 (default 1) — strokes are tagged ink-0..ink-3 */
  pens?: number;
  /** 'interleave' alternates pens stroke-by-stroke within each region (the
   *  reference look); 'per-region' gives each region one pen (default
   *  'interleave') */
  penAssignment?: PenAssignment;

  // ---- Finish ----
  /** Hand-drawn wobble amplitude in px (default sizingDim/500); capped so
   *  it can never bend ink into a seam */
  wobble?: number;
  /** Chain strokes and order them to cut pen travel (default true) */
  optimize?: boolean;
}

/**
 * Curated looks. `specimen` is the reference artwork: ruled vertical field →
 * wavy ring → dense mottled ring → sparse angled hatch → open core, two pens
 * interleaved. Spread presets over `generateLapidary`'s options.
 */
export const LAPIDARY_PRESETS: Record<string, Partial<LapidaryOptions>> = {
  specimen: {
    mode: 'agate',
    bands: 5,
    pens: 2,
    textures: [
      { kind: 'lines', spacingScale: 1.1 },
      { kind: 'wavy', angleDeg: 90, spacingScale: 0.75, waviness: 0.9 },
      { kind: 'mottle', spacingScale: 0.75 },
      { kind: 'hatch', angleDeg: 125, spacingScale: 1.4 },
      { kind: 'lines', angleDeg: 90, spacingScale: 1.3 },
    ],
  },
  geode: {
    mode: 'agate',
    bands: 7,
    pens: 3,
    coverage: 0.95,
    textures: ['lines', 'cross', 'stipple', 'hatch', 'blank', 'grain', 'crystal'],
  },
  breccia: {
    mode: 'breccia',
    bands: 8,
    pens: 3,
    penAssignment: 'per-region',
  },
  terraces: {
    mode: 'strata',
    bands: 6,
    pens: 2,
    baseAngleDeg: 0,
    angleDriftDeg: 14,
    faults: 1,
  },
  fortification: {
    mode: 'agate',
    bands: 6,
    pens: 2,
    coverage: 0.92,
    textures: [
      { kind: 'lines', spacingScale: 1.2 },
      { kind: 'contour', spacingScale: 1 },
      { kind: 'contour', spacingScale: 0.7 },
      { kind: 'lines', angleDeg: 90, spacingScale: 1.4 },
      { kind: 'contour', spacingScale: 0.9 },
      { kind: 'stipple', spacingScale: 1.1 },
    ],
  },
  facet: {
    mode: 'agate',
    bands: 5,
    pens: 2,
    field: false,
    shapes: 'angular',
    coverage: 0.95,
    irregularity: 0.7,
    textures: [
      { kind: 'hatch', spacingScale: 1.3 },
      { kind: 'lines', spacingScale: 0.9 },
      { kind: 'cross', spacingScale: 1.1 },
      { kind: 'lines', angleDeg: 35, spacingScale: 1.5 },
      { kind: 'hatch', spacingScale: 0.8 },
    ],
  },
  mono: {
    mode: 'agate',
    bands: 5,
    pens: 1,
    textures: [
      { kind: 'lines', spacingScale: 1.1 },
      { kind: 'wavy', angleDeg: 90, spacingScale: 0.75, waviness: 0.9 },
      { kind: 'mottle', spacingScale: 0.75 },
      { kind: 'hatch', angleDeg: 125, spacingScale: 1.4 },
      { kind: 'lines', angleDeg: 90, spacingScale: 1.3 },
    ],
  },
  ammonite: {
    mode: 'spiral',
    bands: 6,
    pens: 2,
    spiralJoin: 'blend',
    spiralWidth: 0.62,
    spiralTaper: 0.45,
    spiralPulse: 0.5,
    coverage: 0.94,
    textures: [
      { kind: 'lines', spacingScale: 1.2 },
      { kind: 'contour' },
      { kind: 'stipple', spacingScale: 1.1 },
      { kind: 'contour', spacingScale: 0.7 },
      { kind: 'hatch', spacingScale: 1.2 },
      { kind: 'contour', spacingScale: 0.9 },
    ],
  },
  labyrinth: {
    mode: 'spiral',
    bands: 5,
    pens: 3,
    penAssignment: 'per-region',
    shapes: 'angular',
    spiralForm: 'rectangular',
    spiralWidth: 0.6,
    spiralTaper: 0.1,
    spiralPulse: 0.15,
    irregularity: 0.35,
    coverage: 0.95,
  },
  coil: {
    mode: 'spiral',
    bands: 3,
    pens: 3,
    penAssignment: 'per-region',
    field: false,
    spiralWidth: 1,
    spiralTaper: 0,
    spiralPulse: 0.1,
    coverage: 0.97,
    irregularity: 0.25,
  },
};

/**
 * Kintsugi veins: one path per breccia fragment, run mid-seam — the fragment's
 * ink ends on its boundary and the surrounding ink is held a full halo off it,
 * so a path half a halo out has clear paper both sides (the wobble cap keeps
 * it there). Samples covered by a fragment drawn on top are dropped; the
 * survivors emit as open arcs.
 */
function brecciaVeins(
  regions: Region[],
  rect: { x0: number; y0: number; x1: number; y1: number },
  haloPx: number,
  stepPx: number,
  pen: string
): FlowLine[] {
  const frags = regions.filter((r) => r.z > 0 && r.radial);
  const insideFrag = (x: number, y: number, f: RegionRadial): boolean => {
    const ex = (x - f.cx) / f.rx;
    const ey = (y - f.cy) / f.ry;
    const r = Math.hypot(ex, ey);
    if (r === 0) return true;
    const n = f.table.length;
    const fi = (((Math.atan2(ey, ex) / (Math.PI * 2)) * n % n) + n) % n;
    const j = Math.floor(fi);
    const g = f.table[j] + (f.table[(j + 1) % n] - f.table[j]) * (fi - j);
    return r < g;
  };
  const out: FlowLine[] = [];
  for (const reg of frags) {
    const f = reg.radial!;
    const n = f.table.length;
    const loop: Point[] = [];
    for (let j = 0; j <= n; j++) {
      const theta = ((j % n) / n) * Math.PI * 2;
      const baseLen = Math.hypot(Math.cos(theta) * f.rx, Math.sin(theta) * f.ry) || 1e-6;
      const g = f.table[j % n] + (haloPx * 0.5) / baseLen;
      loop.push({ x: f.cx + Math.cos(theta) * f.rx * g, y: f.cy + Math.sin(theta) * f.ry * g });
    }
    const covers = frags.filter((o) => o.z > reg.z).map((o) => o.radial!);
    const keep = (p: Point): boolean =>
      p.x >= rect.x0 &&
      p.x <= rect.x1 &&
      p.y >= rect.y0 &&
      p.y <= rect.y1 &&
      !covers.some((o) => insideFrag(p.x, p.y, o));
    let arc: Point[] = [];
    const flush = (): void => {
      let len = 0;
      for (let i = 1; i < arc.length; i++) {
        len += Math.hypot(arc[i].x - arc[i - 1].x, arc[i].y - arc[i - 1].y);
      }
      if (len >= haloPx * 3) out.push({ points: arc, layer: pen });
      arc = [];
    };
    for (let i = 1; i < loop.length; i++) {
      const a = loop[i - 1];
      const b = loop[i];
      const segs = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepPx));
      for (let s = i === 1 ? 0 : 1; s <= segs; s++) {
        const p = { x: a.x + ((b.x - a.x) * s) / segs, y: a.y + ((b.y - a.y) * s) / segs };
        if (keep(p)) arc.push(p);
        else flush();
      }
    }
    flush();
  }
  return out;
}

/** Render a lapidary sheet as plottable per-pen strokes. */
export function generateLapidary(options: LapidaryOptions): FlowLinesResult {
  const { width, height, margin = 0, seed = randomSeed(), optimize = true } = options;

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const innerW = x1 - x0;
  const innerH = y1 - y0;
  if (innerW < 16 || innerH < 16) return { lines: [], width, height, seed };
  const minDim = Math.min(innerW, innerH);
  const sizingDim = Math.min(minDim, options.refMinDim ?? Infinity);

  const haloPx = Math.max(1.5, options.haloPx ?? sizingDim / 110);
  const spacingPx = Math.max(1.2, options.spacingPx ?? sizingDim / 150);
  const featureScale = sizingDim / TUNING_DIM;

  const layout: LayoutConfig = {
    seed,
    mode: options.mode ?? 'agate',
    rect: { x0, y0, x1, y1 },
    bands: clamp(Math.round(options.bands ?? 5), 2, 10),
    field: options.field ?? true,
    shapes: options.shapes ?? 'organic',
    irregularity: clamp(options.irregularity ?? 0.55, 0, 1),
    coverage: clamp(options.coverage ?? 0.9, 0.4, 1),
    centerX: clamp(options.centerX ?? 0, -0.5, 0.5),
    centerY: clamp(options.centerY ?? 0, -0.5, 0.5),
    haloPx,
    spacingPx,
    textures: options.textures,
    baseAngleDeg: options.baseAngleDeg ?? 90,
    angleDriftDeg: options.angleDriftDeg ?? 25,
    densityContrast: clamp(options.densityContrast ?? 0.6, 0, 1),
    waviness: clamp(options.waviness ?? 0.5, 0, 1),
    patchiness: clamp(options.patchiness ?? 0.55, 0, 1),
    faults: clamp(Math.round(options.faults ?? 0), 0, 4),
    spiralForm: options.spiralForm ?? 'circular',
    spiralDirection: options.spiralDirection ?? 'inward',
    spiralJoin: options.spiralJoin ?? 'cells',
    spiralWidth: clamp(options.spiralWidth ?? 0.55, 0.15, 1),
    spiralTaper: clamp(options.spiralTaper ?? 0.35, -1, 1),
    spiralPulse: clamp(options.spiralPulse ?? 0.35, 0, 1),
    featureScale,
  };

  const pens = clamp(Math.round(options.pens ?? 1), 1, 4);
  const { regions, geometricGaps } = buildRegions(layout);
  const lines = carveRegions(regions, fillRegion, {
    width,
    height,
    haloPx,
    seed,
    pens,
    penAssignment: options.penAssignment ?? 'interleave',
    outlines: options.outlines ?? false,
    geometricGaps,
    featureScale,
  });

  if ((options.veins ?? false) && layout.mode === 'breccia') {
    const veinStep = Math.max(1, 5 * featureScale);
    lines.push(...brecciaVeins(regions, layout.rect, haloPx, veinStep, VEIN_LAYER));
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  const wobble = options.wobble ?? sizingDim / 500;
  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      wavelength: Math.max(8, 70 * featureScale),
      seed: subSeed(seed, 501),
      // The seams are reserved paper carved before the hand pass; the wobble
      // tail must never bend surviving ink back into them.
      maxDisplacement: haloPx * 0.35,
    });
  }

  if (optimize) {
    // Chain within pens, but never far enough to bridge a seam.
    result = optimizePlot(result, { mergeTolerance: Math.min(1.5, haloPx * 0.4) });
  }

  return result;
}
