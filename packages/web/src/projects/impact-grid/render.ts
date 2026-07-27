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
    region: state.region,
    layout: state.layout,
    frameDepth: state.frameDepth,

    cellSize: state.cellSizeMm * mm,
    sizeVariation: state.sizeVariation,
    positionJitter: state.positionJitter,
    rotationJitter: state.rotationJitter,
    gap: state.gap,
    granularity: state.granularity,

    impactPath: state.maskPath,
    impactRadius: state.impactRadiusMm * mm,
    paneStress: state.paneStress,
    energy: state.energy,
    focus: state.focus,
    drift: state.drift,
    impactStrength: state.impactStrength,
    shatter: state.shatter,
    scatter: state.scatter,
    debris: state.debris,
    crush: state.crush,
    sweep: state.sweep,

    fill: state.fill,
    toneRange: state.toneRange,
    fillStyle: state.fillStyle,
    inks: state.inkColors.length,
    inkBalance: state.inkBalance,
    inkMode: state.inkMode,
    inkPath: state.inkPath,
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

  const layerColors: Record<string, string> = { path: state.pathColor };
  state.inkColors.forEach((c, i) => {
    layerColors[`ink-${i}`] = c;
  });

  return {
    lines,
    strokeColor: state.inkColors[0] ?? '#26282e',
    strokeWidthPx: state.penWidthMm * mm,
    layerColors,
  };
}
