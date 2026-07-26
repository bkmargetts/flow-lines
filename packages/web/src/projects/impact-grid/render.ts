import { generateImpactGrid, type ImpactGridOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { clipLinesToRect } from '../stickmen/clip';
import type { ImpactGridState } from './types';

/**
 * Pure render for Impact Grid: state + page → lines. mm settings convert to
 * px at the page density; cell size is physical, so density scales with the
 * sheet automatically. The drawn `maskPath` is already in page px and passes
 * straight through as the impact centreline. The clip is a real guard here,
 * not just defensive: scatter deliberately throws shards outward and the
 * debris must stop at the margin.
 */
export function renderImpactGrid(state: ImpactGridState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const options: ImpactGridOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,
    layout: state.layout,
    frameDepth: state.frameDepth,

    cellSize: state.cellSizeMm * mm,
    sizeVariation: state.sizeVariation,
    positionJitter: state.positionJitter,
    rotationJitter: state.rotationJitter,
    gap: state.gap,

    impactPath: state.maskPath,
    impactRadius: state.impactRadiusMm * mm,
    impactStrength: state.impactStrength,
    shatter: state.shatter,
    scatter: state.scatter,
    debris: state.debris,

    fill: state.fill,
    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateImpactGrid(options);
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
  };
}
