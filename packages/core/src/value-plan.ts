import { gaussianBlur, type GrayscaleImage } from './image.js';

export interface MassPlanOptions {
  /** Working raster width the plan is computed on */
  width: number;
  /** Working raster height the plan is computed on */
  height: number;
  /** Number of value bands to posterize into (>= 2) */
  valueBands: number;
  /** Composition strength, 0..1: 0 returns the photographic plan unchanged */
  massing: number;
  /** Raw large-scale darkness at a raster cell, 0..1 (1 = black) */
  darknessAt: (rx: number, ry: number) => number;
  /** Subject-ness at a raster cell, 0..1 (1 = the thing the drawing is about) */
  subjectAt: (rx: number, ry: number) => number;
  /** Sky confidence at a raster cell, 0..1 — sky is never darkened by massing */
  skyAt: (rx: number, ry: number) => number;
}

/**
 * Compose a deliberate value plan and posterize it — the artist's tonal
 * abstraction, taken seriously.
 *
 * A photograph hands us a continuous luminance field; a drawing reads as
 * *decisions*: a few committed values assigned by compositional role, with
 * the subject held against a swell of ground tone. `valueBands` on its own
 * posterizes the photo's actual luminance — faithful, but it can't invent
 * the structure a human commits to (the dark wall an artist floods behind a
 * white bouquet, the few solid blacks anchoring a landscape). This stage
 * redistributes tone before banding:
 *
 *  - **Figure/ground swell** — ground that sits *near* the subject (but isn't
 *    the subject) is darkened, feathered over a large radius, so the subject
 *    pops off a swell of background tone the way ink artists hold tone off a
 *    silhouette. Driven globally by subject-ness, so it works even where the
 *    photo's background is light (the local counterchange boost can't).
 *  - **Contrast commit** — values are pushed apart around the mid, so lights
 *    go lighter and darks go darker: committed shapes, not a grey wash. This
 *    is what carries scenes with no single subject (a landscape commits a few
 *    big values by luminance alone).
 *  - **Sky protection** — a confident sky is never darkened; its tone lives
 *    in the stipple, and a composed value plan must not hatch a band over it.
 *
 * The result is blended in from the real mass tone by `massing`, so it stays
 * grounded in the photograph rather than invented from nothing, then snapped
 * to evenly-spread bands. Deterministic; pure function of its inputs.
 */
export function composeMassPlan(options: MassPlanOptions): Float32Array {
  const { width, height, valueBands, massing, darknessAt, subjectAt, skyAt } = options;
  const n = width * height;

  const mass = new Float32Array(n);
  const subj = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      mass[i] = darknessAt(x, y);
      subj[i] = subjectAt(x, y);
    }
  }

  // Proximity-to-subject: blur the subject-ness over a large radius. Where
  // the blurred field is high but the local subject-ness is low, we are in
  // the ground immediately around the subject — the region that should
  // darken to set it off.
  const sNearSigma = Math.max(6, Math.max(width, height) / 12);
  const sNear = gaussianBlur({ width, height, data: subj }, sNearSigma).data;

  const out = new Float32Array(n);
  const levels = Math.max(2, Math.round(valueBands));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const m = mass[i];
      const s = subj[i];

      // Ground halo: near the subject, not the subject. Darken it, but never
      // touch the subject itself (the `1 - s` guard) — a dark subject keeps
      // its own form.
      const ground = Math.max(0, sNear[i] - s);
      let c = m + massing * 0.55 * ground * (1 - s);

      // Commit values: push apart from the mid so the plan reads as a few
      // decisive shapes instead of a continuous gradation.
      c = 0.5 + (c - 0.5) * (1 + 0.45 * massing);

      // Sky is never darkened by the composition — keep it at its light
      // photographic tone wherever the label is confident.
      const sky = skyAt(x, y);
      if (sky > 0) c = c + sky * (Math.min(c, m) - c);

      c = Math.max(0, Math.min(1, c));

      const band = Math.max(0, Math.min(levels - 1, Math.floor(c * levels)));
      out[i] = band / (levels - 1);
    }
  }

  return out;
}

/** A grayscale raster wrapper for a composed plan, for callers that need one */
export function massPlanImage(width: number, height: number, data: Float32Array): GrayscaleImage {
  return { width, height, data };
}
