import {
  generateHearts,
  starRegion,
  heartRegion,
  diamondRegion,
  blobRegion,
  type HeartStyle,
  type HeartsOptions,
  type HeartsRegion,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { sheetAreaFactor } from '../../lib/sheet-scale';
import type { HeartsState } from './types';
import { clipLinesToRect } from '../stickmen/clip';

const DEG = Math.PI / 180;

/**
 * Compile the UI's fill-shape state to a core region — same contract as the
 * stickmen crowd shape: picture shapes (star / heart / diamond / blob) are
 * sized from the smaller box dimension and divided per-axis to stay
 * aspect-correct; the oval follows the page aspect; the ring is circular by
 * the core's contract.
 */
function compileShape(state: HeartsState, boxW: number, boxH: number): HeartsRegion | undefined {
  const { regionShape: shape, regionSize: size, regionX: cx, regionY: cy, regionInner: inner } = state;
  if (shape === 'full') return undefined;
  if (shape === 'ellipse') return { kind: 'ellipse', cx, cy, rx: size / 2, ry: size / 2 };
  if (shape === 'ring')
    return { kind: 'ring', cx, cy, rOuter: size / 2, rInner: (size / 2) * inner };
  const r = (size / 2) * Math.min(boxW, boxH);
  const rx = r / boxW;
  const ry = r / boxH;
  if (shape === 'diamond') return diamondRegion(cx, cy, rx, ry);
  if (shape === 'star') return starRegion(cx, cy, rx, ry, inner, 5);
  if (shape === 'heart') return heartRegion(cx, cy, rx, ry);
  return blobRegion(state.seed, cx, cy, rx, ry, 0.45);
}

/**
 * Pure render for the Hearts generator: state + page → lines. mm settings
 * convert to px at the page density. The core insets every heart by its
 * bounding radius so the pile is page-safe by construction; the clip here is
 * a defensive trim (wobble can nudge a point past the margin).
 */
export function renderHearts(state: HeartsState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  // Toggles → 0/1 weights. The core falls back to every style when all are
  // off, so the layer never renders empty.
  const mix: Partial<Record<HeartStyle, number>> = {};
  for (const [style, on] of Object.entries(state.mix)) mix[style as HeartStyle] = on ? 1 : 0;

  const options: HeartsOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    // Crowd density holds on big sheets: more hearts at the same physical
    // size (×1 at A4 and below — goldens untouched).
    count: Math.round(state.count * sheetAreaFactor(page)),
    clustering: state.clustering,
    minSeparation: state.spacingMm * mm,
    region: compileShape(state, page.widthPx - 2 * marginPx, page.heightPx - 2 * marginPx),
    softRegionEdge: state.regionSoftEdge,

    heartScale: state.heartSizeMm * mm,
    scaleVariance: state.sizeVariance,
    depthGrade: state.depthGrade,
    plumpness: state.plumpness,
    plumpVariance: state.plumpVariance,
    tilt: state.tilt,
    age: state.age,
    mix,

    fillDensity: state.fillDensity,
    hatchAngle: state.hatchAngleDeg * DEG,
    hatchJitter: state.hatchJitter,
    arrows: state.arrows,
    boldOutline: state.boldOutline,

    shading: state.shading,
    lightAngle: state.lightAngleDeg * DEG,
    occlude: state.occlude,
    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateHearts(options);
  const lines = clipLinesToRect(
    result.lines,
    marginPx,
    marginPx,
    page.widthPx - marginPx,
    page.heightPx - marginPx
  );

  return {
    lines,
    strokeColor: state.strokeColor,
    strokeWidthPx: state.penWidthMm * mm,
    layerColors: {
      outline: state.strokeColor,
      fill: state.strokeColor,
      shading: state.strokeColor,
      decor: state.strokeColor,
    },
  };
}
