/**
 * Physical paper sizes for plotter output. Pure data + geometry — no DOM,
 * no ML. The canvas is defined as a real sheet (A4, A3, Letter…) in
 * millimetres; pixels are derived for rendering and the SVG is exported at
 * true millimetre dimensions so what plots matches what the preview shows.
 */

export type Orientation = 'portrait' | 'landscape';

/** How a photo (with its own aspect) sits on a sheet of a different aspect. */
export type PaperFit = 'fit' | 'fill';

export interface PaperSize {
  id: string;
  name: string;
  /** Width in millimetres, portrait orientation. */
  widthMm: number;
  /** Height in millimetres, portrait orientation. */
  heightMm: number;
}

/**
 * Reference render density: pixels per millimetre at scale 1. Chosen so a
 * default A4 (210×297mm) renders ~630×891px — close to the app's previous
 * pixel canvas, so existing tuning still reads the same.
 */
export const BASE_PX_PER_MM = 3;

/** Selectable sheets: ISO A-series plus common US sizes. Stored portrait. */
export const PAPER_SIZES: PaperSize[] = [
  { id: 'a6', name: 'A6', widthMm: 105, heightMm: 148 },
  { id: 'a5', name: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'a3', name: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'a2', name: 'A2', widthMm: 420, heightMm: 594 },
  { id: 'a1', name: 'A1', widthMm: 594, heightMm: 841 },
  { id: 'a0', name: 'A0', widthMm: 841, heightMm: 1189 },
  { id: '2a0', name: '2A0', widthMm: 1189, heightMm: 1682 },
  { id: 'letter', name: 'US Letter', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', name: 'US Legal', widthMm: 215.9, heightMm: 355.6 },
  { id: 'tabloid', name: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
  { id: 'arch-d', name: 'Arch D', widthMm: 609.6, heightMm: 914.4 },
];

const PAPER_BY_ID: Record<string, PaperSize> = Object.fromEntries(
  PAPER_SIZES.map((p) => [p.id, p])
);

export function getPaperSize(id: string): PaperSize {
  const size = PAPER_BY_ID[id];
  if (!size) throw new Error(`Unknown paper size: ${id}`);
  return size;
}

/** Id carried by paper sizes produced from a custom "WxH" spec. */
export const CUSTOM_PAPER_ID = 'custom';

/** Sanity bounds for custom sheets, in mm (10mm .. 3m per edge). */
const CUSTOM_MM_MIN = 10;
const CUSTOM_MM_MAX = 3000;

const clampMm = (v: number): number =>
  Math.min(CUSTOM_MM_MAX, Math.max(CUSTOM_MM_MIN, v));

/**
 * Resolve a paper spec: a table id ('a4'), a raw 'WxH' in millimetres
 * ('1200x900'), or the prefixed form 'custom:1200x900' (what the web frame
 * stores). Custom dims are kept exactly as given (orientation still swaps
 * W/H downstream) and clamped to 10–3000mm per edge. Throws on anything
 * else — same contract as getPaperSize.
 */
export function resolvePaperSize(spec: string): PaperSize {
  const s = spec.trim().toLowerCase().replace(/^custom:/, '');
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(s);
  if (m) {
    const widthMm = clampMm(parseFloat(m[1]));
    const heightMm = clampMm(parseFloat(m[2]));
    return {
      id: CUSTOM_PAPER_ID,
      name: `Custom ${widthMm}×${heightMm}mm`,
      widthMm,
      heightMm,
    };
  }
  return getPaperSize(s);
}

/** Sheet dimensions in mm for the given orientation (landscape swaps W/H). */
export function orientedDimsMm(
  size: PaperSize,
  orientation: Orientation
): { widthMm: number; heightMm: number } {
  return orientation === 'landscape'
    ? { widthMm: size.heightMm, heightMm: size.widthMm }
    : { widthMm: size.widthMm, heightMm: size.heightMm };
}

export interface PageMetrics {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  /** Effective pixels-per-mm after any memory cap. */
  pxPerMm: number;
  /** Length scale vs the reference density (effective px/mm ÷ BASE_PX_PER_MM). */
  scale: number;
}

/**
 * Resolve a paper choice to a concrete pixel raster.
 *
 * The sheet is sized in millimetres; pixels follow at `pxPerMm`, but a
 * `longEdgeCapPx` (a mobile / low-memory budget) lowers the effective density
 * uniformly so big sheets stay renderable. `scale` (effective px/mm ÷
 * reference) is handed to the renderer so it can keep *physical* stroke
 * spacing constant: line density then tracks the sheet's millimetre size — a
 * larger sheet carries proportionally more lines at the same pen width —
 * independent of how the raster was capped.
 */
export function pageMetrics(
  size: PaperSize,
  orientation: Orientation,
  pxPerMm: number = BASE_PX_PER_MM,
  longEdgeCapPx?: number
): PageMetrics {
  const { widthMm, heightMm } = orientedDimsMm(size, orientation);
  const longEdgeMm = Math.max(widthMm, heightMm);
  let effective = pxPerMm;
  if (longEdgeCapPx && longEdgeMm * effective > longEdgeCapPx) {
    effective = longEdgeCapPx / longEdgeMm;
  }
  return {
    widthMm,
    heightMm,
    widthPx: Math.max(1, Math.round(widthMm * effective)),
    heightPx: Math.max(1, Math.round(heightMm * effective)),
    pxPerMm: effective,
    scale: effective / BASE_PX_PER_MM,
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectangle (in page pixels) the drawing occupies for an image of aspect
 * `imgAspect` (= width / height), leaving `marginPx` of clear paper at every
 * edge. 'fit' letterboxes the whole image inside the margin box (nothing
 * cropped); 'fill' covers the margin box, overflowing on one axis (the
 * overflow is clipped at the page edge by the renderer).
 */
export function contentRect(
  pageWidthPx: number,
  pageHeightPx: number,
  marginPx: number,
  imgAspect: number,
  fit: PaperFit
): Rect {
  const availW = Math.max(1, pageWidthPx - 2 * marginPx);
  const availH = Math.max(1, pageHeightPx - 2 * marginPx);
  const availAspect = availW / availH;
  // Whether the sheet's width is the binding constraint for this fit mode.
  const widthLimited =
    fit === 'fit' ? imgAspect > availAspect : imgAspect < availAspect;
  let w: number;
  let h: number;
  if (widthLimited) {
    w = availW;
    h = availW / imgAspect;
  } else {
    h = availH;
    w = availH * imgAspect;
  }
  return {
    x: (pageWidthPx - w) / 2,
    y: (pageHeightPx - h) / 2,
    width: w,
    height: h,
  };
}
