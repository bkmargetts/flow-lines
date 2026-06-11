import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { ImageField, DirectionMap } from './image-field.js';
import { GrayscaleImage, sampleBilinear } from './image.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import {
  PortraitOptions,
  buildPortraitMaps,
  featureStrokesToLines,
} from './portrait.js';
import { traceContours } from './contours.js';
import { traceIsoContours } from './iso-contours.js';
import { optimizePlot } from './optimize.js';
import { createNoise } from './noise.js';

/** Drop a fraction of a polyline's arc length from each end */
function trimPolyline(points: Point[], fraction: number): Point[] {
  if (points.length < 3) return points;

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    );
  }
  const total = cumulative[cumulative.length - 1];
  const trim = Math.min(total * fraction, 12);

  const start = cumulative.findIndex((c) => c >= trim);
  let end = points.length - 1;
  while (end > 0 && cumulative[end] > total - trim) end--;

  if (start < 0 || end - start < 1) return points;
  return points.slice(start, end + 1);
}

/** Offset a polyline perpendicular to its local direction */
function offsetPolyline(points: Point[], distance: number): Point[] {
  if (Math.abs(distance) < 1e-6) return points.map((p) => ({ ...p }));

  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const len = Math.hypot(tx, ty) || 1;
    out[i] = {
      x: points[i].x + (-ty / len) * distance,
      y: points[i].y + (tx / len) * distance,
    };
  }
  return out;
}

export interface FocusOptions {
  /** Focal point x in output canvas coordinates */
  x: number;
  /** Focal point y in output canvas coordinates */
  y: number;
  /** Radius of full rendering detail around the focal point, px */
  radius: number;
  /** Distance over which detail fades out beyond the radius, px (default: radius) */
  falloff?: number;
  /** How strongly detail is suppressed outside the focus, 0-1 (default 0.85) */
  strength?: number;
}

export interface PenInkOptions {
  /** Output width in px (default 800) */
  width?: number;
  /** Output height in px (default: derived from the image aspect ratio) */
  height?: number;
  /** Margin from canvas edges (default 20) */
  margin?: number;
  /** Random seed for reproducibility */
  seed?: number;

  /** Number of hatching layers, 1-4. Darker areas receive more layers (default 3) */
  layers?: number;
  /** Stroke spacing in the darkest areas, px (default 2.5) */
  minSpacing?: number;
  /** Stroke spacing in the lightest hatched areas, px (default 14) */
  maxSpacing?: number;
  /** Darkness below which paper is left blank, 0-1 (default 0.08) */
  whiteCutoff?: number;
  /** Tone response curve; >1 pushes density into shadows (default 1) */
  toneGamma?: number;
  /**
   * Posterize tone into this many discrete value bands — the value plan
   * an artist decides on before inking: big committed shapes of paper,
   * light, mid, and dark instead of continuous photographic gradation.
   * 3-5 reads as deliberate; 0 disables (default 0)
   */
  valueBands?: number;
  /**
   * Build cross-hatch layers up in hand-sized patches with gaps instead
   * of continuous woven coverage, 0-1. Deeper layers get patchier —
   * shadows read as worked over with the pen, not screen-printed
   * (default 0.35)
   */
  hatchPatchiness?: number;
  /**
   * Hatch toned masses as facets: straight parallel strokes in
   * hand-sized patches, each patch at its own constant angle (the local
   * flow direction snapped to 30° quanta plus a per-patch twist), with
   * strokes stopping at patch borders. Smoothly curving streamlines are
   * the strongest remaining "computer" tell; rocks, walls, and shadow
   * masses in real ink work are hatched facet by facet (default false)
   */
  facetHatch?: boolean;

  /** Fallback hatch angle in degrees for flat regions (default -45) */
  hatchAngle?: number;
  /** Follow image contours (true) or hatch at fixed angles only (default true) */
  followTone?: boolean;
  /** Structure tensor smoothing — higher gives smoother, longer strokes (default 4) */
  fieldSmoothing?: number;
  /** Auto-stretch image contrast (default true) */
  normalizeContrast?: boolean;
  /** Max dimension of the internal working raster (default 600) */
  workingSize?: number;

  /** Trace dark edges as outlines (default true) */
  drawOutlines?: boolean;
  /** Edge strength threshold for outlines, 0-1 (default 0.35) */
  outlineThreshold?: number;
  /**
   * Reserve a sliver of blank paper this wide (px) beside long confident
   * contours: hatching and stipple stop short of the line instead of
   * crashing into it, so subjects pop off the background the way ink
   * artists hold background tone away from a silhouette. Applied on the
   * darker side of the line, and only across a real tonal step — edges
   * inside an evenly-toned mass leave no halo. 0 disables (default 2.2)
   */
  contourHalo?: number;

  /**
   * Render textured regions (fur, foliage, fabric) with short directional
   * tick strokes instead of long streamlines — 0 disables, 1 is maximum
   * (default 0.6)
   */
  textureStrokes?: number;
  /**
   * Mark style for texture-dominant regions: directional ticks (default),
   * tone-driven stipple dots, or wandering scribble strokes
   */
  textureStyle?: 'ticks' | 'stipple' | 'scribble';
  /**
   * Stipple smooth light-mid regions (open skies, soft gradients) instead
   * of hatching them — the classic illustrated-sky treatment (default false)
   */
  skyStipple?: boolean;
  /**
   * Let the darkest tones saturate toward solid black by tightening
   * spacing below minSpacing — committed dark masses instead of uniformly
   * gray cross-hatch (default true)
   */
  richBlacks?: boolean;
  /**
   * Counterchange strength, 0-1: tone darkens where a dark mass meets a
   * lighter one and relaxes away from the boundary — the background
   * swells behind a light subject, a shadow mass bites at its edge. The
   * lighter side is never touched. 0 disables (default 0.5)
   */
  counterchange?: number;

  /**
   * Hatch across forms instead of along them: strokes wrap around the
   * cross-section of tubes and limbs like classic etching/engraving
   * shading, rather than flowing parallel to edges (default false)
   */
  crossContour?: boolean;
  /**
   * Cap on hatch stroke length in px — short strokes read as individually
   * placed marks rather than traced streamlines. 0 = unlimited (default 0)
   */
  maxStrokeLength?: number;

  /** Integration step length in px (default 1.5) */
  stepLength?: number;
  /** Max steps per stroke direction (default: enough to cross the canvas) */
  maxSteps?: number;
  /** Minimum stroke length in px (default 4) */
  minLineLength?: number;

  /** Hand-drawn wobble amplitude in px; 0 disables (default 0.8) */
  wobble?: number;

  /**
   * Emphasize detailed/textured regions: flat areas get sparser, lighter,
   * looser strokes. 0 disables, 1 is maximum effect (default 0.3)
   */
  detailEmphasis?: number;
  /**
   * Concentrate rendering detail around one or more focal points (a region
   * keeps detail if it is near any of them)
   */
  focus?: FocusOptions | FocusOptions[];
  /**
   * Subject mask (bright = important), e.g. from an ML segmenter. Any
   * resolution; it is stretched over the full canvas
   */
  subjectMask?: GrayscaleImage;
  /** How strongly the mask suppresses the background, 0-1 (default 1) */
  maskStrength?: number;

  /**
   * Face geometry for portrait-aware rendering: skin is lightened so paper
   * does the work, facial features keep full detail, and feature polylines
   * are drawn as clean strokes (see PortraitOptions)
   */
  portrait?: PortraitOptions;

  /**
   * Estimated depth map (bright = near), e.g. from a monocular depth
   * model. Stroke orientation follows the 3D form, strokes terminate at
   * depth discontinuities, and contours trace silhouettes
   */
  depthMap?: GrayscaleImage;
  /** How strongly depth steers stroke orientation, 0-1 (default 0.8) */
  formStrength?: number;
  /**
   * External direction field (e.g. from a surface-normal map estimated by
   * DSINE/StableNormal); vector magnitude is the blend weight
   */
  flowMap?: DirectionMap;
  /**
   * Fade far regions toward paper based on depth, 0-1. Only applies when
   * the scene has meaningful depth separation (default 0.5)
   */
  depthIsolation?: number;

  /**
   * Chain nearly-touching strokes and order them to minimize pen-up
   * travel — faster plots, fewer pen lifts (default true)
   */
  optimize?: boolean;

  /**
   * Emphasis passes for contour outlines: the same single pen draws the
   * outline this many times with slight offsets, building a bold line
   * the way an artist does — no thick pen required (default 2)
   */
  outlinePasses?: number;

  /**
   * Choose mark-making per region automatically the way an illustrator
   * does: short cross-contour marks wrap curved 3D forms (needs a depth
   * map), directional ticks render texture, and everything else gets
   * flowing hatch lines (default false)
   */
  autoStyle?: boolean;
}

/**
 * Angle offsets (degrees) for successive hatch layers. Kept shallow
 * (~30° apart, slightly irregular): near-perpendicular cross-hatch weaves
 * into a mechanical screen, while shallow crossings read as a hand
 * working over the same shadow
 */
const LAYER_ANGLES = [0, 31, -27, 62];

/** A point may not be drawn closer than this fraction of local spacing to another stroke */
const D_TEST = 0.72;
/** A new seed must be at least this fraction of local spacing from existing strokes */
const D_SEED = 0.95;

interface PassConfig {
  angleOffset: number;
  isDrawable: (x: number, y: number) => boolean;
  spacingAt: (x: number, y: number) => number;
  stepLength: number;
  maxSteps: number;
  margin: number;
  minLineLength: number;
  seedSpacing: number;
  /** Resolve per-stroke style (direction, length budget) at the seed */
  paramsFor: (x: number, y: number, random: () => number) => StrokeParams;
}

/** Per-stroke parameters resolved at the seed */
interface StrokeParams {
  angleOffset: number;
  maxArcLength: number;
  /** Place a stipple dot instead of tracing a stroke */
  dot?: boolean;
  /**
   * Spacing to the next dot, px. Stipple density carries the tone by
   * itself, so it needs a far tighter curve than hatch line spacing
   */
  dotSpacing?: number;
  /** Trace at this constant absolute direction instead of following the field */
  fixedAngle?: number;
  /** Extra per-step termination test (e.g. the stroke left its facet) */
  stopAt?: (x: number, y: number) => boolean;
  /** Random heading drift per integration step, radians (scribble) */
  headingJitter?: number;
  /** Per-stroke random source for heading drift */
  rand?: () => number;
}

/**
 * Mark grid cells in the reserved-white halo beside long contours. The
 * halo is one-sided and contrast-gated: at each contour point the tone is
 * sampled a little way out on both sides, and only a genuine tonal step —
 * a silhouette against a differently-toned region — stamps a halo, on the
 * darker side, where hatching would otherwise crash into the line. Edges
 * inside an evenly-toned mass (architectural detail, fur, foliage) leave
 * no halo, so the mass keeps its tone.
 */
function buildHaloMask(
  contours: Point[][],
  width: number,
  height: number,
  radius: number,
  minContourLength: number,
  darknessAt: (x: number, y: number) => number
): (x: number, y: number) => boolean {
  const cell = Math.max(1, radius / 2);
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const grid = new Uint8Array(cols * rows);

  // Tone probes sit beyond the halo itself so they read the masses on
  // either side, not the edge's own gradient skirt
  const probe = Math.max(radius * 2.5, 5);
  const minStep = 0.12;

  for (const points of contours) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    // Short fragments (texture flecks, broken background edges) don't
    // earn a halo — only lines long enough to read as silhouettes
    if (length < minContourLength) continue;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const ahead = points[Math.min(i + 1, points.length - 1)];
      const behind = points[Math.max(i - 1, 0)];
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const tlen = Math.hypot(tx, ty);
      if (tlen < 1e-9) continue;
      const nx = -ty / tlen;
      const ny = tx / tlen;

      const dA = darknessAt(p.x + nx * probe, p.y + ny * probe);
      const dB = darknessAt(p.x - nx * probe, p.y - ny * probe);
      if (Math.abs(dA - dB) < minStep) continue;

      // Stamp a disk just off the line on the darker side — the gap
      // shows where tone work approaches the silhouette
      const side = dA > dB ? 1 : -1;
      const cx0 = p.x + nx * side * radius * 0.7;
      const cy0 = p.y + ny * side * radius * 0.7;

      const c0 = Math.max(0, Math.floor((cx0 - radius) / cell));
      const c1 = Math.min(cols - 1, Math.floor((cx0 + radius) / cell));
      const r0 = Math.max(0, Math.floor((cy0 - radius) / cell));
      const r1 = Math.min(rows - 1, Math.floor((cy0 + radius) / cell));
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const dx = (cx + 0.5) * cell - cx0;
          const dy = (cy + 0.5) * cell - cy0;
          if (dx * dx + dy * dy <= radius * radius) grid[cy * cols + cx] = 1;
        }
      }
    }
  }

  return (x: number, y: number): boolean => {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cell)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cell)));
    return grid[cy * cols + cx] === 1;
  };
}

/**
 * Build the importance sampler in [0, 1]: 1 = render with full detail,
 * 0 = fade toward blank paper. Sources (auto detail, focal point, subject
 * mask) compose multiplicatively — each can only demote a region.
 */
function buildImportance(
  field: ImageField,
  width: number,
  height: number,
  options: PenInkOptions
): ((x: number, y: number) => number) | null {
  const detailEmphasis = Math.max(0, Math.min(1, options.detailEmphasis ?? 0.3));
  const mask = options.subjectMask;
  const maskStrength = Math.max(0, Math.min(1, options.maskStrength ?? 1));

  const focusList = (Array.isArray(options.focus) ? options.focus : options.focus ? [options.focus] : [])
    .map((f) => ({
      x: f.x,
      y: f.y,
      radius: f.radius,
      falloff: Math.max(1, f.falloff ?? f.radius),
      strength: Math.max(0, Math.min(1, f.strength ?? 0.85)),
    }))
    .filter((f) => f.strength > 0);

  // Depth-based isolation: fade far regions toward paper, but only when
  // the scene actually has meaningful depth separation
  const depthIsolation = Math.max(0, Math.min(1, options.depthIsolation ?? 0.5));
  let depthRemap: ((x: number, y: number) => number) | null = null;
  if (options.depthMap && depthIsolation > 0) {
    const data = options.depthMap.data;
    const stride = Math.max(1, Math.floor(data.length / 5000));
    const sample: number[] = [];
    for (let i = 0; i < data.length; i += stride) sample.push(data[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.15)];
    const hi = sample[Math.floor(sample.length * 0.85)];

    if (hi - lo > 0.15) {
      const range = hi - lo;
      depthRemap = (x: number, y: number): number => {
        const t = Math.max(0, Math.min(1, (field.getDepth(x, y) - lo) / range));
        const near = t * t * (3 - 2 * t); // smoothstep
        return 1 - depthIsolation * (1 - near);
      };
    }
  }

  const useDetail = detailEmphasis > 0;
  const useFocus = focusList.length > 0;
  const useMask = !!mask && maskStrength > 0;
  const useDepth = !!depthRemap;

  if (!useDetail && !useFocus && !useMask && !useDepth) return null;

  const maskScaleX = mask ? mask.width / width : 0;
  const maskScaleY = mask ? mask.height / height : 0;

  return (x: number, y: number): number => {
    let importance = 1;

    if (useDetail) {
      importance *= 1 - detailEmphasis * (1 - field.getDetail(x, y));
    }

    if (useFocus) {
      // A region keeps detail if it is near any focal point
      let best = 0;
      for (const f of focusList) {
        const dist = Math.hypot(x - f.x, y - f.y);
        const t = Math.max(0, Math.min(1, (dist - f.radius) / f.falloff));
        const fade = t * t * (3 - 2 * t); // smoothstep
        best = Math.max(best, 1 - f.strength * fade);
        if (best >= 1) break;
      }
      importance *= best;
    }

    if (useMask && mask) {
      const m = sampleBilinear(mask, x * maskScaleX, y * maskScaleY);
      importance *= 1 - maskStrength * (1 - m);
    }

    if (depthRemap) {
      importance *= depthRemap(x, y);
    }

    return importance;
  };
}

/**
 * Render a grayscale image as pen-and-ink style strokes.
 *
 * Tone is built up from layers of evenly-spaced streamlines traced through
 * the image's contour orientation field; local stroke spacing tightens with
 * darkness, additional layers cross-hatch the shadows, and strong edges are
 * traced as outlines. Optionally applies a hand-drawn wobble at the end.
 */
export function imageToPenInk(
  image: GrayscaleImage,
  options: PenInkOptions = {}
): FlowLinesResult {
  const width = options.width ?? 800;
  const height = options.height ?? Math.max(1, Math.round((width * image.height) / image.width));
  const margin = options.margin ?? 20;
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);

  const layers = Math.max(1, Math.min(4, Math.round(options.layers ?? 3)));
  const minSpacing = options.minSpacing ?? 2.5;
  const maxSpacing = Math.max(options.maxSpacing ?? 14, minSpacing + 0.1);
  const whiteCutoff = options.whiteCutoff ?? 0.08;
  const toneGamma = options.toneGamma ?? 1;

  const stepLength = options.stepLength ?? 1.5;
  const maxSteps = options.maxSteps ?? Math.ceil((Math.max(width, height) * 1.5) / stepLength);
  const minLineLength = options.minLineLength ?? 4;

  const drawOutlines = options.drawOutlines ?? true;
  const outlineThreshold = options.outlineThreshold ?? 0.35;
  const textureStrokes = Math.max(0, Math.min(1, options.textureStrokes ?? 0.6));
  const textureStyle = options.textureStyle ?? 'ticks';
  const skyStipple = options.skyStipple ?? false;
  const richBlacks = options.richBlacks ?? true;
  const valueBands = Math.round(options.valueBands ?? 0);
  const hatchPatchiness = Math.max(0, Math.min(1, options.hatchPatchiness ?? 0.35));
  const facetHatch = options.facetHatch ?? false;
  const crossContour = options.crossContour ?? false;
  const maxStrokeLength = options.maxStrokeLength ?? 0;
  const autoStyle = options.autoStyle ?? false;

  const wobble = options.wobble ?? 0.8;

  const field = new ImageField(image, {
    width,
    height,
    workingSize: options.workingSize,
    fieldSmoothing: options.fieldSmoothing,
    hatchAngle: ((options.hatchAngle ?? -45) * Math.PI) / 180,
    followTone: options.followTone,
    normalizeContrast: options.normalizeContrast,
    depthMap: options.depthMap,
    formStrength: options.formStrength,
    flowMap: options.flowMap,
    valueBands,
  });

  const baseImportance = buildImportance(field, width, height, options);
  const portraitMaps = options.portrait
    ? buildPortraitMaps(options.portrait, width, height)
    : null;

  // Facial features keep full rendering detail regardless of what the
  // other importance sources decided
  const importance =
    portraitMaps?.feature && baseImportance
      ? (x: number, y: number): number => {
          const boost = portraitMaps.featureBoost * portraitMaps.feature!(x, y);
          return Math.max(baseImportance(x, y), Math.min(1, boost));
        }
      : baseImportance;

  // Skin inside face ovals is lightened toward paper — ink artists let
  // paper do the skin and reserve hatching for shadow planes — but the
  // features themselves keep their tone
  const skinFactor =
    portraitMaps?.skin && portraitMaps.skinLightening > 0
      ? (x: number, y: number): number => {
          const feature = portraitMaps.feature ? portraitMaps.feature(x, y) : 0;
          const skin = portraitMaps.skin!(x, y) * (1 - feature);
          return 1 - portraitMaps.skinLightening * skin;
        }
      : null;

  // With a value plan, the posterized mass tone decides the band a region
  // sits in; a little raw tone keeps marks alive within each band
  const bandedTone = field.hasMassTone()
    ? (x: number, y: number): number =>
        0.75 * field.getMassDarkness(x, y) + 0.25 * field.getDarkness(x, y)
    : (x: number, y: number): number => field.getDarkness(x, y);

  // Counterchange: tone deepens where a dark mass borders a lighter one
  // and relaxes in the interior, so subjects sit against a swell of
  // background tone instead of an even wash
  const counterchange = Math.max(0, Math.min(1, options.counterchange ?? 0.5));
  const toneAt =
    counterchange > 0
      ? (x: number, y: number): number =>
          Math.min(1, bandedTone(x, y) + counterchange * field.getCounterBoost(x, y))
      : bandedTone;

  const baseDarkness = skinFactor
    ? (x: number, y: number): number => toneAt(x, y) * skinFactor(x, y)
    : toneAt;

  // Where importance drops, tone is lightened toward paper, the white
  // cutoff rises, and stroke spacing opens up — backgrounds dissolve into
  // a few loose gestures instead of competing with the subject.
  const effectiveDarkness = (x: number, y: number, imp: number): number =>
    baseDarkness(x, y) * (0.25 + 0.75 * imp);

  // Sky tone is judged on raw photo tone, never the banded value plan
  // (quantization rounds a grey sky to paper or a hatch band — both kill
  // the stipple window) — and the ABSOLUTE pre-normalization tone is
  // folded in: an overcast sky is usually the brightest region in the
  // frame, so contrast stretching maps it to paper, but the artist's
  // judgment "this sky is grey, not white" doesn't depend on the rest
  // of the photo
  const skyDark = (x: number, y: number): number =>
    Math.max(field.getDarkness(x, y), field.getAbsoluteDarkness(x, y));

  const skyEligible = skyStipple
    ? (x: number, y: number): boolean =>
        field.getDetail(x, y) < 0.25 &&
        field.getFormConfidence(x, y) < 0.3 &&
        skyDark(x, y) < 0.62
    : null;

  // A sky stipples once it is perceptibly grey; raising the white cutoff
  // can still push it back to paper, but importance cannot blank it —
  // smooth skies always score low on auto-detail and always sit at the
  // far end of depth maps, and the sky is a feature, not a background
  const skyThreshold = Math.max(0.12, whiteCutoff * 0.85);

  // Contours are traced before any tone work: they are both the drawn
  // outlines and the source of the reserved-white halos that hold
  // hatching off the silhouettes
  const contourHalo = Math.max(0, options.contourHalo ?? 2.2);
  const contours =
    drawOutlines || contourHalo > 0
      ? traceContours(field, {
          highThreshold: outlineThreshold,
          lowThreshold: outlineThreshold * 0.4,
          minLength: Math.max(minLineLength * 3, 14),
          stepLength: Math.min(stepLength, 2),
          margin,
          importance,
          // Busy regions demand longer commitment: a city block or a
          // pile of croissants shatters into outline confetti if every
          // 15px edge gets traced — real ink work draws a few long
          // committed lines there and lets tone carry the rest
          minLengthScale: (x: number, y: number): number =>
            1 + 2.5 * field.getDetail(x, y),
        })
      : [];

  const haloAt =
    contourHalo > 0 && contours.length > 0
      ? buildHaloMask(
          contours,
          width,
          height,
          contourHalo,
          Math.max(36, minLineLength * 5),
          baseDarkness
        )
      : null;

  // Facet geometry: the flow direction snapped to 30° quanta, combined
  // with a coarse noise-jittered cell lattice and a per-cell ±1 quantum
  // twist. Within a facet every stroke shares one straight direction;
  // crossing into a neighbouring facet changes the id, which terminates
  // the stroke — parallel marks laid patch by patch, the way a hand
  // hatches a rock face, instead of streamlines bending smoothly
  const FACET_BIN = Math.PI / 6;
  const facetCell = maxSpacing * 5;
  const facetNoise = facetHatch ? createNoise(seed + 6011) : null;
  const facetAt = (x: number, y: number): { angle: number; id: number } => {
    const jx = facetNoise!.noise2D(x / (facetCell * 2.7), y / (facetCell * 2.7));
    const jy = facetNoise!.noise2D(x / (facetCell * 2.7) + 31.7, y / (facetCell * 2.7) - 17.3);
    const cx = Math.floor((x + jx * facetCell * 0.6) / facetCell);
    const cy = Math.floor((y + jy * facetCell * 0.6) / facetCell);
    const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453;
    const twist = Math.round((h - Math.floor(h) - 0.5) * 2);
    const bin = Math.round(field.getOrientation(x, y) / FACET_BIN) + twist;
    return { angle: bin * FACET_BIN, id: bin * 7919 + cx * 131 + cy * 13007 };
  };

  const lines: FlowLine[] = [];

  // Tone layers: layer i only hatches where darkness exceeds its threshold,
  // so shadows accumulate cross-hatched coverage.
  for (let layer = 0; layer < layers; layer++) {
    const threshold = whiteCutoff + (layer / layers) * (0.92 - whiteCutoff);
    const angleOffset =
      (LAYER_ANGLES[layer] * Math.PI) / 180 + (crossContour ? Math.PI / 2 : 0);

    const spacingAt = (x: number, y: number): number => {
      let d = baseDarkness(x, y);
      let spacingScale = 1;

      if (importance) {
        const imp = importance(x, y);
        d = effectiveDarkness(x, y, imp);
        spacingScale = 1 + (1 - imp) * 0.6;
      }

      const u = Math.min(1, Math.max(0, (d - whiteCutoff) / (1 - whiteCutoff)));
      const t = Math.pow(u, toneGamma);
      let spacing = (maxSpacing + (minSpacing - maxSpacing) * t) * spacingScale;

      // Deep shadows commit to near-solid black instead of plateauing at
      // the regular minimum spacing. The ramp starts early enough that
      // the darkest value band actually reaches it — real ink work
      // anchors on a few solid black masses, not a uniform dark grey
      if (richBlacks && d > 0.72) {
        const deep = Math.min(1, (d - 0.72) / 0.2);
        spacing *= 1 - 0.62 * deep;
      }

      return spacing;
    };

    const bandedDrawable = importance
      ? (x: number, y: number): boolean => {
          const imp = importance(x, y);
          return effectiveDarkness(x, y, imp) >= threshold + (1 - imp) * 0.25;
        }
      : (x: number, y: number): boolean => baseDarkness(x, y) >= threshold;

    // In sky, raw tone decides drawability (base layer only — deeper
    // layers still add density where the value plan calls for it).
    // Importance is deliberately left out: it lightens the stipple via
    // wider dot spacing instead of blanking the sky
    const skyDrawable =
      skyEligible && layer === 0
        ? (x: number, y: number): boolean =>
            skyEligible(x, y) && skyDark(x, y) >= skyThreshold
        : null;

    const toneDrawable = skyDrawable
      ? (x: number, y: number): boolean => bandedDrawable(x, y) || skyDrawable(x, y)
      : bandedDrawable;

    // Cross-hatch layers accumulate in hand-sized patches separated by
    // gaps — strokes seed inside a patch and stop at its edge — instead
    // of weaving a continuous screen. The base layer stays continuous so
    // overall tone holds; each deeper layer gets patchier.
    const patchNoise =
      layer >= 1 && hatchPatchiness > 0 ? createNoise(seed + layer * 7919 + 31337) : null;
    const patchFreq = 1 / (maxSpacing * 4);
    const patchCut = -1 + hatchPatchiness * (0.55 + 0.4 * (layer - 1));
    // Saturated blacks skip the patch gaps: a committed dark mass reads
    // as solid ink, not as worked-over patches with paper showing through
    const patchedDrawable = patchNoise
      ? (x: number, y: number): boolean =>
          (patchNoise.noise2D(x * patchFreq, y * patchFreq) > patchCut ||
            (richBlacks && baseDarkness(x, y) > 0.85)) &&
          toneDrawable(x, y)
      : toneDrawable;

    // Tone marks (hatch lines and stipple dots alike) stop short of long
    // contours, leaving the reserved-white sliver; strokes that wander
    // into a halo terminate there
    const isDrawable = haloAt
      ? (x: number, y: number): boolean => !haloAt(x, y) && patchedDrawable(x, y)
      : patchedDrawable;

    // Busy regions (fur, foliage, fabric) read as texture, not form —
    // render them with short directional ticks instead of long streamlines
    const textureAmount =
      textureStrokes > 0
        ? (x: number, y: number): number => {
            const d = field.getDetail(x, y);
            const t = Math.min(1, Math.max(0, (d - 0.25) / 0.45));
            return t * t * (3 - 2 * t) * textureStrokes;
          }
        : null;

    const longest = maxSteps * stepLength;
    const crossCap = maxSpacing * 3.5;
    const layerAngle = angleOffset;

    // Per-stroke style dispatch, resolved at each seed:
    //   ticks for texture, capped cross-contour marks wrapping curved 3D
    //   forms (autoStyle + depth), flowing hatch lines everywhere else
    const paramsFor = (x: number, y: number, random: () => number): StrokeParams => {
      const texture = textureAmount ? textureAmount(x, y) : 0;

      // Open skies and soft gradients: smooth, featureless, light-mid tone.
      // Dots render them the way illustrators do, with cloud highlights
      // left as paper by the white cutoff.
      if (skyEligible && texture < 0.25 && skyEligible(x, y)) {
        // Stipple carries the sky's tone entirely on dot density, so it
        // gets its own spacing curve, much tighter than hatch spacing;
        // density also falls off zenith-to-horizon the way hand-stippled
        // skies are graded. Raw tone drives the gradation — banded tone
        // is flat across a band, which kills the grade.
        const d = skyDark(x, y);
        const t = Math.min(1, Math.max(0, (d - skyThreshold) / (0.62 - skyThreshold)));
        let dotSpacing =
          maxSpacing * 0.5 + (minSpacing * 1.1 - maxSpacing * 0.5) * Math.sqrt(t);
        dotSpacing *= 0.8 + 0.5 * (y / height);
        if (importance) {
          dotSpacing *= 1 + (1 - importance(x, y)) * 1.2;
        }
        return {
          angleOffset: 0,
          maxArcLength: 0,
          dot: true,
          dotSpacing: Math.max(2.2, dotSpacing),
        };
      }
      let cap = maxStrokeLength > 0 ? maxStrokeLength * (0.8 + 0.4 * random()) : Infinity;
      let rotate = 0;

      // Toned masses without strong texture or 3D form get faceted
      // hatching: one straight direction per patch, stroke ends at the
      // patch border (texture keeps its ticks/scribble, curved depth
      // forms keep their wrapping cross-contour marks)
      if (
        facetHatch &&
        texture < 0.35 &&
        field.getFormConfidence(x, y) < 0.5 &&
        baseDarkness(x, y) >= 0.25
      ) {
        const facet = facetAt(x, y);
        return {
          angleOffset: 0,
          fixedAngle: facet.angle + layerAngle,
          maxArcLength: Math.min(cap, maxSpacing * (5 + 3 * random())),
          stopAt: (px: number, py: number): boolean => facetAt(px, py).id !== facet.id,
        };
      }

      if (
        autoStyle &&
        !crossContour &&
        texture < 0.45 &&
        field.getFormConfidence(x, y) > 0.5
      ) {
        rotate = Math.PI / 2;
        cap = Math.min(cap, crossCap * (0.8 + 0.4 * random()));
      }

      if (texture > 0.01) {
        if (textureStyle === 'stipple' && texture > 0.3) {
          return { angleOffset: 0, maxArcLength: 0, dot: true };
        }

        if (textureStyle === 'scribble' && texture > 0.3) {
          return {
            angleOffset: layerAngle * (1 - 0.8 * texture) + rotate,
            maxArcLength: Math.min(cap, maxSpacing * 12),
            headingJitter: 0.35 * texture,
            rand: random,
          };
        }

        const tick = maxSpacing * 0.9 * (0.7 + 0.6 * random());
        return {
          angleOffset:
            layerAngle * (1 - 0.8 * texture) + (random() - 0.5) * 0.5 * texture + rotate,
          // Geometric interpolation: stroke length spans orders of
          // magnitude, so a linear blend barely shortens anything
          maxArcLength: Math.min(
            cap,
            Math.exp(Math.log(longest) + (Math.log(tick) - Math.log(longest)) * texture)
          ),
        };
      }

      return { angleOffset: layerAngle + rotate, maxArcLength: cap };
    };

    lines.push(
      ...tracePass(field, seed + layer * 7919, {
        angleOffset,
        isDrawable,
        spacingAt,
        stepLength,
        maxSteps,
        margin,
        minLineLength,
        seedSpacing: Math.max(minSpacing * 2, maxSpacing / 2),
        paramsFor,
      })
    );
  }

  // Contour pass: link edge ridges into long, confident outline strokes —
  // the committed lines an artist draws first. Drawn with the bold pen.
  if (drawOutlines) {
    // Inside detected faces, interior edges (nose shadows, smile creases,
    // jaw shadows) must not become hard lines — artists leave face
    // interiors to tone. Only clearly strong edges survive there, demoted
    // to the fine pen; the face silhouette stays bold.
    const insideFace =
      portraitMaps && (portraitMaps.skin || portraitMaps.feature)
        ? (x: number, y: number): boolean => {
            const s = portraitMaps.skin ? portraitMaps.skin(x, y) : 0;
            const f = portraitMaps.feature ? portraitMaps.feature(x, y) : 0;
            return Math.max(s, f) > 0.6;
          }
        : null;

    const outlinePasses = Math.max(1, Math.min(4, Math.round(options.outlinePasses ?? 2)));

    const polylineLength = (points: Point[]): number => {
      let length = 0;
      for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return length;
    };

    // Only lines long enough to read as committed outlines earn the
    // multi-pass emphasis; short fragments are incident lines drawn once
    const emphasizeFrom = Math.max(48, minLineLength * 6);

    // Bold outlines are built from repeated single-pen passes with a
    // slight perpendicular offset, like an artist thickening a line by
    // drawing over it — every stroke stays plottable with one pen
    const pushEmphasized = (points: Point[]): void => {
      lines.push({ points, pen: 'bold' });
      const spread = 1.1;
      for (let pass = 1; pass < outlinePasses; pass++) {
        const offset = spread * (pass - (outlinePasses - 1) / 2);
        // Emphasis passes are trimmed at both ends so the built-up line
        // tapers like a real ink stroke instead of ending in a blunt bar
        const trimmed = trimPolyline(offsetPolyline(points, offset), 0.12);
        if (trimmed.length >= 2) {
          lines.push({ points: trimmed, pen: 'bold' });
        }
      }
    };

    for (const points of contours) {
      if (!insideFace) {
        if (polylineLength(points) >= emphasizeFrom) {
          pushEmphasized(points);
        } else {
          lines.push({ points, pen: 'bold' });
        }
        continue;
      }

      let run: Point[] = [];
      let runPen: 'fine' | 'bold' | null = null;

      const flush = (): void => {
        if (run.length >= 2 && runPen) {
          let length = 0;
          for (let i = 1; i < run.length; i++) {
            length += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
          }
          if (length >= 8) {
            if (runPen === 'bold' && length >= emphasizeFrom) {
              pushEmphasized(run);
            } else {
              lines.push({ points: run, pen: runPen });
            }
          }
        }
        run = [];
      };

      for (const p of points) {
        let pen: 'fine' | 'bold' | null;
        if (!insideFace(p.x, p.y)) {
          pen = 'bold';
        } else if (field.getEdgeStrength(p.x, p.y) >= outlineThreshold + 0.2) {
          pen = 'fine';
        } else {
          pen = null;
        }

        if (pen !== runPen) {
          flush();
          runPen = pen;
        }
        if (pen) {
          run.push(p);
        }
      }
      flush();
    }
  }

  // Cloud shapes are carved out of stippled skies as deliberate negative
  // space: the boundary of the large-scale tonal mass is traced and inked
  // as a light outline, leaving the interior paper. The edge detector
  // misses these soft transitions entirely; the blurred mass raster makes
  // them big, simple, confident shapes (wobble is applied later, so the
  // outlines pick up the same hand quality as everything else).
  if (skyStipple) {
    const { raster, scaleX, scaleY } = field.getMassRaster();
    // With a value plan, carve along the paper/lightest-band boundary;
    // otherwise just above the white cutoff
    const iso = valueBands >= 2 ? 1 / valueBands : Math.max(whiteCutoff * 1.25, 0.1);
    const minRun = Math.max(minLineLength * 3, 14);

    for (const poly of traceIsoContours(raster, iso)) {
      let run: Point[] = [];
      let runLength = 0;

      const flushRun = (): void => {
        if (run.length >= 2 && runLength >= minRun) {
          lines.push({ points: run });
        }
        run = [];
        runLength = 0;
      };

      for (const rp of poly) {
        const p = { x: rp.x / scaleX, y: rp.y / scaleY };
        // Keep the outline only where it borders stipple-eligible sky;
        // strong edges are already drawn by the contour pass
        const keep =
          field.isInBounds(p.x, p.y, margin) &&
          field.getDetail(p.x, p.y) < 0.3 &&
          field.getFormConfidence(p.x, p.y) < 0.35 &&
          field.getEdgeStrength(p.x, p.y) < outlineThreshold;
        if (!keep) {
          flushRun();
          continue;
        }
        if (run.length > 0) {
          const prev = run[run.length - 1];
          runLength += Math.hypot(p.x - prev.x, p.y - prev.y);
        }
        run.push(p);
      }
      flushRun();
    }
  }

  // Clean feature strokes (eyelids, brows, lip lines) drawn from landmark
  // geometry — accurate feature lines are what make a sketch read as a person
  if (options.portrait?.featureStrokes) {
    const featureLines = featureStrokesToLines(
      options.portrait.featureStrokes,
      width,
      height,
      Math.min(stepLength, 2)
    );
    // Fine pen: feature lines are accents, not cartoon outlines
    for (const points of featureLines) {
      lines.push({ points });
    }
  }

  let result: FlowLinesResult = { lines, width, height, seed };

  if (wobble > 0) {
    result = applyHandDrawnStyle(result, {
      amplitude: wobble,
      seed,
      // Background strokes get visibly shakier than the subject
      amplitudeScale: importance
        ? (x, y) => 1 + (1 - importance(x, y)) * 0.9
        : undefined,
    });
  }

  if (options.optimize ?? true) {
    result = optimizePlot(result);
  }

  return result;
}

/**
 * Trace one evenly-spaced streamline pass (Jobard-Lefer style): seeds spawn
 * beside accepted strokes at the local spacing distance, falling back to a
 * darkest-first grid scan so all regions get covered.
 */
function tracePass(field: ImageField, seed: number, pass: PassConfig): FlowLine[] {
  const lines: FlowLine[] = [];
  const grid = new SpatialGrid(field.width, field.height, Math.max(2, pass.seedSpacing / 2));

  // Simple seeded random for scan jitter
  let s = (seed & 0x7fffffff) || 1;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  // Grid-scan candidates, darkest first so coverage starts in the shadows
  const scanCandidates: { x: number; y: number; d: number }[] = [];
  for (let y = pass.margin; y < field.height - pass.margin; y += pass.seedSpacing) {
    for (let x = pass.margin; x < field.width - pass.margin; x += pass.seedSpacing) {
      const jx = x + (random() - 0.5) * pass.seedSpacing;
      const jy = y + (random() - 0.5) * pass.seedSpacing;
      if (!field.isInBounds(jx, jy, pass.margin)) continue;
      if (!pass.isDrawable(jx, jy)) continue;
      scanCandidates.push({ x: jx, y: jy, d: field.getDarkness(jx, jy) });
    }
  }
  scanCandidates.sort((a, b) => b.d - a.d);

  const candidateStack: Point[] = [];
  let scanIndex = 0;

  for (;;) {
    let candidate: Point | undefined = candidateStack.pop();
    if (!candidate) {
      if (scanIndex >= scanCandidates.length) break;
      candidate = scanCandidates[scanIndex++];
    }

    const params = pass.paramsFor(candidate.x, candidate.y, random);

    if (params.dot) {
      const dot = placeDot(field, grid, candidate, pass, params, random);
      if (dot) {
        lines.push(dot);
        // Spawn neighbours so stippling propagates at the local spacing
        const spacing = params.dotSpacing ?? pass.spacingAt(candidate.x, candidate.y);
        const baseAngle = random() * Math.PI * 2;
        for (let k = 0; k < 4; k++) {
          const a = baseAngle + (k * Math.PI) / 2 + (random() - 0.5) * 0.6;
          candidateStack.push({
            x: candidate.x + Math.cos(a) * spacing * 1.05,
            y: candidate.y + Math.sin(a) * spacing * 1.05,
          });
        }
      }
      continue;
    }

    const line = traceStreamline(field, grid, candidate, pass, params);
    if (!line) continue;

    lines.push(line);

    // Register stroke points and spawn neighbour seeds on both sides
    const spawnEvery = Math.max(1, Math.round(pass.seedSpacing / pass.stepLength));
    for (let i = 0; i < line.points.length; i++) {
      const p = line.points[i];
      grid.insert(p);

      if (i % spawnEvery === 0 && i > 0 && i < line.points.length - 1) {
        const prev = line.points[i - 1];
        const next = line.points[i + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;

        const offset = pass.spacingAt(p.x, p.y) * 1.05;
        const nx = (-dy / len) * offset;
        const ny = (dx / len) * offset;
        candidateStack.push({ x: p.x + nx, y: p.y + ny });
        candidateStack.push({ x: p.x - nx, y: p.y - ny });
      }
    }
  }

  return lines;
}

/**
 * Place a stipple dot (a tiny closed loop the pen can draw in one touch)
 * if the spot is drawable and respects local spacing
 */
function placeDot(
  field: ImageField,
  grid: SpatialGrid,
  at: Point,
  pass: PassConfig,
  params: StrokeParams,
  random: () => number
): FlowLine | null {
  if (!field.isInBounds(at.x, at.y, pass.margin)) return null;
  if (!pass.isDrawable(at.x, at.y)) return null;
  const spacing = params.dotSpacing ?? pass.spacingAt(at.x, at.y);
  if (grid.hasPointWithin(at.x, at.y, spacing * D_SEED)) return null;

  const radius = 0.55 + random() * 0.35;
  const points: Point[] = [];
  const segments = 7;
  const phase = random() * Math.PI * 2;
  for (let i = 0; i <= segments; i++) {
    const t = phase + (i / segments) * Math.PI * 2;
    points.push({ x: at.x + Math.cos(t) * radius, y: at.y + Math.sin(t) * radius });
  }

  grid.insert(at);
  return { points };
}

function traceStreamline(
  field: ImageField,
  grid: SpatialGrid,
  start: Point,
  pass: PassConfig,
  params: StrokeParams
): FlowLine | null {
  if (!field.isInBounds(start.x, start.y, pass.margin)) return null;
  if (!pass.isDrawable(start.x, start.y)) return null;
  if (grid.hasPointWithin(start.x, start.y, pass.spacingAt(start.x, start.y) * D_SEED)) {
    return null;
  }

  const forward = integrate(field, grid, start, pass, params, 1);
  const backward = integrate(field, grid, start, pass, params, -1);

  backward.reverse();
  const points = [...backward, { ...start }, ...forward];

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  if (length < pass.minLineLength) return null;

  return { points };
}

function integrate(
  field: ImageField,
  grid: SpatialGrid,
  start: Point,
  pass: PassConfig,
  params: StrokeParams,
  sign: 1 | -1
): Point[] {
  const points: Point[] = [];
  const h = pass.stepLength;
  const halfSteps = Math.min(
    Math.ceil(pass.maxSteps / 2),
    Math.max(1, Math.ceil(params.maxArcLength / 2 / h))
  );

  let x = start.x;
  let y = start.y;

  const theta0 =
    params.fixedAngle ?? field.getOrientation(x, y) + params.angleOffset;
  let prevDx = Math.cos(theta0) * sign;
  let prevDy = Math.sin(theta0) * sign;

  // Loop guard: steps to skip when checking proximity against own points
  const selfSkip = Math.ceil((pass.spacingAt(start.x, start.y) * 2.5) / h);

  for (let i = 0; i < halfSteps; i++) {
    const theta =
      params.fixedAngle ?? field.getOrientation(x, y) + params.angleOffset;
    let dx = Math.cos(theta);
    let dy = Math.sin(theta);

    // Orientation is pi-periodic — keep the direction consistent
    if (dx * prevDx + dy * prevDy < 0) {
      dx = -dx;
      dy = -dy;
    }

    // Midpoint (RK2) step for smoother curves
    const mx = x + dx * h * 0.5;
    const my = y + dy * h * 0.5;
    if (!field.isInBounds(mx, my, pass.margin)) break;

    const thetaMid =
      params.fixedAngle ?? field.getOrientation(mx, my) + params.angleOffset;
    let mdx = Math.cos(thetaMid);
    let mdy = Math.sin(thetaMid);
    if (mdx * dx + mdy * dy < 0) {
      mdx = -mdx;
      mdy = -mdy;
    }

    if (params.headingJitter && params.rand) {
      const drift = (params.rand() - 0.5) * 2 * params.headingJitter;
      const cd = Math.cos(drift);
      const sd = Math.sin(drift);
      const rx = mdx * cd - mdy * sd;
      const ry = mdx * sd + mdy * cd;
      mdx = rx;
      mdy = ry;
    }

    const nx = x + mdx * h;
    const ny = y + mdy * h;

    if (!field.isInBounds(nx, ny, pass.margin)) break;
    if (!pass.isDrawable(nx, ny)) break;
    if (grid.hasPointWithin(nx, ny, pass.spacingAt(nx, ny) * D_TEST)) break;

    // Strokes stop at depth discontinuities — hatching must not slide
    // across a silhouette onto a different surface
    if (field.getDepthEdge(nx, ny) > 0.45) break;

    // Per-stroke termination, e.g. the stroke crossed its facet border
    if (params.stopAt && params.stopAt(nx, ny)) break;

    // Stop instead of drawing a sharp kink (scribbles may turn harder)
    if (mdx * prevDx + mdy * prevDy < (params.headingJitter ? -0.4 : 0.2)) break;

    // Stop if the stroke curls back onto itself
    if (i % 3 === 0 && points.length > selfSkip) {
      const limit = points.length - selfSkip;
      const minDist = pass.spacingAt(nx, ny) * 0.6;
      let looped = false;
      for (let j = 0; j < limit; j += 2) {
        if (Math.hypot(points[j].x - nx, points[j].y - ny) < minDist) {
          looped = true;
          break;
        }
      }
      if (looped) break;
    }

    points.push({ x: nx, y: ny });
    x = nx;
    y = ny;
    prevDx = mdx;
    prevDy = mdy;
  }

  return points;
}

/**
 * Uniform hash grid for nearest-neighbour distance rejection
 */
class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: Map<number, Point[]> = new Map();

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
  }

  insert(p: Point): void {
    const key = this.keyFor(p.x, p.y);
    const cell = this.cells.get(key);
    if (cell) {
      cell.push(p);
    } else {
      this.cells.set(key, [p]);
    }
  }

  hasPointWithin(x: number, y: number, radius: number): boolean {
    const r = Math.ceil(radius / this.cellSize);
    const col = this.clampCol(Math.floor(x / this.cellSize));
    const row = this.clampRow(Math.floor(y / this.cellSize));
    const radiusSq = radius * radius;

    for (let cy = Math.max(0, row - r); cy <= Math.min(this.rows - 1, row + r); cy++) {
      for (let cx = Math.max(0, col - r); cx <= Math.min(this.cols - 1, col + r); cx++) {
        const cell = this.cells.get(cy * this.cols + cx);
        if (!cell) continue;
        for (const p of cell) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < radiusSq) return true;
        }
      }
    }

    return false;
  }

  private keyFor(x: number, y: number): number {
    return this.clampRow(Math.floor(y / this.cellSize)) * this.cols +
      this.clampCol(Math.floor(x / this.cellSize));
  }

  private clampCol(c: number): number {
    return Math.max(0, Math.min(this.cols - 1, c));
  }

  private clampRow(r: number): number {
    return Math.max(0, Math.min(this.rows - 1, r));
  }
}
