import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import {
  pageMetrics,
  resolvePaperSize,
  computeTiling,
  sliceResultIntoTiles,
  tileLabel,
  TILE_MARKS_LAYER,
  toSVG,
  toSVGLayers,
  type Orientation,
  type PageMetrics,
  type SVGOptions,
  type FlowLinesResult,
  type TilingOptions,
} from '@flow-lines/core';

/** Shared help text for every command's --paper flag. */
export const PAPER_SPEC_HELP =
  'Plot to a physical sheet (a6,a5,a4,a3,a2,a1,a0,2a0,letter,legal,tabloid,arch-d ' +
  'or a custom WxH in mm, e.g. 1200x900); overrides --width/--height and exports the SVG in mm';

export interface PageFrame {
  width: number;
  height: number;
  marginPx: number;
  paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'>;
  paperStrokeWidth: number | undefined;
  /** Set on the --paper path — the ground truth tiling needs. */
  page?: PageMetrics;
  marginMm?: number;
}

/**
 * Resolve the output frame shared verbatim by the conway/botanical/planet/
 * landscape commands: with --paper, page metrics in px at the requested
 * resolution plus physical-mm SVG dimensions and a pen width in px; without
 * it, the raw pixel flags.
 */
export function resolvePageFrame(options: {
  paper?: string;
  orientation: string;
  resolution: string;
  marginMm: string;
  penWidthMm: string;
  width: string;
  height: string;
  margin: string;
}): PageFrame {
  let width: number;
  let height: number;
  let marginPx: number;
  let paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'> = {};
  let paperStrokeWidth: number | undefined;
  let page: PageMetrics | undefined;
  let marginMm: number | undefined;

  if (options.paper) {
    page = pageMetrics(
      resolvePaperSize(String(options.paper)),
      options.orientation as Orientation,
      parseFloat(options.resolution)
    );
    width = page.widthPx;
    height = page.heightPx;
    marginMm = parseFloat(options.marginMm);
    marginPx = marginMm * page.pxPerMm;
    paperSvg = { physicalWidth: `${page.widthMm}mm`, physicalHeight: `${page.heightMm}mm` };
    paperStrokeWidth = parseFloat(options.penWidthMm) * page.pxPerMm;
  } else {
    width = parseInt(options.width, 10);
    height = parseInt(options.height, 10);
    marginPx = parseInt(options.margin, 10);
  }

  return { width, height, marginPx, paperSvg, paperStrokeWidth, page, marginMm };
}

/** Flag values registered by addTileOptions. */
export interface TileFlagValues {
  tile?: string;
  tileOrientation: string;
  /** commander's --no-tile-margin: defaults true. */
  tileMargin: boolean;
  tileOverlap: string;
  tileMarks?: boolean;
}

/** Register the shared multi-sheet tiling flags on a command. */
export function addTileOptions(cmd: Command): Command {
  return cmd
    .option(
      '--tile <spec>',
      'Split the plot across sheets of this size (id like a4, or WxH in mm); requires --paper'
    )
    .option('--tile-orientation <o>', 'Tile sheet orientation: portrait or landscape', 'portrait')
    .option(
      '--no-tile-margin',
      'Tiles are raw edge-to-edge slices (default: each sheet keeps --margin-mm of clear border, trimmed on assembly)'
    )
    .option(
      '--tile-overlap <mm>',
      'Glue-flap overlap in mm: adjacent sheets repeat this much artwork',
      '0'
    )
    .option(
      '--tile-marks',
      'Trim ticks on the margin line of each edge that meets a neighbouring sheet, held clear of the paper edge, on their own tile-marks pen layer (needs the per-sheet margin)'
    );
}

/**
 * Write the final plot. Without --tile this is exactly the historical output
 * path (one SVG, or one per pen layer with --split-layers). With --tile the
 * result is sliced across sheets of the given size and written as
 * `<base>-r1c1.svg`… (with --split-layers: `<base>-r1c1.<layer>.svg`).
 */
export function writePlotOutput(
  result: FlowLinesResult,
  frame: PageFrame,
  options: TileFlagValues & { splitLayers?: boolean; output: string },
  svgOptions: SVGOptions
): void {
  if (!options.tile) {
    if (options.splitLayers) {
      // Strip a trailing .svg so layers land as <base>.<layer>.svg
      const base = resolve(process.cwd(), options.output.replace(/\.svg$/i, ''));
      const layers = toSVGLayers(result, svgOptions);
      for (const { layer, svg } of layers) {
        const layerPath = `${base}.${layer}.svg`;
        writeFileSync(layerPath, svg, 'utf-8');
        console.log(`  Saved layer '${layer}' to: ${layerPath}`);
      }
    } else {
      const svg = toSVG(result, svgOptions);
      const outputPath = resolve(process.cwd(), options.output);
      writeFileSync(outputPath, svg, 'utf-8');
      console.log(`\nSaved to: ${outputPath}`);
    }
    return;
  }

  if (!frame.page || frame.marginMm === undefined) {
    throw new Error('--tile requires --paper (tiling needs physical sheet dimensions)');
  }
  const tilingOptions: TilingOptions = {
    sheet: resolvePaperSize(String(options.tile)),
    sheetOrientation: options.tileOrientation as Orientation,
    marginMm: frame.marginMm,
    perSheetMargin: options.tileMargin,
    overlapMm: parseFloat(options.tileOverlap),
    registrationMarks: options.tileMarks ?? false,
  };
  const layout = computeTiling(frame.page, tilingOptions);
  const tiles = sliceResultIntoTiles(result, frame.page, layout, tilingOptions);
  console.log(
    `  Tiling: ${layout.rows}×${layout.cols} sheets of ${tilingOptions.sheet.name} (${tiles.length} total)`
  );
  const base = resolve(process.cwd(), options.output.replace(/\.svg$/i, ''));
  for (const t of tiles) {
    const tileSvgOptions: SVGOptions = {
      ...svgOptions,
      physicalWidth: t.physicalWidth,
      physicalHeight: t.physicalHeight,
      ...(tilingOptions.registrationMarks
        ? {
            layerColors: {
              ...svgOptions.layerColors,
              [TILE_MARKS_LAYER]: svgOptions.strokeColor ?? '#000000',
            },
          }
        : {}),
    };
    if (options.splitLayers) {
      for (const { layer, svg } of toSVGLayers(t.result, tileSvgOptions)) {
        const layerPath = `${base}-${tileLabel(t.tile)}.${layer}.svg`;
        writeFileSync(layerPath, svg, 'utf-8');
        console.log(`  Saved sheet ${tileLabel(t.tile)} layer '${layer}' to: ${layerPath}`);
      }
    } else {
      const tilePath = `${base}-${tileLabel(t.tile)}.svg`;
      writeFileSync(tilePath, toSVG(t.result, tileSvgOptions), 'utf-8');
      console.log(`  Saved sheet ${tileLabel(t.tile)} to: ${tilePath}`);
    }
  }
}
