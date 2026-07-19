import {
  sliceResultIntoTiles,
  tileLabel,
  toSVG,
  toSVGLayers,
  TILE_MARKS_LAYER,
  type FlowLinesResult,
  type PageMetrics,
  type SVGOptions,
  type TilingLayout,
  type TilingOptions,
} from '@flow-lines/core';
import type { ZipEntry } from './zip';

/**
 * Zip entries for the "Download sheets" export. Single-pen plots stay flat —
 * one `flow-lines-r1c1.svg` per sheet, all inks combined. Multi-pen plots
 * get one folder per sheet with one SVG per pen layer inside
 * (`r1c1/flow-lines-L0-fine.svg`, `r1c1/flow-lines-tile-marks.svg`, …), so a
 * 3-pen, 9-sheet plot unpacks into 9 folders of 3 registered files; every
 * layer of a sheet shares its viewBox and physical mm dims, so pens register
 * exactly. Layer keys are slash-flattened the same way the whole-sheet
 * layers zip names them.
 */
export function sheetsZipEntries(
  result: FlowLinesResult,
  page: PageMetrics,
  layout: TilingLayout,
  opts: TilingOptions,
  svgOptions: SVGOptions,
  hasLayers: boolean
): ZipEntry[] {
  const tiles = sliceResultIntoTiles(result, page, layout, opts);
  const entries: ZipEntry[] = [];
  for (const t of tiles) {
    const tileSvgOptions: SVGOptions = {
      ...svgOptions,
      physicalWidth: t.physicalWidth,
      physicalHeight: t.physicalHeight,
      ...(opts.registrationMarks
        ? {
            layerColors: {
              ...svgOptions.layerColors,
              [TILE_MARKS_LAYER]: svgOptions.strokeColor ?? '#111111',
            },
          }
        : {}),
    };
    const label = tileLabel(t.tile);
    if (hasLayers) {
      for (const { layer, svg } of toSVGLayers(t.result, tileSvgOptions)) {
        entries.push({
          name: `${label}/flow-lines-${layer.replace(/\//g, '-')}.svg`,
          text: svg,
        });
      }
    } else {
      entries.push({ name: `flow-lines-${label}.svg`, text: toSVG(t.result, tileSvgOptions) });
    }
  }
  return entries;
}
