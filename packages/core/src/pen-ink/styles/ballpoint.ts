import type { PenInkStyle } from './types.js';

/**
 * Ballpoint scribble: the whole drawing is one restless habit of hand —
 * a continuous meandering line whose loop density carries the tone, the
 * way a biro shades on the back of an envelope. The one style that keeps
 * full photographic gradation: continuous tone is exactly what scribble
 * density renders best, so no value plan, no massing, just the pen
 * wandering darker where the photo is darker.
 */
export const BALLPOINT_STYLE: PenInkStyle = {
  id: 'ballpoint',
  label: 'Ballpoint',
  description:
    'One continuous scribbling line carries all the tone — tight loops in shadow, lazy waves in light, full photographic gradation.',
  options: {
    // The signature: scribble replaces the hatch engine entirely
    scribbleTone: 0.9,

    // Continuous gradation is the point — no posterized value plan, no
    // compositional massing, gentle gamma keeping midtones alive
    valueBands: 0,
    massing: 0,
    toneGamma: 1.2,
    whiteCutoff: 0.1,
    richBlacks: true,

    // The scribble owns all the tone marks; texture dispatch, sky
    // stipple, and calm water are hatch-engine devices
    textureStrokes: 0,
    skyStipple: false,
    calmWater: false,
    facetHatch: false,
    crossContour: false,

    // A light single-pass outline: ballpoint sketches state edges once,
    // quickly, and let the scribble mass do the rest
    drawOutlines: true,
    outlinePasses: 1,
    outlineThreshold: 0.4,
    contourHalo: 2.2,

    // The scribble supplies its own nervous energy; the wobble only
    // loosens the outlines
    wobble: 0.6,

    // A biro shades on a diagonal
    hatchAngle: -35,
  },
};
