import { FlowField, FlowFieldOptions } from './flow-field.js';

export interface Point {
  x: number;
  y: number;
}

export interface FlowLine {
  points: Point[];
}

export interface FlowLinesOptions extends Omit<FlowFieldOptions, 'resolution'> {
  lineCount: number;
  stepLength?: number;
  maxSteps?: number;
  margin?: number;
  minLineLength?: number;
  fieldResolution?: number;
  startPoints?: Point[];
}

export interface FlowLinesResult {
  lines: FlowLine[];
  width: number;
  height: number;
  seed: number;
}

/**
 * Generate flow lines based on a noise field
 */
export function generateFlowLines(options: FlowLinesOptions): FlowLinesResult {
  const {
    width,
    height,
    lineCount,
    stepLength = 2,
    maxSteps = 500,
    margin = 20,
    minLineLength = 10,
    fieldResolution = 10,
    seed = Math.floor(Math.random() * 1000000),
    noiseScale,
    octaves,
    persistence,
    lacunarity,
    startPoints,
  } = options;

  const field = new FlowField({
    width,
    height,
    resolution: fieldResolution,
    seed,
    noiseScale,
    octaves,
    persistence,
    lacunarity,
  });

  const lines: FlowLine[] = [];

  // Determine starting points
  const starts: Point[] = startPoints ?? generateStartPoints(
    width,
    height,
    lineCount,
    margin,
    seed
  );

  for (const start of starts) {
    const line = traceLine(field, start, stepLength, maxSteps, margin);

    if (line.points.length >= minLineLength) {
      lines.push(line);
    }
  }

  return {
    lines,
    width,
    height,
    seed,
  };
}

/**
 * Generate random starting points for flow lines
 */
function generateStartPoints(
  width: number,
  height: number,
  count: number,
  margin: number,
  seed: number
): Point[] {
  const points: Point[] = [];

  // Simple seeded random
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  for (let i = 0; i < count; i++) {
    points.push({
      x: margin + random() * (width - 2 * margin),
      y: margin + random() * (height - 2 * margin),
    });
  }

  return points;
}

/**
 * Trace a single flow line through the field
 */
function traceLine(
  field: FlowField,
  start: Point,
  stepLength: number,
  maxSteps: number,
  margin: number
): FlowLine {
  const points: Point[] = [{ ...start }];
  let current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y);

    const next: Point = {
      x: current.x + vector.x * stepLength,
      y: current.y + vector.y * stepLength,
    };

    // Stop if out of bounds
    if (!field.isInBounds(next.x, next.y, margin)) {
      break;
    }

    points.push(next);
    current = next;
  }

  return { points };
}

/**
 * Generate flow lines with grid-based starting points
 */
export function generateFlowLinesGrid(options: Omit<FlowLinesOptions, 'startPoints' | 'lineCount'> & {
  gridSpacing: number;
}): FlowLinesResult {
  const { gridSpacing, margin = 20, ...rest } = options;

  const startPoints: Point[] = [];

  for (let y = margin; y < rest.height - margin; y += gridSpacing) {
    for (let x = margin; x < rest.width - margin; x += gridSpacing) {
      startPoints.push({ x, y });
    }
  }

  return generateFlowLines({
    ...rest,
    margin,
    lineCount: startPoints.length,
    startPoints,
  });
}
