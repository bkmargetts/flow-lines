import { createNoise } from './noise.js';
import { makeRandom, subSeed } from './lib/rng.js';

/**
 * Organic framing for background textures: instead of filling the margin-inset
 * rectangle wall-to-wall (the strongest "computer" tell for a background
 * layer), the texture can fill a hand-sketched patch — most of the frame, but
 * not all of it — with a ragged noise-gated edge where strokes trail off at
 * varying depths, the way a hand hatching a background stops short of the
 * page edge. The region is a pure point field (containment + edge depth), so
 * every texture style clips against it through the same predicate it already
 * uses for the avoid halo.
 */
export interface TextureRegionOptions {
  /** 'rect' = whole margin box (legacy behaviour); 'organic' = seeded blob patch(es). */
  frame: 'rect' | 'organic';
  /** Fraction of the margin box the patch spans, 0.3..1 (organic only). */
  coverage: number;
  /** Boundary irregularity 0..1: harmonic lobes + ring fBm (organic only). */
  irregularity: number;
  /** Patch-centre offset as a fraction of the box half-extents, -0.5..0.5. */
  offsetX: number;
  offsetY: number;
  /** Number of separate patches, 1..4 (organic only). */
  patches: number;
  /** Ragged fade band as a fraction of patch radius, 0..1. 0 = hard clip. */
  fade: number;
  /** Edge density falloff 0..1 — noise-gated dropout loosening toward the
   * region edge. Works for BOTH rect and organic frames. 0 = off. */
  falloff: number;
}

/** Compiled per-page region field. Pure and deterministic in (x, y). */
export interface TextureRegionField {
  /** Hard containment inside the nominal boundary (fade/falloff ignored). */
  inside(x: number, y: number): boolean;
  /** 0 at/outside the boundary → 1 deep inside. Smooth; drives fade + falloff. */
  depth01(x: number, y: number): number;
  /** The clip predicate: containment ∧ ragged-fade gate ∧ falloff gate. */
  clear(x: number, y: number): boolean;
}

/**
 * Seeded organic boundary multiplier m(θ) for a blob: low-order harmonic
 * lobes (amplitudes ~1/k, so big lobes dominate) plus fBm sampled on the
 * ring for sketchy small-scale waver. Deviation from 1 scales with
 * `irregularity`; the result is NOT normalized — callers divide their base
 * radii by the sampled maximum so the blob never leaves its bounding box.
 * Shared with the grating's blob mask.
 */
export function organicBoundary(seed: number, irregularity: number): (theta: number) => number {
  const rng = makeRandom(seed);
  const amps: number[] = [];
  const phases: number[] = [];
  for (let k = 2; k <= 5; k++) {
    amps.push(rng() / k);
    phases.push(rng() * Math.PI * 2);
  }
  const ring = createNoise(subSeed(seed, 1));
  const irr = Math.max(0, Math.min(1, irregularity));
  return (theta) => {
    let h = 0;
    for (let i = 0; i < amps.length; i++) h += amps[i] * Math.sin((i + 2) * theta + phases[i]);
    const n = ring.fbm(Math.cos(theta) * 1.5, Math.sin(theta) * 1.5, 2, 0.5, 2);
    return Math.max(0.25, 1 + irr * (h + 0.35 * n));
  };
}

/** m(θ) baked into an interpolation table: cheap per point, still smooth. */
function tabulateBoundary(
  boundary: (theta: number) => number,
  samples: number
): { at: (theta: number) => number; max: number } {
  const table = new Float64Array(samples);
  let max = 0;
  for (let i = 0; i < samples; i++) {
    const m = boundary((i / samples) * Math.PI * 2);
    table[i] = m;
    if (m > max) max = m;
  }
  const at = (theta: number): number => {
    let t = (theta / (Math.PI * 2)) * samples;
    t -= Math.floor(t / samples) * samples;
    const i = Math.floor(t);
    const f = t - i;
    return table[i % samples] * (1 - f) + table[(i + 1) % samples] * f;
  };
  return { at, max };
}

/**
 * Table-interpolated organic boundary normalized so its maximum is 1 — the
 * blob is inscribed in its rx/ry box. Containment for a blob mask is
 * `ellipticalRadius(x, y) <= boundary(theta)`. Used by the grating's blob
 * `MaskShape`.
 */
export function normalizedBlobBoundary(
  seed: number,
  irregularity: number
): (theta: number) => number {
  const { at, max } = tabulateBoundary(organicBoundary(seed, irregularity), 512);
  return (theta) => at(theta) / max;
}

interface Patch {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  m: (theta: number) => number;
}

/** Elliptical-radius of (x, y) against a patch: ≤1 inside, grows outward. */
function patchRho(p: Patch, x: number, y: number): number {
  const ex = (x - p.cx) / p.rx;
  const ey = (y - p.cy) / p.ry;
  const r = Math.hypot(ex, ey);
  if (r === 0) return 0;
  return r / p.m(Math.atan2(ey, ex));
}

/**
 * Compile the region options into a point field over the margin-inset rect.
 * Returns null when the options are inert (rect frame with no falloff) so the
 * caller can skip clipping entirely — the off-by-default path stays
 * bit-identical to a build without regions. All randomness comes from `seed`
 * (a sub-seed of the texture seed): toggling region knobs must never
 * reshuffle the base texture's RNG stream.
 */
export function compileTextureRegion(
  opts: TextureRegionOptions,
  rect: { x0: number; y0: number; x1: number; y1: number },
  pxPerMm: number,
  seed: number
): TextureRegionField | null {
  const organic = opts.frame === 'organic';
  const fade = organic ? Math.max(0, Math.min(1, opts.fade)) : 0;
  const falloff = Math.max(0, Math.min(1, opts.falloff));
  if (!organic && falloff <= 0) return null;

  const { x0, y0, x1, y1 } = rect;
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;

  let inside: (x: number, y: number) => boolean;
  let depth01: (x: number, y: number) => number;

  if (organic) {
    const coverage = Math.max(0.3, Math.min(1, opts.coverage));
    const n = Math.max(1, Math.min(4, Math.round(opts.patches)));
    const offX = Math.max(-0.5, Math.min(0.5, opts.offsetX)) * halfW;
    const offY = Math.max(-0.5, Math.min(0.5, opts.offsetY)) * halfH;
    const placeRng = makeRandom(seed);
    // Patch centres: one centred patch, or a seeded shuffle of the 2×2
    // quadrant centres with jitter, so multiple patches spread over the page
    // instead of clumping. The whole constellation shifts with the offset.
    const centres: Array<{ x: number; y: number }> = [];
    if (n === 1) {
      centres.push({ x: x0 + halfW + offX, y: y0 + halfH + offY });
    } else {
      const quads = [
        { x: x0 + halfW * 0.55, y: y0 + halfH * 0.55 },
        { x: x0 + halfW * 1.45, y: y0 + halfH * 0.55 },
        { x: x0 + halfW * 0.55, y: y0 + halfH * 1.45 },
        { x: x0 + halfW * 1.45, y: y0 + halfH * 1.45 },
      ];
      for (let i = quads.length - 1; i > 0; i--) {
        const j = Math.floor(placeRng() * (i + 1));
        [quads[i], quads[j]] = [quads[j], quads[i]];
      }
      for (let i = 0; i < n; i++) {
        centres.push({
          x: quads[i].x + (placeRng() - 0.5) * 0.3 * halfW + offX,
          y: quads[i].y + (placeRng() - 0.5) * 0.3 * halfH + offY,
        });
      }
    }
    const scale = n === 1 ? coverage : (coverage / Math.sqrt(n)) * 1.15;
    const patches: Patch[] = centres.map((c, i) => {
      const sizeJit = n === 1 ? 1 : 1 + (placeRng() - 0.5) * 0.5;
      const { at, max } = tabulateBoundary(
        organicBoundary(subSeed(seed, 10 + i), opts.irregularity),
        512
      );
      // Divide by the sampled max so the boundary never exceeds rx/ry, then
      // clamp the radii to the centre's distance from the box edges — the
      // patch stays inside the margin rect at any offset/coverage.
      let rx = (scale * halfW * sizeJit) / max;
      let ry = (scale * halfH * sizeJit) / max;
      rx = Math.max(4, Math.min(rx, (c.x - x0) / max, (x1 - c.x) / max));
      ry = Math.max(4, Math.min(ry, (c.y - y0) / max, (y1 - c.y) / max));
      return { cx: c.x, cy: c.y, rx: rx * max, ry: ry * max, m: (t) => at(t) / max };
    });
    depth01 = (x, y) => {
      let best = 0;
      for (const p of patches) {
        const d = 1 - patchRho(p, x, y);
        if (d > best) best = d;
      }
      return Math.min(1, best);
    };
    inside = (x, y) => {
      for (const p of patches) if (patchRho(p, x, y) <= 1) return true;
      return false;
    };
  } else {
    // Rect frame: depth from the nearest rect edge, normalized so "deep
    // inside" is reached at half the smaller half-extent — a wide band that
    // gives the falloff room to breathe on any aspect ratio.
    const norm = 0.5 * Math.min(halfW, halfH);
    inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    depth01 = (x, y) => {
      const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      return Math.max(0, Math.min(1, d / norm));
    };
  }

  // Ragged fade: within a band inside the boundary, a smooth noise field
  // decides how deep each spot's strokes reach — runs terminate at varying
  // depths (coherent ragged ends, not per-sample confetti). Falloff is the
  // same mechanism with a longer inward extent and wavelength: an honest
  // limitation of a point predicate is that it drops marks rather than
  // widening pitch, but long-wavelength chunked dropout reads as loosening
  // at plot scale, and it works uniformly for every style.
  const band = fade > 0 ? 0.08 + 0.35 * fade : 0;
  const fadeNoise = fade > 0 ? createNoise(subSeed(seed, 2)) : null;
  const falloffNoise = falloff > 0 ? createNoise(subSeed(seed, 3)) : null;
  const fadeLambda = 7 * pxPerMm;
  const falloffLambda = 15 * pxPerMm;

  const clear = (x: number, y: number): boolean => {
    const d = depth01(x, y);
    if (!inside(x, y)) return false;
    if (fadeNoise && d < band) {
      const gate =
        0.06 + 0.94 * (0.5 + 0.5 * fadeNoise.fbm(x / fadeLambda, y / fadeLambda, 2, 0.5, 2));
      if (d / band < gate) return false;
    }
    if (falloffNoise) {
      const thin = falloff * Math.pow(1 - d, 1.3);
      const n01 = 0.5 + 0.5 * falloffNoise.fbm(x / falloffLambda, y / falloffLambda, 2, 0.5, 2);
      if (n01 < thin) return false;
    }
    return true;
  };

  return { inside, depth01, clear };
}
