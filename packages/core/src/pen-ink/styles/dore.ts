import type { PenInkStyle } from './types.js';

/**
 * Doré-school etching/engraving: dense systems of long parallel lines
 * that wrap the form, with the tone carried by the *weight* of the line —
 * strokes swell where they pass through shadow and thin back to hairlines
 * in the light. Shadows deepen by line weight first and cross-hatch
 * second; outlines stay quiet because the line systems themselves draw
 * the form.
 */
export const DORE_STYLE: PenInkStyle = {
  id: 'dore',
  label: 'Doré Etching',
  description:
    'Engraved line systems that wrap the form, swelling heavier through shadow and thinning to hairlines in the light — tone carried by line weight.',
  options: {
    // The signature: swelling line weight near full strength, with
    // spacing compensation trading line count for line weight
    lineSwell: 0.8,
    // Swell owns the darks — the richBlacks spacing collapse would fight
    // the weight-for-count trade and mud the deepest tones
    richBlacks: false,

    // Long, smooth, form-wrapping line systems: cross-contour orientation,
    // heavy field smoothing, no length cap, near-continuous layers (the
    // engraver's burin doesn't lift mid-plane)
    crossContour: true,
    fieldSmoothing: 9,
    maxStrokeLength: 0,
    // Two layers only: weight carries the darks, so a third cross layer
    // would just shatter the line systems into short collided fragments
    layers: 2,
    hatchPatchiness: 0.15,
    facetHatch: false,

    // A committed value plan keeps the plate reading as big tonal masses;
    // texture marks would break the line systems, so form does the work
    valueBands: 5,
    massing: 0.4,
    toneGamma: 1.4,
    whiteCutoff: 0.12,
    minSpacing: 2.8,
    maxSpacing: 14,
    textureStrokes: 0.15,

    // Quiet contours: engravings draw edges with the line systems, not
    // with heavy outlines
    drawOutlines: true,
    outlinePasses: 2,
    outlineThreshold: 0.4,
    contourHalo: 2.2,

    // A burin line is steady — barely any wobble
    wobble: 0.3,
  },
};
