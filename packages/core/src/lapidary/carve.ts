import { FlowLine, Point } from '../flow-lines.js';
import { CoverageAccumulator, createCoverageAccumulator, clipLinesToMask } from '../compose/index.js';
import { smoothPolyline } from '../lib/polyline.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { inkLayerName } from '../marbling/index.js';
import { offsetEmphasisPasses } from '../pen-ink/swell.js';
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
  /** Offset single-pen passes each outline dash is built from (1-3). */
  outlineEmphasis: number;
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
 * The region silhouette as a bold, broken, hand-drawn stroke: the closed
 * loop is smoothed a touch, broken into dashes with pen-lift gaps (the
 * botanical broken-outline idiom — a suggestion, not a coloring-book
 * border), and each dash is built up from trimmed offset passes of the
 * same pen so it swells like a real ink stroke instead of a uniform rail.
 * Every stroke is tagged `pen: 'bold'` — drawn with commitment, so the
 * hand pass wobbles it less and the SVG gives it the heavier weight.
 */
function outlineLines(region: Region, cfg: CarveConfig): FlowLine[] {
  const poly = region.poly;
  const fs = cfg.featureScale;
  const points: Point[] = [];
  const step = Math.max(1, 6 * fs);
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
  if (points.length < 3) return [];
  const loop = smoothPolyline(points, 1);
  loop.push({ ...loop[0] });
  const cum: number[] = new Array(loop.length);
  cum[0] = 0;
  for (let i = 1; i < loop.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(loop[i].x - loop[i - 1].x, loop[i].y - loop[i - 1].y);
  }
  const total = cum[loop.length - 1];
  const at = (s: number): Point => {
    let i = 1;
    while (i < loop.length - 1 && cum[i] < s) i++;
    const span = cum[i] - cum[i - 1] || 1;
    const f = (s - cum[i - 1]) / span;
    return {
      x: loop[i - 1].x + (loop[i].x - loop[i - 1].x) * f,
      y: loop[i - 1].y + (loop[i].y - loop[i - 1].y) * f,
    };
  };
  const rng = makeRandom(subSeed(cfg.seed, 950 + region.z));
  const out: FlowLine[] = [];
  const emitDash = (sa: number, sb: number): void => {
    const dash: Point[] = [at(sa)];
    for (let i = 0; i < loop.length; i++) {
      if (cum[i] > sa && cum[i] < sb) dash.push(loop[i]);
    }
    dash.push(at(sb));
    if (dash.length < 2) return;
    out.push({ points: dash, pen: 'bold' });
    for (const pass of offsetEmphasisPasses(dash, cfg.outlineEmphasis, 0.7 * Math.max(0.5, fs), 0.15)) {
      out.push({ points: pass, pen: 'bold' });
    }
  };
  // Tiny loops (collapsed cores) stay whole — dashing them leaves confetti.
  if (total < 60 * fs) {
    out.push({ points: loop, pen: 'bold' });
    for (const pass of offsetEmphasisPasses(loop, cfg.outlineEmphasis, 0.7 * Math.max(0.5, fs), 0.15)) {
      out.push({ points: pass, pen: 'bold' });
    }
    return out;
  }
  const phase = total * rng();
  let s = 0;
  let guard = 0;
  while (s < total - 2 && guard++ < 400) {
    const e = Math.min(total, s + (30 + rng() * 40) * fs);
    const sa = (s + phase) % total;
    const sb = (e + phase) % total;
    if (sa < sb) {
      emitDash(sa, sb);
    } else {
      if (total - sa > 2) emitDash(sa, total);
      if (sb > 2) emitDash(0, sb);
    }
    s = e + (8 + rng() * 16) * fs;
  }
  return out;
}

/** A contiguous run of output lines that share a texture kind — the unit
 *  the per-kind hand-drawn passes operate on. */
export interface CarveGroup {
  start: number;
  /** Exclusive end index into the returned lines. */
  end: number;
  kind: Region['tex']['kind'] | 'vein';
}

/**
 * Draw the regions top-down (z descending) with reserved-paper seams: each
 * region's fill is clipped OUTSIDE the accumulated upper ink's coverage mask
 * grown by the halo radius, so a lower band's strokes terminate exactly one
 * seam short of the ink above — the stacked-stencil look of the reference,
 * with no polygon-boolean math. Phantom fills ('blank' bands) join the avoid
 * union without being drawn. Lines land region by region, so the returned
 * groups (line-range → texture kind) come for free.
 */
export function carveRegions(
  regions: Region[],
  fill: (region: Region) => RegionFill,
  cfg: CarveConfig
): { lines: FlowLine[]; groups: CarveGroup[] } {
  const sorted = [...regions].sort((a, b) => b.z - a.z);
  // Accumulated upper-ink coverage, stamped incrementally: each stroke is
  // rasterized once instead of re-building the whole mask per region.
  let acc: CoverageAccumulator | null = null;
  let accHasInk = false;
  const out: FlowLine[] = [];
  const groups: CarveGroup[] = [];
  for (const region of sorted) {
    const { ink, phantom } = fill(region);
    let drawn =
      cfg.outlines && region.z > 0 ? [...ink, ...outlineLines(region, cfg)] : ink;
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
    if (drawn.length > 0) {
      groups.push({ start: out.length, end: out.length + drawn.length, kind: region.tex.kind });
      out.push(...drawn);
    }
  }
  return { lines: out, groups };
}
