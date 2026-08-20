import { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp } from '../lib/math.js';
import {
  nestedRingTables,
  ringPolygon,
  blobBoundaryTable,
  angularBoundaryTable,
  strataCurves,
  type LapidaryShape,
} from './shapes.js';
import { spiralRegions } from './spiral.js';

export type LapidaryMode = 'agate' | 'breccia' | 'strata' | 'spiral';
export type { LapidaryShape } from './shapes.js';

/** Spiral cross-section: a round coil, a superellipse coil that squares
 *  off toward the page corners (matching the sheet's aspect), or 'page' —
 *  the true margin rectangle itself, corners and all, so the sheet IS the
 *  spiral: the rim runs flush with the page edge and the coil insets from
 *  there. */
export type SpiralForm = 'circular' | 'rectangular' | 'page';

/** Which end of the ribbon leads: 'inward' winds from the rim into the
 *  centre (the taper thins and the deal runs toward the core); 'outward'
 *  unwinds from the centre, loosening toward the page edge. */
export type SpiralDirection = 'inward' | 'outward';

/** How the ribbon's patterns meet: 'cells' chops it into segments separated
 *  by carved reserved-paper seams; 'blend' lets abutting segments' textures
 *  morph into one another with no seam between them. */
export type SpiralJoin = 'cells' | 'blend';

/** Sheet-wide silhouette language; 'mixed' deals organic/angular per band. */
export type LapidaryShapes = LapidaryShape | 'mixed';

/** The within-region tone idea: 'seam' ramps dark against each band's
 *  boundaries (the reference agate's densified band walls), 'core' shades
 *  toward the region centre, 'light' models a flat light direction,
 *  'noise' clouds each band, 'none' keeps the flat constant-pitch fill. */
export type LapidaryToneShape = 'none' | 'seam' | 'core' | 'light' | 'noise';

export type LapidaryTexture =
  | 'lines'
  | 'wavy'
  | 'contour'
  | 'crystal'
  | 'hatch'
  | 'patchy'
  | 'cross'
  | 'stipple'
  | 'mottle'
  | 'grain'
  | 'solid'
  | 'blank';

/** Per-band texture spec; a plain kind string means "defaults for that kind". */
export interface BandTexture {
  kind: LapidaryTexture;
  /** Absolute stroke direction in degrees (default: base angle + seeded drift). */
  angleDeg?: number;
  /** Multiplier on the kind's resolved line pitch. */
  spacingScale?: number;
  /** Per-band override of the global waviness (wavy amplitude / contour
   *  undulation / grain bend). */
  waviness?: number;
  /** Per-band override of the global patchiness (patchy/cross hole amount;
   *  mottle weave amount). */
  patchiness?: number;
  /** Per-band override of the global stroke end-taper amount (0..1). */
  taper?: number;
  /** Per-band override of the global per-stroke angle jitter in degrees. */
  jitterDeg?: number;
  /** Per-band override of the global tone strength (0 pins this band flat —
   *  e.g. a preset holding its ruled field at constant pitch). */
  tone?: number;
  /** Plot this band's marks as unbroken runs: no hand-fed dashing (ruled
   *  'lines' rows, dashed contour laminae) and no taper mid-stroke pen
   *  lifts — each row or lamina is one continuous flowing stroke. `taper`
   *  still trims the stroke ends. Overrides the sheet-wide setting. */
  continuous?: boolean;
  /** Per-band override of the sheet's shape language (agate/breccia). */
  shape?: LapidaryShape;
}

/** The tuning anchor: the A3 short edge at 3 px/mm. Feature sizes (seam
 *  width, line pitch, wobble amplitude) derive from the sizing dimension
 *  directly; fixed detail steps (densify sampling, wobble wavelength, vein
 *  sampling) scale by `sizingDim / TUNING_DIM` so they keep their tuned
 *  physical size on other sheets too. */
export const TUNING_DIM = 891;

/** A band texture with every knob resolved to concrete numbers. */
export interface ResolvedTexture {
  kind: LapidaryTexture;
  angleRad: number;
  spacing: number;
  waviness: number;
  patchiness: number;
  /** Stroke end-taper amount 0..1 (seeded trims at both ends + occasional
   *  mid-stroke pen lift — the emitStroke craft). */
  taper: number;
  /** Unbroken flowing runs: suppress the hand-fed dashing and mid-stroke
   *  pen lifts (see `BandTexture.continuous`). */
  continuous: boolean;
  /** Per-stroke rotation jitter in radians. */
  jitterRad: number;
  /** Reserved-paper seam width — caps the dash stagger so staggered marks
   *  can never lean into a seam. */
  haloPx: number;
  /** Within-region tone shape (see `LapidaryToneShape`). */
  toneShape: LapidaryToneShape;
  /** Tone strength 0..1 (0 = flat). */
  toneStrength: number;
  /** Direction the light comes from, radians ('light' shape only). */
  lightAngleRad: number;
  /** Seeded stream for the 'noise' tone shape (fresh 600+z channel). */
  toneSeed: number;
  /** Slides the hatch family so no two bands' lines register alike. */
  phase: number;
  seed: number;
  /** sizingDim / TUNING_DIM — see `TUNING_DIM`. */
  featureScale: number;
}

/** Radial geometry behind a table-built region (agate rings, breccia
 *  fragments): the per-θ multiplier table plus its ellipse frame. Fills that
 *  follow the silhouette (contour loops, crystal rays) offset in table space,
 *  where inward offsets of these star-shaped blobs can never self-intersect. */
export interface RegionRadial {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  table: Float64Array;
}

/** A strata band's bounding curves, index-aligned left→right on the shared
 *  x grid (page-edge bands get their straight edge resampled to match). */
export interface RegionStrataBand {
  top: Point[];
  bottom: Point[];
}

/** A spiral cell's bounding edges, index-aligned along the ribbon's walk
 *  direction — the curved analogue of a strata band's top/bottom, so
 *  silhouette-following fills can laminate between them. */
export interface RegionRibbon {
  outer: Point[];
  inner: Point[];
}

/** One drawable region: a closed silhouette plus its resolved texture.
 *  Higher z = drawn on top; lower-z ink is carved away around it.
 *  `seamless` regions still stamp the avoid mask (so lower layers carve
 *  around them) but are never clipped themselves — abutting blend cells
 *  meet edge to edge instead of opening a seam. */
export interface Region {
  z: number;
  poly: Point[];
  tex: ResolvedTexture;
  radial?: RegionRadial;
  strataBand?: RegionStrataBand;
  ribbon?: RegionRibbon;
  seamless?: boolean;
  /** The inner neighbour's radial (agate rings): the band's second seam,
   *  so the 'seam' tone can ramp against both walls of the annulus. */
  innerRadial?: RegionRadial;
  /** Radial boundaries the background field gathers around ('seam' tone):
   *  the outermost agate ring, or every breccia fragment. */
  fieldRefs?: RegionRadial[];
}

export interface LayoutConfig {
  seed: number;
  mode: LapidaryMode;
  rect: { x0: number; y0: number; x1: number; y1: number };
  bands: number;
  /** Draw the full-frame background band (agate/breccia). Without it the
   *  layered shapes float on clean paper. */
  field: boolean;
  shapes: LapidaryShapes;
  irregularity: number;
  coverage: number;
  centerX: number;
  centerY: number;
  haloPx: number;
  spacingPx: number;
  textures?: Array<LapidaryTexture | BandTexture>;
  baseAngleDeg: number;
  angleDriftDeg: number;
  densityContrast: number;
  waviness: number;
  patchiness: number;
  /** Stroke end-taper amount 0..1. */
  taper: number;
  /** Sheet-wide default for unbroken flowing runs (see
   *  `BandTexture.continuous`); omitted = false, the dashed hand-fed look. */
  continuous?: boolean;
  /** Per-stroke rotation jitter in degrees. */
  jitterDeg: number;
  /** Within-region tone shape. */
  toneShape: LapidaryToneShape;
  /** Within-region tone strength 0..1. */
  toneStrength: number;
  /** Direction the light comes from, degrees ('light' tone shape). */
  lightAngleDeg: number;
  /** Vertical fault planes thrown across the strata stack (strata only). */
  faults: number;
  /** Spiral cross-section form (spiral only). */
  spiralForm: SpiralForm;
  /** Which end of the spiral ribbon leads (spiral only). */
  spiralDirection: SpiralDirection;
  /** Carved cell seams vs seamless texture morphing (spiral only). */
  spiralJoin: SpiralJoin;
  /** Ribbon width as a fraction of the local winding pitch, 0.15..0.9. */
  spiralWidth: number;
  /** Signed taper toward the leading end, -1..1. */
  spiralTaper: number;
  /** Low-frequency width modulation along the arc, 0..1. */
  spiralPulse: number;
  /** sizingDim / TUNING_DIM — see `TUNING_DIM`. */
  featureScale: number;
}

/** Baseline pitch multiplier per texture kind, spread further apart by
 *  `densityContrast`: the reference's dense mottled ring against its airy
 *  line field is a spacing decision, not a different pen. */
const KIND_SPACING: Record<LapidaryTexture, number> = {
  lines: 1.7,
  wavy: 1.1,
  contour: 1.0,
  crystal: 0.8,
  hatch: 0.45,
  patchy: 0.55,
  cross: 0.95,
  stipple: 1.3,
  // Two interleaved same-pitch gratings (the noise-texture module's
  // mechanism): overall pitch 0.5·base when evenly spread, opening to
  // 1·base where the weave stacks the families — the dense mottled ring
  // of the reference, with paper showing through the stacked passages.
  mottle: 0.5,
  grain: 0.7,
  // Committed black: serpentine rows at pen-width pitch. Pair with a pen
  // width near 0.3× the base spacing so the rows close up into ink.
  solid: 0.3,
  blank: 1,
};

/** Kinds the seeded picker may deal a band (blank, crystal and solid are
 *  preset-only — a random paper band next to the background reads as a hole,
 *  not a decision, a druzy ray-burst is too loud to land uninvited, and a
 *  committed black mass must be an artist's call, not a dice roll). */
const RANDOM_KINDS: LapidaryTexture[] = [
  'lines',
  'wavy',
  'contour',
  'hatch',
  'patchy',
  'cross',
  'stipple',
  'mottle',
  'grain',
];

/**
 * Resolve the texture for band `z` (0 = the background field). Explicit
 * specs are cycled outer→inner; otherwise a seeded pick that always opens
 * with 'lines' (the reference's ruled field) and never repeats a kind on
 * adjacent bands. Every random draw comes from this band's own sub-seeded
 * stream, so re-rolling one knob never reshuffles a sibling band.
 */
export function resolveTexture(
  cfg: LayoutConfig,
  z: number,
  prevKind: LapidaryTexture | null
): ResolvedTexture {
  const rng = makeRandom(subSeed(cfg.seed, 200 + z));
  let spec: BandTexture;
  if (cfg.textures && cfg.textures.length > 0) {
    const raw = cfg.textures[z % cfg.textures.length];
    spec = typeof raw === 'string' ? { kind: raw } : raw;
  } else if (z === 0) {
    spec = { kind: 'lines' };
  } else {
    let kind = RANDOM_KINDS[Math.floor(rng() * RANDOM_KINDS.length)];
    if (kind === prevKind) {
      kind = RANDOM_KINDS[(RANDOM_KINDS.indexOf(kind) + 1) % RANDOM_KINDS.length];
    }
    // Crystal is dealt sparingly — a druzy ray-burst is loud — and only on
    // inner agate/breccia bands, whose radial geometry the fan needs. The
    // roll is always drawn so eligibility never shifts a sibling draw.
    const crystalRoll = rng();
    if (
      (cfg.mode === 'agate' || cfg.mode === 'breccia') &&
      z >= 2 &&
      prevKind !== 'crystal' &&
      crystalRoll < 0.08
    ) {
      kind = 'crystal';
    }
    spec = { kind };
  }
  // The background band keeps the base angle exactly — the reference's ruled
  // vertical field is a datum the inner bands drift against.
  const drift = z === 0 ? 0 : (rng() * 2 - 1) * cfg.angleDriftDeg;
  const angleDeg = spec.angleDeg ?? cfg.baseAngleDeg + drift;
  // densityContrast spreads per-band pitch around the kind baseline; explicit
  // spacingScale pins it.
  const contrast = spec.spacingScale ?? lerp(1, 0.7 + 0.9 * rng(), cfg.densityContrast);
  const spacing = Math.max(1.2, cfg.spacingPx * KIND_SPACING[spec.kind] * contrast);
  return {
    kind: spec.kind,
    angleRad: (angleDeg * Math.PI) / 180,
    spacing,
    waviness: clamp(spec.waviness ?? cfg.waviness, 0, 1),
    patchiness: clamp(spec.patchiness ?? cfg.patchiness, 0, 1),
    taper: clamp(spec.taper ?? cfg.taper, 0, 1),
    continuous: spec.continuous ?? cfg.continuous ?? false,
    jitterRad: (clamp(spec.jitterDeg ?? cfg.jitterDeg, 0, 3) * Math.PI) / 180,
    haloPx: cfg.haloPx,
    toneShape: cfg.toneShape,
    toneStrength: clamp(spec.tone ?? cfg.toneStrength, 0, 1),
    lightAngleRad: (cfg.lightAngleDeg * Math.PI) / 180,
    toneSeed: subSeed(cfg.seed, 600 + z),
    phase: rng(),
    seed: subSeed(cfg.seed, 400 + z),
    featureScale: cfg.featureScale,
  };
}

function rectPolygon(rect: LayoutConfig['rect']): Point[] {
  return [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x1, y: rect.y1 },
    { x: rect.x0, y: rect.y1 },
  ];
}

/** The shape language for band `z`: an explicit per-band override in the
 *  texture spec wins; otherwise the sheet-wide setting, with 'mixed' dealing
 *  each band its own seeded coin so re-rolling one knob never flips a
 *  sibling band's language. */
function shapeFor(cfg: LayoutConfig, z: number): LapidaryShape {
  if (cfg.textures && cfg.textures.length > 0) {
    const raw = cfg.textures[z % cfg.textures.length];
    if (typeof raw !== 'string' && raw.shape) return raw.shape;
  }
  if (cfg.shapes === 'mixed') {
    return makeRandom(subSeed(cfg.seed, 550 + z))() < 0.5 ? 'organic' : 'angular';
  }
  return cfg.shapes;
}

function agateRegions(cfg: LayoutConfig): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;
  const cx = x0 + halfW + cfg.centerX * halfW;
  const cy = y0 + halfH + cfg.centerY * halfH;
  // Ring shrink must leave room for the seam plus a couple of surviving
  // strokes, or a band exists only as its own halo. Without the background
  // field every band is a ring; ring z stays i+1 either way so toggling the
  // field never reshuffles the rings' sub-seeded shapes and textures.
  const minGap = cfg.haloPx * 2 + cfg.spacingPx * 3;
  const rings = cfg.field ? cfg.bands - 1 : cfg.bands;
  const tables = nestedRingTables(
    cfg.seed,
    rings,
    cfg.coverage,
    cfg.irregularity,
    halfW,
    halfH,
    minGap,
    (i) => shapeFor(cfg, i + 1)
  );
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  const push = (z: number, poly: Point[], radial?: RegionRadial): void => {
    const tex = resolveTexture(cfg, z, prevKind);
    prevKind = tex.kind;
    regions.push({ z, poly, tex, radial });
  };
  if (cfg.field) push(0, rectPolygon(cfg.rect));
  tables.forEach((g, i) =>
    push(i + 1, ringPolygon(cx, cy, halfW, halfH, g), { cx, cy, rx: halfW, ry: halfH, table: g })
  );
  // Seam-tone geometry: each ring's second wall is its inner neighbour's
  // boundary; the field gathers around the outermost ring.
  const ringAt = (i: number): Region | undefined => regions[cfg.field ? i + 1 : i];
  for (let i = 0; i < tables.length - 1; i++) {
    ringAt(i)!.innerRadial = ringAt(i + 1)!.radial;
  }
  if (cfg.field && tables.length > 0) {
    regions[0].fieldRefs = [ringAt(0)!.radial!];
  }
  return regions;
}

/** Fragment count is bands-1 capped: past ~14 blobs the sheet reads as
 *  confetti and the halo carve cost grows for nothing. */
const BRECCIA_CAP = 14;

function brecciaRegions(cfg: LayoutConfig): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;
  const rng = makeRandom(subSeed(cfg.seed, 5));
  const want = Math.min(cfg.field ? cfg.bands - 1 : cfg.bands, BRECCIA_CAP);
  const frags: Array<{ cx: number; cy: number; rx: number; ry: number; seed: number }> = [];
  let attempts = 0;
  while (frags.length < want && attempts < want * 12) {
    attempts++;
    const cx = x0 + halfW * (0.24 + 1.52 * rng()) + cfg.centerX * halfW;
    const cy = y0 + halfH * (0.24 + 1.52 * rng()) + cfg.centerY * halfH;
    const f = lerp(0.16, 0.42, rng()) * cfg.coverage;
    const fragSeed = subSeed(cfg.seed, 120 + attempts);
    // Overlapping skirts are wanted (that's the layering); a centre landing
    // inside an existing fragment's core would just vanish under its halo.
    let coreHit = false;
    for (const e of frags) {
      const dx = (cx - e.cx) / (e.rx * 0.55);
      const dy = (cy - e.cy) / (e.ry * 0.55);
      if (dx * dx + dy * dy < 1) {
        coreHit = true;
        break;
      }
    }
    if (coreHit) continue;
    // Clamp the radius box to the margin rect (the normalized boundary never
    // exceeds it), so fragments stay on the sheet at any throw.
    const rx = Math.min(f * halfW, cx - x0, x1 - cx);
    const ry = Math.min(f * halfH, cy - y0, y1 - cy);
    if (rx < cfg.haloPx * 2 || ry < cfg.haloPx * 2) continue;
    frags.push({ cx, cy, rx, ry, seed: fragSeed });
  }
  // Relaxed second phase, entered only when the strict deal under-delivered
  // (those seeds silently returned fewer fragments than `bands` promised):
  // a tighter core-rejection ellipse and a smaller radius floor let the
  // remaining fragments tuck into leftover pockets. Draws continue from the
  // same rng stream — seeds the strict phase satisfied never reach this loop
  // and stay byte-identical. Fragment shape seeds come from a fresh sub-seed
  // channel: the strict phase's 120+ channel runs past 200 at high attempt
  // counts, into the 200+z texture streams.
  let relaxed = 0;
  while (frags.length < want && relaxed < want * 12) {
    relaxed++;
    const cx = x0 + halfW * (0.24 + 1.52 * rng()) + cfg.centerX * halfW;
    const cy = y0 + halfH * (0.24 + 1.52 * rng()) + cfg.centerY * halfH;
    const f = lerp(0.16, 0.42, rng()) * cfg.coverage;
    const fragSeed = subSeed(cfg.seed, 700 + relaxed);
    let coreHit = false;
    for (const e of frags) {
      const dx = (cx - e.cx) / (e.rx * 0.3);
      const dy = (cy - e.cy) / (e.ry * 0.3);
      if (dx * dx + dy * dy < 1) {
        coreHit = true;
        break;
      }
    }
    if (coreHit) continue;
    const rx = Math.min(f * halfW, cx - x0, x1 - cx);
    const ry = Math.min(f * halfH, cy - y0, y1 - cy);
    if (rx < cfg.haloPx || ry < cfg.haloPx) continue;
    frags.push({ cx, cy, rx, ry, seed: fragSeed });
  }
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  const push = (z: number, poly: Point[], radial?: RegionRadial): void => {
    const tex = resolveTexture(cfg, z, prevKind);
    prevKind = tex.kind;
    regions.push({ z, poly, tex, radial });
  };
  if (cfg.field) push(0, rectPolygon(cfg.rect));
  frags.forEach((fr, i) => {
    const table =
      shapeFor(cfg, i + 1) === 'angular'
        ? angularBoundaryTable(fr.seed, cfg.irregularity)
        : blobBoundaryTable(fr.seed, cfg.irregularity, null, 0);
    push(i + 1, ringPolygon(fr.cx, fr.cy, fr.rx, fr.ry, table), {
      cx: fr.cx,
      cy: fr.cy,
      rx: fr.rx,
      ry: fr.ry,
      table,
    });
  });
  // Seam-tone geometry: the field gathers around every fragment.
  if (cfg.field && regions.length > 1) {
    regions[0].fieldRefs = regions.slice(1).map((r) => r.radial!);
  }
  return regions;
}

function strataRegions(cfg: LayoutConfig): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const curves = strataCurves(
    cfg.seed,
    cfg.bands - 1,
    x0,
    y0,
    x1,
    y1,
    cfg.irregularity,
    cfg.haloPx * 2 + cfg.spacingPx * 2,
    (k) => shapeFor(cfg, k),
    cfg.faults
  );
  const half = cfg.haloPx / 2;
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  for (let k = 0; k < cfg.bands; k++) {
    const topCurve = k === 0 ? null : curves[k - 1].map((p) => ({ x: p.x, y: p.y + half }));
    const bottomCurve =
      k === cfg.bands - 1 ? null : curves[k].map((p) => ({ x: p.x, y: p.y - half }));
    const top: Point[] = topCurve ?? [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
    ];
    const bottom: Point[] = bottomCurve
      ? [...bottomCurve].reverse()
      : [
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ];
    const poly = [...top, ...bottom];
    // Bounding curves for silhouette-following fills, index-aligned on the
    // shared x grid: a page-edge band resamples its straight edge onto the
    // opposite curve's grid.
    const bandTop = topCurve ?? (bottomCurve ?? []).map((p) => ({ x: p.x, y: y0 }));
    const bandBottom = bottomCurve ?? (topCurve ?? []).map((p) => ({ x: p.x, y: y1 }));
    const tex = resolveTexture(cfg, k, prevKind);
    prevKind = tex.kind;
    regions.push({
      z: k,
      poly,
      tex,
      strataBand:
        bandTop.length > 1 && bandTop.length === bandBottom.length
          ? { top: bandTop, bottom: bandBottom }
          : undefined,
    });
  }
  return regions;
}

/** Build the mode's region list. Strata partitions the sheet with geometric
 *  seam gaps already built into the polygons; the other modes rely on the
 *  z-order halo carve. */
export function buildRegions(cfg: LayoutConfig): { regions: Region[]; geometricGaps: boolean } {
  if (cfg.mode === 'breccia') return { regions: brecciaRegions(cfg), geometricGaps: false };
  if (cfg.mode === 'strata') return { regions: strataRegions(cfg), geometricGaps: true };
  if (cfg.mode === 'spiral') return { regions: spiralRegions(cfg, resolveTexture), geometricGaps: false };
  return { regions: agateRegions(cfg), geometricGaps: false };
}
