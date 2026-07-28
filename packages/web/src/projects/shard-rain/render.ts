import { generateShardRain, type ShardRainOptions } from '@flow-lines/core';
import type { LayerOutput, RenderEnv } from '../../modules/types';
import { clipLinesToRect } from '../stickmen/clip';
import type { ShardRainState } from './types';

/**
 * Pure render for Shard Rain: state + page → lines. mm settings convert to
 * px at the page density; cell size and strike radius are physical, so
 * density scales with the sheet automatically. The drawn `maskPath` is
 * already in page px and passes straight through as the pin field (the core
 * decimates it into sites and ignores points above the plate's underside).
 * The clip is a real guard: the cascade fans wide and the debris must stop
 * at the margin.
 */
export function renderShardRain(state: ShardRainState, env: RenderEnv): LayerOutput {
  const { page, marginPx } = env;
  const mm = page.pxPerMm;

  const options: ShardRainOptions = {
    width: page.widthPx,
    height: page.heightPx,
    margin: marginPx,
    seed: state.seed,

    paneShape: state.paneShape,
    paneScale: state.paneScale,
    layout: state.layout,
    frameDepth: state.frameDepth,
    cellSize: state.cellSizeMm * mm,
    sizeVariation: state.sizeVariation,
    positionJitter: state.positionJitter,
    rotationJitter: state.rotationJitter,
    gap: state.gap,
    granularity: state.granularity,

    impactPoints: state.maskPath.length > 0 ? state.maskPath : undefined,
    impacts: state.impacts,
    impactRadius: state.impactRadiusMm * mm,
    radiusVariation: state.radiusVariation,
    energy: state.energy,
    moment: state.moment,
    pinSpread: state.pinSpread,
    tilt: state.tilt,
    shatter: state.shatter,
    scatter: state.scatter,
    debris: state.debris,
    crush: state.crush,
    sag: state.sag,

    fill: state.fill,
    toneRange: state.toneRange,
    fillStyle: state.fillStyle,
    inks: state.inkColors.length,
    inkBalance: state.inkBalance,
    inkMode: state.inkMode,
    markImpacts: state.markImpacts,
    occlude: state.occlude,
    penWidth: state.penWidthMm * mm,
    wobble: state.wobbleMm * mm,
  };

  const result = generateShardRain(options);
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
