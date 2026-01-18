import { FlowLinesResult, FlowLine, Point } from './flow-lines.js';

export interface SVGOptions {
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  includeBackground?: boolean;
  precision?: number;
  optimizePaths?: boolean;
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
  } = options;

  const paths = result.lines
    .map((line) => lineToPath(line, precision, optimizePaths))
    .filter((path) => path.length > 0);

  const backgroundRect = includeBackground
    ? `  <rect width="${result.width}" height="${result.height}" fill="${backgroundColor}"/>\n`
    : '';

  const pathElements = paths
    .map(
      (d) =>
        `  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}">
${backgroundRect}${pathElements}
</svg>`;
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
