import { FlowLine, FlowLinesResult, Point } from './flow-lines.js';
import { ImageField } from './image-field.js';
import { GrayscaleImage, sampleBilinear } from './image.js';
import { applyHandDrawnStyle } from './hand-drawn.js';
import {
  PortraitOptions,
  buildPortraitMaps,
  featureStrokesToLines,
} from './portrait.js';
import { traceContours } from './contours.js';

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
   * Render textured regions (fur, foliage, fabric) with short directional
   * tick strokes instead of long streamlines — 0 disables, 1 is maximum
   * (default 0.6)
   */
  textureStrokes?: number;

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
   * Fade far regions toward paper based on depth, 0-1. Only applies when
   * the scene has meaningful depth separation (default 0.5)
   */
  depthIsolation?: number;
}

/** Angle offsets (degrees) for successive hatch layers */
const LAYER_ANGLES = [0, 75, -40, 105];

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
  /**
   * Local texture amount in [0, 1]; textured strokes become short
   * directional ticks with angle jitter, like fur or fabric marks
   */
  textureAt?: (x: number, y: number) => number;
  /** Target tick length in textured areas, px */
  tickLength?: number;
  /** Global cap on stroke arc length for this pass, px */
  maxArcLength?: number;
}

/** Per-stroke parameters resolved at the seed (texture shortens strokes) */
interface StrokeParams {
  angleOffset: number;
  maxArcLength: number;
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
  const crossContour = options.crossContour ?? false;
  const maxStrokeLength = options.maxStrokeLength ?? 0;

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

  const baseDarkness = skinFactor
    ? (x: number, y: number): number => field.getDarkness(x, y) * skinFactor(x, y)
    : (x: number, y: number): number => field.getDarkness(x, y);

  // Where importance drops, tone is lightened toward paper, the white
  // cutoff rises, and stroke spacing opens up — backgrounds dissolve into
  // a few loose gestures instead of competing with the subject.
  const effectiveDarkness = (x: number, y: number, imp: number): number =>
    baseDarkness(x, y) * (0.25 + 0.75 * imp);

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
      return (maxSpacing + (minSpacing - maxSpacing) * t) * spacingScale;
    };

    const isDrawable = importance
      ? (x: number, y: number): boolean => {
          const imp = importance(x, y);
          return effectiveDarkness(x, y, imp) >= threshold + (1 - imp) * 0.25;
        }
      : (x: number, y: number): boolean => baseDarkness(x, y) >= threshold;

    // Busy regions (fur, foliage, fabric) read as texture, not form —
    // render them with short directional ticks instead of long streamlines
    const textureAt =
      textureStrokes > 0
        ? (x: number, y: number): number => {
            const d = field.getDetail(x, y);
            const t = Math.min(1, Math.max(0, (d - 0.25) / 0.45));
            return t * t * (3 - 2 * t) * textureStrokes;
          }
        : undefined;

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
        textureAt,
        tickLength: maxSpacing * 0.9,
        maxArcLength: maxStrokeLength > 0 ? maxStrokeLength : undefined,
      })
    );
  }

  // Contour pass: link edge ridges into long, confident outline strokes —
  // the committed lines an artist draws first. Drawn with the bold pen.
  if (drawOutlines) {
    const contours = traceContours(field, {
      highThreshold: outlineThreshold,
      lowThreshold: outlineThreshold * 0.4,
      minLength: Math.max(minLineLength * 3, 14),
      stepLength: Math.min(stepLength, 2),
      margin,
      importance,
    });

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

    for (const points of contours) {
      if (!insideFace) {
        lines.push({ points, pen: 'bold' });
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
            lines.push({ points: run, pen: runPen });
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

    // In textured regions strokes become short ticks: random length around
    // tickLength, angle jittered, and cross-hatch offsets collapse toward
    // the local orientation (fur is layered in one direction, not crossed)
    const texture = pass.textureAt ? pass.textureAt(candidate.x, candidate.y) : 0;
    // Pass-level cap (with per-stroke variation, so cut ends don't align)
    const passCap = pass.maxArcLength
      ? pass.maxArcLength * (0.8 + 0.4 * random())
      : Infinity;

    let params: StrokeParams;
    if (texture > 0.01) {
      const tick = (pass.tickLength ?? 12) * (0.7 + 0.6 * random());
      const longest = pass.maxSteps * pass.stepLength;
      params = {
        angleOffset:
          pass.angleOffset * (1 - 0.8 * texture) + (random() - 0.5) * 0.5 * texture,
        // Geometric interpolation: stroke length spans orders of magnitude,
        // so a linear blend would barely shorten anything until texture ≈ 1
        maxArcLength: Math.min(
          passCap,
          Math.exp(Math.log(longest) + (Math.log(tick) - Math.log(longest)) * texture)
        ),
      };
    } else {
      params = { angleOffset: pass.angleOffset, maxArcLength: passCap };
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

  const theta0 = field.getOrientation(x, y) + params.angleOffset;
  let prevDx = Math.cos(theta0) * sign;
  let prevDy = Math.sin(theta0) * sign;

  // Loop guard: steps to skip when checking proximity against own points
  const selfSkip = Math.ceil((pass.spacingAt(start.x, start.y) * 2.5) / h);

  for (let i = 0; i < halfSteps; i++) {
    const theta = field.getOrientation(x, y) + params.angleOffset;
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

    const thetaMid = field.getOrientation(mx, my) + params.angleOffset;
    let mdx = Math.cos(thetaMid);
    let mdy = Math.sin(thetaMid);
    if (mdx * dx + mdy * dy < 0) {
      mdx = -mdx;
      mdy = -mdy;
    }

    const nx = x + mdx * h;
    const ny = y + mdy * h;

    if (!field.isInBounds(nx, ny, pass.margin)) break;
    if (!pass.isDrawable(nx, ny)) break;
    if (grid.hasPointWithin(nx, ny, pass.spacingAt(nx, ny) * D_TEST)) break;

    // Strokes stop at depth discontinuities — hatching must not slide
    // across a silhouette onto a different surface
    if (field.getDepthEdge(nx, ny) > 0.45) break;

    // Stop instead of drawing a sharp kink
    if (mdx * prevDx + mdy * prevDy < 0.2) break;

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
