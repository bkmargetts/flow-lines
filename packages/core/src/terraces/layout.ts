import { Point } from '../flow-lines.js';
import {
  resolveTexture,
  type BandTexture,
  type LapidaryTexture,
  type LapidaryToneShape,
  type LayoutConfig,
  type Region,
} from '../lapidary/layout.js';
import { terraceCurves } from './curves.js';

/** Layout inputs for the terraces sheet: the strata-relevant slice of
 *  lapidary's `LayoutConfig` plus the terrace knobs. */
export interface TerracesLayout {
  seed: number;
  rect: { x0: number; y0: number; x1: number; y1: number };
  bands: number;
  irregularity: number;
  steppiness: number;
  faults: number;
  faultThrow: number;
  faultIncline: number;
  haloPx: number;
  spacingPx: number;
  textures?: Array<LapidaryTexture | BandTexture>;
  baseAngleDeg: number;
  angleDriftDeg: number;
  densityContrast: number;
  waviness: number;
  patchiness: number;
  taper: number;
  jitterDeg: number;
  toneShape: LapidaryToneShape;
  toneStrength: number;
  lightAngleDeg: number;
  featureScale: number;
}

/** Adapter into lapidary's `LayoutConfig` so the shared texture deal
 *  (`resolveTexture`) sees exactly the fields it reads. The fields terraces
 *  doesn't expose are pinned to the strata path's values — `mode: 'strata'`
 *  keeps the crystal deal gated off, exactly as lapidary strata does. If
 *  lapidary grows a required `LayoutConfig` field, this adapter must pin it
 *  too. */
function toLapidaryLayout(cfg: TerracesLayout): LayoutConfig {
  return {
    seed: cfg.seed,
    mode: 'strata',
    rect: cfg.rect,
    bands: cfg.bands,
    field: true,
    shapes: 'organic',
    irregularity: cfg.irregularity,
    coverage: 0.9,
    centerX: 0,
    centerY: 0,
    haloPx: cfg.haloPx,
    spacingPx: cfg.spacingPx,
    textures: cfg.textures,
    baseAngleDeg: cfg.baseAngleDeg,
    angleDriftDeg: cfg.angleDriftDeg,
    densityContrast: cfg.densityContrast,
    waviness: cfg.waviness,
    patchiness: cfg.patchiness,
    taper: cfg.taper,
    jitterDeg: cfg.jitterDeg,
    toneShape: cfg.toneShape,
    toneStrength: cfg.toneStrength,
    lightAngleDeg: cfg.lightAngleDeg,
    faults: 0,
    spiralForm: 'circular',
    spiralDirection: 'inward',
    spiralJoin: 'cells',
    spiralWidth: 0.55,
    spiralTaper: 0.35,
    spiralPulse: 0.35,
    featureScale: cfg.featureScale,
  };
}

/**
 * Fork of lapidary's `strataRegions`: the sheet partitioned into beds whose
 * seam gaps are built into the polygons (geometric gaps — no mask carve),
 * each carrying the index-aligned `strataBand` bounding curves that
 * silhouette-following fills (the fortification contour lamination) follow.
 */
export function buildTerraceRegions(cfg: TerracesLayout): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const lap = toLapidaryLayout(cfg);
  const curves = terraceCurves(
    cfg.seed,
    cfg.bands - 1,
    x0,
    y0,
    x1,
    y1,
    cfg.irregularity,
    cfg.haloPx * 2 + cfg.spacingPx * 2,
    cfg.steppiness,
    cfg.faults,
    cfg.faultThrow,
    cfg.faultIncline
  );
  const half = cfg.haloPx / 2;
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  for (let k = 0; k < cfg.bands; k++) {
    const topCurve = k === 0 ? null : curves[k - 1].map((p) => ({ x: p.x, y: p.y + half }));
    const bottomCurve =
      k === cfg.bands - 1 ? null : curves[k].map((p) => ({ x: p.x, y: p.y - half }));
    const top: Point[] = topCurve ?? [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
    ];
    const bottom: Point[] = bottomCurve
      ? [...bottomCurve].reverse()
      : [
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ];
    const poly = [...top, ...bottom];
    // Bounding curves for silhouette-following fills, index-aligned on the
    // shared x grid: a page-edge band resamples its straight edge onto the
    // opposite curve's grid.
    const bandTop = topCurve ?? (bottomCurve ?? []).map((p) => ({ x: p.x, y: y0 }));
    const bandBottom = bottomCurve ?? (topCurve ?? []).map((p) => ({ x: p.x, y: y1 }));
    const tex = resolveTexture(lap, k, prevKind);
    prevKind = tex.kind;
    regions.push({
      z: k,
      poly,
      tex,
      strataBand:
        bandTop.length > 1 && bandTop.length === bandBottom.length
          ? { top: bandTop, bottom: bandBottom }
          : undefined,
    });
  }
  return regions;
}
