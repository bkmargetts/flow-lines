import { FlowLine, Point } from '../flow-lines.js';
import { CoverageAccumulator, createCoverageAccumulator, clipLinesToMask } from '../compose/index.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { trimPolyline } from '../lib/polyline.js';
import { offsetEmphasisPasses } from '../pen-ink/swell.js';
import { inkLayerName } from '../marbling/index.js';
import { Region } from './layout.js';
import { RegionFill } from './textures.js';

export type PenAssignment = 'interleave' | 'per-region';

export interface CarveConfig {
  width: number;
  height: number;
  haloPx: number;
  seed: number;
  pens: number;
  penAssignment: PenAssignment;
  outlines: boolean;
  /** Built-up weight on the hero band's keyline, 0..1 (0 = every outline is a
   *  single pass). */
  outlineWeight: number;
  /** The z of the band whose silhouette carries the extra weight — the sheet's
   *  focal point. -1 = none. */
  heroZ: number;
  /** Strata builds its seam gaps into the polygons — skip the masks. */
  geometricGaps: boolean;
  /** sizingDim / TUNING_DIM — scales the outline densify step. */
  featureScale: number;
}

/** Tag every stroke with its pen layer. Interleave walks a per-region
 *  round-robin over emission order — hatch fills emit in scanline order, so
 *  adjacent strokes alternate pens the way the reference's black/orange
 *  field does — with an occasional skipped step so the alternation reads
 *  hand-fed, not machine-cycled. Strokes pre-tagged with a `fam-K` family
 *  marker (mottle's interwoven gratings) map to a dedicated pen per family
 *  in every mode — the two-ink weave is the point of that texture — with
 *  the z offset alternating which ink gets the straight family band to
 *  band. */
function assignPens(lines: FlowLine[], region: Region, cfg: CarveConfig): void {
  const famPen = (line: FlowLine): boolean => {
    if (line.layer !== 'fam-0' && line.layer !== 'fam-1') return false;
    const k = line.layer === 'fam-0' ? 0 : 1;
    line.layer = inkLayerName(cfg.pens <= 1 ? 0 : (region.z + k) % cfg.pens);
    return true;
  };
  if (cfg.pens <= 1) {
    for (const line of lines) line.layer = inkLayerName(0);
    return;
  }
  if (cfg.penAssignment === 'per-region') {
    const layer = inkLayerName(region.z % cfg.pens);
    for (const line of lines) {
      if (!famPen(line)) line.layer = layer;
    }
    return;
  }
  const rng = makeRandom(subSeed(cfg.seed, 300 + region.z));
  let counter = Math.floor(rng() * cfg.pens);
  for (const line of lines) {
    if (famPen(line)) continue;
    line.layer = inkLayerName(counter % cfg.pens);
    counter++;
    if (rng() < 0.15) counter++;
  }
}

/**
 * The region silhouette as a *drawn* keyline rather than a traced loop.
 *
 * A closed, uniformly densified polygon is the one mark on the sheet that
 * could only have been made by a machine: a hand draws a silhouette in two or
 * three confident arcs, lands and lifts at each end, and leans on the pen
 * where the form turns. So: break the loop at a seeded phase, trim each arc so
 * it tapers instead of ending in a blunt bar, and tag the result `pen: 'bold'`
 * — which also buys the steadier hand `applyHandDrawnStyle` gives bold strokes
 * for free, and stops `optimizePlot` chaining the keyline into the fills.
 *
 * The hero band earns extra weight from repeated offset passes of the same pen
 * (never a stroke-width trick — this has to plot). Those passes push ink
 * sideways into the reserved seam, so the spread is clamped against the halo:
 * at `haloPx * 0.12` even four passes travel under `haloPx * 0.18` outward,
 * leaving the wobble budget intact. Do not loosen that clamp without redoing
 * the arithmetic — the seam is the whole look.
 */
function outlineLines(region: Region, cfg: CarveConfig, hero: boolean): FlowLine[] {
  const poly = region.poly;
  const points: Point[] = [];
  const step = Math.max(1, 6 * cfg.featureScale);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  if (points.length < 8) return points.length >= 2 ? [{ points }] : [];

  const rng = makeRandom(subSeed(cfg.seed, 600 + region.z));
  const n = points.length;
  // Two to four arcs, each starting where the last lifted. The gaps are a
  // fraction of an arc, not a fixed px count, so they read the same on any
  // sheet.
  const arcs = 2 + Math.floor(rng() * 3);
  const phase = Math.floor(rng() * n);
  const out: FlowLine[] = [];
  const cuts: number[] = [];
  for (let k = 0; k < arcs; k++) cuts.push(Math.floor((k / arcs) * n));
  for (let k = 0; k < arcs; k++) {
    const from = cuts[k];
    const to = k + 1 < arcs ? cuts[k + 1] : n;
    // Lift a short gap before the next arc picks up.
    const lift = Math.max(1, Math.round((to - from) * (0.03 + 0.05 * rng())));
    const arc: Point[] = [];
    for (let i = from; i < to - lift; i++) arc.push(points[(i + phase) % n]);
    if (arc.length < 3) continue;
    const drawn = trimPolyline(arc, 0.03);
    if (drawn.length < 2) continue;
    out.push({ points: drawn, pen: 'bold' });
    if (!hero || cfg.outlineWeight <= 0) continue;
    const passes = 2 + Math.round(cfg.outlineWeight * 2);
    const spread = Math.min(0.5 * cfg.featureScale, cfg.haloPx * 0.12);
    for (const pass of offsetEmphasisPasses(drawn, passes, spread, 0.08)) {
      out.push({ points: pass, pen: 'bold' });
    }
  }
  return out;
}

/**
 * Draw the regions top-down (z descending) with reserved-paper seams: each
 * region's fill is clipped OUTSIDE the accumulated upper ink's coverage mask
 * grown by the halo radius, so a lower band's strokes terminate exactly one
 * seam short of the ink above — the stacked-stencil look of the reference,
 * with no polygon-boolean math. Phantom fills ('blank' bands) join the avoid
 * union without being drawn.
 */
export function carveRegions(
  regions: Region[],
  fill: (region: Region) => RegionFill,
  cfg: CarveConfig
): FlowLine[] {
  const sorted = [...regions].sort((a, b) => b.z - a.z);
  // Accumulated upper-ink coverage, stamped incrementally: each stroke is
  // rasterized once instead of re-building the whole mask per region.
  let acc: CoverageAccumulator | null = null;
  let accHasInk = false;
  const out: FlowLine[] = [];
  for (const region of sorted) {
    const { ink, phantom } = fill(region);
    let drawn =
      cfg.outlines && region.z > 0
        ? [...ink, ...outlineLines(region, cfg, region.z === cfg.heroZ)]
        : ink;
    if (!cfg.geometricGaps) {
      // Seamless regions (blend-joined spiral cells) still stamp coverage —
      // the field below carves around them — but are never clipped
      // themselves, so abutting cells meet edge to edge with no seam.
      if (accHasInk && drawn.length > 0 && !region.seamless) {
        drawn = clipLinesToMask(drawn, acc!.mask, {
          mode: 'outside',
          // Dust filter, sized to the texture: sliver hatch ticks at the seam
          // are noise, but a stipple dot is sub-px long and must survive.
          minKeepPx: region.tex.kind === 'stipple' ? 0.5 : region.tex.spacing,
        });
      }
      const add = [...drawn, ...phantom];
      if (add.length > 0) {
        acc ??= createCoverageAccumulator(cfg.width, cfg.height, { radiusPx: cfg.haloPx });
        acc.stamp(add);
        accHasInk = true;
      }
    }
    assignPens(drawn, region, cfg);
    out.push(...drawn);
  }
  return out;
}
