import type { FlowLine, FlowLinesResult } from '../flow-lines.js';
import { clamp, lerp } from '../lib/math.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { randomSeed, subSeed } from '../lib/rng.js';
import { ZBuffer } from '../lib/spatial.js';
import { compileRegion, type StickmenRegion } from '../stickmen/region.js';
import { splitVisible, type ZOffset } from '../stickmen/occlude.js';
import { placeHearts, type HeartStyle } from './layout.js';
import { buildHeart, type HeartBuild } from './heart.js';

export type { HeartStyle } from './layout.js';

/** Placement regions are shared with the stick-men crowd — same normalized
 *  drawable-box contract, same preset shape builders (star/heart/…). */
export type HeartsRegion = StickmenRegion;

/**
 * A page full of love hearts, drawn as plottable pen-and-ink. Each heart is
 * the classic parametric curve at its own size, tilt and plumpness, in one
 * of four styles — a confident outline, a solid of concentric nested copies,
 * an exact even-odd hatch fill, or a broken heart with a jagged crack — with
 * optional cupid's arrows, multi-pass bold emphasis, and a shadow-side band
 * lit by one shared light. Hearts soft-pack (below-width separation ⇒ an
 * overlapping pile) and resolve back-to-front with exact silhouette
 * hidden-line removal. Single pen, deterministic per seed. Mirrors the
 * Sports Balls generator: heavy algorithm here in core, a thin web wrapper
 * feeds it.
 */
export interface HeartsOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  // Scene / placement
  count?: number;
  clustering?: number; // 0..1
  /** Soft minimum gap between centres, px. Below the mean width ⇒ hearts
   *  overlap into a pile (the default look); `count` stays exact. */
  minSeparation?: number;
  /** Confine hearts to a shape on the page, in normalized drawable-box
   *  coords — see `StickmenRegion` for the coordinate contract. Unset /
   *  'full' = the whole drawable box. */
  region?: HeartsRegion;
  /** Soft region edge: only heart CENTRES are confined, so hearts poke past
   *  the shape outline. Default holds the whole heart inside — crisp shape
   *  silhouettes. */
  softRegionEdge?: boolean;

  // Hearts
  heartScale?: number; // px mean width
  scaleVariance?: number; // 0..1
  /** 0..0.5 — nearer (lower on page) hearts grow, farther shrink. */
  depthGrade?: number;
  /** 0..1 — 0 tall and pointy, 1 wide and chubby. */
  plumpness?: number;
  /** 0..1 — per-heart plumpness jitter. */
  plumpVariance?: number;
  /** 0..1 — per-heart rotation jitter (±~35° at 1). */
  tilt?: number;
  /** 3..18 — who's holding the pen. 18 (the default) is an adult and
   *  reproduces today's exact output. Younger hands draw progressively
   *  SIMPLER hearts — the curve collapses toward a schema of a few straight
   *  strokes with an exaggerated notch and tip, shading finesse disappears,
   *  solid fills become colouring-in scribble — plus lopsidedness, outlines
   *  that don't quite close, sloppy retraces and a little extra shake.
   *  Values outside 3..18 clamp. */
  age?: number;
  /** Style weights; omitted/<=0 excludes a style. All-off falls back to all. */
  mix?: Partial<Record<HeartStyle, number>>;

  // Fill / decor
  /** 0..1 — line spacing of solid and hatched fills (1 = tight). */
  fillDensity?: number;
  /** Base hatch direction, radians (per-heart tilt and jitter added). */
  hatchAngle?: number;
  /** 0..1 — per-heart hatch angle jitter (±30° at 1). */
  hatchJitter?: number;
  /** 0..1 — fraction of hearts pierced by a cupid's arrow. */
  arrows?: number;
  /** 0..1 — fraction of hearts with multi-pass bold outlines. */
  boldOutline?: number;

  // Render
  /** 0..1 — shadow-side band hatch (0 = pure line art). */
  shading?: number;
  /** Page-space light direction, radians (default upper-right-ish). */
  lightAngle?: number;
  occlude?: boolean;
  penWidth?: number;
  wobble?: number;
}

const DEFAULTS: Required<Omit<HeartsOptions, 'width' | 'height' | 'margin' | 'seed' | 'region'>> = {
  count: 70,
  clustering: 0.35,
  minSeparation: 24,
  softRegionEdge: false,
  heartScale: 44,
  scaleVariance: 0.3,
  depthGrade: 0.15,
  plumpness: 0.5,
  plumpVariance: 0.25,
  tilt: 0.35,
  age: 18,
  mix: {
    outline: 1,
    solid: 1,
    hatched: 1,
    broken: 0.4,
  },
  fillDensity: 0.5,
  hatchAngle: -35 * (Math.PI / 180),
  hatchJitter: 0.3,
  arrows: 0.1,
  boldOutline: 0.3,
  shading: 0,
  lightAngle: Math.PI * 1.75, // light from the upper right (page y is down)
  occlude: true,
  penWidth: 1.4,
  wobble: 0.8,
};

/** Hard cap so a runaway count knob can't blow up plot time. */
const MAX_HEARTS = 2000;

export function generateHearts(options: HeartsOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  const noise = createNoise(subSeed(seed, 5));
  const pageRegion =
    o.region && o.region.kind !== 'full' ? compileRegion(o.region, { x0, y0, x1, y1 }) : null;
  const specs = placeHearts(
    {
      count: Math.min(MAX_HEARTS, Math.max(1, Math.round(o.count))),
      clustering: o.clustering,
      minSeparation: o.minSeparation,
      softEdge: o.softRegionEdge,
      heartScale: o.heartScale,
      scaleVariance: o.scaleVariance,
      depthGrade: o.depthGrade,
      plumpness: o.plumpness,
      plumpVariance: o.plumpVariance,
      tilt: o.tilt,
      arrows: o.arrows,
      boldOutline: o.boldOutline,
      mix: o.mix,
      x0,
      y0,
      x1,
      y1,
      region: pageRegion,
    },
    noise,
    seed
  );

  // 0 at 18 (adult — every kid effect is a skipped branch, so the adult
  // path is byte-identical to the pre-age generator), 1 at 3.
  const childish = (18 - clamp(o.age, 3, 18)) / 15;

  const builds: HeartBuild[] = specs.map((s) =>
    buildHeart(s, {
      shading: o.shading,
      lightAngle: o.lightAngle,
      fillDensity: o.fillDensity,
      hatchAngle: o.hatchAngle,
      hatchJitter: o.hatchJitter,
      penWidth: o.penWidth,
      childish,
    })
  );

  // Hidden-line removal against a shared depth buffer holding every heart's
  // silhouette — a farther heart's lines are cut wherever a nearer heart
  // covers them. The even-odd scanline fill handles the non-convex cleft
  // exactly. A heart never occludes itself: its silhouette shares its depth
  // and `hidden` needs something strictly nearer.
  const cell = Math.max(0.6, o.penWidth * 0.5);
  const step = Math.max(1, o.penWidth * 0.8);
  let zbuf: ZBuffer | null = null;
  let off: ZOffset = { offX: 0, offY: 0 };
  if (o.occlude && specs.length > 1) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of builds) {
      for (const p of b.occluder) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (isFinite(minX)) {
      const pad = 4 * cell;
      off = { offX: -minX + pad, offY: -minY + pad };
      zbuf = new ZBuffer(maxX - minX + 2 * pad, maxY - minY + 2 * pad, cell);
      for (const b of builds) {
        zbuf.fill(
          b.occluder.map((p) => ({ x: p.x + off.offX, y: p.y + off.offY })),
          b.depth
        );
      }
    }
  }

  const lines: FlowLine[] = [];
  for (const b of builds) {
    for (const s of b.strokes) {
      if (zbuf) {
        for (const run of splitVisible(s.points, b.depth, zbuf, step, off)) {
          lines.push({ ...s, points: run });
        }
      } else {
        lines.push(s);
      }
    }
  }

  // Hand finish: a light wobble, damped on the fill passes so concentric and
  // hatch lines never cross each other. Placement already insets each centre
  // by its bounding radius, so the pile stays on the sheet; the web layer
  // still clips defensively for a clean plot. A young hand shakes harder and
  // faster (the boosted amplitude can poke ~1px past the margin — accepted,
  // the web clip trims it); the adult branch keeps today's exact literals.
  const finished = applyHandDrawnStyle(
    { lines, width, height, seed },
    childish > 0
      ? {
          amplitude: o.wobble * (1 + 1.4 * Math.pow(childish, 1.7)),
          wavelength: lerp(38, 26, childish),
          seed,
          layerAmplitude: { fill: lerp(0.5, 0.85, childish) },
        }
      : { amplitude: o.wobble, wavelength: 38, seed, layerAmplitude: { fill: 0.5 } }
  ).lines;

  return { lines: finished, width, height, seed };
}
