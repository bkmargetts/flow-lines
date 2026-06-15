import { FlowLinesResult, FlowLine, Point } from './flow-lines.js';

export interface SVGOptions {
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  includeBackground?: boolean;
  precision?: number;
  optimizePaths?: boolean;
  /**
   * Per-layer stroke color, keyed by `FlowLine.layer` (falling back to `pen`,
   * then 'default'). Any layer not listed uses `strokeColor`. Lets a single
   * drawing preview/export in two or three inks (e.g. near-black present, warm
   * grey ghosts, faint sepia trails) while still plotting one pen per layer.
   */
  layerColors?: Record<string, string>;
  /**
   * Physical SVG width/height (e.g. "210mm"). When set, the document is
   * tagged with real-world dimensions while the `viewBox` stays in the px
   * coordinate space — so the on-screen preview (which reads the viewBox) and
   * the plotted output (which reads the mm) are the same drawing at true size.
   */
  physicalWidth?: string;
  physicalHeight?: string;
}

/**
 * Render a set of lines into <path> elements (shared by toSVG and
 * toSVGLayers). Everything plots with one pen at one width: emphasis (bold
 * outlines) is built from repeated offset strokes upstream, not stroke width.
 */
function renderPathElements(
  lines: FlowLine[],
  strokeColor: string,
  strokeWidth: number,
  precision: number,
  optimizePaths: boolean
): string {
  return lines
    .map((line) => lineToPath(line, precision, optimizePaths))
    .filter((d) => d.length > 0)
    .map(
      (d) =>
        `  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join('\n');
}

/** Wrap rendered path elements in an SVG document at the result's dimensions */
function wrapSvg(
  width: number,
  height: number,
  physicalWidth: string | undefined,
  physicalHeight: string | undefined,
  backgroundRect: string,
  body: string
): string {
  // Physical dimensions tag the page for plotting; the viewBox keeps the px
  // coordinate space so geometry and preview are untouched. Falls back to px.
  const svgWidth = physicalWidth ?? `${width}`;
  const svgHeight = physicalHeight ?? `${height}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}">
${backgroundRect}${body}
</svg>`;
}

/**
 * Convert flow lines result to SVG string
 */
export function toSVG(result: FlowLinesResult, options: SVGOptions = {}): string {
  const {
    strokeColor = '#000000',
    strokeWidth = 1,
    backgroundColor = '#ffffff',
    includeBackground = false,
    precision = 2,
    optimizePaths = true,
    physicalWidth,
    physicalHeight,
  } = options;

  const backgroundRect = includeBackground
    ? `  <rect width="${result.width}" height="${result.height}" fill="${backgroundColor}"/>\n`
    : '';

  // One color for everything (the common case), unless per-layer inks are
  // given — then emit one colored block per layer so a single document can
  // preview in two or three pens. Absent layerColors → byte-identical output.
  const pathElements = options.layerColors
    ? orderedLayers(result.lines)
        .map(([layer, lines]) =>
          renderPathElements(
            lines,
            options.layerColors?.[layer] ?? strokeColor,
            strokeWidth,
            precision,
            optimizePaths
          )
        )
        .filter((s) => s.length > 0)
        .join('\n')
    : renderPathElements(result.lines, strokeColor, strokeWidth, precision, optimizePaths);

  return wrapSvg(
    result.width,
    result.height,
    physicalWidth,
    physicalHeight,
    backgroundRect,
    pathElements
  );
}

/** The export layer a line belongs to: explicit `layer`, else its `pen`, else 'default' */
function layerKey(line: FlowLine): string {
  return line.layer ?? line.pen ?? 'default';
}

/** Group lines by layer in a stable order (present → ghost → trail → others). */
function orderedLayers(lines: FlowLine[]): Array<[string, FlowLine[]]> {
  const groups = new Map<string, FlowLine[]>();
  for (const line of lines) {
    const key = layerKey(line);
    const list = groups.get(key);
    if (list) list.push(line);
    else groups.set(key, [line]);
  }

  const preferred = ['texture', 'present', 'ghost', 'trail'];
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return keys.map((k) => [k, groups.get(k) as FlowLine[]]);
}

/**
 * Split a result into one SVG per layer for multi-pen plotting. Lines are
 * grouped by `line.layer` (falling back to `pen`, then 'default'); each
 * returned SVG shares the same viewBox and physical dimensions so the layers
 * register perfectly when plotted on the same sheet with different pens.
 * Layers are returned in a stable order (present → ghost → trail → others).
 */
export function toSVGLayers(
  result: FlowLinesResult,
  options: SVGOptions = {}
): { layer: string; svg: string }[] {
  const {
    strokeColor = '#000000',
    strokeWidth = 1,
    backgroundColor = '#ffffff',
    includeBackground = false,
    precision = 2,
    optimizePaths = true,
    physicalWidth,
    physicalHeight,
  } = options;

  const backgroundRect = includeBackground
    ? `  <rect width="${result.width}" height="${result.height}" fill="${backgroundColor}"/>\n`
    : '';

  return orderedLayers(result.lines).map(([layer, lines]) => {
    const body = renderPathElements(
      lines,
      options.layerColors?.[layer] ?? strokeColor,
      strokeWidth,
      precision,
      optimizePaths
    );
    return {
      layer,
      svg: wrapSvg(
        result.width,
        result.height,
        physicalWidth,
        physicalHeight,
        backgroundRect,
        body
      ),
    };
  });
}

/**
 * Convert a flow line to an SVG path data string
 */
function lineToPath(line: FlowLine, precision: number, optimize: boolean): string {
  if (line.points.length < 2) {
    return '';
  }

  const points = optimize ? optimizePoints(line.points, 0.5) : line.points;

  if (points.length < 2) {
    return '';
  }

  const formatNum = (n: number) => n.toFixed(precision);

  let d = `M${formatNum(points[0].x)},${formatNum(points[0].y)}`;

  // Use quadratic curves for smoother lines
  if (points.length === 2) {
    d += ` L${formatNum(points[1].x)},${formatNum(points[1].y)}`;
  } else {
    // Use smooth curves through points
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      d += ` Q${formatNum(current.x)},${formatNum(current.y)} ${formatNum(midX)},${formatNum(midY)}`;
    }
    // Final point
    const last = points[points.length - 1];
    d += ` L${formatNum(last.x)},${formatNum(last.y)}`;
  }

  return d;
}

/**
 * Reduce points using Ramer-Douglas-Peucker algorithm
 */
function optimizePoints(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) {
    return points;
  }

  // Find the point with the maximum distance
  let maxDist = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = optimizePoints(points.slice(0, maxIndex + 1), epsilon);
    const right = optimizePoints(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

/**
 * Calculate perpendicular distance from a point to a line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
    );
  }

  const t = Math.max(0, Math.min(1,
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
  ));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Parse SVG options from command line style arguments
 */
export function parseSVGOptions(args: Record<string, unknown>): SVGOptions {
  return {
    strokeColor: typeof args.strokeColor === 'string' ? args.strokeColor : undefined,
    strokeWidth: typeof args.strokeWidth === 'number' ? args.strokeWidth : undefined,
    backgroundColor: typeof args.backgroundColor === 'string' ? args.backgroundColor : undefined,
    includeBackground: typeof args.includeBackground === 'boolean' ? args.includeBackground : undefined,
    precision: typeof args.precision === 'number' ? args.precision : undefined,
    optimizePaths: typeof args.optimizePaths === 'boolean' ? args.optimizePaths : undefined,
  };
}
