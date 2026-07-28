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
import { applyRigid, makeDrift, rigidFit } from './drift.js';
import { makeCracks, type CrackNetwork } from './cracks.js';
import { channelSplit, clipHalfPlane, ringArea, shatterCell } from './shatter.js';
import {
  boundsOf,
  clipLineOutside,
  makeOccluder,
  type Bounds,
  type Occluder,
} from './occlude.js';
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
  /** 0..1 how concentrated the carve is at the strike: 1 keeps destruction
   *  in one crater around the epicentre, 0 lets the whole trajectory sweep
   *  its channel end to end (the reference plates). */
  focus?: number;
  /** 0..1 bulk advection: how far the stroke drags the surrounding material
   *  along its direction of travel — whole cells ride a smooth shared field
   *  as RIGID plates (laminar drifts; plates that can't ride rigidly
   *  fracture), never per-cell scatter, never bending. */
  drift?: number;
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
  /** 0..1 tonal spread of the fills: 0 draws every cell at one pitch, 1
   *  commits regions to tiers from near-solid dark to sparse near-paper —
   *  the deliberate value design of the reference plates. */
  toneRange?: number;
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
  /** Hidden-line removal (default true): displaced material hides the lines
   *  beneath it, with a paper hold-off. Off ⇒ overlaps overprint — the
   *  multi-pen riso look. */
  occlude?: boolean;
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
  focus: 0.35,
  drift: 0.55,
  impactStrength: 0,
  shatter: 0.8,
  scatter: 0.3,
  debris: 0.25,
  crush: 0.7,
  sweep: 0.7,
  fill: 1,
  toneRange: 0.65,
  fillStyle: 'texture',
  inks: 2,
  inkBalance: 0.5,
  inkMode: 'regions',
  inkPath: true,
  occlude: true,
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
  const driftField =
    field && o.drift > 0
      ? makeDrift(field, radius, { drift: o.drift, energy: o.energy, seed: subSeed(seed, 5) })
      : null;

  const fillNoise = createNoise(subSeed(seed, 2));
  const inkNoise = createNoise(subSeed(seed, 4));
  const lines: FlowLine[] = [];
  const wobbleStep = Math.max(2, o.penWidth * 2);
  const push = (points: Point[], layer: string) => {
    lines.push({ points: o.wobble > 0 ? densify(points, wobbleStep) : points, pen: 'fine', layer });
  };

  // Every drawn shape is buffered as a piece so displaced material can
  // OCCLUDE what it comes to rest over: shards land on top of the pane,
  // drifted cells slide over their static neighbours, and the lines
  // beneath stop at the shape above (with a paper hold-off) instead of
  // printing through it.
  interface Piece {
    z: number;
    layer: string;
    occ: Occluder | null;
    bounds: Bounds;
    lines: Point[][];
  }
  const pieces: Piece[] = [];

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
          o.shatter,
          o.focus
        )
      : null;
    const resting = cell.ring ?? rectAt(cell.centre, cell.hx, cell.hy, cell.rotation);
    // Whole cells (intact + cracked) ride the drift field RIGIDLY: the
    // best-fit translation + rotation of the field over their vertices —
    // glass never bends, so every edge and fill line stays dead straight.
    // Where the field's gradient disagrees with rigidity, the plate
    // fractures into smaller rigid plates instead (below). Shards inherit
    // the field at their parent's centre (shatterCell owns their
    // ballistics), so nothing is displaced twice.
    const nearDrift =
      driftField !== null && dmg !== null && dmg.hit.d - extent < driftField.range;
    const anchor = nearDrift ? driftField!.at(cell.centre.x, cell.centre.y) : null;

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
    // `toneRange` spreads that one pitch into committed regional tiers —
    // near-solid darks through sparse near-paper — posterized so the value
    // design reads as decided, not dithered.
    const toneK = 2.2 / region.extent;
    const tone =
      Math.floor(
        clamp01(0.5 + 0.5 * fillNoise.noise2D(cell.centre.x * toneK + 37, cell.centre.y * toneK - 91)) *
          3.999
      ) / 3;
    const tierMul = lerp(0.55, 2.6, Math.pow(tone, 1.1)) * (0.92 + 0.16 * cellRng());
    const fillSpacing = Math.max(
      1.15 * o.penWidth,
      Math.max(1.8 * o.penWidth, 2.2) * lerp(1, tierMul, clamp01(o.toneRange))
    );
    const D = dmg?.D ?? 0;
    const fillPoly = (poly: Point[], rotOffset = 0): Point[][] => {
      switch (o.fillStyle) {
        case 'texture': {
          if (rotOffset === 0) return textureFill(poly, texture, fillSpacing, o.penWidth, cellRng);
          // The pattern is ON the glass: a spun plate carries its fill
          // rotated with it — fill in the plate's frame, rotate back. This
          // is also what keeps a landed shard legible on top of a
          // same-texture neighbour instead of camouflaging into it.
          const n = poly.length - 1;
          let gx = 0;
          let gy = 0;
          for (let i = 0; i < n; i++) {
            gx += poly[i].x;
            gy += poly[i].y;
          }
          gx /= n;
          gy /= n;
          const cosB = Math.cos(-rotOffset);
          const sinB = Math.sin(-rotOffset);
          const local = poly.map((p) => {
            const lx = p.x - gx;
            const ly = p.y - gy;
            return { x: gx + lx * cosB - ly * sinB, y: gy + lx * sinB + ly * cosB };
          });
          return textureFill(local, texture, fillSpacing, o.penWidth, cellRng).map((span) =>
            span.map((p) => {
              const lx = p.x - gx;
              const ly = p.y - gy;
              return { x: gx + lx * cosB + ly * sinB, y: gy - lx * sinB + ly * cosB };
            })
          );
        }
        case 'hatch':
          return hatchConvex(
            poly,
            cell.rotation + rotOffset + Math.PI / 4,
            lerp(4 * o.penWidth, 2.5 * o.penWidth, D),
            o.penWidth
          );
        case 'concentric':
          return concentricFill(poly, lerp(4 * o.penWidth, 2.5 * o.penWidth, D), o.penWidth);
        default:
          return [];
      }
    };
    // Pieces are FINAL rigid geometry — convex rings — so the fill is
    // computed on the ring as drawn and the ring itself is the occluder.
    // `occludes` marks material that MOVED, so it hides what it lies over.
    // z is banded by HOW the material moved (shards over strips over
    // plates, farther-travelled plates over near-static ones) with a tiny
    // per-piece epsilon so every overlapping pair is strictly ordered —
    // near-tie damage must never decide visibility by luck. Specks are too
    // small to occlude: as occluders they'd just pinhole the fills below.
    const addPiece = (
      poly: Point[],
      filled: boolean,
      opts: { z: number; occludes: boolean; rotOffset?: number }
    ) => {
      if (poly.length < 4) return;
      const area = ringArea(poly);
      let maxEdge = 0;
      for (let i = 0; i < poly.length - 1; i++) {
        const e = Math.hypot(poly[i + 1].x - poly[i].x, poly[i + 1].y - poly[i].y);
        if (e > maxEdge) maxEdge = e;
      }
      // Degenerate slivers — long but thinner than the pen — would print as
      // stray scratch lines across whatever they landed on (their fill is
      // empty and they're too small to occlude). A plotter can't draw a
      // shape thinner than its pen; deliberate specks stay (short edges).
      if (maxEdge > 6 * o.penWidth && area / maxEdge < 0.9 * o.penWidth) return;
      const pls: Point[][] = [poly];
      if (filled) for (const span of fillPoly(poly, opts.rotOffset ?? 0)) pls.push(span);
      // Same fate for any long, elongated shape too thin to carry a single
      // fill span: an empty outline slashed across the material below reads
      // as a scratch, not a shard.
      if (
        filled &&
        pls.length === 1 &&
        maxEdge > 8 * o.penWidth &&
        area < 0.2 * maxEdge * maxEdge
      ) {
        return;
      }
      const occludes =
        opts.occludes && area > 2.5 * o.penWidth * (2.5 * o.penWidth);
      pieces.push({
        z: opts.z + pieces.length * 1e-6,
        layer: ink,
        occ: occludes ? makeOccluder(poly) : null,
        bounds: boundsOf(poly),
        lines: pls,
      });
    };

    if (dmg && (dmg.zone === 'dust' || dmg.zone === 'cascade')) {
      const shards = shatterCell(
        resting,
        extent,
        {
          f: D,
          dx: anchor?.dx ?? 0,
          dy: anchor?.dy ?? 0,
          radius,
          shatter: o.shatter,
          scatter: o.scatter,
          debris: o.debris,
          crush: o.crush,
          sweep: o.sweep,
          tx: dmg.hit.tx,
          ty: dmg.hit.ty,
          side: dmg.hit.side,
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
      // Flying material lands ON TOP of the pane: always above whole cells.
      for (const shard of shards) {
        addPiece(shard.ring, regionFilled, { z: 5 + D, occludes: true, rotOffset: shard.rot });
      }
    } else {
      // A surviving cell the stroke touches is SLICED by it first: clean
      // cuts along the local travel direction at both channel rims, the
      // in-channel strip nudged out to the flanks — the line cuts through,
      // it never drapes a shape around itself.
      let bodies: Point[][] = [resting];
      // shatter 0 = the pane refuses to break at all — no slicing either.
      if (dmg && o.shatter > 0 && dmg.hit.d < channel + Math.hypot(cell.hx, cell.hy)) {
        const nHat = { x: -dmg.hit.ty, y: dmg.hit.tx };
        const q = { x: dmg.hit.qx, y: dmg.hit.qy };
        const split = channelSplit(resting, q, nHat, channel);
        if (split.strip.length > 0) {
          bodies = split.outside;
          for (const strip of split.strip) {
            const n = strip.length - 1;
            let gx = 0;
            let gy = 0;
            for (let i = 0; i < n; i++) {
              gx += strip[i].x;
              gy += strip[i].y;
            }
            gx /= n;
            gy /= n;
            const sFrag = nHat.x * (gx - q.x) + nHat.y * (gy - q.y);
            const sideF = Math.abs(sFrag) > 1e-6 ? Math.sign(sFrag) : dmg.hit.side;
            const shift =
              (channel - Math.abs(sFrag)) * (1.1 + 0.5 * impactRng()) + o.penWidth;
            const rot = (2 * impactRng() - 1) * 0.15;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            addPiece(
              strip.map((p) => {
                const lx = p.x - gx;
                const ly = p.y - gy;
                return {
                  x: gx + nHat.x * sideF * shift + lx * cos - ly * sin,
                  y: gy + nHat.y * sideF * shift + lx * sin + ly * cos,
                };
              }),
              regionFilled,
              { z: 4 + D, occludes: true, rotOffset: rot }
            );
          }
        }
      }
      if (dmg && dmg.zone === 'cracked' && cracks) {
        // Cracked in place: the shared spiderweb facets this cell — and the
        // facets ARE the fracture. Each rides the drift field with its own
        // best-fit rigid motion (edges always straight) on top of the
        // hairline gap and whisper of rotation that read as a cracked pane.
        for (const body of bodies) {
          for (const facet of cracks.facet(body)) {
            // The occasional facet falls out of the cracked pane — a hole
            // in the spiderweb, very glass.
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
            const seated = facet.map((p) => {
              const lx = (p.x - gx) * 0.985;
              const ly = (p.y - gy) * 0.985;
              return { x: gx + lx * cos - ly * sin, y: gy + lx * sin + ly * cos };
            });
            const fit = nearDrift ? rigidFit(seated, driftField!) : null;
            const moved = fit ? seated.map((p) => applyRigid(fit, p)) : seated;
            // Moved material always sits in a band ABOVE the static pane —
            // a plate that slid onto a neighbour must beat it regardless of
            // their damage — and farther-travelled stacks higher.
            const disp = fit ? Math.hypot(fit.dx, fit.dy) : 0;
            const moving = disp > 0.6 * o.penWidth;
            addPiece(moved, regionFilled, {
              z: moving ? 1.5 + 0.5 * D + 0.9 * clamp01(disp / (0.5 * radius)) : D,
              occludes: moving,
              rotOffset: rot + (fit ? Math.atan2(fit.sin, fit.cos) : 0),
            });
          }
        }
      } else {
        // Intact — optionally leaned on by the strike (impactStrength > 0),
        // then riding the drift field rigidly. Where the field's gradient
        // fights rigidity (the fit residual), the plate FRACTURES along the
        // local travel direction into smaller rigid plates — glass crackle
        // near the cuts, never curvature.
        let dx = 0;
        let dy = 0;
        let dRot = 0;
        let scale = 1;
        if (dmg && o.impactStrength > 0 && dmg.hit.d < radius) {
          const f = smoothstep(clamp01(1 - dmg.hit.d / radius));
          const d = dmg.hit.d;
          const ux = d > 1e-6 ? (cell.centre.x - dmg.hit.qx) / d : dmg.rx;
          const uy = d > 1e-6 ? (cell.centre.y - dmg.hit.qy) / d : dmg.ry;
          const pushDist = o.impactStrength * 0.5 * radius * f * f;
          dx += pushDist * ux;
          dy += pushDist * uy;
          dRot +=
            o.impactStrength *
            (dmg.hit.side * (35 * Math.PI / 180) + (2 * impactRng() - 1) * (10 * Math.PI / 180)) *
            f;
          scale = 1 - 0.35 * o.impactStrength * f;
        }
        const rigid = dx !== 0 || dy !== 0 || dRot !== 0 || scale !== 1;
        const cosS = Math.cos(dRot);
        const sinS = Math.sin(dRot);
        const ride = (ring: Point[], depth: number): void => {
          const fit = nearDrift ? rigidFit(ring, driftField!) : null;
          if (!fit) {
            addPiece(ring, regionFilled, {
              z: rigid ? 1.5 + 0.5 * D : D,
              occludes: rigid,
              rotOffset: dRot,
            });
            return;
          }
          const n = ring.length - 1;
          let gx = 0;
          let gy = 0;
          for (let i = 0; i < n; i++) {
            gx += ring[i].x;
            gy += ring[i].y;
          }
          gx /= n;
          gy /= n;
          let ext = 0;
          for (let i = 0; i < n; i++) {
            const d2 = Math.hypot(ring[i].x - gx, ring[i].y - gy);
            if (d2 > ext) ext = d2;
          }
          const tol = Math.max(2.5 * o.penWidth, 0.18 * ext) * (1.25 - 0.6 * o.crush);
          if (fit.residual > tol && depth < 3 && ext > 4 * o.penWidth) {
            // Crack along the local travel direction, like the channel cuts.
            const u = driftField!.at(gx, gy);
            const nHat = { x: -u.ty, y: u.tx };
            const off = (2 * impactRng() - 1) * 0.25 * ext;
            const a = { x: gx + nHat.x * off, y: gy + nHat.y * off };
            const lo = clipHalfPlane(ring, a, nHat);
            const hi = clipHalfPlane(ring, a, { x: -nHat.x, y: -nHat.y });
            if (lo.length >= 4 && hi.length >= 4) {
              ride(lo, depth + 1);
              ride(hi, depth + 1);
              return;
            }
          }
          // Hairline extra spin on fractured plates — crackle, not pattern.
          const jitter = depth > 0 ? (2 * impactRng() - 1) * 0.06 : 0;
          const theta = Math.atan2(fit.sin, fit.cos) + jitter;
          const spun = { ...fit, cos: Math.cos(theta), sin: Math.sin(theta) };
          // Moved material always sits in a band ABOVE the static pane — a
          // plate that slid onto a neighbour must beat it regardless of
          // their damage — and farther-travelled stacks higher.
          const disp = Math.hypot(fit.dx, fit.dy);
          const moving = rigid || depth > 0 || disp > 0.6 * o.penWidth;
          addPiece(ring.map((p) => applyRigid(spun, p)), regionFilled, {
            z: moving ? 1.5 + 0.5 * D + 0.9 * clamp01(disp / (0.5 * radius)) : D,
            occludes: moving,
            rotOffset: dRot + theta,
          });
        };
        for (const body of bodies) {
          const seated = rigid
            ? body.map((p) => {
                const lx = (p.x - cell.centre.x) * scale;
                const ly = (p.y - cell.centre.y) * scale;
                return {
                  x: cell.centre.x + dx + lx * cosS - ly * sinS,
                  y: cell.centre.y + dy + lx * sinS + ly * cosS,
                };
              })
            : body;
          ride(seated, 0);
        }
      }
    }
  }

  // Hidden-line removal: every piece's lines are clipped against every
  // higher-z occluder overlapping it (with a paper hold-off), so landed
  // shards and drifted cells read as sitting in front of the pane instead
  // of printing through it. The per-piece z epsilon makes every pair
  // strictly ordered — any two overlapping pieces resolve one way.
  const occluders = o.occlude ? pieces.filter((p) => p.occ !== null) : [];
  if (occluders.length > 0) {
    // Wide enough to READ as reserved paper: with a sub-pen gap, two
    // stacked plates sharing a fill direction fuse into one mass and the
    // upper plate's edges read as stray scratch lines across it.
    const outset = 2 * o.penWidth;
    const gridStep = Math.max(48, cellSize * 2);
    const grid = new Map<string, number[]>();
    occluders.forEach((oc, i) => {
      const b = oc.occ!.bounds;
      for (let ix = Math.floor((b.x0 - outset) / gridStep); ix <= Math.floor((b.x1 + outset) / gridStep); ix++) {
        for (let iy = Math.floor((b.y0 - outset) / gridStep); iy <= Math.floor((b.y1 + outset) / gridStep); iy++) {
          const key = ix + ':' + iy;
          let bucket = grid.get(key);
          if (!bucket) {
            bucket = [];
            grid.set(key, bucket);
          }
          bucket.push(i);
        }
      }
    });
    const overlaps = (a: Bounds, b: Bounds) =>
      a.x0 <= b.x1 + outset && a.x1 >= b.x0 - outset && a.y0 <= b.y1 + outset && a.y1 >= b.y0 - outset;
    for (const piece of pieces) {
      const b = piece.bounds;
      const seen = new Set<number>();
      let ls = piece.lines;
      for (let ix = Math.floor(b.x0 / gridStep); ix <= Math.floor(b.x1 / gridStep) && ls.length > 0; ix++) {
        for (let iy = Math.floor(b.y0 / gridStep); iy <= Math.floor(b.y1 / gridStep) && ls.length > 0; iy++) {
          const bucket = grid.get(ix + ':' + iy);
          if (!bucket) continue;
          for (const i of bucket) {
            if (seen.has(i)) continue;
            seen.add(i);
            const oc = occluders[i];
            if (oc === piece || oc.z <= piece.z || !overlaps(oc.occ!.bounds, b)) continue;
            const next: Point[][] = [];
            for (const l of ls) {
              if (overlaps(oc.occ!.bounds, boundsOf(l))) next.push(...clipLineOutside(l, oc.occ!, outset));
              else next.push(l);
            }
            ls = next;
            if (ls.length === 0) break;
          }
        }
      }
      piece.lines = ls;
    }
  }
  for (const piece of pieces) for (const l of piece.lines) push(l, piece.layer);

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
