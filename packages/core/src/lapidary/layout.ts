import { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp } from '../lib/math.js';
import { smoothstep } from '../lib/spatial.js';
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
  /** Slides the hatch family so no two bands' lines register alike. */
  phase: number;
  seed: number;
  /** sizingDim / TUNING_DIM — see `TUNING_DIM`. */
  featureScale: number;
  /** Target ink coverage 0..1 — this band's place in the sheet's value plan.
   *  The pitch above is derived from it. */
  value: number;
  /** Signed gradation across the band's width, -1..1: real agate graduates
   *  from one edge to the other rather than holding a flat tone. */
  gradient: number;
  /** Where the band sits in the composition. */
  role: BandRole;
  /** The resolved direction in degrees — carried so the next band can be held
   *  apart from it. */
  angleDeg: number;
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
  /**
   * The next ring inward, in the same table space — i.e. where this band's ink
   * actually stops.
   *
   * A ring's polygon is the whole *disc*: the annulus only exists because the
   * carve clips it outside everything above. So anything asking "how far across
   * this band am I" from `table` alone is measuring across the disc, and on a
   * log-spaced nest the drawn annulus is only the outer third of that. Absent
   * on the innermost ring, which really is a disc.
   */
  innerTable?: Float64Array;
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
  /** How hard the sheet's value ladder is composed, 0..1. */
  valueStructure: number;
  /** Which way the darks run across the stack. */
  valueRhythm: LapidaryValueRhythm;
  /** Let the plan hold its lightest band as bare paper. */
  paperBand: boolean;
  /** How far a band graduates across its own width, 0..1. */
  gradation: number;
  /** Snap per-band angle drift to multiples of this, 0 = free drift. */
  angleQuantumDeg: number;
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
  blank: 1,
};

/**
 * Ink coverage each kind actually delivers at its own baseline pitch
 * (`KIND_SPACING x spacingPx`), measured rather than estimated:
 * ink *area* over band area, one kind alone in an uncarved region at
 * `spacingScale: 1`, `gradation: 0`, `penPx = spacingPx / 4`. Each stroke is
 * measured as a capsule — `length x pen` plus a round cap — because a stipple
 * tick is drawn shorter than the pen is wide, so the cap is most of the mark
 * and counting only `length x pen` under-reports dots threefold.
 *
 * These were guessed once and the guesses were wrong by up to 25x *relative to
 * each other* — stipple was declared 1.4x lighter than `lines` when it is 16x
 * lighter — so a band asked to be dark and dealt stipple rendered near-blank.
 * The numbers are only meaningful as a set, and only against the current
 * `KIND_SPACING` and mark geometry: change either and re-measure. The test
 * `coverage model matches what the marks deliver` pins them.
 */
const KIND_VALUE: Record<LapidaryTexture, number> = {
  lines: 0.165,
  wavy: 0.24,
  contour: 0.244,
  crystal: 0.349,
  hatch: 0.591,
  patchy: 0.304,
  cross: 0.46,
  stipple: 0.023,
  mottle: 0.565,
  grain: 0.174,
  blank: 0,
};

/**
 * The coverage a plan value of 1.0 asks for.
 *
 * `KIND_VALUE` is now literal coverage, but the ladder speaks in 0..1, so one
 * constant maps between them. Set to the ruled field's own figure: the field is
 * the largest region on the sheet and is dealt `lines` most of the time, so
 * pinning it here leaves the most visible area drawing exactly as it did and
 * lets every other kind move by however far its guess was out.
 */
const COVERAGE_AT_FULL_VALUE = 0.55;

/**
 * How hard a pitch change moves the coverage. A line family scales as 1/pitch.
 * A field of fixed-size dots would scale as 1/pitch squared. Stipple and grain
 * sit between the two: their seeds are two-dimensional, so the mark count goes
 * as 1/pitch squared, but their marks also ride the pitch and shrink with it,
 * which pulls the exponent back down. Measured at the reference pitch, stipple
 * is roughly 57% cap area and 43% stroke, hence 1.6.
 */
const KIND_VALUE_EXP: Record<LapidaryTexture, number> = {
  lines: 1,
  wavy: 1,
  contour: 1,
  crystal: 1,
  hatch: 1,
  patchy: 1,
  cross: 1,
  mottle: 1,
  stipple: 1.6,
  grain: 1.4,
  blank: 1,
};

/** Pitch multipliers outside this can't be honoured: below it the marks fuse
 *  into a solid mass, above it the band is two strokes and a rumour. */
const VALUE_SCALE_MIN = 0.45;
const VALUE_SCALE_MAX = 2.6;

/** The pitch multiplier that lands `kind` on ink value `target`. */
export function valueSpacingScale(kind: LapidaryTexture, target: number): number {
  if (kind === 'blank' || target <= 0) return 1;
  const want = Math.max(0.005, target * COVERAGE_AT_FULL_VALUE);
  const raw = Math.pow(KIND_VALUE[kind] / want, 1 / KIND_VALUE_EXP[kind]);
  return clamp(raw, VALUE_SCALE_MIN, VALUE_SCALE_MAX);
}

/**
 * How honestly `kind` can reach `target` — 1 when its own pitch gets there,
 * falling off as the clamp starts doing the work instead.
 *
 * Deliberately asymmetric. Being clamped at the *tight* end means the mark
 * cannot get dark enough and the band renders near-blank where the plan wanted
 * weight — unrecoverable, and the defect this exists to prevent. Being clamped
 * at the *open* end only means the mark is denser than the slot needs and opens
 * out sparse, which still reads as marks. So under-delivery is punished hard
 * and over-delivery only mildly.
 */
export function valueFit(kind: LapidaryTexture, target: number): number {
  if (kind === 'blank') return target <= 0.09 ? 1 : 0;
  const want = Math.max(0.005, target * COVERAGE_AT_FULL_VALUE);
  const raw = Math.pow(KIND_VALUE[kind] / want, 1 / KIND_VALUE_EXP[kind]);
  const held = clamp(raw, VALUE_SCALE_MIN, VALUE_SCALE_MAX);
  if (raw >= held) return clamp(1 - Math.log(raw / held) * 1.1, 0.12, 1);
  return clamp(1 - Math.log(held / raw) * 3.2, 0.02, 1);
}

/** Kinds the seeded picker may deal a band (blank and crystal are
 *  preset-only — a random paper band next to the background reads as a hole,
 *  not a decision, and a druzy ray-burst is too loud to land uninvited). */
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

/** How the sheet's darks are arranged across the stack. */
export type LapidaryValueRhythm =
  | 'auto'
  | 'dark-core'
  | 'dark-rim'
  | 'alternating'
  | 'ramp'
  | 'flat';

/** A band's place in the composition — the deal weights marks by it, and the
 *  keyline hangs its extra weight on the anchor. */
export type BandRole = 'field' | 'rim' | 'mid' | 'core';

/**
 * The sheet's tonal composition: what each band weighs, which one anchors the
 * darks, which is held as near-paper.
 *
 * Without this a band's darkness was a pitch lottery — `KIND_SPACING` times a
 * random draw — so nothing guaranteed a dark to hang the drawing on, nothing
 * guaranteed reserved paper, and two neighbours could land a hair apart, which
 * reads as a mistake rather than a decision. The image pipeline composes value
 * before it draws anything (`valueBands`, then `massing`); a stone sheet needs
 * the same decision made for it.
 */
export interface ValuePlan {
  /** Target ink value 0..1 per band, indexed by z. */
  values: number[];
  /** z of the guaranteed dark band — the sheet's focal weight. */
  anchor: number;
  /** z of the guaranteed near-paper band, or -1. */
  reserve: number;
  /** Whether `reserve` is light enough to be held as bare paper. */
  reserveIsPaper: boolean;
  /** The highest z that will actually be drawn. `values` is deliberately one
   *  slot longer in the modes with a field, so role and pin placement have to
   *  measure against this rather than against `values.length`. */
  lastDrawnZ: number;
  rhythm: Exclude<LapidaryValueRhythm, 'auto'>;
}

/** Whether z 0 is the full-frame field slot for this mode. Deliberately keyed
 *  on the *mode*, not on `cfg.field`: agate/breccia/spiral number their bands
 *  from z 1 whether or not the field is drawn, so the composition — like the
 *  sub-seeded silhouettes — stays put when the field is toggled off. */
function hasFieldSlot(cfg: LayoutConfig): boolean {
  return cfg.mode !== 'strata';
}

/** Where band `z` sits in the composition. Agate/spiral z ascends outer→inner,
 *  so low z is the rim and high z the core. */
export function roleFor(z: number, slots: number, fieldSlot: boolean): BandRole {
  if (fieldSlot && z === 0) return 'field';
  const first = fieldSlot ? 1 : 0;
  const span = Math.max(1, slots - 1 - first);
  const u = (z - first) / span;
  if (u < 0.34) return 'rim';
  if (u > 0.72) return 'core';
  return 'mid';
}

/** Compose the sheet's value ladder. All draws come from one dedicated
 *  sub-seed channel, so re-rolling a texture or a silhouette never reshuffles
 *  the tonal composition. */
export function buildValuePlan(cfg: LayoutConfig, slots: number, lastDrawnZ: number): ValuePlan {
  const rng = makeRandom(subSeed(cfg.seed, 900));
  const n = Math.max(1, slots);
  const structure = clamp(cfg.valueStructure, 0, 1);

  // The rhythm draw is consumed either way, so pinning the rhythm never shifts
  // the rest of the plan's stream.
  const roll = rng();
  const rhythm: Exclude<LapidaryValueRhythm, 'auto'> =
    cfg.valueRhythm !== 'auto'
      ? cfg.valueRhythm
      : roll < 0.3
        ? 'dark-core'
        : roll < 0.55
          ? 'dark-rim'
          : roll < 0.8
            ? 'alternating'
            : 'ramp';

  // At structure 0 the ladder is nearly flat (the old undifferentiated read);
  // at 1 it spans held paper to a near-solid mass.
  const vDark = lerp(0.55, 0.92, structure);
  const vLight = lerp(0.35, 0.06, structure);

  // Whether this sheet holds a band as bare paper. A coin, not a threshold:
  // reserved paper is a decision an artist makes on some pieces and not
  // others, and a blank band on every single sheet would be its own tic.
  const paperRoll = rng() < 0.5;
  const dirUp = rng() < 0.5;
  const kink = 0.3 + 0.4 * rng();
  const values: number[] = new Array(n);
  for (let z = 0; z < n; z++) {
    const u = n > 1 ? z / (n - 1) : 0.5;
    let v: number;
    switch (rhythm) {
      case 'dark-core':
        v = lerp(vLight, vDark, smoothstep(u));
        break;
      case 'dark-rim':
        v = lerp(vDark, vLight, smoothstep(u));
        break;
      case 'ramp': {
        // A mid kink keeps the ramp from reading as a printed gradient.
        const w = u < kink ? (u / kink) * 0.5 : 0.5 + ((u - kink) / (1 - kink)) * 0.5;
        v = dirUp ? lerp(vLight, vDark, w) : lerp(vDark, vLight, w);
        break;
      }
      case 'alternating':
        v = z % 2 === 0 ? vLight : vDark;
        break;
      default:
        v = (vDark + vLight) / 2;
    }
    values[z] = v;
  }
  // Nudge every rung so no rhythm lands mechanically exact — an alternating
  // ladder especially must not read as a zebra.
  const nudge = rhythm === 'alternating' ? 0.16 : 0.07;
  for (let z = 0; z < n; z++) {
    values[z] = clamp(values[z] + (rng() - 0.5) * nudge, 0.02, 0.98);
  }

  // The two guarantees are placed among the *shape* bands only, never on the
  // full-frame field. A black background swallows the layered-stencil read the
  // whole generator is built on, and a field the plan had spent its dark on
  // would leave a `field: false` sheet with no anchor at all. The outermost
  // ring can still carry the dark, which is the same vignette read.
  //
  // The upper bound is the last band that will actually be DRAWN, not the last
  // slot. The ladder is deliberately allocated one slot wider than the drawn
  // range so its shape does not move when the field is toggled off — which
  // means the top slot is a phantom whenever the field is on, and searching to
  // it pinned the sheet's dark to a band nothing renders. That silently cost a
  // quarter of agate sheets their anchor, and left the keyline with no hero.
  const first = hasFieldSlot(cfg) ? Math.min(1, n - 1) : 0;
  const last = clamp(lastDrawnZ, first, n - 1);
  let anchor = first;
  for (let z = first + 1; z <= last; z++) if (values[z] > values[anchor]) anchor = z;
  values[anchor] = vDark;

  let reserve = first;
  for (let z = first + 1; z <= last; z++) if (values[z] < values[reserve]) reserve = z;
  if (reserve !== anchor) values[reserve] = vLight;
  else reserve = -1;

  // The field is a ground, not a subject: hold it back so the shapes read off it.
  if (hasFieldSlot(cfg) && n > 1) values[0] = Math.min(values[0], 0.42);

  // Push neighbours apart until each reads as its own value. Pushing (rather
  // than re-rolling) means one band's separation never reshuffles a sibling.
  const minSep = lerp(0.05, 0.22, structure);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let z = 1; z < n; z++) {
      const d = values[z] - values[z - 1];
      if (Math.abs(d) >= minSep) continue;
      const shove = (minSep - Math.abs(d)) * 0.5;
      const sign = d === 0 ? (z % 2 === 0 ? 1 : -1) : Math.sign(d);
      values[z] = clamp(values[z] + sign * shove, vLight, vDark);
      values[z - 1] = clamp(values[z - 1] - sign * shove, vLight, vDark);
      moved = true;
    }
    // The two guarantees outrank the separation sweep.
    values[anchor] = vDark;
    if (reserve >= 0) values[reserve] = vLight;
    if (!moved) break;
  }

  return {
    values,
    anchor,
    reserve,
    // Never at z 0: a blank full-frame field is `field: false` wearing a
    // disguise, and it would leave the sheet with no ground at all. And only
    // when the ladder is composed hard enough that a paper band reads as the
    // lightest step of a plan rather than as a hole.
    reserveIsPaper: cfg.paperBand && paperRoll && reserve > 0 && structure >= 0.4,
    lastDrawnZ: last,
    rhythm,
  };
}

/** How far apart two neighbouring bands' stroke directions have to sit before
 *  they read as two decisions. Below this the eye sees one direction badly
 *  held — a mistake rather than a choice — which is what an unconstrained
 *  ±drift draw kept producing (bands landing 1° apart). */
const ANGLE_MIN_SEP_DEG = 14;

/** Separation between two undirected stroke directions, 0..90°. */
function angleGap(a: number, b: number): number {
  const d = (((a - b) % 180) + 180) % 180;
  return Math.min(d, 180 - d);
}

/**
 * Nudge `angleDeg` off `prevDeg` until the two bands read apart, walking the
 * quantum lattice outward from the drawn angle and never leaving the drift
 * budget. Returns the angle unchanged when the budget simply cannot pay for
 * the separation — a deliberately tight drift must stay tight.
 */
function separateAngle(
  angleDeg: number,
  prevDeg: number,
  baseDeg: number,
  budget: number,
  quantum: number
): number {
  if (angleGap(angleDeg, prevDeg) >= ANGLE_MIN_SEP_DEG) return angleDeg;
  const step = quantum > 0 ? quantum : 3;
  for (let k = 1; k * step <= budget * 2 + step; k++) {
    for (const s of [1, -1]) {
      const cand = angleDeg + s * k * step;
      if (Math.abs(cand - baseDeg) > budget + 1e-6) continue;
      if (angleGap(cand, prevDeg) >= ANGLE_MIN_SEP_DEG) return cand;
    }
  }
  return angleDeg;
}

/** What the deal carries from one band to the next. */
export interface DealState {
  prevKind: LapidaryTexture | null;
  /** Two bands back — without it the busy/quiet alternation collapses into a
   *  strict ABAB, which is its own mechanical pattern. */
  prevKind2: LapidaryTexture | null;
  prevAngleDeg: number | null;
}

/** Below this `valueFit`, a mark simply cannot reach the value asked of it. */
const FIT_VETO = 0.15;

/** Marks that carry a lot of incident. Two of these abutting is the mud
 *  complaint — the eye has nowhere quiet to rest between them. */
const BUSY: ReadonlySet<LapidaryTexture> = new Set<LapidaryTexture>([
  'mottle',
  'cross',
  'stipple',
  'grain',
  'crystal',
  'patchy',
]);

/** What each compositional role wants. The field is the ruled datum the inner
 *  bands drift against; a rim wants marks that follow the silhouette; a core
 *  can take the loudest thing on the sheet because everything around it is
 *  holding still. */
const ROLE_WEIGHT: Record<BandRole, Partial<Record<LapidaryTexture, number>>> = {
  // The ground is a datum the shapes drift against, so it leans hard on the
  // ruled field of the reference — but not exclusively, or every sheet opens
  // the same way.
  field: { lines: 4, wavy: 1.5, stipple: 1.2, grain: 0.9, hatch: 0.5, mottle: 0.4, cross: 0.3 },
  rim: { contour: 1.9, wavy: 1.6, lines: 1.2, grain: 1.1 },
  mid: {},
  core: { contour: 1.5, hatch: 1.4, mottle: 1.2, cross: 1.2, stipple: 0.9 },
};

/**
 * Deal a band its mark. The old rule was a uniform pick with one constraint
 * ("not the same as the previous band"), which happily put a mottled grating
 * beside a cross-hatch beside a patchy field — three loud marks at three
 * near-identical weights, which is how a sheet turns to mud.
 *
 * Three things steer it now. What the role wants and a busy/quiet alternation
 * are *preferences*: they discourage rather than forbid — measured, they take
 * busy-next-to-busy from 41% of adjacent pairs down to 25% — and both fade to
 * the old uniform draw as `valueStructure` goes to 0, so the knob genuinely
 * turns the composition off. Whether the mark can physically reach the value
 * the plan asked for is not a preference, so it gates the draw at any setting.
 */
function dealKind(
  cfg: LayoutConfig,
  rng: () => number,
  state: DealState,
  value: number,
  role: BandRole
): LapidaryTexture {
  const strength = clamp(cfg.valueStructure, 0, 1);
  const prev = state.prevKind;
  const fits = RANDOM_KINDS.map((kind) => valueFit(kind, value));
  const weights = RANDOM_KINDS.map((kind, i) => {
    if (kind === prev) return 0;
    // A hard veto, not a light thumb on the scale: below this the mark cannot
    // reach the planned value at any pitch a pen can plot, so dealing it here
    // guarantees a band that renders as near-blank paper where the plan wanted
    // weight. Better to deal something else.
    if (fits[i] < FIT_VETO) return 0;
    const roleW = ROLE_WEIGHT[role][kind] ?? 1;
    const rest = prev !== null && BUSY.has(kind) === BUSY.has(prev) ? 0.4 : 1;
    // Discourage, don't forbid, coming straight back to the band before last.
    const echo = kind === state.prevKind2 ? 0.45 : 1;
    // Role and rhythm are preferences and fade out with `valueStructure`.
    const preference = lerp(1, roleW * rest * echo, strength);
    // Whether the mark can physically reach the planned value is not a
    // preference — a stipple field asked to be the sheet's dark cannot become
    // one at any pitch a pen can plot, it just renders as near-blank paper. So
    // the fit gates the draw whatever the composition knob says.
    return Math.max(1e-5, preference * Math.pow(fits[i], 1.6));
  });
  let total = 0;
  for (const w of weights) total += w;
  // Every kind vetoed (a value nothing can honestly reach): fall back to the
  // closest fit rather than to an arbitrary one.
  if (total <= 0) {
    let best = 0;
    for (let i = 1; i < RANDOM_KINDS.length; i++) {
      if (RANDOM_KINDS[i] !== prev && fits[i] > fits[best]) best = i;
    }
    return RANDOM_KINDS[best];
  }
  // One draw, at the same position in the stream the uniform pick used.
  let pick = rng() * total;
  for (let i = 0; i < RANDOM_KINDS.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return RANDOM_KINDS[i];
  }
  return RANDOM_KINDS[RANDOM_KINDS.length - 1];
}

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
  state: DealState,
  plan: ValuePlan
): ResolvedTexture {
  const rng = makeRandom(subSeed(cfg.seed, 200 + z));
  const planned = plan.values[Math.min(z, plan.values.length - 1)];
  const role = roleFor(z, plan.lastDrawnZ + 1, hasFieldSlot(cfg));
  // densityContrast is no longer the value model — it is how far this seed is
  // allowed to wander off the composition. Always consumed, so pinning a
  // band's spacingScale no longer shifts its own phase draw.
  const wander = lerp(1, 0.82 + 0.36 * rng(), cfg.densityContrast);
  const value = clamp(planned * wander, 0.02, 0.98);

  let spec: BandTexture;
  if (cfg.textures && cfg.textures.length > 0) {
    const raw = cfg.textures[z % cfg.textures.length];
    spec = typeof raw === 'string' ? { kind: raw } : raw;
  } else if (plan.reserveIsPaper && z === plan.reserve) {
    // The plan asked for held paper here, so this band is a decision rather
    // than a hole — which is the whole reason `blank` stays out of the deal.
    spec = { kind: 'blank' };
  } else {
    spec = { kind: dealKind(cfg, rng, state, value, role) };
  }
  // The background band keeps the base angle exactly — the reference's ruled
  // vertical field is a datum the inner bands drift against.
  //
  // Off that datum the drift is quantized and then held apart from the
  // previous band. A free ±drift draw kept landing neighbours a degree or two
  // apart, which reads as one direction badly held rather than two decisions,
  // and it was the main reason a five-band sheet could look like one texture.
  // A quantum coarser than the whole drift budget is clamped down to it rather
  // than switched off: set coarser than the budget it used to go silently dead,
  // which at the default 25° drift made a third of the slider a no-op.
  const quantum =
    cfg.angleQuantumDeg > 0 && cfg.angleDriftDeg > 0
      ? Math.min(cfg.angleQuantumDeg, cfg.angleDriftDeg)
      : 0;
  let drift = z === 0 ? 0 : (rng() * 2 - 1) * cfg.angleDriftDeg;
  if (quantum > 0) drift = Math.round(drift / quantum) * quantum;
  let angleDeg = spec.angleDeg ?? cfg.baseAngleDeg + drift;
  if (spec.angleDeg === undefined && z > 0 && state.prevAngleDeg !== null) {
    angleDeg = separateAngle(
      angleDeg,
      state.prevAngleDeg,
      cfg.baseAngleDeg,
      cfg.angleDriftDeg,
      quantum
    );
  }
  // Pitch is derived from the band's place in the value ladder; an explicit
  // spacingScale still pins it (a preset that wrote its own tone means it).
  const contrast = spec.spacingScale ?? valueSpacingScale(spec.kind, value);
  const spacing = Math.max(1.2, cfg.spacingPx * KIND_SPACING[spec.kind] * contrast);
  // Which way the band graduates across its width, and how hard.
  const gradient = cfg.gradation * (0.45 + 0.55 * rng()) * (rng() < 0.5 ? -1 : 1);
  return {
    kind: spec.kind,
    angleRad: (angleDeg * Math.PI) / 180,
    spacing,
    waviness: clamp(spec.waviness ?? cfg.waviness, 0, 1),
    patchiness: clamp(spec.patchiness ?? cfg.patchiness, 0, 1),
    phase: rng(),
    seed: subSeed(cfg.seed, 400 + z),
    featureScale: cfg.featureScale,
    value,
    gradient,
    role,
    angleDeg,
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

function agateRegions(cfg: LayoutConfig, plan: ValuePlan): Region[] {
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
  const state: DealState = { prevKind: null, prevKind2: null, prevAngleDeg: null };
  const advance = (tex: ResolvedTexture): void => {
    state.prevKind2 = state.prevKind;
    state.prevKind = tex.kind;
    state.prevAngleDeg = tex.angleDeg;
  };
  const push = (z: number, poly: Point[], radial?: RegionRadial): void => {
    const tex = resolveTexture(cfg, z, state, plan);
    advance(tex);
    regions.push({ z, poly, tex, radial });
  };
  // Slot 0 is resolved whether or not the field is drawn, so what the shapes
  // are dealt — and how far their angles are held off their neighbour — does
  // not change when the ground is simply left off the page.
  const fieldTex = resolveTexture(cfg, 0, state, plan);
  advance(fieldTex);
  if (cfg.field) regions.push({ z: 0, poly: rectPolygon(cfg.rect), tex: fieldTex });
  tables.forEach((g, i) =>
    push(i + 1, ringPolygon(cx, cy, halfW, halfH, g), {
      cx,
      cy,
      rx: halfW,
      ry: halfH,
      table: g,
      innerTable: tables[i + 1],
    })
  );
  return regions;
}

/** Fragment count is bands-1 capped: past ~14 blobs the sheet reads as
 *  confetti and the halo carve cost grows for nothing. */
const BRECCIA_CAP = 14;

function brecciaRegions(
  cfg: LayoutConfig,
  buildPlan: (lastDrawnZ: number) => ValuePlan
): { regions: Region[]; plan: ValuePlan } {
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
  const plan = buildPlan(frags.length);
  const regions: Region[] = [];
  const state: DealState = { prevKind: null, prevKind2: null, prevAngleDeg: null };
  const advance = (tex: ResolvedTexture): void => {
    state.prevKind2 = state.prevKind;
    state.prevKind = tex.kind;
    state.prevAngleDeg = tex.angleDeg;
  };
  const push = (z: number, poly: Point[], radial?: RegionRadial): void => {
    const tex = resolveTexture(cfg, z, state, plan);
    advance(tex);
    regions.push({ z, poly, tex, radial });
  };
  // Slot 0 is resolved whether or not the field is drawn, so what the shapes
  // are dealt — and how far their angles are held off their neighbour — does
  // not change when the ground is simply left off the page.
  const fieldTex = resolveTexture(cfg, 0, state, plan);
  advance(fieldTex);
  if (cfg.field) regions.push({ z: 0, poly: rectPolygon(cfg.rect), tex: fieldTex });
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
  return { regions, plan };
}

function strataRegions(cfg: LayoutConfig, plan: ValuePlan): Region[] {
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
  const state: DealState = { prevKind: null, prevKind2: null, prevAngleDeg: null };
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
    const tex = resolveTexture(cfg, k, state, plan);
    state.prevKind2 = state.prevKind;
    state.prevKind = tex.kind;
    state.prevAngleDeg = tex.angleDeg;
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

/**
 * Re-point the plan's anchor at a band that was actually built.
 *
 * The predicted range is not enough on its own: `nestedRingTables` stops early
 * when a ring collapses on hostile geometry, so the realised band count can
 * fall short of what the plan was told to expect. The anchor is only read
 * after the fact (as the keyline's hero band), so deriving it from the built
 * list is both cheap and impossible to get wrong.
 */
export function withRealisedAnchor(plan: ValuePlan, regions: Region[]): ValuePlan {
  const shapes = regions.filter((r) => r.z > 0);
  const pool = shapes.length > 0 ? shapes : regions;
  if (pool.length === 0) return plan;
  let anchor = pool[0];
  for (const r of pool) if (r.tex.value > anchor.tex.value) anchor = r;
  return anchor.z === plan.anchor ? plan : { ...plan, anchor: anchor.z };
}

/** Build the mode's region list. Strata partitions the sheet with geometric
 *  seam gaps already built into the polygons; the other modes rely on the
 *  z-order halo carve. */
export function buildRegions(cfg: LayoutConfig): {
  regions: Region[];
  geometricGaps: boolean;
  plan: ValuePlan;
} {
  // The spiral's slot count isn't known until the coil has been walked, so it
  // builds its own plan and hands it back.
  if (cfg.mode === 'spiral') {
    const { regions, plan } = spiralRegions(cfg, resolveTexture, buildValuePlan);
    return { regions, geometricGaps: false, plan };
  }
  // Slot 0 is the field's whether or not it is drawn, and the shape bands
  // number from 1, so the ladder spans `bands + 1` slots in the modes that
  // have a field. Strata has none — it partitions the whole sheet.
  const strata = cfg.mode === 'strata';
  const slots = strata ? cfg.bands : cfg.bands + 1;
  if (cfg.mode === 'breccia') {
    const built = brecciaRegions(cfg, (lastDrawnZ) => buildValuePlan(cfg, slots, lastDrawnZ));
    return {
      regions: built.regions,
      geometricGaps: false,
      plan: withRealisedAnchor(built.plan, built.regions),
    };
  }
  const lastDrawn = strata ? cfg.bands - 1 : cfg.field ? cfg.bands - 1 : cfg.bands;
  const plan = buildValuePlan(cfg, slots, lastDrawn);
  const regions = strata ? strataRegions(cfg, plan) : agateRegions(cfg, plan);
  return { regions, geometricGaps: strata, plan: withRealisedAnchor(plan, regions) };
}
