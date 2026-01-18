import { FlowField, FlowFieldOptions, type Attractor, type FieldMode } from './flow-field.js';

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
  attractors?: Attractor[];
  smoothing?: number;  // 0-1, how much to smooth lines (0 = none, 1 = max)
  // Advanced options for wispy/organic patterns
  separationDistance?: number;  // Min distance between lines (0 = disabled)
  bidirectional?: boolean;      // Trace lines in both directions from seed
  evenDistribution?: boolean;   // Use Poisson disk sampling for seed points
}

export interface FlowLinesResult {
  lines: FlowLine[];
  width: number;
  height: number;
  seed: number;
}

/**
 * Spatial grid for efficient proximity checking
 */
class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Point[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private getKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  add(point: Point): void {
    const key = this.getKey(point.x, point.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(point);
  }

  addLine(points: Point[]): void {
    for (const point of points) {
      this.add(point);
    }
  }

  hasNearby(x: number, y: number, distance: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const searchRadius = Math.ceil(distance / this.cellSize);

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const points = this.grid.get(key);
        if (points) {
          for (const p of points) {
            const distSq = (p.x - x) ** 2 + (p.y - y) ** 2;
            if (distSq < distance * distance) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
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
    fieldMode,
    spiralStrength,
    warpStrength,
    startPoints,
    attractors,
    smoothing = 0,
    separationDistance = 0,
    bidirectional = false,
    evenDistribution = false,
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
    fieldMode,
    spiralStrength,
    warpStrength,
  });

  const lines: FlowLine[] = [];
  const spatialGrid = separationDistance > 0 ? new SpatialGrid(separationDistance) : null;

  // Determine starting points
  let starts: Point[];
  if (startPoints) {
    starts = startPoints;
  } else if (evenDistribution) {
    starts = generatePoissonDiskPoints(width, height, lineCount, margin, seed);
  } else {
    starts = generateStartPoints(width, height, lineCount, margin, seed);
  }

  for (const start of starts) {
    // Skip if too close to existing lines
    if (spatialGrid && spatialGrid.hasNearby(start.x, start.y, separationDistance)) {
      continue;
    }

    let line: FlowLine;

    if (bidirectional) {
      line = traceLineBidirectional(field, start, stepLength, maxSteps, margin, attractors, spatialGrid, separationDistance);
    } else {
      line = traceLine(field, start, stepLength, maxSteps, margin, attractors, spatialGrid, separationDistance);
    }

    // Apply smoothing if requested
    if (smoothing > 0 && line.points.length > 2) {
      line = { points: smoothLine(line.points, smoothing) };
    }

    if (line.points.length >= minLineLength) {
      lines.push(line);
      // Add line points to spatial grid for separation
      if (spatialGrid) {
        spatialGrid.addLine(line.points);
      }
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
 * Generate evenly distributed points using Poisson disk sampling
 */
function generatePoissonDiskPoints(
  width: number,
  height: number,
  targetCount: number,
  margin: number,
  seed: number
): Point[] {
  // Estimate minimum distance based on target count
  const area = (width - 2 * margin) * (height - 2 * margin);
  const minDist = Math.sqrt(area / (targetCount * Math.PI)) * 1.5;

  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const cellSize = minDist / Math.sqrt(2);
  const gridWidth = Math.ceil((width - 2 * margin) / cellSize);
  const gridHeight = Math.ceil((height - 2 * margin) / cellSize);
  const grid: (Point | null)[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(null));

  const points: Point[] = [];
  const activeList: Point[] = [];

  // Start with a random point
  const firstPoint: Point = {
    x: margin + random() * (width - 2 * margin),
    y: margin + random() * (height - 2 * margin),
  };
  points.push(firstPoint);
  activeList.push(firstPoint);

  const gx = Math.floor((firstPoint.x - margin) / cellSize);
  const gy = Math.floor((firstPoint.y - margin) / cellSize);
  if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
    grid[gy][gx] = firstPoint;
  }

  const k = 30; // Candidates per point

  while (activeList.length > 0 && points.length < targetCount * 2) {
    const activeIdx = Math.floor(random() * activeList.length);
    const activePoint = activeList[activeIdx];
    let found = false;

    for (let attempt = 0; attempt < k; attempt++) {
      const angle = random() * Math.PI * 2;
      const dist = minDist + random() * minDist;
      const candidate: Point = {
        x: activePoint.x + Math.cos(angle) * dist,
        y: activePoint.y + Math.sin(angle) * dist,
      };

      // Check bounds
      if (candidate.x < margin || candidate.x >= width - margin ||
          candidate.y < margin || candidate.y >= height - margin) {
        continue;
      }

      // Check grid for nearby points
      const cgx = Math.floor((candidate.x - margin) / cellSize);
      const cgy = Math.floor((candidate.y - margin) / cellSize);

      let tooClose = false;
      for (let dy = -2; dy <= 2 && !tooClose; dy++) {
        for (let dx = -2; dx <= 2 && !tooClose; dx++) {
          const nx = cgx + dx;
          const ny = cgy + dy;
          if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
            const neighbor = grid[ny][nx];
            if (neighbor) {
              const d = Math.sqrt((neighbor.x - candidate.x) ** 2 + (neighbor.y - candidate.y) ** 2);
              if (d < minDist) {
                tooClose = true;
              }
            }
          }
        }
      }

      if (!tooClose) {
        points.push(candidate);
        activeList.push(candidate);
        if (cgx >= 0 && cgx < gridWidth && cgy >= 0 && cgy < gridHeight) {
          grid[cgy][cgx] = candidate;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      activeList.splice(activeIdx, 1);
    }
  }

  // Shuffle and return up to targetCount points
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  return points.slice(0, targetCount);
}

/**
 * Trace a single flow line through the field
 */
function traceLine(
  field: FlowField,
  start: Point,
  stepLength: number,
  maxSteps: number,
  margin: number,
  attractors?: Attractor[],
  spatialGrid?: SpatialGrid | null,
  separationDistance?: number
): FlowLine {
  const points: Point[] = [{ ...start }];
  let current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y, attractors);

    const next: Point = {
      x: current.x + vector.x * stepLength,
      y: current.y + vector.y * stepLength,
    };

    // Stop if out of bounds
    if (!field.isInBounds(next.x, next.y, margin)) {
      break;
    }

    // Stop if too close to existing lines
    if (spatialGrid && separationDistance && spatialGrid.hasNearby(next.x, next.y, separationDistance)) {
      break;
    }

    points.push(next);
    current = next;
  }

  return { points };
}

/**
 * Trace a line in both directions from the starting point
 */
function traceLineBidirectional(
  field: FlowField,
  start: Point,
  stepLength: number,
  maxSteps: number,
  margin: number,
  attractors?: Attractor[],
  spatialGrid?: SpatialGrid | null,
  separationDistance?: number
): FlowLine {
  // Trace forward
  const forwardPoints: Point[] = [{ ...start }];
  let current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y, attractors);
    const next: Point = {
      x: current.x + vector.x * stepLength,
      y: current.y + vector.y * stepLength,
    };

    if (!field.isInBounds(next.x, next.y, margin)) break;
    if (spatialGrid && separationDistance && spatialGrid.hasNearby(next.x, next.y, separationDistance)) break;

    forwardPoints.push(next);
    current = next;
  }

  // Trace backward
  const backwardPoints: Point[] = [];
  current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y, attractors);
    // Go in opposite direction
    const next: Point = {
      x: current.x - vector.x * stepLength,
      y: current.y - vector.y * stepLength,
    };

    if (!field.isInBounds(next.x, next.y, margin)) break;
    if (spatialGrid && separationDistance && spatialGrid.hasNearby(next.x, next.y, separationDistance)) break;

    backwardPoints.push(next);
    current = next;
  }

  // Combine: backward (reversed) + forward
  backwardPoints.reverse();
  return { points: [...backwardPoints, ...forwardPoints] };
}

/**
 * Smooth a line using Chaikin's corner-cutting algorithm
 */
function smoothLine(points: Point[], strength: number): Point[] {
  if (points.length < 3) return points;

  // Number of smoothing iterations based on strength
  const iterations = Math.ceil(strength * 3);

  let result = points;

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Point[] = [result[0]]; // Keep first point

    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];

      // Chaikin's algorithm: 25% and 75% points
      const q: Point = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      };
      const r: Point = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      };

      smoothed.push(q, r);
    }

    smoothed.push(result[result.length - 1]); // Keep last point
    result = smoothed;
  }

  return result;
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
