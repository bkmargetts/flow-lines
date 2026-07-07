import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { ImageField } from '../image-field.js';
import { GrayscaleImage, sampleBilinear } from '../image.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import {
  buildPortraitMaps,
  featureStrokesToLines,
} from '../portrait.js';
import { traceContours } from '../contours.js';
import { traceIsoContours } from '../iso-contours.js';
import { optimizePlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { SemanticMap } from '../semantic-map.js';
import { composeMassPlan } from '../value-plan.js';
import { randomSeed } from '../lib/rng.js';
import { PenInkOptions, LAYER_ANGLES } from './options.js';
import { planSolidFill } from './fill.js';
import { applyLineSwell, offsetEmphasisPasses, swellPassCount, swellPasses } from './swell.js';
import { scribblePass } from './scribble.js';
import { buildHaloMask, buildImportance } from './masks.js';
import { tracePass, type StrokeParams } from './streamline.js';
import { frameOntoPage } from './frame.js';

export type { PenInkOptions, FocusOptions } from './options.js';
export { PEN_INK_STYLES, resolvePenInkStyle } from './styles/index.js';
export type { PenInkStyle } from './styles/index.js';

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
  // Physical-length scale: when the canvas is sized to a paper sheet, lengths
  // expressed at the reference density are scaled so physical spacing holds.
  const scale = Math.max(1e-3, options.scale ?? 1);
  const margin = (options.margin ?? 20) * scale;
  const seed = options.seed ?? randomSeed();

  // Scene labels, when provided, replace the geometric heuristics below
  // wherever they are confident; with no label map every gate falls back
  // to its heuristic unchanged
  const semantic = options.labelMap ? new SemanticMap(options.labelMap, width, height) : null;

  const layers = Math.max(1, Math.min(5, Math.round(options.layers ?? 3)));
  const minSpacing = (options.minSpacing ?? 2.5) * scale;
  const maxSpacing = Math.max((options.maxSpacing ?? 14) * scale, minSpacing + 0.1);
  const whiteCutoff = options.whiteCutoff ?? 0.08;
  const toneGamma = options.toneGamma ?? 1;

  const stepLength = (options.stepLength ?? 1.5) * scale;
  const maxSteps = options.maxSteps ?? Math.ceil((Math.max(width, height) * 1.5) / stepLength);
  const minLineLength = (options.minLineLength ?? 4) * scale;

  const drawOutlines = options.drawOutlines ?? true;
  const outlineThreshold = options.outlineThreshold ?? 0.35;
  const textureStrokes = Math.max(0, Math.min(1, options.textureStrokes ?? 0.6));
  const textureStyle = options.textureStyle ?? 'ticks';
  // Sky and water treatments switch themselves on when the labels say the
  // material is in frame — the artist doesn't need telling that a sky
  // should be a sky. Explicit options still win in both directions.
  const skyStipple = options.skyStipple ?? (semantic ? semantic.has('sky') : false);
  const calmWater = options.calmWater ?? (semantic ? semantic.has('water') : false);
  const richBlacks = options.richBlacks ?? true;
  const valueBands = Math.round(options.valueBands ?? 0);
  const massing = Math.max(0, Math.min(1, options.massing ?? 0));
  const hatchPatchiness = Math.max(0, Math.min(1, options.hatchPatchiness ?? 0.35));
  const facetHatch = options.facetHatch ?? false;
  const crossContour = options.crossContour ?? false;
  const lineSwell = Math.max(0, Math.min(1, options.lineSwell ?? 0));
  const scribbleTone = Math.max(0, Math.min(1, options.scribbleTone ?? 0));
  const maxStrokeLength = (options.maxStrokeLength ?? 0) * scale;
  const autoStyle = options.autoStyle ?? false;

  const wobble = (options.wobble ?? 0.8) * scale;

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

  const baseImportance = buildImportance(field, width, height, options, semantic);
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

  // Composition-aware value massing: redistribute the value plan by
  // compositional role before it drives spacing — figure/ground swell,
  // committed values, protected sky (see composeMassPlan). Needs a value
  // plan to act on; subject-ness is drawn from the mask, focal points, and
  // person/object labels (the signals that say "this is the subject").
  if (massing > 0 && field.hasMassTone()) {
    const mask = options.subjectMask;
    const maskScaleX = mask ? mask.width / width : 0;
    const maskScaleY = mask ? mask.height / height : 0;
    const focusList = Array.isArray(options.focus)
      ? options.focus
      : options.focus
        ? [options.focus]
        : [];

    const subjectAt = (x: number, y: number): number => {
      let s = 0;
      if (mask) s = Math.max(s, sampleBilinear(mask, x * maskScaleX, y * maskScaleY));
      if (semantic) {
        // A person is the subject; an object usually is (a vase, a chair, a
        // plate) but less certainly than a person, so it counts for less
        s = Math.max(s, semantic.confidence(x, y, 'person'), 0.85 * semantic.confidence(x, y, 'object'));
      }
      for (const f of focusList) {
        const falloff = Math.max(1, f.falloff ?? f.radius);
        const t = Math.max(0, Math.min(1, (Math.hypot(x - f.x, y - f.y) - f.radius) / falloff));
        s = Math.max(s, 1 - t * t * (3 - 2 * t));
      }
      return Math.min(1, s);
    };

    const { raster, scaleX, scaleY } = field.getMassRaster();
    const plan = composeMassPlan({
      width: raster.width,
      height: raster.height,
      valueBands,
      massing,
      darknessAt: (rx, ry) => raster.data[ry * raster.width + rx],
      subjectAt: (rx, ry) => subjectAt(rx / scaleX, ry / scaleY),
      skyAt: (rx, ry) =>
        semantic && skyStipple ? semantic.confidence(rx / scaleX, ry / scaleY, 'sky') : 0,
    });
    field.setMassPlan(plan);
  }

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

  // With a sky label the smoothness heuristics are unnecessary — clouds
  // with visible texture are still sky — and the tone cap relaxes so
  // heavier overcast still stipples instead of falling to cross-hatch
  const skyEligible = skyStipple
    ? semantic?.has('sky')
      ? (x: number, y: number): boolean =>
          semantic.confidence(x, y, 'sky') > 0.5 && skyDark(x, y) < 0.75
      : (x: number, y: number): boolean =>
          field.getDetail(x, y) < 0.25 &&
          field.getFormConfidence(x, y) < 0.3 &&
          skyDark(x, y) < 0.62
    : null;

  // A sky stipples once it is perceptibly grey; raising the white cutoff
  // can still push it back to paper, but importance cannot blank it —
  // smooth skies always score low on auto-detail and always sit at the
  // far end of depth maps, and the sky is a feature, not a background
  const skyThreshold = Math.max(0.12, whiteCutoff * 0.85);

  // Calm water. With a water label, water is wherever the labels say —
  // a high-horizon sea qualifies, a smooth forest floor does not — and
  // only the detail gate remains (choppy reflections still hatch).
  // Without labels: smooth, formless regions in the lower half of the
  // frame, claiming their territory before the sky test — a smooth grey
  // region below the midline is sea or lake, not overcast
  const waterEligible = calmWater
    ? semantic?.has('water')
      ? (x: number, y: number): boolean =>
          semantic.confidence(x, y, 'water') > 0.5 && field.getDetail(x, y) < 0.45
      : (x: number, y: number): boolean =>
          y > height * 0.5 &&
          field.getDetail(x, y) < 0.28 &&
          field.getFormConfidence(x, y) < 0.3
    : null;
  // Breaks in the horizontals: a noise field stretched along x so gaps
  // arrive as runs, the way a hand lifts the pen mid-passage and resumes
  const waterNoise = calmWater ? createNoise(seed + 9419) : null;
  const waterBreakX = maxSpacing * 7;
  const waterBreakY = maxSpacing * 1.6;

  // Contours are traced before any tone work: they are both the drawn
  // outlines and the source of the reserved-white halos that hold
  // hatching off the silhouettes
  const contourHalo = Math.max(0, (options.contourHalo ?? 2.2) * scale);
  const contours =
    drawOutlines || contourHalo > 0
      ? traceContours(field, {
          highThreshold: outlineThreshold,
          lowThreshold: outlineThreshold * 0.4,
          minLength: Math.max(minLineLength * 3, 14),
          stepLength: Math.min(stepLength, 2),
          margin,
          importance,
          // Soft tonal boundaries (mass edges, reflections, blurred
          // transitions) traced as wiggly blob outlines are the strongest
          // "computer" tell. Hold the sharpness bar above the contours.ts
          // default — only edges that concentrate their tonal step at the
          // line survive; depth silhouettes stay exempt inside isSharp.
          minSharpness: 0.55,
          // Busy regions demand longer commitment: a city block or a
          // pile of croissants shatters into outline confetti if every
          // 15px edge gets traced — real ink work draws a few long
          // committed lines there and lets tone carry the rest. Foliage
          // raises the bar further: a canopy is texture, not outlines
          minLengthScale: (x: number, y: number): number =>
            (1 + 2.5 * field.getDetail(x, y)) *
            (semantic ? 1 + 0.8 * semantic.confidence(x, y, 'foliage') : 1),
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
  const facetCell = maxSpacing * 8;
  const facetNoise = facetHatch ? createNoise(seed + 6011) : null;
  const facetAt = (x: number, y: number): { angle: number; id: number } => {
    const jx = facetNoise!.noise2D(x / (facetCell * 2.7), y / (facetCell * 2.7));
    const jy = facetNoise!.noise2D(x / (facetCell * 2.7) + 31.7, y / (facetCell * 2.7) - 17.3);
    const cx = Math.floor((x + jx * facetCell * 0.6) / facetCell);
    const cy = Math.floor((y + jy * facetCell * 0.6) / facetCell);
    const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453;
    // Architecture is hatched plumb and level: where the labels say
    // building and the flow runs near a cardinal direction, the facet
    // snaps to it and the per-cell twist is suppressed — masonry doesn't
    // tilt patch by patch
    const orientation = field.getOrientation(x, y);
    if (semantic && semantic.confidence(x, y, 'building') > 0.5) {
      const cardinal = Math.round(orientation / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(orientation - cardinal) < (25 * Math.PI) / 180) {
        const bin = Math.round(cardinal / FACET_BIN);
        return { angle: bin * FACET_BIN, id: bin * 7919 + cx * 131 + cy * 13007 };
      }
    }
    // Twist only a minority of cells off the snapped flow angle: when most
    // facets share one direction the mass reads as a few big coherent
    // planes; twisting nearly every cell (the old ±1 bias) crackles the
    // mass into cellular mud
    const r = h - Math.floor(h);
    const twist = r > 0.82 ? 1 : r < 0.18 ? -1 : 0;
    const bin = Math.round(orientation / FACET_BIN) + twist;
    return { angle: bin * FACET_BIN, id: bin * 7919 + cx * 131 + cy * 13007 };
  };

  // Value-plan restraint: with a value plan, the lightest mass band is
  // left as clean paper — no hatch marks at all — so big light shapes
  // (a lit wall, a white subject) read as a committed decision instead of
  // being veiled in stray strokes. Keyed on the posterized mass darkness,
  // not the raw/counterchange tone: counterBoost is one-sided and ~0 on
  // light masses, so a band-0 region that should stay white stays white,
  // while the background swell (band 1+) behind a light subject still draws.
  const bandFloor = field.hasMassTone() && valueBands >= 2 ? 0.5 / valueBands : 0;
  const inLightestBand =
    bandFloor > 0 ? (x: number, y: number): boolean => field.getMassDarkness(x, y) < bandFloor : null;

  // Solid blacks: the darkest value band is inked as one committed mass —
  // serpentine fill at pen spacing with drawn boundary passes — instead of
  // accumulating cross-hatch. Hatch layers treat the region as already
  // inked (strokes stop at its border); tiny flecks stay hatched. The
  // darkest-band test allows half a band of bilinear smear at the edge.
  const solidFill =
    (options.solidBlacks ?? false) && field.hasMassTone() && valueBands >= 2
      ? (() => {
          const { raster, scaleX, scaleY } = field.getMassRaster();
          return planSolidFill({
            width,
            height,
            margin,
            rasterWidth: raster.width,
            rasterHeight: raster.height,
            scaleX,
            scaleY,
            darknessAt: (x, y) => field.getMassDarkness(x, y),
            threshold: 1 - 0.5 / valueBands,
            // An explicit fillSpacing is absolute output px (the caller
            // ties it to the plotted pen width, a physical property);
            // only the default tracks the sheet's render density
            spacing: Math.max(0.5, options.fillSpacing ?? 0.9 * scale),
            angle: ((options.hatchAngle ?? -45) * Math.PI) / 180,
            // Hand-sized: a black mass earns solid ink, a speck stays hatched
            minArea: Math.pow(maxSpacing * 2.5, 2),
          });
        })()
      : null;

  const lines: FlowLine[] = [];

  // The tone→spacing curve, shared by the hatch layers and the scribble
  // engine (which carries the same curve on loop frequency instead)
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
      spacing *= 1 - 0.7 * deep;
    }

    // Ink compensation for swelling line weight: where lines earn extra
    // passes, spacing opens up a little so the darks don't double-darken
    // into mud. Deliberately mild — the swell should read as weight ON
    // dense line systems; full proportional compensation thins the darks
    // into sparse fat strokes that read as thorns, not engraving
    if (lineSwell > 0) {
      spacing *= 1 + lineSwell * 0.35 * swellPassCount(d, swellPasses(lineSwell));
    }

    return spacing;
  };

  // With the scribble engine on, it replaces the hatch layers as the tone
  // engine entirely — contours, halos, portrait work, and the value plan
  // all still apply around it
  const hatchLayers = scribbleTone > 0 ? 0 : layers;

  // Tone layers: layer i only hatches where darkness exceeds its threshold,
  // so shadows accumulate cross-hatched coverage.
  for (let layer = 0; layer < hatchLayers; layer++) {
    const threshold = whiteCutoff + (layer / layers) * (0.92 - whiteCutoff);
    const angleOffset =
      (LAYER_ANGLES[layer] * Math.PI) / 180 + (crossContour ? Math.PI / 2 : 0);

    const bandedDrawable = importance
      ? (x: number, y: number): boolean => {
          if (inLightestBand && inLightestBand(x, y)) return false;
          const imp = importance(x, y);
          return effectiveDarkness(x, y, imp) >= threshold + (1 - imp) * 0.25;
        }
      : (x: number, y: number): boolean => {
          if (inLightestBand && inLightestBand(x, y)) return false;
          return baseDarkness(x, y) >= threshold;
        };

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

    // Calm water carries its tone entirely on layer-0 horizontals —
    // cross-hatch over water reads as land. Labeled sky is excluded the
    // same way: its tone lives in the stipple, and hatch strokes across
    // a sky read as weather, not tone
    const labeledSky = semantic?.has('sky') && skyStipple ? semantic : null;
    const waterFiltered =
      (waterEligible || labeledSky) && layer >= 1
        ? (x: number, y: number): boolean =>
            !(waterEligible && waterEligible(x, y)) &&
            !(labeledSky && labeledSky.confidence(x, y, 'sky') > 0.5) &&
            patchedDrawable(x, y)
        : patchedDrawable;

    // Solid-fill regions are already ink: hatch neither seeds inside them
    // nor slides across their border
    const fillFiltered = solidFill
      ? (x: number, y: number): boolean => !solidFill.isSolid(x, y) && waterFiltered(x, y)
      : waterFiltered;

    // Tone marks (hatch lines and stipple dots alike) stop short of long
    // contours, leaving the reserved-white sliver; strokes that wander
    // into a halo terminate there
    const isDrawable = haloAt
      ? (x: number, y: number): boolean => !haloAt(x, y) && fillFiltered(x, y)
      : fillFiltered;

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

    // Midtone texture commits to hand-sized patches: inside a patch the
    // ticks land dense enough to read as deliberate texture, between
    // patches tone is carried by coherent hatch — scattered lone ticks
    // read as noise, and a hand never dots a wash evenly
    const tickPatchNoise = createNoise(seed + 4243);
    const tickPatchFreq = 1 / (maxSpacing * 4);

    // Per-stroke style dispatch, resolved at each seed:
    //   ticks for texture, capped cross-contour marks wrapping curved 3D
    //   forms (autoStyle + depth), flowing hatch lines everywhere else
    const paramsFor = (x: number, y: number, random: () => number): StrokeParams => {
      let texture = textureAmount ? textureAmount(x, y) : 0;
      let foliage = 0;
      if (semantic && textureAmount) {
        // Foliage floors texture: a smooth dark canopy is still leaves,
        // and without the floor it collapses into flat silhouette mush.
        // Labels promote marks, never demote them — buildings keep their
        // material texture (brick, stone, shingle); scattered-tick noise
        // is already handled by the midtone patch commitment below.
        // textureStrokes: 0 stays a hard off in both directions
        foliage = semantic.confidence(x, y, 'foliage');
        texture = Math.max(texture, 0.5 * foliage);
      }

      // Calm water: long broken horizontals, spacing carries the tone.
      // The break noise is stretched along x so the pen lifts and
      // resumes in runs instead of pecking
      if (waterEligible && texture < 0.3 && waterEligible(x, y)) {
        return {
          angleOffset: 0,
          fixedAngle: 0,
          maxArcLength: maxSpacing * (5 + 8 * random()),
          stopAt: (px: number, py: number): boolean =>
            waterNoise!.noise2D(px / waterBreakX, py / waterBreakY) < -0.62 ||
            !waterEligible(px, py),
        };
      }

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
        foliage < 0.5 &&
        field.getFormConfidence(x, y) < 0.5 &&
        baseDarkness(x, y) >= 0.25
      ) {
        const facet = facetAt(x, y);
        return {
          angleOffset: 0,
          fixedAngle: facet.angle + layerAngle,
          // Run the full width of the (now larger) facet instead of dying
          // mid-plane; the facet-id test still terminates at the real
          // border, and cap (maxStrokeLength) still bounds plottability
          maxArcLength: Math.min(cap, maxSpacing * (9 + 4 * random())),
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
        const darkHere = baseDarkness(x, y);

        // Dark foliage scribbles regardless of the texture style: deep
        // canopy shadow inked as wandering strokes reads as worked
        // leaf-mass, where straight ticks or hatch read as flood fill
        if (foliage > 0.5 && texture > 0.3 && darkHere >= 0.55) {
          return {
            angleOffset: layerAngle * (1 - 0.8 * texture),
            maxArcLength: Math.min(cap, maxSpacing * (5 + 4 * random())),
            headingJitter: 0.4 * texture,
            rand: random,
          };
        }

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

        // Deep shadow defers to ordered cross-hatch: tick noise inside a
        // near-black mass reads as mud with paper veins, where layered
        // hatch under richBlacks commits to confident black. Explicit
        // stipple/scribble styles (above) stay the user's call
        if (darkHere >= 0.75 && foliage < 0.5) {
          return { angleOffset: layerAngle + rotate, maxArcLength: cap };
        }

        // Weak-to-moderate texture commits to patches: between them the
        // midtone yields to plain hatch (commit or leave clean) instead
        // of sprinkling lone marks across the wash. Strong texture (real
        // fur, dense foliage) keeps its ticks everywhere
        if (
          darkHere < 0.5 &&
          texture < 0.5 &&
          foliage < 0.5 &&
          tickPatchNoise.noise2D(x * tickPatchFreq, y * tickPatchFreq) < 0
        ) {
          return { angleOffset: layerAngle + rotate, maxArcLength: cap };
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

  // Continuous scribble tone engine: one meandering ballpoint habit whose
  // loop density carries the tone (see scribble.ts). Honors the same
  // white cutoff, halos, solid fill, and importance gates as the hatch.
  if (scribbleTone > 0) {
    const scribbleDrawable = (x: number, y: number): boolean => {
      if (inLightestBand && inLightestBand(x, y)) return false;
      if (solidFill && solidFill.isSolid(x, y)) return false;
      if (haloAt && haloAt(x, y)) return false;
      if (importance) {
        const imp = importance(x, y);
        return effectiveDarkness(x, y, imp) >= whiteCutoff + (1 - imp) * 0.25;
      }
      return baseDarkness(x, y) >= whiteCutoff;
    };
    lines.push(
      ...scribblePass({
        width,
        height,
        margin,
        angle: ((options.hatchAngle ?? -45) * Math.PI) / 180,
        amount: scribbleTone,
        carrierGap: maxSpacing * 0.85,
        stepLength,
        scale,
        seed: seed + 8117,
        spacingAt,
        isDrawable: scribbleDrawable,
        darknessAt: baseDarkness,
      })
    );
  }

  // The committed blacks land after the tone layers: serpentine fill plus
  // its drawn boundary, all on the 'fill' layer so density protection and
  // wobble treat the solid mass as deliberate ink, not stroke pile-up
  if (solidFill) {
    lines.push(...solidFill.lines);
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
    // drawing over it — every stroke stays plottable with one pen (the
    // offset/trim recipe is shared with the swelling line weight)
    const pushEmphasized = (points: Point[]): void => {
      lines.push({ points, pen: 'bold' });
      for (const trimmed of offsetEmphasisPasses(points, outlinePasses, 1.1, 0.12)) {
        lines.push({ points: trimmed, pen: 'bold' });
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
      // Loose, shaky gestures belong only where there is structure to
      // gesture at — a busy, unimportant background (foliage, distant
      // clutter) loosens up, but a flat evenly-toned tone wall is exactly
      // where a hand draws steadiest, so it stays calm. Gating the boost on
      // local detail keeps backgrounds gestural without making clean
      // cross-hatch fields read nervous.
      amplitudeScale: importance
        ? (x, y) => 1 + (1 - importance(x, y)) * field.getDetail(x, y) * 0.9
        : undefined,
      // Solid fill must wobble as one calm mass: full-amplitude shake on
      // passes one pen width apart opens white gaps through the black
      layerAmplitude: solidFill ? { fill: 0.25 } : undefined,
    });
  }

  // Swelling line weight: shadow runs of the traced tone layers thicken
  // with extra offset passes of the same pen and taper back to a single
  // line in the light — the engraver's swelling line. Applied AFTER the
  // wobble so every pass hugs its parent's drawn path exactly: passes
  // that wobble independently read as crossing thorns, not built weight.
  if (lineSwell > 0) {
    result = {
      ...result,
      lines: [
        ...result.lines,
        ...applyLineSwell(result.lines, { lineSwell, scale, darknessAt: baseDarkness }),
      ],
    };
  }

  if (options.optimize ?? true) {
    result = optimizePlot(result);
  }

  // Frame the content onto the full sheet: translate every mark into place and
  // make the canvas the page. 'fill' content can spill past the sheet, so clip
  // marks to the page edge — a plotter must not draw off-paper.
  if (options.page) {
    result = frameOntoPage(result, width, height, options.page);
  }

  return result;
}
