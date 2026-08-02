import { DirectionMap } from '../image-field.js';
import { type PlotOrderOptions } from '../optimize.js';
import { GrayscaleImage } from '../image.js';
import { PortraitOptions } from '../portrait.js';
import { type LabelImage } from '../semantic-map.js';

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

  /**
   * Length scale vs the reference render density (see paper-sizes
   * `pageMetrics`). Multiplies physical lengths — stroke spacing, step length,
   * wobble, halo — so that when the raster is sized to a sheet, *physical*
   * spacing stays constant and line density tracks the sheet's millimetre size
   * (a bigger sheet carries more lines at the same pen width). Default 1, which
   * leaves the pixel-canvas behaviour exactly as before.
   */
  scale?: number;
  /**
   * Frame the drawing onto a larger page. `width`/`height` above stay the
   * drawing's *content* size; `page` is the exported sheet. The rendered marks
   * are translated by (`offsetX`,`offsetY`) and the canvas becomes the page —
   * giving a letterbox border ('fit') or a centred crop ('fill', clipped to
   * the page edge). Omit to draw straight onto the canvas as before.
   */
  page?: { width: number; height: number; offsetX: number; offsetY: number };

  /** Number of hatching layers, 1-5. Darker areas receive more layers (default 3) */
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
   * Composition-aware value massing, 0..1. Before the value plan is banded,
   * tone is *redistributed by compositional role* rather than reproduced
   * from photographic luminance: the ground around a subject swells darker
   * to set it off (figure/ground), values are committed apart from the mid
   * (a few decisive shapes, not a grey wash), and confident skies are held
   * light. Needs valueBands >= 2; subject-ness comes from a subject mask,
   * focal points, or person/object labels. 0 disables (default 0)
   */
  massing?: number;
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
  /** Max dimension of the internal working raster (default 720) */
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
   * of hatching them — the classic illustrated-sky treatment. Unset, it
   * enables itself when a label map says the frame contains sky
   * (default false without labels)
   */
  skyStipple?: boolean;
  /**
   * Render smooth water regions as calm water: long broken horizontal
   * strokes whose spacing carries the tone, with no cross-hatch layered
   * over them — the classic illustrated-sea treatment. With a label map,
   * water is wherever the labels say (any horizon height); without one, a
   * smooth formless region in the lower half of the frame. Unset, it
   * enables itself when labels report water (default false without labels)
   */
  calmWater?: boolean;
  /**
   * Let the darkest tones saturate toward solid black by tightening
   * spacing below minSpacing — committed dark masses instead of uniformly
   * gray cross-hatch (default true)
   */
  richBlacks?: boolean;
  /**
   * Ink the darkest value band as committed solid black: the region is
   * filled with serpentine passes one pen width apart, bounded by
   * concentric boundary passes for a crisp drawn edge, instead of
   * accumulating cross-hatch — the decisive spot blacks of heavy comic
   * ink. Hatch layers treat the region as already inked. Needs
   * valueBands >= 2 to define "darkest band"; regions smaller than a
   * hand-sized patch stay hatched (default false)
   */
  solidBlacks?: boolean;
  /**
   * Distance between solid-fill passes in output px — set it slightly
   * tighter than the plotted pen width so passes overlap into true solid
   * (the standard plotter fill practice): wider leaves paper streaks
   * through the black, much tighter soaks the paper. Absolute, not
   * multiplied by `scale` — pen width is a physical property. Solid fill
   * is pen-time expensive by nature (default 0.9 at the reference render
   * density, scaled with the sheet)
   */
  fillSpacing?: number;
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
   * Swelling line weight, 0-1 — the engraver's tool: where a hatch line
   * passes through shadow it thickens (extra offset passes of the same
   * pen, tapering back to a single line in the light), and stroke spacing
   * opens up in compensation so shadow tone is carried by fewer, heavier
   * lines. 0 disables (default 0)
   */
  lineSwell?: number;
  /**
   * Cap on hatch stroke length in px — short strokes read as individually
   * placed marks rather than traced streamlines. 0 = unlimited (default 0)
   */
  maxStrokeLength?: number;
  /**
   * Continuous scribble as the tone engine, 0-1 — ballpoint shading: one
   * long meandering line per carrier band whose loop density carries the
   * tone (tight curls in shadow, lazy waves in light, pen lifted in the
   * highlights). Replaces the hatch layers entirely when > 0; contours,
   * halos, portrait work, and the value plan still apply (default 0)
   */
  scribbleTone?: number;

  /** Integration step length in px (default 1.5) */
  stepLength?: number;
  /** Max steps per stroke direction (default: enough to cross the canvas) */
  maxSteps?: number;
  /** Minimum stroke length in px (default 4) */
  minLineLength?: number;

  /** Hand-drawn wobble amplitude in px; 0 disables (default 0.8) */
  wobble?: number;

  /**
   * Stroke economy budget — the sumi-e discipline. Total drawn length is
   * capped at this multiple of the canvas diagonal; strokes are ranked by
   * how much they say (length × importance × edge presence, contours
   * counting extra) and only the best survive, coherence-aware so the
   * kept gesture clusters instead of stranding confetti. Scale-robust
   * because it is length-based. 0 disables (default 0)
   */
  strokeBudget?: number;
  /**
   * Total pen passes per surviving long stroke when the economy budget is
   * active: >1 thickens survivors into fat, pressure-tapered brush
   * strokes built from offset passes of the same pen (default 1)
   */
  strokeWeight?: number;

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
   * Semantic region labels (see SEMANTIC_LABELS for the taxonomy), e.g.
   * from an ML scene segmenter. Where a label is confident it replaces
   * the geometric heuristics: calm water follows the water label at any
   * horizon height, sky stipple follows the sky label, foliage keeps its
   * texture instead of collapsing to flat masses, building facets snap to
   * architectural verticals/horizontals, and people hold full importance.
   * Without labels every heuristic behaves exactly as before
   */
  labelMap?: LabelImage;

  /**
   * Chain nearly-touching strokes and order them to minimize pen-up
   * travel — faster plots, fewer pen lifts (default true)
   */
  optimize?: boolean;

  /**
   * Ordering strategy when optimizing. Non-travel modes order strokes
   * along a spatial ramp so physical pen wear lands as a composed
   * gradient across the sheet (see `PlotOrderOptions`); default travel.
   */
  order?: PlotOrderOptions;

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
export const LAYER_ANGLES = [0, 31, -27, 62, -58];

/** A point may not be drawn closer than this fraction of local spacing to another stroke */
export const D_TEST = 0.72;
/** A new seed must be at least this fraction of local spacing from existing strokes */
export const D_SEED = 0.95;
