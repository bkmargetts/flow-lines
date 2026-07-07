import type { PenInkStyle } from './types.js';

/**
 * Sumi-e economy: radical restraint. A handful of fat, confident brush
 * strokes capture the subject by gesture; most of the sheet stays empty
 * paper, and the emptiness is doing work. The ink budget is the style —
 * every stroke has to earn its place, contours count the most (the
 * gesture IS the contour), and what survives is thickened into loaded
 * brush strokes with pressure-tapered ends.
 */
export const SUMIE_STYLE: PenInkStyle = {
  id: 'sumie',
  label: 'Sumi-e',
  description:
    'A handful of fat, confident brush strokes and a lot of empty paper — the subject captured by gesture, every stroke earning its place.',
  options: {
    // The signature: a hard ink budget with the survivors thickened into
    // brush weight. The budget bites after the starved hatch below — it
    // keeps roughly the strongest third of an already sparse drawing
    strokeBudget: 14,
    strokeWeight: 3,

    // Starve the hatch before the budget even looks at it: one layer,
    // wide spacing, a high white cutoff, and a committed three-value plan
    // so candidates are few, long, and already decisive
    layers: 1,
    minSpacing: 4,
    maxSpacing: 26,
    whiteCutoff: 0.3,
    toneGamma: 1.6,
    valueBands: 3,
    massing: 0.5,
    richBlacks: true,

    // Gesture needs long smooth strokes, not marks: no texture dispatch,
    // no facets, heavy field smoothing
    textureStrokes: 0,
    skyStipple: false,
    calmWater: false,
    facetHatch: false,
    crossContour: false,
    fieldSmoothing: 10,
    maxStrokeLength: 0,

    // Contours are the gesture: catch them a little more eagerly, hold
    // wide reserved paper around them, and build them bold
    drawOutlines: true,
    outlinePasses: 3,
    outlineThreshold: 0.3,
    contourHalo: 4,

    // A loaded brush moves loosely — high wobble reads as a wrist, and
    // the weight passes hug the wobbled path so it stays one stroke
    wobble: 1.5,
  },
};
