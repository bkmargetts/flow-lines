import { pageMetrics, getPaperSize, type Orientation, type SVGOptions } from '@flow-lines/core';

export interface PageFrame {
  width: number;
  height: number;
  marginPx: number;
  paperSvg: Pick<SVGOptions, 'physicalWidth' | 'physicalHeight'>;
  paperStrokeWidth: number | undefined;
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

  if (options.paper) {
    const page = pageMetrics(
      getPaperSize(String(options.paper).toLowerCase()),
      options.orientation as Orientation,
      parseFloat(options.resolution)
    );
    width = page.widthPx;
    height = page.heightPx;
    marginPx = parseFloat(options.marginMm) * page.pxPerMm;
    paperSvg = { physicalWidth: `${page.widthMm}mm`, physicalHeight: `${page.heightMm}mm` };
    paperStrokeWidth = parseFloat(options.penWidthMm) * page.pxPerMm;
  } else {
    width = parseInt(options.width, 10);
    height = parseInt(options.height, 10);
    marginPx = parseInt(options.margin, 10);
  }

  return { width, height, marginPx, paperSvg, paperStrokeWidth };
}
