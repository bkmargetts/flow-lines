import { FlowField, FlowFieldOptions, type Attractor, type FieldMode } from './flow-field.js';
import { createNoise } from './noise.js';

export interface Point {
  x: number;
  y: number;
}

export interface FlowLine {
  points: Point[];
}

export interface DensityPoint {
  x: number;
  y: number;
  radius: number;      // How far the density effect extends
  strength: number;    // 0-1, how much denser at the center (1 = max density)
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
  fillMode?: boolean;           // Streamline filling - systematically fill space with parallel lines
  // Variable density options
  densityPoints?: DensityPoint[];     // Focal points of high density
  densityVariation?: number;          // 0-1, how much noise affects density
  densityNoiseScale?: number;         // Scale of density variation noise
  minSeparation?: number;             // Minimum separation (for dense areas)
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
    densityPoints = [],
    densityVariation = 0,
    densityNoiseScale = 0.003,
    minSeparation = 1,
    evenDistribution = false,
    fillMode = false,
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

  // Use fill mode for streamline-style parallel lines
  if (fillMode && separationDistance > 0) {
    return generateStreamlines(
      field, width, height, lineCount, stepLength, maxSteps,
      margin, minLineLength, separationDistance, smoothing, attractors, seed,
      densityPoints, densityVariation, densityNoiseScale, minSeparation
    );
  }

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

/**
 * Calculate the effective separation distance at a given position
 * based on density points and noise variation
 */
function calculateSeparation(
  x: number,
  y: number,
  baseSeparation: number,
  minSeparation: number,
  densityPoints: DensityPoint[],
  densityNoise: ReturnType<typeof createNoise> | null,
  densityNoiseScale: number,
  densityVariation: number
): number {
  // With high variation and no density points, use noise to create organic density patterns
  let targetSeparation = baseSeparation;

  // Apply noise variation first - this creates organic density patterns
  if (densityNoise && densityVariation > 0) {
    const noiseVal = densityNoise.fbm(x * densityNoiseScale, y * densityNoiseScale, 3, 0.5, 2);
    // Map noise to a dramatic range: at max variation, goes from 0.2x to 2.5x base
    // This creates clear areas of high and low density
    const noiseMultiplier = 0.2 + (noiseVal + 1) * 0.5 * (1 + densityVariation * 1.5);
    targetSeparation = baseSeparation * noiseMultiplier;
  }

  // Apply manual density points on top of noise
  if (densityPoints.length > 0) {
    let maxInfluence = 0;

    for (const dp of densityPoints) {
      const dx = x - dp.x;
      const dy = y - dp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < dp.radius) {
        const falloff = 1 - (dist / dp.radius);
        const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
        const influence = smoothFalloff * dp.strength;
        maxInfluence = Math.max(maxInfluence, influence);
      }
    }

    if (maxInfluence > 0) {
      // Dense areas go down toward minSeparation
      targetSeparation = targetSeparation * (1 - maxInfluence * 0.9);
    }
  }

  // Clamp to valid range
  return Math.max(minSeparation, targetSeparation);
}

/**
 * Generate streamlines that fill space with parallel flowing lines
 * This creates the wispy, organic effect by seeding new lines adjacent to existing ones
 */
function generateStreamlines(
  field: FlowField,
  width: number,
  height: number,
  maxLines: number,
  stepLength: number,
  maxSteps: number,
  margin: number,
  minLineLength: number,
  baseSeparation: number,
  smoothing: number,
  attractors?: Attractor[],
  seed: number = 0,
  densityPoints: DensityPoint[] = [],
  densityVariation: number = 0,
  densityNoiseScale: number = 0.003,
  minSeparation: number = 1
): FlowLinesResult {
  const lines: FlowLine[] = [];
  // Use small cell size for spatial grid to allow dense packing
  const spatialGrid = new SpatialGrid(Math.max(minSeparation * 0.5, 1));

  // Create density noise if variation is enabled
  const densityNoise = densityVariation > 0 ? createNoise(seed + 12345) : null;

  // Queue of candidate seed points
  const seedQueue: Array<{ point: Point; priority: number }> = [];

  // Seeded random
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  // Start with many more initial seeds spread across the canvas
  const initialSeeds = Math.max(20, Math.ceil(maxLines / 20));
  for (let i = 0; i < initialSeeds; i++) {
    const x = margin + random() * (width - 2 * margin);
    const y = margin + random() * (height - 2 * margin);
    // Higher priority for seeds in potentially dense areas
    const sep = calculateSeparation(x, y, baseSeparation, minSeparation,
      densityPoints, densityNoise, densityNoiseScale, densityVariation);
    const priority = baseSeparation / sep; // Dense areas get higher priority
    seedQueue.push({ point: { x, y }, priority });
  }

  // Add density point centers with high priority
  for (const dp of densityPoints) {
    seedQueue.push({ point: { x: dp.x, y: dp.y }, priority: 10 });
  }

  // Sort by priority (process dense areas first)
  seedQueue.sort((a, b) => b.priority - a.priority);

  // Process seed queue
  while (seedQueue.length > 0 && lines.length < maxLines) {
    const { point: seedPoint } = seedQueue.shift()!;

    // Calculate effective separation at this point
    const effectiveSep = calculateSeparation(
      seedPoint.x, seedPoint.y, baseSeparation, minSeparation,
      densityPoints, densityNoise, densityNoiseScale, densityVariation
    );

    // In dense areas (small separation), SKIP collision check entirely to allow overlapping
    // In sparse areas, still check to prevent too much overlap
    const densityRatio = effectiveSep / baseSeparation;
    const skipCollisionCheck = densityRatio < 0.5 || (densityRatio < 0.8 && random() > 0.5);

    if (!skipCollisionCheck) {
      const collisionThreshold = effectiveSep * 0.5;
      if (spatialGrid.hasNearby(seedPoint.x, seedPoint.y, collisionThreshold)) {
        continue;
      }
    }

    // Trace line - in dense areas, don't stop at collisions
    const line = traceStreamlineVariable(
      field, seedPoint, stepLength, maxSteps, margin,
      spatialGrid, baseSeparation, minSeparation,
      densityPoints, densityNoise, densityNoiseScale, densityVariation, attractors,
      skipCollisionCheck // Pass flag to allow overlapping traces
    );

    if (line.points.length < minLineLength) {
      continue;
    }

    // Apply smoothing
    let finalLine = line;
    if (smoothing > 0 && line.points.length > 2) {
      finalLine = { points: smoothLine(line.points, smoothing) };
    }

    lines.push(finalLine);

    // Only add to spatial grid in sparse areas
    if (!skipCollisionCheck) {
      const gridSampleRate = Math.max(1, Math.floor(effectiveSep / 2));
      for (let i = 0; i < finalLine.points.length; i += gridSampleRate) {
        spatialGrid.add(finalLine.points[i]);
      }
      if (finalLine.points.length > 1) {
        spatialGrid.add(finalLine.points[finalLine.points.length - 1]);
      }
    }

    // Generate new seed candidates from this line
    // Sample MORE frequently in dense areas to pack more lines
    const denseSampling = densityRatio < 0.5;
    const sampleInterval = denseSampling
      ? Math.max(1, Math.floor(finalLine.points.length / 50))
      : Math.max(1, Math.floor(finalLine.points.length / 20));

    for (let i = 0; i < finalLine.points.length - 1; i += sampleInterval) {
      const p0 = finalLine.points[i];
      const p1 = finalLine.points[Math.min(i + 1, finalLine.points.length - 1)];

      // Calculate local separation for seeding
      const localSep = calculateSeparation(
        p0.x, p0.y, baseSeparation, minSeparation,
        densityPoints, densityNoise, densityNoiseScale, densityVariation
      );

      // Direction along line
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len < 0.001) continue;

      // Perpendicular (normal) direction
      const nx = -dy / len;
      const ny = dx / len;

      // Create seeds on both sides - use SMALLER offset in dense areas
      const offset = localSep * (0.5 + random() * 0.5);

      const seed1: Point = {
        x: p0.x + nx * offset,
        y: p0.y + ny * offset,
      };
      const seed2: Point = {
        x: p0.x - nx * offset,
        y: p0.y - ny * offset,
      };

      // Priority based on density (smaller sep = higher priority)
      const priority = baseSeparation / localSep;

      // Add to queue if in bounds
      if (field.isInBounds(seed1.x, seed1.y, margin)) {
        seedQueue.push({ point: seed1, priority });
      }
      if (field.isInBounds(seed2.x, seed2.y, margin)) {
        seedQueue.push({ point: seed2, priority });
      }
    }

    // Occasionally re-sort by priority and add some randomness
    if (lines.length % 15 === 0 && seedQueue.length > 20) {
      // Partial shuffle to maintain some priority ordering but add variety
      for (let i = 0; i < Math.min(20, seedQueue.length); i++) {
        const j = Math.floor(random() * seedQueue.length);
        [seedQueue[i], seedQueue[j]] = [seedQueue[j], seedQueue[i]];
      }
    }
  }

  return { lines, width, height, seed };
}

/**
 * Trace a streamline with variable density, stopping when hitting other lines
 * (unless skipCollisionCheck is true for dense areas)
 */
function traceStreamlineVariable(
  field: FlowField,
  start: Point,
  stepLength: number,
  maxSteps: number,
  margin: number,
  spatialGrid: SpatialGrid,
  baseSeparation: number,
  minSeparation: number,
  densityPoints: DensityPoint[],
  densityNoise: ReturnType<typeof createNoise> | null,
  densityNoiseScale: number,
  densityVariation: number,
  attractors?: Attractor[],
  skipCollisionCheck: boolean = false
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

    // In dense areas, skip collision check to allow overlapping lines
    if (!skipCollisionCheck) {
      // Calculate separation at this point
      const localSep = calculateSeparation(
        next.x, next.y, baseSeparation, minSeparation,
        densityPoints, densityNoise, densityNoiseScale, densityVariation
      );
      if (spatialGrid.hasNearby(next.x, next.y, localSep * 0.5)) break;
    }

    forwardPoints.push(next);
    current = next;
  }

  // Trace backward
  const backwardPoints: Point[] = [];
  current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y, attractors);
    const next: Point = {
      x: current.x - vector.x * stepLength,
      y: current.y - vector.y * stepLength,
    };

    if (!field.isInBounds(next.x, next.y, margin)) break;

    // In dense areas, skip collision check
    if (!skipCollisionCheck) {
      const localSep = calculateSeparation(
        next.x, next.y, baseSeparation, minSeparation,
        densityPoints, densityNoise, densityNoiseScale, densityVariation
      );
      if (spatialGrid.hasNearby(next.x, next.y, localSep * 0.5)) break;
    }

    backwardPoints.push(next);
    current = next;
  }

  // Combine: backward (reversed) + forward
  backwardPoints.reverse();
  return { points: [...backwardPoints, ...forwardPoints] };
}

/**
 * Trace a streamline bidirectionally, stopping when hitting other lines
 */
function traceStreamline(
  field: FlowField,
  start: Point,
  stepLength: number,
  maxSteps: number,
  margin: number,
  spatialGrid: SpatialGrid,
  separationDistance: number,
  attractors?: Attractor[]
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
    if (spatialGrid.hasNearby(next.x, next.y, separationDistance * 0.8)) break;

    forwardPoints.push(next);
    current = next;
  }

  // Trace backward
  const backwardPoints: Point[] = [];
  current = { ...start };

  for (let i = 0; i < maxSteps; i++) {
    const vector = field.getVector(current.x, current.y, attractors);
    const next: Point = {
      x: current.x - vector.x * stepLength,
      y: current.y - vector.y * stepLength,
    };

    if (!field.isInBounds(next.x, next.y, margin)) break;
    if (spatialGrid.hasNearby(next.x, next.y, separationDistance * 0.8)) break;

    backwardPoints.push(next);
    current = next;
  }

  // Combine: backward (reversed) + forward
  backwardPoints.reverse();
  return { points: [...backwardPoints, ...forwardPoints] };
}
