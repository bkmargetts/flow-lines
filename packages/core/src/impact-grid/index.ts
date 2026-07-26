import type { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { clamp01, lerp } from '../lib/math.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { createNoise } from '../noise.js';
import { densify, smoothstep } from '../lib/spatial.js';
import { smoothPolyline } from '../lib/polyline.js';
import { layoutCells, makeRegion, rectAt, type RegionKind } from './layout.js';
import { preparePath } from './impact.js';
import { cellDamage } from './impact.js';
import { makeCracks, type CrackNetwork } from './cracks.js';
import { shatterCell } from './shatter.js';
import { concentricFill, hatchConvex } from './hatch.js';
import { TEXTURES, textureFill } from './textures.js';

/**
 * One pane under one strike. A dense mosaic of texture-filled cells —
 * packed squares, a border frame, or tall stacked bars — occupies a shaped
 * slab floating in paper (band / slab / disc / full page). A drawn
 * trajectory strikes it: damage radiates from the epicentre across the
 * whole pane, graded dust → detached shard cascade → cracked-in-place
 * facets whose fracture lines run continuously across cell boundaries →
 * intact; the stroke also sweeps its own channel clean, debris cascading
 * along its direction of travel. The gesture's speed drives the violence
 * (fast flicks leave sparse drawn points — that spacing is read as
 * velocity). Any number of pen layers ('ink-0' … 'ink-N') split the mosaic
 * in coherent swaths (or ordered by damage); the trajectory itself plots on
 * a 'path' layer with a terminal dot. Plain
 * stroked paths, deterministic per seed; no path ⇒ the pristine mosaic.
 */
export interface ImpactGridOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** The slab the mosaic occupies: inset 'slab' (default), a central
   *  horizontal 'band', a 'disc', or the 'full' framed page. */
  region?: RegionKind;
  /** 'mosaic' (default) is the multi-scale patchwork — big panels beside
   *  clusters of small patches; 'grid' packs even squares; 'frame' keeps a
   *  border band of the grid; 'bars' builds tall stacked columns. */
  layout?: 'mosaic' | 'grid' | 'frame' | 'bars';
  /** Cells deep the 'frame' band runs, 1..6. */
  frameDepth?: number;

  // Mosaic
  /** Mean cell pitch, px. Default: min(innerW, innerH) / 16. */
  cellSize?: number;
  /** 0..1 per-cell size jitter. */
  sizeVariation?: number;
  /** 0..1 centre jitter as a fraction of pitch. */
  positionJitter?: number;
  /** 0..1 per-cell rotation jitter. */
  rotationJitter?: number;
  /** 0..0.6 mean gap between cells as a fraction of pitch. */
  gap?: number;
  /** 0..1 scale mixture of the 'mosaic' layout: 0 ≈ even panels, 1 ≈ big
   *  slabs beside clusters of tiny patches. */
  granularity?: number;

  // Impact — inert when the path is missing/short: pristine mosaic.
  /** Impact trajectory in page px (the web layer passes the RAW drawn
   *  points — their spacing carries the gesture's speed). */
  impactPath?: Point[];
  /** Channel falloff radius, px. Default: min(innerW, innerH) * 0.3. */
  impactRadius?: number;
  /** 0..1 pane-wide stress: how far the shared crack network and damage
   *  radiate from the epicentre across the whole slab. */
  paneStress?: number;
  /** 0..1 overall impact violence, scaling the gesture's speed. */
  energy?: number;
  /** 0..1 radial push / torque of intact cells near the channel (0 = the
   *  pane stands still outside its damage zones). */
  impactStrength?: number;
  /** 0..1 damage-zone width (dust / cascade / cracked thresholds). */
  shatter?: number;
  /** 0..1 sideways spray of the cascade off the strike. */
  scatter?: number;
  /** 0..1 chance shards vanish entirely — pulverised. */
  debris?: number;
  /** 0..1 shard fineness (subdivision depth near the strike). */
  crush?: number;
  /** 0..1 how far shards are carried along the stroke's direction of travel
   *  — also how hard the channel is swept clean. */
  sweep?: number;

  // Marks
  /** 0..1 fraction of cells carrying fill marks (region-committed). */
  fill?: number;
  /** The fill vocabulary: 'texture' draws each cell in one of eight fill
   *  patterns; 'hatch' / 'concentric' are single-style; 'none' outlines. */
  fillStyle?: 'texture' | 'hatch' | 'concentric' | 'none';
  /** How many mosaic pen layers, ≥1 — cells plot on layers 'ink-0' …
   *  'ink-(n-1)' and the web/export side maps each to its own colour. */
  inks?: number;
  /** 0..1 skew of the swath split: 0.5 shares the pane evenly, lower
   *  favours the first inks, higher the last. */
  inkBalance?: number;
  /** How the inks are placed: 'regions' commits large coherent swaths;
   *  'damage' orders them by destruction — ink 0 is calm material, the
   *  last ink the hottest zone, the way the blue piece reads. */
  inkMode?: 'regions' | 'damage';
  /** Ink the trajectory itself as a thin stroke with a terminal dot. */
  inkPath?: boolean;
  penWidth?: number;
  wobble?: number;
  /** Reorder strokes to cut pen-up travel (default true) */
  optimize?: boolean;
}

const DEFAULTS: Required<
  Omit<ImpactGridOptions, 'width' | 'height' | 'margin' | 'seed' | 'impactPath' | 'cellSize' | 'impactRadius'>
> = {
  region: 'slab',
  layout: 'mosaic',
  frameDepth: 3,
  sizeVariation: 0.15,
  positionJitter: 0.03,
  rotationJitter: 0.02,
  gap: 0.06,
  granularity: 0.6,
  paneStress: 0.6,
  energy: 0.6,
  impactStrength: 0,
  shatter: 0.8,
  scatter: 0.3,
  debris: 0.25,
  crush: 0.7,
  sweep: 0.7,
  fill: 1,
  fillStyle: 'texture',
  inks: 2,
  inkBalance: 0.5,
  inkMode: 'regions',
  inkPath: true,
  penWidth: 1.2,
  wobble: 0,
  optimize: true,
};

export function generateImpactGrid(options: ImpactGridOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const innerMin = Math.min(width - 2 * margin, height - 2 * margin);
  const cellSize = options.cellSize ?? innerMin / 16;
  const radius = options.impactRadius ?? innerMin * 0.25;
  const channel = Math.max(cellSize * 0.5, radius * 0.12);
  const region = makeRegion(o.region, width, height, margin);

  const cells = layoutCells({
    width,
    height,
    margin,
    seed,
    layout: o.layout,
    frameDepth: o.frameDepth,
    cellSize,
    sizeVariation: o.sizeVariation,
    positionJitter: o.positionJitter,
    rotationJitter: o.rotationJitter,
    gap: o.gap,
    granularity: o.granularity,
    penWidth: o.penWidth,
    region,
  });
  if (cells.length === 0) return { lines: [], width, height, seed };

  const field = preparePath(o.impactPath, radius, region, innerMin);
  const epi = field?.epicentre ?? null;
  const reach = epi
    ? region.extent * (0.22 + 0.55 * o.energy * (0.3 + 0.7 * epi.speed))
    : 0;
  const cracks: CrackNetwork | null =
    epi && o.paneStress > 0 ? makeCracks(epi, reach, region, seed) : null;

  const fillNoise = createNoise(subSeed(seed, 2));
  const inkNoise = createNoise(subSeed(seed, 4));
  const lines: FlowLine[] = [];
  const wobbleStep = Math.max(2, o.penWidth * 2);
  const push = (points: Point[], layer: string) => {
    lines.push({ points: o.wobble > 0 ? densify(points, wobbleStep) : points, pen: 'fine', layer });
  };

  for (const cell of cells) {
    const extent = Math.max(cell.hx, cell.hy);
    const impactRng = makeRandom(subSeed(seed, cell.index) + 17);
    impactRng();
    impactRng();
    const cellRng = makeRandom(subSeed(seed, cell.index) + 41);
    cellRng();
    cellRng();

    const dmg = field
      ? cellDamage(
          field,
          cell.centre.x,
          cell.centre.y,
          extent,
          radius,
          reach,
          o.energy,
          o.paneStress,
          o.shatter
        )
      : null;

    // Ink assignment: hemisphere-scale swaths quantised into `inks` bins
    // (extent-relative noise through a balance curve), or — in 'damage'
    // mode — inks ordered by destruction, calm material first.
    const inkCount = Math.max(1, Math.round(o.inks));
    const inkK = 0.9 / region.extent;
    const D0 = dmg?.D ?? 0;
    const inkNoiseVal = inkNoise.noise2D(cell.centre.x * inkK, cell.centre.y * inkK);
    const gamma = Math.pow(4, 2 * (0.5 - clamp01(o.inkBalance)));
    const inkT =
      o.inkMode === 'damage'
        ? clamp01(D0 * 1.15 + 0.12 * inkNoiseVal)
        : Math.pow(clamp01(inkNoiseVal * 0.5 + 0.5), gamma);
    const ink = `ink-${Math.min(inkCount - 1, Math.floor(inkT * inkCount))}`;
    const fillK = 3 / region.extent;
    const regionFilled =
      o.fill > 0 &&
      fillNoise.noise2D(cell.centre.x * fillK, cell.centre.y * fillK) * 0.5 + 0.5 < o.fill;
    const texture = TEXTURES[Math.floor(cellRng() * TEXTURES.length) % TEXTURES.length];
    // Fine pitch: the fills should read as tone, not as pattern samples.
    const fillSpacing = Math.max(1.8 * o.penWidth, 2.2);
    const D = dmg?.D ?? 0;
    const fillPoly = (poly: Point[]): Point[][] => {
      switch (o.fillStyle) {
        case 'texture':
          return textureFill(poly, texture, fillSpacing, o.penWidth, cellRng);
        case 'hatch':
          return hatchConvex(
            poly,
            cell.rotation + Math.PI / 4,
            lerp(4 * o.penWidth, 2.5 * o.penWidth, D),
            o.penWidth
          );
        case 'concentric':
          return concentricFill(poly, lerp(4 * o.penWidth, 2.5 * o.penWidth, D), o.penWidth);
        default:
          return [];
      }
    };
    const emit = (poly: Point[], filled: boolean) => {
      push(poly, ink);
      if (filled) for (const span of fillPoly(poly)) push(span, ink);
    };

    if (dmg && (dmg.zone === 'dust' || dmg.zone === 'cascade')) {
      const resting = rectAt(cell.centre, cell.hx, cell.hy, cell.rotation);
      const shards = shatterCell(
        resting,
        extent,
        {
          f: D,
          dx: 0,
          dy: 0,
          radius,
          shatter: o.shatter,
          scatter: o.scatter,
          debris: o.debris,
          crush: o.crush,
          sweep: o.sweep,
          tx: dmg.hit.tx,
          ty: dmg.hit.ty,
          rx: dmg.rx,
          ry: dmg.ry,
          channel,
          d: dmg.hit.d,
          dust: dmg.zone === 'dust',
          cone: dmg.downstream,
          penWidth: o.penWidth,
        },
        impactRng
      );
      for (const shard of shards) emit(shard, regionFilled);
    } else if (dmg && dmg.zone === 'cracked' && cracks) {
      // Cracked in place: the shared spiderweb facets this cell; facets stay
      // lodged — hairline gaps and a whisper of rotation, no displacement.
      const resting = rectAt(cell.centre, cell.hx, cell.hy, cell.rotation);
      for (const facet of cracks.facet(resting)) {
        // The occasional facet falls out of the cracked pane — a hole in
        // the spiderweb, very glass.
        if (impactRng() < 0.5 * o.debris * D) continue;
        const n = facet.length - 1;
        let gx = 0;
        let gy = 0;
        for (let i = 0; i < n; i++) {
          gx += facet[i].x;
          gy += facet[i].y;
        }
        gx /= n;
        gy /= n;
        const rot = (2 * impactRng() - 1) * 0.05 * D;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        emit(
          facet.map((p) => {
            const lx = (p.x - gx) * 0.985;
            const ly = (p.y - gy) * 0.985;
            return { x: gx + lx * cos - ly * sin, y: gy + lx * sin + ly * cos };
          }),
          regionFilled
        );
      }
    } else {
      // Intact — optionally leaned on by the strike (impactStrength > 0).
      let cx = cell.centre.x;
      let cy = cell.centre.y;
      let rotation = cell.rotation;
      let scale = 1;
      if (dmg && o.impactStrength > 0 && dmg.hit.d < radius) {
        const f = smoothstep(clamp01(1 - dmg.hit.d / radius));
        const d = dmg.hit.d;
        const ux = d > 1e-6 ? (cx - dmg.hit.qx) / d : dmg.rx;
        const uy = d > 1e-6 ? (cy - dmg.hit.qy) / d : dmg.ry;
        const pushDist = o.impactStrength * 0.5 * radius * f * f;
        cx += pushDist * ux;
        cy += pushDist * uy;
        rotation +=
          o.impactStrength *
          (dmg.hit.side * (35 * Math.PI / 180) + (2 * impactRng() - 1) * (10 * Math.PI / 180)) *
          f;
        scale = 1 - 0.35 * o.impactStrength * f;
      }
      emit(rectAt({ x: cx, y: cy }, cell.hx * scale, cell.hy * scale, rotation), regionFilled);
    }
  }

  if (o.inkPath && field) {
    const stroke = smoothPolyline(field.points, 2);
    if (stroke.length >= 2) {
      lines.push({ points: stroke, pen: 'fine', layer: 'path' });
      const end = stroke[stroke.length - 1];
      const dotR = o.penWidth * 1.6;
      const dot: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        dot.push({ x: end.x + dotR * Math.cos(a), y: end.y + dotR * Math.sin(a) });
      }
      lines.push({ points: dot, pen: 'fine', layer: 'path' });
    }
  }

  // Optional hand finish — off by default: the reference read is crisp,
  // the chaos lives in the displacement, not the pen.
  const finished =
    o.wobble > 0
      ? applyHandDrawnStyle(
          { lines, width, height, seed },
          {
            amplitude: o.wobble,
            wavelength: 30,
            seed,
            layerAmplitude: { path: 0.5 },
            amplitudeScale: field
              ? (x, y) => 1 + field.falloff(field.nearest(x, y).d)
              : undefined,
          }
        ).lines
      : lines;

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Discrete shapes: reorder only — chaining would fuse separate outlines.
  return o.optimize ? orderPlot(result) : result;
}
