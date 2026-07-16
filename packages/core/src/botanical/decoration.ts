import { FlowLine, Point } from '../flow-lines.js';
import { smoothPolyline } from '../lib/polyline.js';
import { FruitType, Inflorescence, LeafArrangement, LeafStyle, LeafType, Phyllotaxis, BotanicalFlower } from './types.js';
import { densify, normalsOf, outlineFromEdges, polylineLength, smoothstep } from '../lib/spatial.js';
import { ribbon } from './structures.js';

// ——— decorations ———

export interface DecorParams {
  leaves: boolean;
  leafStyle: LeafStyle;
  leafType: LeafType;
  veins: boolean;
  leafSize: number;
  leafWidthRatio: number;
  leafSpacing: number;
  leafArrangement: LeafArrangement;
  leafletCount: number;
  phyllotaxis: Phyllotaxis;
  whorlCount: number;
  tendrils: boolean;
  tendrilProb: number;
  flowers: boolean;
  flowerType: BotanicalFlower;
  flowerProb: number;
  flowerSize: number;
  inflorescence: Inflorescence;
  floretCount: number;
  fruitType: FruitType;
  fruitProb: number;
  dewdrops: boolean;
  dewdropProb: number;
  penPx: number;
  light: Point;
  shadeDensity: number;
  /** Composition focal points — foliage and blooms swell and concentrate near
   *  them (the visual "events"): one for a specimen's gesture end, a few
   *  deliberate clusters for a wreath, empty for free/colonization growth. */
  focals: Point[];
  focalR: number;
  /** 0..1 overall foliage density — scales leaf clusters, spacing and blooms. */
  density: number;
  /** Negative-space mass weight (1 everywhere when off); thins foliage in the
   *  held-clear region. */
  weightAt?: ((x: number, y: number) => number) | null;
  /** 0..1 tonal-massing strength. >0 couples leaf shade-intensity to the value
   *  field (the shadow side hatches heavier); 0 leaves hatching untouched so
   *  non-massed renders (incl. notan-only) stay byte-identical. */
  shadeMass: number;
  /** Inside-test of a `fill` composition's region: decorations whose reach
   *  would land outside are skipped so they don't fuzz the shape's silhouette. */
  insideRegion?: (x: number, y: number) => boolean;
}

/** The golden angle (≈137.5°), the divergence of spiral phyllotaxis. */
const GOLDEN_ANGLE = 2.39996323;

/** One leaf insertion at a node: which side, an angular offset off the stem
 *  tangent, and a foreshortening factor (back leaves of a whorl read shorter). */
interface LeafInsertion {
  side: 1 | -1;
  angOff: number;
  fore: number;
}

/** Resolve a node's leaf insertions for a phyllotaxis mode. `alternate` returns
 *  the legacy single alternating blade; the others place pairs / rings / a
 *  golden-angle spiral, faking the around-stem third dimension in 2D with an
 *  angular spread and a cosine foreshortening. */
function phyllotaxisSites(
  mode: Phyllotaxis,
  node: number,
  side: 1 | -1,
  whorlN: number,
  theta: number
): LeafInsertion[] {
  switch (mode) {
    case 'opposite':
      return [
        { side: 1, angOff: 0, fore: 1 },
        { side: -1, angOff: 0, fore: 1 },
      ];
    case 'whorled': {
      const n = Math.max(2, Math.min(6, Math.round(whorlN)));
      const out: LeafInsertion[] = [];
      for (let k = 0; k < n; k++) {
        // Spread the ring across ±0.7 rad of the tangent; back leaves shorten.
        const a = (k / (n - 1) - 0.5) * 1.4;
        out.push({ side: a < 0 ? -1 : 1, angOff: a, fore: 0.5 + 0.5 * Math.abs(Math.cos(a)) });
      }
      return out;
    }
    case 'spiral': {
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      return [{ side: c < 0 ? -1 : 1, angOff: s * 0.6, fore: 0.55 + 0.45 * Math.abs(c) }];
    }
    case 'alternate':
    default:
      void node;
      return [{ side, angOff: 0, fore: 1 }];
  }
}

export function decorate(
  stems: { points: Point[] }[],
  d: DecorParams,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void
): void {
  // 0..1 nearness to the closest composition focal point (0 when there's none).
  const nearFocal = (p: Point): number => {
    let best = 0;
    for (const f of d.focals) {
      const dist = Math.hypot(p.x - f.x, p.y - f.y);
      const nf = smoothstep(1 - dist / d.focalR);
      if (nf > best) best = nf;
    }
    return best;
  };

  // Would a blade inserted at (x,y) with this stem direction and side keep its
  // reach inside the fill region? (Always true when there's no region.)
  const fits = (x: number, y: number, stemDir: number, side: 1 | -1, reach: number): boolean => {
    if (!d.insideRegion) return true;
    const a = stemDir + side * (Math.PI / 3);
    return d.insideRegion(x + Math.cos(a) * reach, y + Math.sin(a) * reach);
  };

  // Foliage density (0..1) sets how packed the leaves are: low → spread out,
  // single leaves; high → tight, multi-leaf clusters. Each leaf keeps its full
  // detail either way.
  const dens = Math.max(0, Math.min(1, d.density));
  const spacingFactor = 1.7 - dens; // ~1.7× spacing at 0 → ~0.7× at 1
  // Compound leaves carry many blades per node, so a compound canopy needs the
  // *nodes* spread further apart or it packs into a solid mass (a bipinnate fern
  // at simple-leaf spacing renders ~63 blades per node into a black blob).
  // Exactly 1 for the legacy `simple` arrangement, so that path stays byte-identical.
  const arrSpacing =
    d.leafArrangement === 'bipinnate' ? 3.2 :
    d.leafArrangement === 'pinnate' ? 1.5 :
    d.leafArrangement === 'palmate' || d.leafArrangement === 'trifoliate' ? 1.2 :
    1;
  // Reserve the very end of each cane for the terminal bloom/fruit, so a leaf
  // isn't grown right where the flower opens and then pokes out through the gaps
  // between its petals. Only when a tip decoration is actually in play.
  const hasTipBloom = d.flowers || d.inflorescence !== 'none' || d.fruitType !== 'none';
  const tipReserve = hasTipBloom ? d.flowerSize * 1.4 : 0;

  // Terminal blooms/fruit are buffered and emitted AFTER every cane's foliage,
  // so a flower always sits on top of leaves — a leaf from another cane can't
  // poke through the gaps between its petals. The geometry (and its rng draws)
  // is still computed inline, so only the draw/z order changes, not the stream.
  const deferredBlooms: { lines: FlowLine[]; sils: Point[][] }[] = [];
  const bloomAdd = (lines: FlowLine[], sils: Point[][]): void => { deferredBlooms.push({ lines, sils }); };

  for (const stem of stems) {
    const pts = stem.points;
    if (pts.length < 2) continue;
    const stemLen = polylineLength(pts);
    if (stemLen < d.leafSpacing) continue;

    // Every leaf keeps its full style/detail.
    const effStyle: LeafStyle = d.leafStyle;

    // The "legacy" placement (one alternating blade per site) is preserved
    // byte-for-byte; anything else is a gated new path so existing renders are
    // untouched until a botanical-structure option is dialled up.
    const legacyLeaves = d.leafArrangement === 'simple' && d.phyllotaxis === 'alternate';

    let arc = 0;
    let nextLeaf = d.leafSpacing * spacingFactor * (0.5 + rng()) * arrSpacing;
    let side: 1 | -1 = rng() < 0.5 ? 1 : -1;
    // Spiral phyllotaxis carries a rotating insertion phase; only drawn (so the
    // rng sequence only shifts) when spiral is actually selected.
    let theta = d.phyllotaxis === 'spiral' ? rng() * Math.PI * 2 : 0;
    let node = 0;

    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      arc += seg;
      const dir = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);

      if (arc >= nextLeaf) {
        side = (side === 1 ? -1 : 1) as 1 | -1;
        const along = arc / stemLen;
        const nf = nearFocal(pts[i]);
        // Negative-space weight (1 when off): foliage shrinks and thins toward
        // the held-clear region so it reads as a deliberate empty passage.
        const massW = d.weightAt ? d.weightAt(pts[i].x, pts[i].y) : 1;
        // Leaves swell gently toward the focal point, and with depth.
        const sizeScale = (0.7 + 0.4 * (1 - along)) * (1 + 0.4 * nf) * (0.4 + 0.6 * massW);
        // Leaf *presence* now scales with density (it used to only affect
        // clustering, so a node always bore a leaf — which left winter / density-0
        // plants fully leafed). Below ~0.45 density, sites drop out toward bare;
        // at/above it the canopy is full. A small per-leaf angle jitter further
        // breaks the regular fishbone.
        // rng() is drawn first (left-to-right) so the reserve only flips the
        // result, never the random stream.
        const present = d.leaves && rng() < Math.min(1, dens * 2.2) * massW && (stemLen - arc) > tipReserve;
        const jit = (rng() - 0.5) * 0.5;
        if (present && legacyLeaves) {
          // Extra leaves cluster the canopy near the focal point.
          const cluster = 1 + (rng() < dens * massW ? 1 : 0) + (rng() < (dens - 0.4 + 0.6 * nf) * massW ? 1 : 0);
          for (let c = 0; c < cluster; c++) {
            const s: 1 | -1 = c === 0 ? side : ((rng() < 0.5 ? 1 : -1) as 1 | -1);
            const llen = d.leafSize * sizeScale * (0.8 + rng() * 0.5);
            if (!fits(pts[i].x, pts[i].y, dir + jit, s, llen * 0.75)) continue;
            const leaf = makeLeaf(pts[i], dir + jit, s, llen, d, effStyle, rng);
            add(leaf.lines, leaf.silhouette);
          }
        } else if (present) {
          // Phyllotaxis places one or more insertions at this node; each is a
          // single blade or a whole compound leaf.
          const sites = phyllotaxisSites(d.phyllotaxis, node, side, d.whorlCount, theta);
          const compound = d.leafArrangement !== 'simple';
          for (const ins of sites) {
            const ldir = dir + ins.angOff + jit;
            if (compound) {
              const clen = d.leafSize * sizeScale * 2.2 * ins.fore * (0.85 + rng() * 0.3);
              if (!fits(pts[i].x, pts[i].y, ldir, ins.side, clen * 0.6)) continue;
              makeCompoundLeaf(pts[i], ldir, ins.side, clen, d, effStyle, rng, add, 0);
            } else {
              const llen = d.leafSize * sizeScale * ins.fore * (0.8 + rng() * 0.5);
              if (!fits(pts[i].x, pts[i].y, ldir, ins.side, llen * 0.75)) continue;
              const leaf = makeLeaf(pts[i], ldir, ins.side, llen, d, effStyle, rng);
              add(leaf.lines, leaf.silhouette);
            }
          }
        }
        if (d.tendrils && rng() < d.tendrilProb) {
          const t = makeTendril(pts[i], dir, (-side) as 1 | -1, d.leafSize * (0.8 + rng()), rng);
          add([t], []);
        }
        // Fruit borne along the cane (grapes hang from the vine, not just tips).
        // Gated on a non-'none' type, so it never perturbs a fruitless render.
        if (d.fruitType !== 'none' && rng() < d.fruitProb * 0.35 * (0.5 + dens) * massW) {
          const fr = makeFruit(pts[i], d.fruitType, d.flowerSize * (0.9 + rng() * 0.5), d.penPx, d.light, rng, add);
          add(fr.lines, fr.silhouette);
        }
        // A dewdrop catching the light, near the leaf base. Gated, so it never
        // perturbs a dewless render's rng sequence.
        if (d.dewdrops && rng() < d.dewdropProb) {
          const r = d.penPx * (1.6 + rng() * 1.6);
          const ox = pts[i].x + (rng() - 0.5) * d.leafSize * 0.3;
          const oy = pts[i].y + (rng() - 0.5) * d.leafSize * 0.3;
          add(makeDewdrop({ x: ox, y: oy }, r, d.light), []);
        }
        // Internodes vary widely and lengthen toward the base (foliage gathers
        // near the growing tip, longer bare stretches lower down) so the rhythm
        // reads hand-grown rather than metronomic.
        nextLeaf += d.leafSpacing * spacingFactor * (0.5 + rng() * 1.0) * (1.3 - 0.5 * along) * (1 - 0.25 * nf) * arrSpacing;
        theta += GOLDEN_ANGLE;
        node++;
      }
    }

    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const tipDir = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const nfTip = nearFocal(tip);
    const massWTip = d.weightAt ? d.weightAt(tip.x, tip.y) : 1;
    const flowerChance = Math.min(1, d.flowerProb * (0.6 + 0.8 * dens) * (1 + 2 * nfTip) * massWTip);
    const legacyTip = d.inflorescence === 'none' && d.fruitType === 'none';
    let tipDressed = false;
    if (legacyTip) {
      if (d.flowers && rng() < flowerChance) {
        // A bloom cluster, larger and more numerous toward the focal point.
        // Satellite blooms (b > 0) sit on a ring around the tip and each hangs
        // on its own short bowed pedicel back to the tip — a jittered bloom
        // with no connecting stroke reads as floating beside the plant, the
        // most jarring "computer" tell in the whole drawing. Satellites close
        // enough to overlap the cluster skip the pedicel (the overlap carries
        // the attachment).
        const blooms = 1 + (rng() < 0.3 * dens + 0.4 * nfTip ? 1 : 0) + (rng() < 0.5 * nfTip ? 1 : 0);
        for (let b = 0; b < blooms; b++) {
          let bx = tip.x;
          let by = tip.y;
          if (b > 0) {
            const pa = rng() * Math.PI * 2;
            const pr = d.flowerSize * (0.6 + rng() * 0.6);
            bx = tip.x + Math.cos(pa) * pr;
            by = tip.y + Math.sin(pa) * pr;
            if (pr > d.flowerSize * 0.7) {
              const mx = (tip.x + bx) / 2 + (rng() - 0.5) * pr * 0.4;
              const my = (tip.y + by) / 2 + (rng() - 0.5) * pr * 0.4;
              bloomAdd([{ points: smoothPolyline([tip, { x: mx, y: my }, { x: bx, y: by }], 1), layer: 'stem' }], []);
            }
          }
          makeFlower({ x: bx, y: by }, d.flowerSize * (0.7 + rng() * 0.6) * (1 + 0.5 * nfTip), d.penPx, d.flowerType, d.light, rng, bloomAdd, tipDir);
        }
        tipDressed = true;
      } else if (d.tendrils && rng() < d.tendrilProb) {
        const t = makeTendril(tip, tipDir, (rng() < 0.5 ? 1 : -1) as 1 | -1, d.leafSize * (0.8 + rng()), rng);
        add([t], []);
        tipDressed = true;
      }
    } else {
      // New tip path: an inflorescence and/or a fruit cluster.
      if (d.inflorescence !== 'none') {
        if (d.flowers && rng() < flowerChance) {
          makeInflorescence(d.inflorescence, tip, tipDir, d.flowerSize * (1.4 + 1.2 * nfTip), d, rng, bloomAdd);
          tipDressed = true;
        }
      } else if (d.flowers && rng() < flowerChance) {
        makeFlower(tip, d.flowerSize * (0.7 + rng() * 0.6) * (1 + 0.5 * nfTip), d.penPx, d.flowerType, d.light, rng, bloomAdd, tipDir);
        tipDressed = true;
      }
      if (d.fruitType !== 'none' && rng() < Math.min(1, d.fruitProb * (0.6 + 0.8 * dens) * massWTip)) {
        const fr = makeFruit(tip, d.fruitType, d.flowerSize * 1.15 * (0.85 + 0.4 * nfTip), d.penPx, d.light, rng, bloomAdd);
        bloomAdd(fr.lines, fr.silhouette);
        tipDressed = true;
      }
    }
    // Terminal finish: a cane that earned neither bloom, inflorescence, fruit
    // nor tendril ends in a young terminal leaf — in real ink botany a growing
    // tip always resolves into *something*; a naked line end reads as unfinished.
    if (!tipDressed && d.leaves) {
      const llen = d.leafSize * (0.55 + rng() * 0.3);
      const leaf = makeLeaf(tip, tipDir + (rng() - 0.5) * 0.4, (rng() < 0.5 ? 1 : -1) as 1 | -1, llen, d, d.leafStyle, rng);
      add(leaf.lines, leaf.silhouette);
    }
  }

  // Emit every terminal bloom on top of the whole canopy (see deferredBlooms).
  for (const b of deferredBlooms) add(b.lines, b.sils);
}

// ——— leaves ———

const LEAF_TYPES: LeafType[] = ['ovate', 'lance', 'cordate', 'lobed', 'serrate'];

/** Half-width profile fraction (0..1) along the blade for a leaf species. */
function leafProfile(type: LeafType, u: number, lobes: number): number {
  switch (type) {
    case 'lance':
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 1.35)), 1.15);
    case 'cordate':
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.7);
    case 'lobed':
      // Deeper sinuses between broader lobes so ivy/maple/grape read as palmate
      // lobed blades, not faintly rippled ovals.
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85) * (0.58 + 0.42 * Math.cos(lobes * Math.PI * u));
    case 'ovate':
    case 'serrate':
    default:
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85);
  }
}

function makeLeaf(
  base: Point,
  stemDir: number,
  side: 1 | -1,
  len: number,
  d: DecorParams,
  style: LeafStyle,
  rng: () => number
): { lines: FlowLine[]; silhouette: Point[][] } {
  const type: LeafType = d.leafType === 'mixed' ? LEAF_TYPES[Math.floor(rng() * LEAF_TYPES.length)] : d.leafType;
  const penPx = d.penPx;
  const spread = (Math.PI / 3) * (0.85 + rng() * 0.5);
  const curl = (rng() - 0.5) * 0.8;
  // Foreshortening: a tilted leaf is narrower; a steep one folds edge-on.
  const tilt = rng();
  const widthRatio = d.leafWidthRatio * (0.85 + rng() * 0.4) * (1 - 0.7 * tilt);
  const lobes = 2 + Math.floor(rng() * 2); // 2–3 lobe pairs
  const serrate = type === 'serrate';

  const baseAngle = stemDir + side * spread;
  const M = 22;
  const axis: Point[] = [{ x: base.x, y: base.y }];
  let x = base.x;
  let y = base.y;
  for (let j = 1; j <= M; j++) {
    const t = j / M;
    const ang = baseAngle + curl * t;
    const step = len / M;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    axis.push({ x, y });
  }
  const normals = normalsOf(axis);
  const maxHalf = Math.max(penPx, len * widthRatio * 0.5);
  const pet = 0.16; // petiole fraction
  const halfAt = (t: number): number => {
    if (t < pet) return Math.max(penPx * 0.4, maxHalf * 0.1 * (t / pet));
    const u = (t - pet) / (1 - pet);
    return Math.max(0, maxHalf * leafProfile(type, u, lobes));
  };

  // Light/shadow side of the blade.
  const mid = Math.floor(axis.length / 2);
  const litIsPlus = normals[mid].x * d.light.x + normals[mid].y * d.light.y > 0;
  const shadowSign = litIsPlus ? -1 : 1;

  const lines: FlowLine[] = [];

  // Outline edges (closed silhouette). Serrate margins get small teeth.
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < axis.length; i++) {
    const t = i / (axis.length - 1);
    let h = halfAt(t);
    if (serrate && t > pet) h *= 1 + 0.24 * Math.sin(i * 2.2);
    left.push({ x: axis[i].x + normals[i].x * h, y: axis[i].y + normals[i].y * h });
    right.push({ x: axis[i].x - normals[i].x * h, y: axis[i].y - normals[i].y * h });
  }
  const poly = outlineFromEdges(left, right);

  if (tilt > 0.78) {
    // Edge-on: just a folded sickle (one edge + optional midrib).
    lines.push({ points: left, layer: 'leaf' });
    if (d.veins && style !== 'outline') lines.push({ points: axis.map((p) => ({ ...p })), layer: 'vein' });
    return { lines, silhouette: [poly] };
  }

  if (style === 'solid') {
    return { lines: ribbon(densify(axis, penPx), normalsOf(densify(axis, penPx)), densify(axis, penPx).map((_, i, arr) => halfAt(i / (arr.length - 1))), penPx, 'leaf', 'solid'), silhouette: [poly] };
  }

  // Outline: shadow edge slightly heavier.
  lines.push({ points: litIsPlus ? left : right, layer: 'leaf' });
  lines.push({ points: (litIsPlus ? right : left), layer: 'leaf', pen: 'bold' });

  // Veins: a midrib plus secondary veins curving toward the tip.
  if (d.veins && style !== 'outline') {
    lines.push({ points: axis.map((p) => ({ ...p })), layer: 'vein' }); // midrib
    const veinN = Math.max(3, Math.round(len / (penPx * 12)));
    for (let v = 1; v <= veinN; v++) {
      const t = pet + (v / (veinN + 1)) * (1 - pet);
      const i = Math.max(1, Math.min(axis.length - 2, Math.round(t * (axis.length - 1))));
      const h = halfAt(t) * 0.82;
      if (h < penPx) continue;
      const tx = axis[Math.min(i + 1, axis.length - 1)].x - axis[i - 1].x;
      const ty = axis[Math.min(i + 1, axis.length - 1)].y - axis[i - 1].y;
      const tl = Math.hypot(tx, ty) || 1;
      for (const s of [1, -1] as const) {
        // Curve the vein toward the tip.
        const ex = axis[i].x + normals[i].x * s * h + (tx / tl) * h * 0.55;
        const ey = axis[i].y + normals[i].y * s * h + (ty / tl) * h * 0.55;
        const mxp = axis[i].x + normals[i].x * s * h * 0.5 + (tx / tl) * h * 0.15;
        const myp = axis[i].y + normals[i].y * s * h * 0.5 + (ty / tl) * h * 0.15;
        lines.push({ points: [{ x: axis[i].x, y: axis[i].y }, { x: mxp, y: myp }, { x: ex, y: ey }], layer: 'vein' });
      }
    }
  }

  // Shadow hatching: fine cross strokes from the midrib to the shadow edge.
  if (style === 'shaded' && d.shadeDensity > 0.01) {
    // Couple hatch density to the scene value field: leaves on the shadow side
    // (high mass) hatch tighter, the lit side opens up — so the canopy carries a
    // committed value structure, not a flat even tone. Purely deterministic
    // geometry (no rng), and inert (effShade === d.shadeDensity) when massing is
    // off, so non-massed renders stay byte-identical.
    let effShade = d.shadeDensity;
    if (d.shadeMass > 0 && d.weightAt) {
      const m = d.weightAt(base.x, base.y); // 1 = dense/shadow, →LIT_FLOOR = lit
      effShade = Math.max(0, Math.min(1, d.shadeDensity * (1 + 0.5 * d.shadeMass * (m - 0.6))));
    }
    const hatchStep = penPx * (2 + (1 - effShade) * 5);
    let acc = 0;
    for (let i = 1; i < axis.length; i++) {
      acc += Math.hypot(axis[i].x - axis[i - 1].x, axis[i].y - axis[i - 1].y);
      if (acc < hatchStep) continue;
      acc = 0;
      const t = i / (axis.length - 1);
      const h = halfAt(t) * 0.86;
      if (h < penPx * 1.5) continue;
      const fromX = axis[i].x + normals[i].x * shadowSign * h * 0.18;
      const fromY = axis[i].y + normals[i].y * shadowSign * h * 0.18;
      const toX = axis[i].x + normals[i].x * shadowSign * h;
      const toY = axis[i].y + normals[i].y * shadowSign * h;
      lines.push({ points: [{ x: fromX, y: fromY }, { x: toX, y: toY }], layer: 'leaf' });
    }
  }

  return { lines, silhouette: [poly] };
}

/** A compound leaf: many `makeLeaf` blades sharing one petiole/rachis. Each
 *  leaflet is `add`ed as its own occluding element (so siblings overlap
 *  correctly); the rachis is added first so it sits behind them. */
function makeCompoundLeaf(
  base: Point,
  stemDir: number,
  side: 1 | -1,
  len: number,
  d: DecorParams,
  style: LeafStyle,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void,
  depth = 0
): void {
  const penPx = d.penPx;
  const arrangement = d.leafArrangement;
  const spread = (Math.PI / 4) * (0.85 + rng() * 0.4);
  const baseAngle = stemDir + side * spread;

  // Palmate / trifoliate: leaflets radiate from one point, no rachis.
  if (arrangement === 'palmate' || arrangement === 'trifoliate') {
    const n = arrangement === 'trifoliate' ? 3 : Math.max(3, Math.min(9, Math.round(d.leafletCount)));
    const fan = arrangement === 'trifoliate' ? 0.5 : 0.85;
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0.5 : k / (n - 1);
      const a = baseAngle + (u - 0.5) * 2 * fan;
      const m = 1 - Math.abs(u - 0.5) * (arrangement === 'trifoliate' ? 0.7 : 0.85);
      const lf = makeLeaf(base, a, u < 0.5 ? -1 : 1, len * (0.55 + 0.4 * m) * (0.9 + rng() * 0.2), d, style, rng);
      add(lf.lines, lf.silhouette);
    }
    return;
  }

  // Pinnate / bipinnate: a gently curved rachis with paired leaflets + terminal.
  const M = 14;
  const axis: Point[] = [{ x: base.x, y: base.y }];
  let x = base.x;
  let y = base.y;
  const curl = (rng() - 0.5) * 0.5;
  for (let j = 1; j <= M; j++) {
    const t = j / M;
    const ang = baseAngle + curl * t;
    const step = len / M;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    axis.push({ x, y });
  }
  const rachis = smoothPolyline(axis, 1);
  const dn = densify(rachis, penPx);
  const rib = ribbon(dn, normalsOf(dn), dn.map(() => penPx * 0.9), penPx, 'stem', 'solid');
  add(rib, rib.length ? [rib[0].points] : []);

  const total = Math.max(3, Math.min(11, Math.round(d.leafletCount)));
  const pairs = Math.max(1, Math.floor((total - 1) / 2));
  const leafletLen = len * (depth === 0 ? 0.4 : 0.5);
  const recurse = depth === 0 && arrangement === 'bipinnate';
  // A bipinnate frond's pinnules read as small simple blades; drawing each as a
  // full veined/shaded leaf packs them into a black mass. Render the sub-pinnae's
  // leaflets as light outlines and thin their count so a fern reads as fronds.
  const SUB_LEAFLETS = 5;
  const subStyle: LeafStyle = 'outline';
  for (let p = 1; p <= pairs; p++) {
    const t = p / (pairs + 1);
    const idx = Math.max(1, Math.min(rachis.length - 1, Math.round(t * (rachis.length - 1))));
    const segNext = rachis[Math.min(idx + 1, rachis.length - 1)];
    const segPrev = rachis[idx - 1];
    const tang = Math.atan2(segNext.y - segPrev.y, segNext.x - segPrev.x);
    const sizeGrad = 0.7 + 0.3 * (1 - t);
    for (const s of [1, -1] as const) {
      const ll = leafletLen * sizeGrad * (0.85 + rng() * 0.3);
      if (recurse) {
        makeCompoundLeaf(rachis[idx], tang, s, ll * 1.6, { ...d, leafArrangement: 'pinnate', leafletCount: SUB_LEAFLETS }, subStyle, rng, add, 1);
      } else {
        const lf = makeLeaf(rachis[idx], tang, s, ll, d, style, rng);
        add(lf.lines, lf.silhouette);
      }
    }
  }
  // Terminal leaflet at the rachis tip.
  const tip = rachis[rachis.length - 1];
  const tprev = rachis[rachis.length - 2];
  const tdir = Math.atan2(tip.y - tprev.y, tip.x - tprev.x);
  const tl = leafletLen * (0.85 + rng() * 0.3);
  if (recurse) {
    makeCompoundLeaf(tip, tdir, 1, tl * 1.6, { ...d, leafArrangement: 'pinnate', leafletCount: SUB_LEAFLETS }, subStyle, rng, add, 1);
  } else {
    const lf = makeLeaf(tip, tdir, 1, tl, d, style, rng);
    add(lf.lines, lf.silhouette);
  }
}

// ——— tendrils & flowers ———

/** A dewdrop: a small ring with the lit quadrant left open and a short
 *  highlight tick inside, so it reads as a glistening bead of water. */
function makeDewdrop(center: Point, r: number, light: Point): FlowLine[] {
  const la = Math.atan2(light.y, light.x);
  const ring: Point[] = [];
  // Leave a ~70° gap on the lit side (the rim catches the light).
  for (let s = 0; s <= 28; s++) {
    const a = la + 0.6 + (s / 28) * (2 * Math.PI - 1.2);
    ring.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  const hx = center.x + Math.cos(la) * r * 0.4;
  const hy = center.y + Math.sin(la) * r * 0.4;
  return [
    { points: ring, layer: 'vein' },
    { points: [{ x: hx - Math.cos(la) * r * 0.15, y: hy - Math.sin(la) * r * 0.15 }, { x: hx + Math.cos(la) * r * 0.15, y: hy + Math.sin(la) * r * 0.15 }], layer: 'vein' },
  ];
}

function makeTendril(base: Point, stemDir: number, side: 1 | -1, size: number, rng: () => number): FlowLine {
  // A graceful tendril: a tangent lead-in off the cane easing into an open coil
  // that spirals *inward* to a tight centre — a climbing-vine curl, not a
  // detached bullseye ring floating beside the stem.
  const lead = size * (0.7 + rng() * 0.5);
  const leadAng = stemDir + side * 0.5;
  const lx = Math.cos(leadAng);
  const ly = Math.sin(leadAng);
  const tipX = base.x + lx * lead;
  const tipY = base.y + ly * lead;
  // Lead-in carries a midpoint so, once smoothed, the coil reads as growing out
  // of the cane rather than as a ring dropped next to it.
  const pts: Point[] = [
    { x: base.x, y: base.y },
    { x: base.x + lx * lead * 0.5, y: base.y + ly * lead * 0.5 },
    { x: tipX, y: tipY },
  ];

  const coils = 0.55 + rng() * 0.6; // ~0.55–1.15 turns: an open hook, never a full O
  const steps = 40;
  const baseR = size * 0.42;
  // Coil centre sits perpendicular to the lead so the first arc leaves the tip
  // tangentially (no kink at the junction).
  const perpAng = leadAng + side * (Math.PI / 2);
  const cx = tipX + Math.cos(perpAng) * baseR;
  const cy = tipY + Math.sin(perpAng) * baseR;
  const phi0 = Math.atan2(tipY - cy, tipX - cx);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const phi = phi0 + side * coils * 2 * Math.PI * t;
    const r = baseR * Math.pow(1 - t, 1.3); // spirals in to a tight centre
    pts.push({ x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r });
  }
  return { points: smoothPolyline(pts, 2), layer: 'tendril' };
}

const FLOWER_TYPES: BotanicalFlower[] = ['rose', 'daisy', 'bell', 'bud'];

/** A petal as an outline loop (no fill) — botanical line-work to match leaves. */
function petalOutline(center: Point, ang: number, len: number, half: number, penPx: number): FlowLine {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const px = -dy;
  const py = dx;
  const N = 10;
  const loop: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const out = Math.sin(Math.PI * t) * half;
    loop.push({ x: center.x + dx * len * t + px * out, y: center.y + dy * len * t + py * out });
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const out = Math.sin(Math.PI * t) * half;
    loop.push({ x: center.x + dx * len * t - px * out, y: center.y + dy * len * t - py * out });
  }
  void penPx;
  return { points: loop, layer: 'flower' };
}

function ringOutline(center: Point, radius: number, layer: string): FlowLine {
  const segs = Math.max(10, Math.round(radius * 2.2));
  const ring: Point[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * 2 * Math.PI;
    ring.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
  }
  return { points: ring, layer };
}

/** A single berry as an engraved sphere rather than a hollow ring: the rim is
 *  drawn with a small gap on the lit side (a reserved-white catchlight), and
 *  one or two nested crescent arcs on the shadow side give it volume. Every
 *  berry jitters its catchlight, gap, crescents and a slight squash+tilt off
 *  `rng`, so a cluster reads as hand-drawn individuals, not a stamped pattern. */
function makeBerry(center: Point, radius: number, light: Point, rng: () => number): { lines: FlowLine[]; sil: Point[] } {
  // Catchlight roughly toward the light, but nudged per berry; the gap and the
  // berry's squash/tilt vary too.
  const la = Math.atan2(light.y, light.x) + (rng() - 0.5) * 0.7;
  const sa = la + Math.PI;
  const gap = 0.32 + rng() * 0.3;
  const squash = 0.88 + rng() * 0.2; // minor-axis fraction
  const tilt = (rng() - 0.5) * 0.8;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // Map a unit-circle angle to the tilted, squashed berry surface.
  const at = (a: number, rr: number): Point => {
    const ex = Math.cos(a) * rr;
    const ey = Math.sin(a) * rr * squash;
    return { x: center.x + ex * ct - ey * st, y: center.y + ex * st + ey * ct };
  };
  const segs = Math.max(14, Math.round(radius * 2.6));
  const lines: FlowLine[] = [];
  const sil: Point[] = [];
  const rim: Point[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = la + gap + (i / segs) * (2 * Math.PI - 2 * gap);
    rim.push(at(a, radius));
  }
  lines.push({ points: rim, layer: 'flower' });
  for (let i = 0; i <= segs; i++) sil.push(at((i / segs) * 2 * Math.PI, radius));
  // One or two shadow-side crescents (riper berries get the second), each a
  // little different in reach and span.
  const crescents = rng() < 0.6 ? 2 : 1;
  for (let k = 1; k <= crescents; k++) {
    const rr = radius * (0.46 + 0.2 * k + (rng() - 0.5) * 0.1);
    const span = 1.8 - 0.3 * k + (rng() - 0.5) * 0.4;
    const arc: Point[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) arc.push(at(sa - span / 2 + (i / steps) * span, rr));
    lines.push({ points: arc, layer: 'flower' });
  }
  return { lines, sil };
}

/** A flower as botanical line-work, varied by species — matching the leaves'
 *  outline-and-detail treatment rather than a solid blob. Each petal (and the
 *  centre detail) is `add`ed as its OWN occluding element, in draw order, so a
 *  front petal hides the part of the petal behind it — the overlap reads as
 *  layered petals, not transparent crossing loops. The petal silhouettes are the
 *  actual closed shapes (not a bounding disc), so the gaps between petals stay
 *  open (no circular halo) while the bloom still occludes the foliage behind. */
function makeFlower(
  center: Point,
  size: number,
  penPx: number,
  type: BotanicalFlower,
  light: Point,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void,
  dir?: number
): void {
  const t: BotanicalFlower = type === 'mixed' ? FLOWER_TYPES[Math.floor(rng() * FLOWER_TYPES.length)] : type;
  const rot = rng() * Math.PI * 2;

  if (t === 'rose') {
    // The classic etching shorthand for a rose: a wound spiral heart, an inner
    // row of cupped C-strokes hugging it, and a ring of broad unfurled lobes —
    // instead of fat loops radiating from one point (which read as popcorn).
    // A silhouette-only central disc (no drawn line) so foliage or stem sitting
    // behind the bloom's centre is occluded instead of poking through the gaps
    // between petals. Added before the petals so it occludes earlier elements
    // (the leaves/stem) without clipping the petals drawn over it.
    const hub: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      hub.push({ x: center.x + Math.cos(a) * size * 0.6, y: center.y + Math.sin(a) * size * 0.6 });
    }
    add([], [hub]);
    // The heart: a spiral winding out from the centre, slightly squashed and
    // gently dented so it reads as folded petals, not a compass coil.
    const turns = 2.1 + rng() * 0.5;
    const sq = 0.82 + rng() * 0.12;
    const spiral: Point[] = [];
    const steps = 44;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = rot + u * turns * 2 * Math.PI;
      const r = size * 0.34 * Math.pow(u, 0.75) * (1 + 0.08 * Math.sin(a * 3 + rot));
      spiral.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r * sq });
    }
    add([{ points: spiral, layer: 'flower' }], []);
    // Inner row: cupped open arcs hugging the heart, each its own element.
    const innerN = 3 + Math.floor(rng() * 2);
    for (let k = 0; k < innerN; k++) {
      const a0 = rot + (k / innerN) * 2 * Math.PI + (rng() - 0.5) * 0.4;
      const span = 1.5 + rng() * 0.5;
      const rr = size * (0.42 + rng() * 0.08);
      const arc: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const a = a0 - span / 2 + u * span;
        const r = rr * (1 + 0.22 * Math.sin(Math.PI * u));
        arc.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
      }
      add([{ points: arc, layer: 'flower' }], []);
    }
    // Outer row: broad rounded lobes ringing the heart. The drawn stroke is the
    // open lobe only (base → rounded top → base); the closed loop (lobe + base
    // arc) is used as the occluding silhouette so petals layer over each other
    // and over the foliage behind without an extra clutter line at the base.
    const petals = 5 + Math.floor(rng() * 2);
    const w = ((2 * Math.PI) / petals) * 1.25;
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * 2 * Math.PI + (rng() - 0.5) * 0.25;
      const r0 = size * 0.38;
      const r1 = size * (0.95 + rng() * 0.25);
      const N = 14;
      const lobe: Point[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = ang + (u - 0.5) * w;
        const r = r0 + (r1 - r0) * Math.pow(Math.sin(Math.PI * u), 0.8);
        lobe.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
      }
      const sil = lobe.slice();
      for (let i = N; i >= 0; i--) {
        const u = i / N;
        const a = ang + (u - 0.5) * w;
        sil.push({ x: center.x + Math.cos(a) * r0, y: center.y + Math.sin(a) * r0 });
      }
      add([{ points: lobe, layer: 'flower' }], [sil]);
    }
  } else if (t === 'daisy') {
    const petals = 11 + Math.floor(rng() * 5);
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * 2 * Math.PI;
      const pl = petalOutline(center, ang, size, size * 0.12, penPx);
      add([pl], [pl.points]);
    }
    const ring = ringOutline(center, size * 0.28, 'flower');
    add([ring], [ring.points]);
  } else if (t === 'bell') {
    // A bell / foxglove bloom built from rounded petal lobes (the same
    // primitive as the rose) flaring from a common throat, with the throat set
    // back from the centre so the petals form a deep cupped trumpet rather than
    // a flat star. Petals read as a soft flower — not a geometric pentagon.
    // Open along the stem (away from where it joins) when a direction is given,
    // so the throat sits on the stem tip and the petals flare outward — not a
    // bloom floating off to one side.
    const face = dir ?? rot;                 // direction the bloom opens toward
    const petals = 5;
    const spread = 2.0;                      // fan of the petal lobes (radians)
    // Throat behind the centre (back toward the stem), so petals splay forward.
    const throat = { x: center.x - Math.cos(face) * size * 0.5, y: center.y - Math.sin(face) * size * 0.5 };
    for (let k = 0; k < petals; k++) {
      const f = k / (petals - 1);
      const ang = face + (f - 0.5) * spread;
      const plen = size * (0.95 + 0.2 * Math.sin(f * Math.PI)); // centre petals longer
      const pl = petalOutline(throat, ang, plen, size * 0.3, penPx);
      add([pl], [pl.points]);
    }
    // A short calyx/tube where it joins the pedicel, on top of the petal bases.
    add([{ points: [throat, { x: throat.x - Math.cos(face) * size * 0.35, y: throat.y - Math.sin(face) * size * 0.35 }], layer: 'flower' }], []);
  } else {
    // bud: a closed teardrop with two sepal strokes at its base; points along
    // the stem (away from the join) when a direction is given.
    const a = dir ?? rot;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    const L = size * 1.1;
    const N = 12;
    const bud: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.4;
      bud.push({ x: center.x + dx * L * u + px * wb, y: center.y + dy * L * u + py * wb });
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.4;
      bud.push({ x: center.x + dx * L * u - px * wb, y: center.y + dy * L * u - py * wb });
    }
    // A bud is one closed teardrop with two sepal strokes — no internal petal
    // overlap, so it's a single element.
    const budLines: FlowLine[] = [{ points: bud, layer: 'flower' }];
    for (const s of [1, -1] as const) {
      budLines.push({ points: [{ x: center.x, y: center.y }, { x: center.x + dx * size * 0.4 + px * s * size * 0.22, y: center.y + dy * size * 0.4 + py * s * size * 0.22 }], layer: 'flower' });
    }
    add(budLines, [bud]);
  }
  void light;
}

// ——— inflorescences, thorns & fruit ———

/** A multi-flower structure borne at a tip: each floret is a `makeFlower` added
 *  as its own occluding element. Racemes/spikes grade from open florets at the
 *  base to buds at the tip; umbels/corymbs radiate from one point. */
function makeInflorescence(
  type: Inflorescence,
  base: Point,
  axisDir: number,
  size: number,
  d: DecorParams,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void
): void {
  if (type === 'none') return;
  const penPx = d.penPx;
  const n = Math.max(3, Math.min(16, Math.round(d.floretCount)));
  const dx = Math.cos(axisDir);
  const dy = Math.sin(axisDir);
  const px = -dy;
  const py = dx;

  if (type === 'umbel' || type === 'corymb') {
    // Florets gathered on slender, gently *curving* pedicels — a rounded posy
    // (umbel) or flat-topped head (corymb). Curved, varied-length pedicels and
    // small florets read as a natural cluster instead of a stiff umbrella of
    // straight radial spokes.
    const m = Math.max(4, Math.min(11, n));
    const stalk = size * (type === 'umbel' ? 1.7 : 2.0);
    for (let k = 0; k < m; k++) {
      const u = m === 1 ? 0.5 : k / (m - 1);
      const a = axisDir + (u - 0.5) * 1.1 + (rng() - 0.5) * 0.3;
      const len = type === 'umbel'
        ? stalk * (0.78 + rng() * 0.35)
        : stalk * (0.55 + Math.abs(u - 0.5) * 0.9 + rng() * 0.2);
      const fx = base.x + Math.cos(a) * len;
      const fy = base.y + Math.sin(a) * len;
      // Bow the pedicel sideways so it arcs rather than spoking out straight.
      const bow = (rng() - 0.5) * 0.5;
      const mx = (base.x + fx) / 2 + Math.cos(a + Math.PI / 2) * len * bow;
      const my = (base.y + fy) / 2 + Math.sin(a + Math.PI / 2) * len * bow;
      const ped = smoothPolyline([base, { x: mx, y: my }, { x: fx, y: fy }], 1);
      add([{ points: ped, layer: 'stem' }], []);
      makeFlower({ x: fx, y: fy }, size * (0.5 + rng() * 0.25), penPx, d.flowerType, d.light, rng, add, a);
    }
    return;
  }

  // Raceme / spike: florets strung along a leaning/hanging axis.
  const L = size * (type === 'raceme' ? 5 : 4);
  const axis: Point[] = [];
  const bend = (rng() - 0.5) * 0.6;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    axis.push({ x: base.x + dx * L * t + px * bend * L * t * t, y: base.y + dy * L * t + py * bend * L * t * t });
  }
  const ax = smoothPolyline(axis, 1);
  add([{ points: ax, layer: 'stem' }], []);
  for (let k = 0; k < n; k++) {
    const t = k / Math.max(1, n - 1); // 0 = base, 1 = tip
    const idx = Math.max(1, Math.min(ax.length - 1, Math.round(t * (ax.length - 1))));
    const at = ax[idx];
    const maturity = 1 - t; // base most open, tip still in bud
    const fsize = size * (0.55 + 0.5 * maturity);
    const ftype: BotanicalFlower = maturity > 0.5 ? d.flowerType : 'bud';
    if (type === 'raceme') {
      const ped = size * 0.7;
      const fx = at.x + px * (k % 2 ? 1 : -1) * ped * 0.4 + dx * ped * 0.3;
      const fy = at.y + py * (k % 2 ? 1 : -1) * ped * 0.4 + dy * ped * 0.3;
      add([{ points: [at, { x: fx, y: fy }], layer: 'stem' }], []);
      makeFlower({ x: fx, y: fy }, fsize, penPx, ftype, d.light, rng, add, Math.atan2(fy - at.y, fx - at.x));
    } else {
      makeFlower(at, fsize * 0.8, penPx, ftype, d.light, rng, add, axisDir + Math.PI / 2);
    }
  }
}

/** Recurved thorns spaced along a cane, on the stem layer, pointing back toward
 *  the base. Returned as plain lines to append onto the stem element so they
 *  share the cane's depth. Only invoked when thorns are enabled. */
export function makeThorns(stemPts: Point[], baseHalf: number, prob: number, penPx: number, rng: () => number): FlowLine[] {
  const out: FlowLine[] = [];
  if (stemPts.length < 2) return out;
  const spacing = Math.max(6, penPx * 12 * (1 - Math.min(0.9, prob)));
  let acc = 0;
  let side: 1 | -1 = 1;
  for (let i = 1; i < stemPts.length; i++) {
    acc += Math.hypot(stemPts[i].x - stemPts[i - 1].x, stemPts[i].y - stemPts[i - 1].y);
    if (acc < spacing) continue;
    acc = 0;
    side = (side === 1 ? -1 : 1) as 1 | -1;
    if (rng() > prob * 3) continue;
    const dir = Math.atan2(stemPts[i].y - stemPts[i - 1].y, stemPts[i].x - stemPts[i - 1].x);
    const nx = -Math.sin(dir) * side;
    const ny = Math.cos(dir) * side;
    const len = Math.max(penPx * 2.5, baseHalf * (1.1 + rng() * 0.7));
    const root = stemPts[i];
    // Out along the normal then hooked back toward the cane base — a recurve.
    const tipx = root.x + nx * len - Math.cos(dir) * len * 0.7;
    const tipy = root.y + ny * len - Math.sin(dir) * len * 0.7;
    const midx = root.x + nx * len * 0.5 - Math.cos(dir) * len * 0.1;
    const midy = root.y + ny * len * 0.5 - Math.sin(dir) * len * 0.1;
    out.push({ points: [{ x: root.x, y: root.y }, { x: midx, y: midy }, { x: tipx, y: tipy }], layer: 'stem' });
  }
  return out;
}

/** A fruiting body on the `flower` pen layer. Cluster fruits (grape / berry)
 *  `add` each berry as its own occluding element and return the stalk; single
 *  bodies (rosehip / pod / catkin) are returned whole. */
function makeFruit(
  center: Point,
  type: FruitType,
  size: number,
  penPx: number,
  light: Point,
  rng: () => number,
  add: (lines: FlowLine[], sil: Point[][]) => void
): { lines: FlowLine[]; silhouette: Point[][] } {
  void penPx;
  if (type === 'grape' || type === 'berry') {
    const big = type === 'grape';
    const count = big ? 9 + Math.floor(rng() * 10) : 3 + Math.floor(rng() * 4);
    const r = size * (big ? 0.36 : 0.42);
    if (big) {
      // A grape bunch: staggered rows tapering from wide shoulders to a single
      // tip berry — the triangular silhouette that says "grapes". Berries kiss
      // (pitch ~1.5r) instead of drowning each other: over-packed circles
      // smear into an unreadable mass at plot scale.
      let shoulders = 1;
      while ((shoulders * (shoulders + 1)) / 2 < count) shoulders++;
      const pitch = r * 1.5;
      const rowPitch = r * 1.35;
      let placed = 0;
      for (let row = 0; row < shoulders && placed < count; row++) {
        const inRow = Math.min(shoulders - row, count - placed);
        const rowW = (inRow - 1) * pitch;
        const stagger = row % 2 ? pitch * 0.3 : 0;
        for (let c = 0; c < inRow && placed < count; c++) {
          const bx = center.x + (c * pitch - rowW / 2) + stagger + (rng() - 0.5) * r * 0.3;
          const by = center.y + size * 0.4 + row * rowPitch + (rng() - 0.5) * r * 0.25;
          const berry = makeBerry({ x: bx, y: by }, r * (0.88 + rng() * 0.24), light, rng);
          add(berry.lines, [berry.sil]);
          placed++;
        }
      }
    } else {
      // A berry clump: one berry at the hang point, the rest packed around it
      // on a golden-angle spiral — a rounded cluster, not a bead row. Vertical
      // offsets fold to |sin| so every berry hangs at or below the hang point:
      // a berry drifting *above* it sits beside the cane, visibly detached
      // from the stalk that's supposed to carry the clump.
      for (let k = 0; k < count; k++) {
        const a = k * 2.39996323 + rng() * 0.6;
        const rr = k === 0 ? 0 : r * 1.15 * Math.sqrt(k) * (0.9 + rng() * 0.2);
        const bx = center.x + Math.cos(a) * rr;
        const by = center.y + size * 0.4 + Math.abs(Math.sin(a)) * rr * 0.8;
        const berry = makeBerry({ x: bx, y: by }, r * (0.82 + rng() * 0.36), light, rng);
        add(berry.lines, [berry.sil]);
      }
    }
    // The hanging stalk: a gently bowed stroke from the cane to the bunch's
    // shoulder centre — a straight one-segment tick gets lost among the
    // berries and the bunch reads as floating.
    const bow = (rng() - 0.5) * size * 0.25;
    const stalk = smoothPolyline(
      [center, { x: center.x + bow, y: center.y + size * 0.22 }, { x: center.x, y: center.y + size * 0.45 }],
      1
    );
    return { lines: [{ points: stalk, layer: 'stem' }], silhouette: [] };
  }
  if (type === 'rosehip') {
    // An engraved hip, not a hollow ring: the rim breaks for a lit-side
    // catchlight, shadow-side crescents give it volume, and a little sepal crown
    // at the calyx end reads it as a rosehip (so it never reads as a stray O).
    // Deterministic (catchlight follows the light) so it perturbs no rng stream.
    const N = 18;
    const w = size * 0.55;
    const h = size * 0.78;
    const la = Math.atan2(light.y, light.x);
    const sil: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI;
      sil.push({ x: center.x + Math.cos(a) * w, y: center.y + Math.sin(a) * h });
    }
    const gap = 0.5; // catchlight on the lit side
    const rim: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const a = la + gap + (i / N) * (2 * Math.PI - 2 * gap);
      rim.push({ x: center.x + Math.cos(a) * w, y: center.y + Math.sin(a) * h });
    }
    const lines: FlowLine[] = [{ points: rim, layer: 'flower' }];
    const sa = la + Math.PI; // shadow side
    for (let k = 1; k <= 2; k++) {
      const span = 1.7 - 0.3 * k;
      const rr = 0.5 + 0.18 * k;
      const arc: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = sa - span / 2 + (i / 8) * span;
        arc.push({ x: center.x + Math.cos(a) * w * rr, y: center.y + Math.sin(a) * h * rr });
      }
      lines.push({ points: arc, layer: 'flower' });
    }
    // Sepal crown: a small fan of ticks radiating from the calyx (lower) end.
    const by = center.y + h * 0.95;
    for (let s = -2; s <= 2; s++) {
      const ta = Math.PI / 2 + s * 0.34;
      lines.push({ points: [{ x: center.x, y: by }, { x: center.x + Math.cos(ta) * w * 0.55, y: by + Math.sin(ta) * h * 0.3 }], layer: 'flower' });
    }
    return { lines, silhouette: [sil] };
  }
  if (type === 'pod') {
    const a = -Math.PI / 2 + (rng() - 0.5) * 0.6;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    const L = size * 2.1;
    const N = 12;
    const pod: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.36;
      pod.push({ x: center.x + dx * L * u + px * wb, y: center.y + dy * L * u + py * wb });
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      const wb = Math.sin(Math.PI * Math.pow(u, 0.7)) * size * 0.36;
      pod.push({ x: center.x + dx * L * u - px * wb, y: center.y + dy * L * u - py * wb });
    }
    const seam: Point[] = [{ x: center.x, y: center.y }, { x: center.x + dx * L, y: center.y + dy * L }];
    return { lines: [{ points: pod, layer: 'flower' }, { points: seam, layer: 'flower' }], silhouette: [pod] };
  }
  // catkin: a soft drooping lozenge — narrow at the stalk, swelling, then
  // tapering to the tip — textured with short diagonal scales. (The old version
  // was a bare axis with symmetric perpendicular ticks, which read as a stiff
  // ladder rather than a fuzzy catkin.)
  const a = Math.PI / 2 + (rng() - 0.5) * 0.5; // droops downward
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const L = size * 2.5;
  const N = 16;
  const bend = (rng() - 0.5) * 0.4;
  const axis: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    axis.push({ x: center.x + dx * L * t + px * bend * L * t * t, y: center.y + dy * L * t + py * bend * L * t * t });
  }
  const ax = smoothPolyline(axis, 1);
  const halfAt = (t: number): number => Math.sin(Math.PI * Math.pow(t, 0.6)) * size * 0.36 * (1 - 0.35 * t);
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < ax.length; i++) {
    const t = i / (ax.length - 1);
    const h = halfAt(t);
    left.push({ x: ax[i].x + px * h, y: ax[i].y + py * h });
    right.push({ x: ax[i].x - px * h, y: ax[i].y - py * h });
  }
  const outline = outlineFromEdges(left, right);
  const lines: FlowLine[] = [{ points: outline, layer: 'flower' }];
  // Short diagonal scale-ticks, alternating sides, angled toward the tip.
  for (let i = 1; i < ax.length - 1; i++) {
    const t = i / (ax.length - 1);
    const h = halfAt(t);
    if (h < size * 0.06) continue;
    const s = i % 2 ? 1 : -1;
    lines.push({
      points: [
        { x: ax[i].x, y: ax[i].y },
        { x: ax[i].x + px * s * h * 0.85 + dx * h * 0.4, y: ax[i].y + py * s * h * 0.85 + dy * h * 0.4 },
      ],
      layer: 'flower',
    });
  }
  return { lines, silhouette: [outline] };
}
