import {
  generateSportsBalls,
  starRegion,
  heartRegion,
  diamondRegion,
  blobRegion,
  type BallType,
  type SportsBallsOptions,
  type SportsBallsRegion,
} from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import type { SportsBallsState } from './types';
import { clipLinesToRect } from '../stickmen/clip';

const DEG = Math.PI / 180;

/**
 * Compile the UI's fill-shape state to a core region — same contract as the
 * stickmen crowd shape: picture shapes (star / heart / diamond / blob) are
 * sized from the smaller box dimension and divided per-axis to stay
 * aspect-correct; the oval follows the page aspect; the ring is circular by
 * the core's contract.
 */
function compileShape(
  state: SportsBallsState,
  boxW: number,
  boxH: number
): SportsBallsRegion | undefined {
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
 * Pure render for the Sports Balls generator: state + page → lines. mm
 * settings convert to px at the page density. The core insets every ball by
 * its radius so the pile is page-safe by construction; the clip here is a
 * defensive trim (wobble can nudge a point past the margin).
 */
export function renderSportsBalls(state: SportsBallsState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  // Toggles → 0/1 weights. The core falls back to every type when all are
  // off, so the layer never renders empty.
  const mix: Partial<Record<BallType, number>> = {};
  for (const [type, on] of Object.entries(state.mix)) mix[type as BallType] = on ? 1 : 0;

  const options: SportsBallsOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    count: Math.round(state.count),
    clustering: state.clustering,
    minSeparation: state.spacingMm * mm,
    region: compileShape(state, page.widthPx - 2 * marginPx, page.heightPx - 2 * marginPx),

    ballScale: state.ballSizeMm * mm,
    scaleVariance: state.sizeVariance,
    trueSizes: state.trueSizes,
    depthGrade: state.depthGrade,
    mix,
    spin: state.spin,

    shading: state.shading,
    castShadows: state.castShadows,
    lightAngle: state.lightAngleDeg * DEG,
    occlude: state.occlude,
    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateSportsBalls(options);
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
      seams: state.strokeColor,
      shading: state.strokeColor,
    },
  };
}
