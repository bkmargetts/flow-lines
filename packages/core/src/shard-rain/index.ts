import type { FlowLinesResult, Point } from '../flow-lines.js';
import { clamp01 } from '../lib/math.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { orderPlot } from '../optimize.js';
import { layoutCells, rectAt, type RegionSpec } from '../impact-grid/layout.js';
import { clipHalfPlane, ringArea } from '../impact-grid/shatter.js';
import { placeImpacts, type Impact } from '../impact-grid/point-impacts.js';
import {
  centroidOf,
  maxVertexDist,
  renderFragScene,
  strikeCracks,
  strikeFrags,
  MAX_FRAGMENTS,
  type Frag,
  type StrikeKnobs,
} from '../impact-grid/strike-engine.js';
import type { CrackNetwork } from '../impact-grid/cracks.js';

/**
 * A plate dropped onto invisible points. A SMALL pane — a floating slab or
 * disc of the impact grid's hand-ruled mosaic, deliberately modest against
 * the paper — is dropped from the top of the page onto a field of invisible
 * pins scattered in the air below it. It comes to rest on the first pin
 * under its footprint (tipping slightly onto its heavy side), shatters at
 * the contact — a bitten-out crater at the bottom edge, a spiderweb of
 * cracks radiating up into the held material — and the freed shards RAIN
 * DOWN from the point of impact, fanning apart as they fall. Any shard
 * whose fall carries it onto a lower pin shatters again there, so the
 * cascade grows finer down the page; whatever reaches the bottom settles
 * into a rubble pile on the margin. The `moment` knob scrubs the simulation:
 * 0 = the plate has just cracked, shards barely loosened; mid = the cascade
 * frozen mid-fall; 1 = everything come to rest in the pile. Any number of
 * pen layers ('ink-0' … 'ink-N'); the pins stay invisible unless
 * `markImpacts` inks a small target at each. Plain stroked paths,
 * deterministic per seed; no pins ⇒ the pristine floating pane.
 */
export interface ShardRainOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  // The plate
  /** 'slab' (default) drops a rectangular pane; 'disc' a round one. */
  paneShape?: 'slab' | 'disc';
  /** Pane width as a fraction of the inner page width, 0.2..0.7 — small on
   *  purpose, so the impact and the cascade both get room. Default 0.42. */
  paneScale?: number;
  /** 'mosaic' (default) is the multi-scale patchwork; 'grid' packs even
   *  squares; 'frame' keeps a border band; 'bars' builds stacked columns. */
  layout?: 'mosaic' | 'grid' | 'frame' | 'bars';
  /** Cells deep the 'frame' band runs, 1..6. */
  frameDepth?: number;
  /** Mean cell pitch, px. Default: pane min-side / 8. */
  cellSize?: number;
  /** 0..1 per-cell size jitter. */
  sizeVariation?: number;
  /** 0..1 centre jitter as a fraction of pitch. */
  positionJitter?: number;
  /** 0..1 per-cell rotation jitter. */
  rotationJitter?: number;
  /** 0..0.6 mean gap between cells as a fraction of pitch. */
  gap?: number;
  /** 0..1 scale mixture of the 'mosaic' layout. */
  granularity?: number;

  // The drop
  /** Drawn pin field in page px: decimated to pin sites (points above the
   *  pane's underside are ignored). When present it decides where AND how
   *  many — `impacts` is ignored. */
  impactPoints?: Point[];
  /** How many invisible pins hang in the fall, 1..12 (0 ⇒ nothing to land
   *  on: the pristine pane floats untouched). Default 5. */
  impacts?: number;
  /** Strike radius, px — the size of the bite at each contact.
   *  Default: pane extent * 0.55. */
  impactRadius?: number;
  /** 0..1 per-pin radius spread around the base. */
  radiusVariation?: number;
  /** 0..1 violence of the landing, varied per pin. */
  energy?: number;
  /** 0..1 the simulation moment the pen freezes: 0 = just cracked,
   *  ~0.5 = cascade mid-fall, 1 = all rubble settled in the pile. */
  moment?: number;
  /** 0..1 how wide the pin field spreads beyond the pane's footprint. */
  pinSpread?: number;
  /** 0..1 how far the plate tips onto its heavy side as it settles. */
  tilt?: number;
  /** 0..1 damage-zone width (dust / cascade / cracked thresholds). */
  shatter?: number;
  /** 0..1 lateral fan of the falling shards. */
  scatter?: number;
  /** 0..1 chance shards vanish entirely — pulverised. */
  debris?: number;
  /** 0..1 shard fineness (subdivision depth at each contact). */
  crush?: number;
  /** 0..1 downward slip of the cracked-but-held facets above the crater. */
  sag?: number;

  // Marks
  /** 0..1 fraction of cells carrying fill marks (region-committed). */
  fill?: number;
  /** 0..1 tonal spread of the fills — committed regional tiers. */
  toneRange?: number;
  /** The fill vocabulary. */
  fillStyle?: 'texture' | 'hatch' | 'concentric' | 'none';
  /** How many mosaic pen layers, ≥1 — layers 'ink-0' … 'ink-(n-1)'. */
  inks?: number;
  /** 0..1 skew of the swath split. */
  inkBalance?: number;
  /** 'regions' commits large coherent swaths; 'damage' orders the inks by
   *  ACCUMULATED destruction — ink 0 calm plate, the last ink the finest
   *  rubble at the bottom of the cascade. */
  inkMode?: 'regions' | 'damage';
  /** Ink a small target at each pin on a 'path' layer — off by default:
   *  the pins are invisible, only the destruction shows. */
  markImpacts?: boolean;
  /** Hidden-line removal (default true). Off ⇒ overlaps overprint. */
  occlude?: boolean;
  penWidth?: number;
  wobble?: number;
  /** Reorder strokes to cut pen-up travel (default true) */
  optimize?: boolean;
}

const DEFAULTS: Required<
  Omit<
    ShardRainOptions,
    'width' | 'height' | 'margin' | 'seed' | 'impactPoints' | 'cellSize' | 'impactRadius'
  >
> = {
  paneShape: 'slab',
  paneScale: 0.42,
  layout: 'mosaic',
  frameDepth: 3,
  sizeVariation: 0.15,
  positionJitter: 0.03,
  rotationJitter: 0.02,
  gap: 0.06,
  granularity: 0.6,
  impacts: 5,
  radiusVariation: 0.5,
  energy: 0.6,
  moment: 0.55,
  pinSpread: 0.5,
  tilt: 0.5,
  shatter: 0.8,
  scatter: 0.35,
  debris: 0.15,
  crush: 0.6,
  sag: 0.4,
  fill: 1,
  toneRange: 0.65,
  fillStyle: 'texture',
  inks: 2,
  inkBalance: 0.5,
  inkMode: 'damage',
  markImpacts: false,
  occlude: true,
  penWidth: 1.2,
  wobble: 0,
  optimize: true,
};

/** Recursion guard: a shard re-shatters on at most this many pins. */
const MAX_GEN = 5;

/** A convex rect region — the resting pane. */
function rectRegion(x0: number, y0: number, x1: number, y1: number): RegionSpec {
  return {
    contains: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    depth: (x, y) => Math.max(0, Math.min(x - x0, x1 - x, y - y0, y1 - y)),
    yRange: (x) => (x >= x0 && x <= x1 ? [y0, y1] : null),
    clip: (ring) => {
      let out = ring;
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (const p of ring) {
        if (p.x < bx0) bx0 = p.x;
        if (p.y < by0) by0 = p.y;
        if (p.x > bx1) bx1 = p.x;
        if (p.y > by1) by1 = p.y;
      }
      if (bx0 >= x0 && bx1 <= x1 && by0 >= y0 && by1 <= y1) return ring;
      if (bx0 < x0) out = clipHalfPlane(out, { x: x0, y: y0 }, { x: -1, y: 0 });
      if (out.length >= 4 && bx1 > x1) out = clipHalfPlane(out, { x: x1, y: y0 }, { x: 1, y: 0 });
      if (out.length >= 4 && by0 < y0) out = clipHalfPlane(out, { x: x0, y: y0 }, { x: 0, y: -1 });
      if (out.length >= 4 && by1 > y1) out = clipHalfPlane(out, { x: x0, y: y1 }, { x: 0, y: 1 });
      return out.length >= 4 ? out : [];
    },
    centroid: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    extent: Math.hypot(x1 - x0, y1 - y0) / 2,
  };
}

/** A convex disc region — the round pane. */
function discRegion(cx: number, cy: number, r: number): RegionSpec {
  return {
    contains: (x, y) => Math.hypot(x - cx, y - cy) <= r,
    depth: (x, y) => Math.max(0, r - Math.hypot(x - cx, y - cy)),
    yRange: (x) => {
      const dx = Math.abs(x - cx);
      if (dx >= r) return null;
      const h = Math.sqrt(r * r - dx * dx);
      return [cy - h, cy + h];
    },
    clip: (ring) => {
      let out = ring;
      for (let pass = 0; pass < 4; pass++) {
        let worst = 0;
        let wx = 0;
        let wy = 0;
        for (const p of out) {
          const d = Math.hypot(p.x - cx, p.y - cy);
          if (d > worst) {
            worst = d;
            wx = p.x;
            wy = p.y;
          }
        }
        if (worst <= r + 1e-6) return pass === 0 ? ring : out;
        const ux = (wx - cx) / worst;
        const uy = (wy - cy) / worst;
        out = clipHalfPlane(out, { x: cx + ux * r, y: cy + uy * r }, { x: ux, y: uy });
        if (out.length < 4) return [];
      }
      return out;
    },
    centroid: { x: cx, y: cy },
    extent: r,
  };
}

export function generateShardRain(options: ShardRainOptions): FlowLinesResult {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const innerW = width - 2 * margin;
  const innerH = height - 2 * margin;
  if (innerW <= 0 || innerH <= 0) return { lines: [], width, height, seed };
  const floorY = height - margin;

  // ---- The plate: a small pane hung near the top of the page. ----
  const paneScale = clamp01(o.paneScale) || 0.42;
  const paneW = innerW * Math.max(0.15, Math.min(0.7, paneScale));
  const paneH =
    o.paneShape === 'disc' ? paneW : Math.min(paneW * 0.62, innerH * 0.3);
  const paneCx = width / 2;
  const paneTop0 = margin + innerH * 0.03;
  const paneBottom0 = paneTop0 + paneH;
  const paneX0 = paneCx - paneW / 2;
  const paneX1 = paneCx + paneW / 2;

  // ---- The pin field: invisible points in the air below the plate. ----
  const dropRng = makeRandom(subSeed(seed, 601));
  const fallH = Math.max(1, floorY - paneBottom0);
  const paneExtent = Math.hypot(paneW, paneH) / 2;
  const radiusBase = options.impactRadius ?? paneExtent * 0.75;
  const corridorHalf = (paneW / 2) * (0.6 + 1.6 * o.pinSpread);
  let pins: Impact[];
  if (options.impactPoints && options.impactPoints.length > 0) {
    // Drawn pins: keep only points below the plate's underside, then let
    // the shared decimation choose the sites.
    const below = options.impactPoints.filter((p) => p.y > paneBottom0 + 2);
    pins = placeImpacts({
      points: below,
      count: 0,
      radiusBase,
      radiusVariation: o.radiusVariation,
      energy: o.energy,
      region: {
        contains: (x, y) => y > paneBottom0 && y < floorY && x > margin && x < width - margin,
        centroid: { x: paneCx, y: paneBottom0 + fallH * 0.5 },
      },
      seed,
      cellSize: radiusBase * 0.4,
      width,
      height,
      margin,
    });
  } else if (o.impacts > 0) {
    const count = Math.min(12, Math.max(1, Math.round(o.impacts)));
    // The first pin is the one the plate lands on: always under the
    // footprint, high in the fall — the pane stays up the page and the
    // cascade gets the room below. The rest scatter down the corridor.
    const catchX = paneCx + (2 * dropRng() - 1) * paneW * 0.3;
    const catchY = paneBottom0 + fallH * (0.04 + 0.2 * dropRng());
    const rest = placeImpacts({
      count: count - 1,
      radiusBase,
      radiusVariation: o.radiusVariation,
      energy: o.energy,
      region: {
        contains: (x, y) =>
          Math.abs(x - paneCx) < corridorHalf &&
          y > catchY + fallH * 0.08 &&
          y < floorY - fallH * 0.05,
        centroid: { x: paneCx, y: catchY + (floorY - catchY) * 0.55 },
      },
      seed: subSeed(seed, 613),
      cellSize: radiusBase * 0.4,
      width,
      height,
      margin,
    });
    const first: Impact = (() => {
      // The catch pin takes the plate's whole falling weight: a bigger,
      // hotter strike than the pins the loose shards meet later.
      const radius = Math.max(
        radiusBase * 0.6,
        radiusBase * 1.25 * (1 + 0.4 * o.radiusVariation * (2 * dropRng() - 1))
      );
      const strength = clamp01(o.energy * (0.95 + 0.3 * dropRng()));
      return { x: catchX, y: catchY, radius, strength, reach: radius * (1.1 + 1.3 * strength) };
    })();
    pins = [first, ...rest];
  } else {
    pins = [];
  }

  // ---- Contact: the plate falls until a pin under its footprint (or the
  // floor) catches it. ----
  let contact: Impact | null = null;
  if (pins.length > 0) {
    for (const pin of pins) {
      if (pin.x >= paneX0 + paneW * 0.04 && pin.x <= paneX1 - paneW * 0.04) {
        if (!contact || pin.y < contact.y) contact = pin;
      }
    }
    if (!contact) {
      // Nothing under the plate: it lands flat on the floor and breaks
      // against it — no room below, all crater and pile.
      const strength = clamp01(o.energy * (0.95 + 0.3 * dropRng()));
      contact = {
        x: paneCx,
        y: floorY,
        radius: radiusBase * 1.25,
        strength,
        reach: radiusBase * 1.25 * (1.1 + 1.3 * strength),
      };
      pins = [...pins, contact];
    }
  }

  // The pane rests with its underside ON the contact pin.
  const paneBottom = contact ? contact.y : paneBottom0;
  const paneTop = paneBottom - paneH;
  const region =
    o.paneShape === 'disc'
      ? discRegion(paneCx, paneTop + paneH / 2, paneW / 2)
      : rectRegion(paneX0, paneTop, paneX1, paneBottom);

  const cellSize = options.cellSize ?? Math.min(paneW, paneH) / 8;
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

  const ids = { next: 1_000_000 };
  const minArea = 2 * o.penWidth * (2 * o.penWidth);
  let frags: Frag[] = cells.map((cell) => ({
    ring: cell.ring ?? rectAt(cell.centre, cell.hx, cell.hy, cell.rotation),
    cellIndex: cell.index,
    id: cell.index,
    gen: 0,
    damage: 0,
    rot: 0,
    moved: 0,
    airborne: false,
  }));

  const knobs: StrikeKnobs = {
    shatter: o.shatter,
    scatter: o.scatter,
    eject: 0,
    debris: o.debris,
    crush: o.crush,
    push: o.sag,
    penWidth: o.penWidth,
  };

  if (contact) {
    // Settle tilt: the plate tips about the contact toward its heavy side.
    const lever = clamp01(Math.abs(paneCx - contact.x) / (paneW / 2));
    const theta =
      o.tilt * Math.sign(paneCx - contact.x || 1) * lever * (6 * Math.PI / 180) +
      o.tilt * (2 * dropRng() - 1) * (1.2 * Math.PI / 180);
    if (theta !== 0) {
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      for (const frag of frags) {
        frag.ring = frag.ring.map((p) => {
          const lx = p.x - contact!.x;
          const ly = p.y - contact!.y;
          return { x: contact!.x + lx * cos - ly * sin, y: contact!.y + lx * sin + ly * cos };
        });
        frag.rot += theta;
      }
    }

    // ---- The landing: shatter at the contact. Freed shards are CUT here
    // but not thrown — gravity owns them below. Held material cracks in a
    // spiderweb radiating up into the plate, sagging slightly. ----
    const cracks = strikeCracks(contact, region, seed, 0);
    frags = strikeFrags(frags, contact, cracks, knobs, seed, 0, {
      slide: 'down',
      freeze: true,
      // A mosaic parts along its grout lines: most cascade-zone tiles fall
      // WHOLE — the pins below do the fine breaking.
      looseTiles: 0.8,
      minArea,
      budget: MAX_FRAGMENTS,
    }, ids);

    // ---- The rain: every freed shard falls from the crater, fanning as it
    // goes; a shard that meets a lower pin shatters again there and its
    // children fall on. `moment` scrubs how far along everything is. ----
    const m = clamp01(o.moment);
    const lowerPins = pins
      .filter((p) => p !== contact && p.y > contact!.y + 1)
      .sort((a, b) => a.y - b.y);
    const pinCrackCache = new Map<Impact, CrackNetwork>();
    const fullRegion = rectRegion(margin, margin, width - margin, height - margin);
    const settled: Frag[] = [];
    const done: Frag[] = [];
    const budget = () => MAX_FRAGMENTS - done.length - settled.length - queue.length;

    const queue: { frag: Frag; srcX: number }[] = [];
    const still: Frag[] = [];
    for (const frag of frags) {
      if (frag.airborne) queue.push({ frag, srcX: contact.x });
      else still.push(frag);
    }

    while (queue.length > 0) {
      const { frag, srcX } = queue.shift()!;
      const g = centroidOf(frag.ring);
      const extent = maxVertexDist(frag.ring, g);
      const rng = makeRandom(subSeed(subSeed(seed, 977), frag.id));
      rng();
      rng();
      const avail = floorY - g.y - extent * 0.35;
      if (avail <= 0) {
        settled.push(frag);
        continue;
      }
      // Staggered fall: a wide exponent spread plus an overshoot jitter
      // strings the shards down the whole column — a rain, not a band —
      // and lets the quickest reach the pile well before moment 1.
      const expo = 0.35 + 1.8 * rng();
      const F = avail * Math.min(1, Math.pow(m, expo) * (0.9 + 0.5 * rng()));
      const dir = Math.sign(g.x - srcX + (2 * rng() - 1) * 2) || 1;
      const drift = o.scatter * F * (0.1 + 0.45 * rng()) * dir;
      const spin = (2 * rng() - 1) * (0.25 + 1.1 * (F / avail)) * (0.4 + 0.6 * o.crush);

      // First pin the fall corridor crosses — the re-shatter.
      let hit: Impact | null = null;
      let hitX = 0;
      if (frag.gen < MAX_GEN && ringArea(frag.ring) > 4 * minArea && budget() > 0) {
        for (const pin of lowerPins) {
          if (pin.y <= g.y + extent || pin.y >= g.y + F) continue;
          const xAt = g.x + (drift * (pin.y - g.y)) / Math.max(F, 1e-6);
          if (Math.abs(xAt - pin.x) < extent + pin.radius * 0.25) {
            hit = pin;
            hitX = xAt;
            break;
          }
        }
      }

      if (hit) {
        // Carry the shard to the pin and break it there; the children keep
        // falling from the pin with the same clock.
        const partial = clamp01((hit.y - g.y) / Math.max(F, 1e-6));
        const dx = hitX - g.x;
        const dy = hit.y - extent * 0.3 - g.y;
        const rot = spin * partial;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const moved = frag.ring.map((p) => {
          const lx = p.x - g.x;
          const ly = p.y - g.y;
          return { x: g.x + dx + lx * cos - ly * sin, y: g.y + dy + lx * sin + ly * cos };
        });
        const arrived: Frag = {
          ...frag,
          ring: moved,
          rot: frag.rot + rot,
          moved: frag.moved + Math.hypot(dx, dy),
        };
        let cracks = pinCrackCache.get(hit);
        if (!cracks) {
          cracks = strikeCracks(hit, fullRegion, seed, 11 + lowerPins.indexOf(hit));
          pinCrackCache.set(hit, cracks);
        }
        const children = strikeFrags([arrived], hit, cracks, knobs, seed, 11 + lowerPins.indexOf(hit), {
          slide: 'down',
          freeze: true,
          looseTiles: 0.2,
          minArea,
          budget: Math.max(1, budget()),
        }, ids);
        for (const child of children) {
          child.zBias = (child.zBias ?? 0) + 0.25;
          queue.push({ frag: child, srcX: hit.x });
        }
        continue;
      }

      // No pin in the way: fall F, drift, tumble — frozen mid-air, or
      // handed to the pile once the floor arrives.
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      const rested = F >= avail - 1e-6;
      const ring = frag.ring.map((p) => {
        const lx = p.x - g.x;
        const ly = p.y - g.y;
        return { x: g.x + drift + lx * cos - ly * sin, y: g.y + F + lx * sin + ly * cos };
      });
      const out: Frag = {
        ...frag,
        ring,
        rot: frag.rot + spin,
        moved: frag.moved + Math.hypot(drift, F),
      };
      if (rested) settled.push(out);
      else done.push(out);
    }

    // ---- The pile: settled shards lie down flat and stack into a mound. ----
    settled.sort((a, b) => a.id - b.id);
    const bucketW = Math.max(6, cellSize * 0.9);
    const heights = new Map<number, number>();
    let settleIdx = 0;
    for (const frag of settled) {
      const g = centroidOf(frag.ring);
      // Lie down: rotate the longest edge toward horizontal.
      let bestLen = 0;
      let bestAngle = 0;
      for (let i = 0; i < frag.ring.length - 1; i++) {
        const ex = frag.ring[i + 1].x - frag.ring[i].x;
        const ey = frag.ring[i + 1].y - frag.ring[i].y;
        const len = Math.hypot(ex, ey);
        if (len > bestLen) {
          bestLen = len;
          bestAngle = Math.atan2(ey, ex);
        }
      }
      let flat = -bestAngle;
      while (flat > Math.PI / 2) flat -= Math.PI;
      while (flat < -Math.PI / 2) flat += Math.PI;
      const rot = flat * 0.8;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      let ring = frag.ring.map((p) => {
        const lx = p.x - g.x;
        const ly = p.y - g.y;
        return { x: g.x + lx * cos - ly * sin, y: g.y + lx * sin + ly * cos };
      });
      const bucket = Math.round(g.x / bucketW);
      const lift =
        Math.max(heights.get(bucket - 1) ?? 0, heights.get(bucket) ?? 0, heights.get(bucket + 1) ?? 0);
      let maxY = -Infinity;
      let minY = Infinity;
      for (const p of ring) {
        if (p.y > maxY) maxY = p.y;
        if (p.y < minY) minY = p.y;
      }
      const dy = floorY - lift - maxY;
      ring = ring.map((p) => ({ x: p.x, y: p.y + dy }));
      heights.set(bucket, lift + (maxY - minY) * 0.55);
      done.push({
        ...frag,
        ring,
        rot: frag.rot + rot,
        moved: frag.moved + Math.abs(dy),
        zBias: (frag.zBias ?? 0) + 0.5 + settleIdx * 1e-3,
      });
      settleIdx++;
    }
    frags = [...still, ...done];
  }

  // ---- Render over the whole scene. ----
  const lines = renderFragScene({
    frags,
    cells,
    region,
    impacts: pins,
    seed,
    cellSize,
    radiusBase,
    o: {
      fill: o.fill,
      toneRange: o.toneRange,
      fillStyle: o.fillStyle,
      inks: o.inks,
      inkBalance: o.inkBalance,
      inkMode: o.inkMode,
      occlude: o.occlude,
      markImpacts: o.markImpacts,
      penWidth: o.penWidth,
      wobble: o.wobble,
    },
  });

  // Optional hand finish — off by default: the chaos lives in the fall,
  // not the pen.
  const finished =
    o.wobble > 0
      ? applyHandDrawnStyle(
          { lines, width, height, seed },
          { amplitude: o.wobble, wavelength: 30, seed, layerAmplitude: { path: 0.5 } }
        ).lines
      : lines;

  const result: FlowLinesResult = { lines: finished, width, height, seed };
  // Discrete shapes: reorder only — chaining would fuse separate outlines.
  return o.optimize ? orderPlot(result) : result;
}
