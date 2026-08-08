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

/** The region silhouette as a closed, densified stroke. */
function outlineLines(region: Region, featureScale: number): FlowLine[] {
  const poly = region.poly;
  const points: Point[] = [];
  const step = Math.max(1, 6 * featureScale);
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
    let drawn =
      cfg.outlines && region.z > 0 ? [...ink, ...outlineLines(region, cfg.featureScale)] : ink;
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
