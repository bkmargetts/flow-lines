import type { PenInkStyle } from './types.js';

/**
 * Heavy comic ink, in the Mignola tradition: a two-value world. Tone is
 * committed to massive solid blacks and clean paper with no midtone wash
 * between them — shadow shapes merge into the background black, subjects
 * pop as reserved white, and a few confident outlines carry everything
 * the blacks don't. The restraint is the style: what isn't black is line
 * or paper, never grey.
 */
export const COMIC_STYLE: PenInkStyle = {
  id: 'comic',
  label: 'Comic Ink',
  description:
    'Massive committed blacks, no midtones — a two-value world of solid shadow shapes, reserved paper, and a few confident outlines.',
  options: {
    // The two-value plan is the whole style: band 0 is paper, band 1 is
    // solid ink. Massing runs high so shadow-side masses swell and merge
    // into the background black the way spot blacks are designed, not
    // photographed
    valueBands: 2,
    massing: 0.8,
    solidBlacks: true,

    // One hatch layer only: with the darkest band inked solid, hatch
    // exists just for the band-boundary smear, and layered cross-hatch
    // would reintroduce the grey the style forbids
    layers: 1,
    // A high white cutoff kills the midtone wash — tone either commits
    // to black or yields to paper
    whiteCutoff: 0.25,
    toneGamma: 1,
    // Texture marks, sky stipple, and calm-water strokes are midtone
    // devices; comic ink says it with shape — an overcast sky commits to
    // paper, a storm sky commits to black
    textureStrokes: 0,
    skyStipple: false,
    calmWater: false,
    facetHatch: false,
    crossContour: false,

    // The line work carries everything the blacks don't: outlines built
    // bold from the full four passes, catching slightly softer edges than
    // the default, with a wide reserved-paper halo so blacks hold off
    // white shapes instead of bleeding into them
    drawOutlines: true,
    outlinePasses: 4,
    outlineThreshold: 0.3,
    contourHalo: 3,

    // Confident, calm pen — brush-inked lines are committed, not sketchy
    wobble: 0.5,
    fieldSmoothing: 5,
  },
};
