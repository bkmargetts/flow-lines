import type { FlowLine, Point } from '../flow-lines.js';
import { clamp01, lerp } from '../lib/math.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { createNoise } from '../noise.js';
import { densify } from '../lib/spatial.js';
import type { PlacedCell, RegionSpec } from './layout.js';
import { makeCracks, type CrackNetwork } from './cracks.js';
import { ringArea, shatterCell } from './shatter.js';
import {
  boundsOf,
  clipLineOutside,
  makeOccluder,
  type Bounds,
  type Occluder,
} from './occlude.js';
import { concentricFill, hatchConvex } from './hatch.js';
import { TEXTURES, textureFill } from './textures.js';
import { pointDamage, type Impact } from './point-impacts.js';

/**
 * The point-strike engine: a working set of convex glass fragments struck by
 * invisible impact points, one after another — each strike re-fractures
 * whatever the previous ones left. Shared by the impact grid's `strikes`
 * mode (strikes scattered ON the pane, radial ejection) and by Shard Rain
 * (the pane dropped onto pins, gravity owning the ballistics).
 */

/** One piece of glass at rest or in flight between strikes. */
export interface Frag {
  /** Closed convex ring, page px — geometry is cumulative: the ring already
   *  sits wherever earlier strikes left it. */
  ring: Point[];
  /** The resting cell this glass came from — marks (ink swath, texture,
   *  tone) are material properties assigned when the pane was made, so a
   *  shard keeps its cell's character however far it flies. */
  cellIndex: number;
  /** Stable id seeding the per-(impact, fragment) random stream. */
  id: number;
  /** How many times this piece has been subdivided. */
  gen: number;
  /** Worst damage this piece has taken, 0..1. */
  damage: number;
  /** Accumulated spin, radians — the fill pattern rides the glass. */
  rot: number;
  /** Accumulated travel, px. */
  moved: number;
  /** True once the piece has been thrown (not just slid in place). */
  airborne: boolean;
  /** Extra z on top of the band formula — settle stacking, generation lag. */
  zBias?: number;
}

/** Working-set ceiling: past it, strikes still crack and slide material but
 *  never subdivide it further — plot time stays bounded however many land. */
export const MAX_FRAGMENTS = 6000;

export function centroidOf(ring: Point[]): Point {
  let x = 0;
  let y = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    x += ring[i].x;
    y += ring[i].y;
  }
  return { x: x / n, y: y / n };
}

export function maxVertexDist(ring: Point[], g: Point): number {
  let e = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i].x - g.x, ring[i].y - g.y);
    if (d > e) e = d;
  }
  return e;
}

export interface StrikeKnobs {
  shatter: number;
  scatter: number;
  /** Radial carry of burst shards (ignored when `freeze` is on). */
  eject: number;
  debris: number;
  crush: number;
  /** Slide of cracked-in-place facets away from the strike. */
  push: number;
  penWidth: number;
}

export interface StrikeOptions {
  /** 'radial': cracked facets slide away from the strike (the pane takes a
   *  hit where it stands). 'down': they sag with gravity instead — the
   *  plate rests ON the point, held material only slips downward. */
  slide: 'radial' | 'down';
  /** Freeze burst shards in place (cut + tumble, no ballistics) so the
   *  caller can own their motion — the drop simulation's gravity. */
  freeze?: boolean;
  /** 0..1 chance a cascade-zone piece breaks free WHOLE instead of being
   *  cut — a mosaic parts along its grout lines, so the strike knocks
   *  entire tiles loose and only the core is pulverised. */
  looseTiles?: number;
  minArea: number;
  /** Working-set headroom the strike may still grow into. */
  budget: number;
}

/**
 * Apply one strike to the working set. Returns the surviving fragments in
 * stable order (deterministic per seed); freed burst shards come back with
 * `airborne: true`. `nextId` threads the creation-ordered id counter.
 */
export function strikeFrags(
  frags: Frag[],
  imp: Impact,
  cracks: CrackNetwork,
  o: StrikeKnobs,
  seed: number,
  k: number,
  opts: StrikeOptions,
  ids: { next: number }
): Frag[] {
  const out: Frag[] = [];
  for (const frag of frags) {
    const g = centroidOf(frag.ring);
    const extent = maxVertexDist(frag.ring, g);
    // Cheap early-out: the strike can't even crack this piece.
    if (Math.hypot(g.x - imp.x, g.y - imp.y) - extent > imp.reach) {
      out.push(frag);
      continue;
    }
    const dmg = pointDamage(imp, g.x, g.y, extent, o.shatter);
    if (dmg.zone === 'intact') {
      out.push(frag);
      continue;
    }
    const rng = makeRandom(subSeed(subSeed(seed, 301 + k), frag.id));
    rng();
    rng();
    const damage = Math.max(frag.damage, dmg.D);
    // Once the working set is full — or a piece is already speck-sized —
    // strikes displace it but never subdivide it further.
    const mayGrow = out.length < opts.budget && ringArea(frag.ring) > 4 * opts.minArea;
    if (dmg.zone === 'cracked' || !mayGrow) {
      // Cracked in place: this strike's spiderweb facets the piece where it
      // lies; facets seat with a hairline gap and a whisper of spin, and
      // slide off the strike (or sag under gravity) as `push` rises.
      const bodies = mayGrow ? cracks.facet(frag.ring) : [frag.ring];
      const split = bodies.length > 1;
      const sx = opts.slide === 'down' ? 0 : dmg.rx;
      const sy = opts.slide === 'down' ? 1 : dmg.ry;
      for (const facet of bodies) {
        // The occasional facet falls out of the web — a hole, very glass.
        if (split && rng() < 0.5 * o.debris * dmg.D) continue;
        const fg = centroidOf(facet);
        const rot = (2 * rng() - 1) * 0.06 * dmg.D;
        const slideScale = opts.slide === 'down' ? 0.35 : 1;
        const slide = o.push * imp.radius * dmg.D * dmg.D * (0.5 + 0.9 * rng()) * slideScale;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const shrink = split ? 0.985 : 1;
        const seated = facet.map((p) => {
          const lx = (p.x - fg.x) * shrink;
          const ly = (p.y - fg.y) * shrink;
          return {
            x: fg.x + slide * sx + lx * cos - ly * sin,
            y: fg.y + slide * sy + lx * sin + ly * cos,
          };
        });
        if (split && ringArea(seated) < 0.5 * opts.minArea) continue;
        out.push({
          ring: seated,
          cellIndex: frag.cellIndex,
          id: split ? ids.next++ : frag.id,
          gen: frag.gen + (split ? 1 : 0),
          damage,
          rot: frag.rot + rot,
          moved: frag.moved + slide,
          airborne: frag.airborne,
          zBias: frag.zBias,
        });
      }
    } else if (
      dmg.zone === 'cascade' &&
      (opts.looseTiles ?? 0) > 0 &&
      rng() < (opts.looseTiles ?? 0)
    ) {
      // The tile parts whole along its grout lines: freed, tumbling a
      // little, but in one piece — big legible chunks near the strike.
      const rot = (2 * rng() - 1) * 0.1 * dmg.D;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      out.push({
        ring: frag.ring.map((p) => {
          const lx = p.x - g.x;
          const ly = p.y - g.y;
          return { x: g.x + lx * cos - ly * sin, y: g.y + lx * sin + ly * cos };
        }),
        cellIndex: frag.cellIndex,
        id: ids.next++,
        gen: frag.gen,
        damage,
        rot: frag.rot + rot,
        moved: frag.moved,
        airborne: true,
        zBias: frag.zBias,
      });
    } else {
      // The hot core: burst the piece into shards. `shatterCell` is the
      // path engine with a radial mapping — travel direction = radial
      // direction, no channel — so "drift along the stroke" becomes
      // ejection. With `freeze` on the knives still cut and the shards
      // still tumble, but they stay put for the caller's gravity.
      const shards = shatterCell(
        frag.ring,
        extent,
        {
          f: dmg.D,
          dx: 0,
          dy: 0,
          radius: imp.radius,
          shatter: o.shatter,
          scatter: opts.freeze ? 0 : o.scatter,
          debris: o.debris,
          crush: o.crush,
          sweep: opts.freeze ? 0 : o.eject,
          tx: dmg.rx,
          ty: dmg.ry,
          side: 1,
          rx: dmg.rx,
          ry: dmg.ry,
          channel: 0,
          d: dmg.d,
          dust: dmg.zone === 'dust',
          cone: 0.35 * imp.strength,
          penWidth: o.penWidth,
        },
        rng
      );
      for (const shard of shards) {
        const sg = centroidOf(shard.ring);
        out.push({
          ring: shard.ring,
          cellIndex: frag.cellIndex,
          id: ids.next++,
          gen: frag.gen + 1,
          damage,
          rot: frag.rot + shard.rot,
          moved: frag.moved + Math.hypot(sg.x - g.x, sg.y - g.y),
          airborne: true,
          zBias: frag.zBias,
        });
      }
    }
  }
  return out;
}

export interface SceneMarks {
  fill: number;
  toneRange: number;
  fillStyle: 'texture' | 'hatch' | 'concentric' | 'none';
  inks: number;
  inkBalance: number;
  inkMode: 'regions' | 'damage';
  occlude: boolean;
  markImpacts: boolean;
  penWidth: number;
  wobble: number;
}

/**
 * Render the final resting fragments as pen marks: per-cell material
 * properties (ink swath, texture, tone tier, fill presence) carried by every
 * fragment a cell produced, z banded by how the material moved, hidden-line
 * removal with a paper hold-off, optional survey targets at the strike
 * sites. Returns raw layered lines — the caller owns wobble and ordering.
 */
export function renderFragScene(args: {
  frags: Frag[];
  cells: PlacedCell[];
  region: RegionSpec;
  impacts: Impact[];
  seed: number;
  cellSize: number;
  /** z normalisation scale for slid material (the strike radius base). */
  radiusBase: number;
  o: SceneMarks;
}): FlowLine[] {
  const { frags, cells, region, impacts, seed, cellSize, radiusBase, o } = args;
  const fillNoise = createNoise(subSeed(seed, 2));
  const inkNoise = createNoise(subSeed(seed, 4));
  const inkCount = Math.max(1, Math.round(o.inks));
  const gamma = Math.pow(4, 2 * (0.5 - clamp01(o.inkBalance)));
  interface CellMarks {
    regionsInk: string;
    inkNoiseVal: number;
    regionFilled: boolean;
    texture: (typeof TEXTURES)[number];
    fillSpacing: number;
    baseRot: number;
    rng: () => number;
  }
  const marks = new Map<number, CellMarks>();
  for (const cell of cells) {
    const cellRng = makeRandom(subSeed(seed, cell.index) + 41);
    cellRng();
    cellRng();
    const inkK = 0.9 / region.extent;
    const inkNoiseVal = inkNoise.noise2D(cell.centre.x * inkK, cell.centre.y * inkK);
    const inkT = Math.pow(clamp01(inkNoiseVal * 0.5 + 0.5), gamma);
    const regionsInk = `ink-${Math.min(inkCount - 1, Math.floor(inkT * inkCount))}`;
    const fillK = 3 / region.extent;
    const regionFilled =
      o.fill > 0 &&
      fillNoise.noise2D(cell.centre.x * fillK, cell.centre.y * fillK) * 0.5 + 0.5 < o.fill;
    const texture = TEXTURES[Math.floor(cellRng() * TEXTURES.length) % TEXTURES.length];
    const toneK = 2.2 / region.extent;
    const tone =
      Math.floor(
        clamp01(
          0.5 + 0.5 * fillNoise.noise2D(cell.centre.x * toneK + 37, cell.centre.y * toneK - 91)
        ) * 3.999
      ) / 3;
    const tierMul = lerp(0.55, 2.6, Math.pow(tone, 1.1)) * (0.92 + 0.16 * cellRng());
    const fillSpacing = Math.max(
      1.15 * o.penWidth,
      Math.max(1.8 * o.penWidth, 2.2) * lerp(1, tierMul, clamp01(o.toneRange))
    );
    marks.set(cell.index, {
      regionsInk,
      inkNoiseVal,
      regionFilled,
      texture,
      fillSpacing,
      baseRot: cell.rotation,
      rng: cellRng,
    });
  }

  const lines: FlowLine[] = [];
  const wobbleStep = Math.max(2, o.penWidth * 2);
  const push = (points: Point[], layer: string) => {
    lines.push({ points: o.wobble > 0 ? densify(points, wobbleStep) : points, pen: 'fine', layer });
  };

  // Every drawn shape is buffered as a piece so displaced material can
  // OCCLUDE what it comes to rest over — same contract as the impact grid.
  interface Piece {
    z: number;
    layer: string;
    occ: Occluder | null;
    bounds: Bounds;
    lines: Point[][];
  }
  const pieces: Piece[] = [];

  for (const frag of frags) {
    const m = marks.get(frag.cellIndex);
    if (!m) continue;
    const inkT =
      o.inkMode === 'damage'
        ? clamp01(frag.damage * 1.05 + 0.25 * (Math.min(frag.gen, 3) / 3) + 0.12 * m.inkNoiseVal)
        : Math.pow(clamp01(m.inkNoiseVal * 0.5 + 0.5), gamma);
    const ink =
      o.inkMode === 'damage'
        ? `ink-${Math.min(inkCount - 1, Math.floor(inkT * inkCount))}`
        : m.regionsInk;
    const fillPoly = (poly: Point[], rotOffset: number): Point[][] => {
      switch (o.fillStyle) {
        case 'texture': {
          if (rotOffset === 0) return textureFill(poly, m.texture, m.fillSpacing, o.penWidth, m.rng);
          // The pattern is ON the glass: a spun shard carries its fill
          // rotated with it — fill in the shard's frame, rotate back.
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
          return textureFill(local, m.texture, m.fillSpacing, o.penWidth, m.rng).map((span) =>
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
            m.baseRot + rotOffset + Math.PI / 4,
            lerp(4 * o.penWidth, 2.5 * o.penWidth, frag.damage),
            o.penWidth
          );
        case 'concentric':
          return concentricFill(
            poly,
            lerp(4 * o.penWidth, 2.5 * o.penWidth, frag.damage),
            o.penWidth
          );
        default:
          return [];
      }
    };
    const poly = frag.ring;
    if (poly.length < 4) continue;
    const area = ringArea(poly);
    let maxEdge = 0;
    for (let i = 0; i < poly.length - 1; i++) {
      const e = Math.hypot(poly[i + 1].x - poly[i].x, poly[i + 1].y - poly[i].y);
      if (e > maxEdge) maxEdge = e;
    }
    // Degenerate slivers — long but thinner than the pen — would print as
    // stray scratch lines across whatever they landed on. A plotter can't
    // draw a shape thinner than its pen; deliberate specks stay.
    if (maxEdge > 6 * o.penWidth && area / maxEdge < 0.9 * o.penWidth) continue;
    const pls: Point[][] = [poly];
    if (m.regionFilled) for (const span of fillPoly(poly, frag.rot)) pls.push(span);
    // Same fate for any long, elongated shape too thin to carry a single
    // fill span: an empty outline slashed across the material below reads
    // as a scratch, not a shard.
    if (
      m.regionFilled &&
      pls.length === 1 &&
      maxEdge > 8 * o.penWidth &&
      area < 0.2 * maxEdge * maxEdge
    ) {
      continue;
    }
    // z is banded by HOW the material moved: the static pane at the bottom,
    // slid facets above it (farther-travelled higher), thrown shards on top
    // with later generations landing over earlier ones — plus a per-piece
    // epsilon so every overlapping pair is strictly ordered.
    const moving = frag.gen > 0 && frag.moved > 0.6 * o.penWidth;
    const z =
      (frag.airborne
        ? 5 + frag.damage + 0.25 * Math.min(frag.gen, 4)
        : moving
          ? 1.5 + 0.5 * frag.damage + 0.9 * clamp01(frag.moved / (0.5 * radiusBase))
          : frag.damage) + (frag.zBias ?? 0);
    const occludes =
      (frag.airborne || moving) && area > 2.5 * o.penWidth * (2.5 * o.penWidth);
    pieces.push({
      z: z + pieces.length * 1e-6,
      layer: ink,
      occ: occludes ? makeOccluder(poly) : null,
      bounds: boundsOf(poly),
      lines: pls,
    });
  }

  // Hidden-line removal: every piece's lines are clipped against every
  // higher-z occluder overlapping it (with a paper hold-off), so landed
  // shards read as sitting in front of the pane instead of printing
  // through it.
  const occluders = o.occlude ? pieces.filter((p) => p.occ !== null) : [];
  if (occluders.length > 0) {
    // Wide enough to READ as reserved paper: with a sub-pen gap, two
    // stacked plates sharing a fill direction fuse into one mass.
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

  if (o.markImpacts) {
    // A small survey target at each strike point: a fine ring plus four
    // ticks — the invisible points made legible on their own pen.
    for (const imp of impacts) {
      const r = o.penWidth * 1.6;
      const ring: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ring.push({ x: imp.x + r * Math.cos(a), y: imp.y + r * Math.sin(a) });
      }
      lines.push({ points: ring, pen: 'fine', layer: 'path' });
      const t0 = r * 1.4;
      const t1 = r * 1.4 + o.penWidth * 3;
      for (const [ux, uy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        lines.push({
          points: [
            { x: imp.x + ux * t0, y: imp.y + uy * t0 },
            { x: imp.x + ux * t1, y: imp.y + uy * t1 },
          ],
          pen: 'fine',
          layer: 'path',
        });
      }
    }
  }

  return lines;
}

/** Build one strike's crack network — shared seeding convention. */
export function strikeCracks(
  imp: Impact,
  region: RegionSpec,
  seed: number,
  k: number
): CrackNetwork {
  return makeCracks(
    { x: imp.x, y: imp.y, speed: imp.strength, arc: 0 },
    imp.reach,
    region,
    subSeed(seed, 701 + k)
  );
}
