import { FlowLine, Point } from '../flow-lines.js';
import { CoverageAccumulator, createCoverageAccumulator, clipLinesToMask } from '../compose/index.js';
import { makeRandom, subSeed } from '../lib/rng.js';
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
  /** Strata builds its seam gaps into the polygons — skip the masks. */
  geometricGaps: boolean;
}

/** Tag every stroke with its pen layer. Interleave walks a per-region
 *  round-robin over emission order — hatch fills emit in scanline order, so
 *  adjacent strokes alternate pens the way the reference's black/orange
 *  field does — with an occasional skipped step so the alternation reads
 *  hand-fed, not machine-cycled. */
function assignPens(lines: FlowLine[], region: Region, cfg: CarveConfig): void {
  if (cfg.pens <= 1) {
    for (const line of lines) line.layer = inkLayerName(0);
    return;
  }
  if (cfg.penAssignment === 'per-region') {
    const layer = inkLayerName(region.z % cfg.pens);
    for (const line of lines) line.layer = layer;
    return;
  }
  const rng = makeRandom(subSeed(cfg.seed, 300 + region.z));
  let counter = Math.floor(rng() * cfg.pens);
  for (const line of lines) {
    line.layer = inkLayerName(counter % cfg.pens);
    counter++;
    if (rng() < 0.15) counter++;
  }
}

/** The region silhouette as a closed, densified stroke. */
function outlineLines(region: Region): FlowLine[] {
  const poly = region.poly;
  const points: Point[] = [];
  const step = 6;
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
  if (points.length >= 2) points.push({ ...points[0] });
  return points.length >= 2 ? [{ points }] : [];
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
    let drawn = cfg.outlines && region.z > 0 ? [...ink, ...outlineLines(region)] : ink;
    if (!cfg.geometricGaps) {
      if (accHasInk && drawn.length > 0) {
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
