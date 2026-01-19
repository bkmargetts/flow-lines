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

/**
 * Configuration for density variation algorithm
 */
export interface DensityConfig {
  points: DensityPoint[];
  variation: number;
  noiseScale: number;
  minSeparation: number;
  noise: ReturnType<typeof createNoise> | null;
}

/**
 * Configuration for organic aesthetics (pen plotter output)
 */
export interface OrganicConfig {
  wobble: number;
  velocityFadeout: boolean;
  edgeAttraction: number;
  wobbleNoise: ReturnType<typeof createNoise> | null;
  lineFatigue: number;              // 0-1, probability of early line termination
  fatigueNoise: ReturnType<typeof createNoise> | null;
}

/**
 * Configuration for line tracing
 */
export interface TraceConfig {
  stepLength: number;
  maxSteps: number;
  margin: number;
  baseSeparation: number;
  attractors?: Attractor[];
  density: DensityConfig;
  organic: OrganicConfig;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * A particle agent that traces a line through the flow field
 */
export interface Agent {
  id: number;
  position: Point;
  velocity: { x: number; y: number };

  // Energy system (controls lifespan)
  energy: number;           // Current energy, depletes over time
  maxEnergy: number;        // Starting energy (varies per agent)
  energyDecayRate: number;  // How fast energy depletes per step

  // Trail (accumulated points for the line)
  trail: Point[];

  // Agent personality (varies for organic variation)
  wanderStrength: number;   // How much agent deviates from flow field (0-1)
  speedMultiplier: number;  // Movement speed variation (0.5-1.5)
  clusterAffinity: number;  // How attracted to nearby agents (0-1)

  // State
  isAlive: boolean;
  stepsAlive: number;
}

/**
 * Configuration for swarm-based generation
 */
export interface SwarmConfig {
  // Agent population
  initialAgentCount: number;
  maxAgents: number;
  maxLinesOutput: number;

  // Spawning
  spawnClusterBias: number;     // 0-1, how clustered initial spawns are
  childSpawnRate: number;       // 0-1, probability of spawning child per step
  childSpawnDistance: number;   // Distance from parent for child spawn

  // Movement
  baseStepLength: number;
  flowFieldInfluence: number;   // 0-1, how much agents follow flow field
  noiseWanderScale: number;     // Scale of wandering noise

  // Energy
  baseEnergy: number;           // Starting energy (in steps)
  energyVariation: number;      // 0-1, randomness in starting energy
  lowEnergySlowdown: boolean;   // Agents slow down as energy depletes

  // Clustering
  clusterRadius: number;        // Radius to detect nearby agents
  clusterAttraction: number;    // 0-1, pull toward cluster centers

  // Density control
  densityNoise: ReturnType<typeof createNoise> | null;
  densityNoiseScale: number;
  spawnDensityBias: number;     // 0-1, spawn more in dense areas

  // Void regions
  voidThreshold: number;        // Noise value below which no spawning occurs
  voidRepulsion: number;        // 0-1, agents avoid void regions

  // 3D form illusion
  formNoise: ReturnType<typeof createNoise> | null;
  formNoiseScale: number;       // Scale of "form" noise for wrapping effect
  formInfluence: number;        // 0-1, how much lines wrap around forms

  // Wander noise
  wanderNoise: ReturnType<typeof createNoise> | null;

  // Canvas bounds
  width: number;
  height: number;
  margin: number;
  minLineLength: number;
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
  // Organic aesthetics options (for pen plotter output)
  organicWobble?: number;             // 0-1, subtle random perturbations for hand-drawn look
  velocityFadeout?: boolean;          // End lines naturally at low-velocity areas
  edgeAttraction?: number;            // 0-1, strength of pull toward canvas edges for graceful endings
  lineFatigue?: number;               // 0-1, probability of early line termination for length variation
  spacingVariation?: number;          // 0-1, irregularity in line spacing (clusters and gaps)
  // Swarm mode options (particle/agent-based generation)
  swarmMode?: boolean;                // Enable swarm generation
  swarmAgentCount?: number;           // Initial agents (default: 200)
  swarmClusterBias?: number;          // 0-1, clustering of initial spawns
  swarmChildSpawnRate?: number;       // 0-1, child spawn frequency
  swarmFlowInfluence?: number;        // 0-1, how much agents follow field
  swarmClusterAttraction?: number;    // 0-1, agents pull toward each other
  swarmFormInfluence?: number;        // 0-1, 3D form wrapping effect
  swarmVoidSize?: number;             // 0-1, size of empty regions
  swarmEnergyVariation?: number;      // 0-1, line length variation
  // Form hatching mode - contour-following lines that wrap around implied 3D forms
  formHatchingMode?: boolean;         // Enable form hatching
  formScale?: number;                 // Scale of form noise (larger = bigger forms)
  formContrast?: number;              // 0-1, how extreme the density variation is
  hatchDensity?: number;              // Lines per unit area in dense regions
  hatchLengthVariation?: number;      // 0-1, variation in line lengths
  hatchAngleVariation?: number;       // 0-1, deviation from perfect contour following
  hatchOverlap?: number;              // 0-1, how much lines can overlap/pile up
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
    organicWobble = 0,
    velocityFadeout = false,
    edgeAttraction = 0,
    lineFatigue = 0,
    spacingVariation = 0,
    // Swarm mode options
    swarmMode = false,
    swarmAgentCount = 300,
    swarmClusterBias = 0.6,
    swarmChildSpawnRate = 0.3,
    swarmFlowInfluence = 0.7,
    swarmClusterAttraction = 0.6,
    swarmFormInfluence = 0.6,
    swarmVoidSize = 0.5,
    swarmEnergyVariation = 0.6,
    // Form hatching options
    formHatchingMode = false,
    formScale = 0.003,
    formContrast = 0.8,
    hatchDensity = 1.0,
    hatchLengthVariation = 0.6,
    hatchAngleVariation = 0.3,
    hatchOverlap = 0.8,
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

  // Use form hatching mode for organic contour-following lines
  if (formHatchingMode) {
    return generateFormHatching(
      width, height, lineCount, stepLength, maxSteps,
      margin, minLineLength, seed,
      formScale, formContrast, hatchDensity,
      hatchLengthVariation, hatchAngleVariation, hatchOverlap,
      organicWobble
    );
  }

  // Use swarm mode for particle/agent-based organic generation
  if (swarmMode) {
    return generateSwarmLines(
      field, width, height, lineCount, stepLength, maxSteps,
      margin, minLineLength, seed, attractors,
      swarmAgentCount, swarmClusterBias, swarmChildSpawnRate,
      swarmFlowInfluence, swarmClusterAttraction, swarmFormInfluence,
      swarmVoidSize, swarmEnergyVariation
    );
  }

  // Use fill mode for streamline-style parallel lines
  if (fillMode && separationDistance > 0) {
    return generateStreamlines(
      field, width, height, lineCount, stepLength, maxSteps,
      margin, minLineLength, separationDistance, smoothing, attractors, seed,
      densityPoints, densityVariation, densityNoiseScale, minSeparation,
      organicWobble, velocityFadeout, edgeAttraction, lineFatigue, spacingVariation
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
  minSeparation: number = 1,
  organicWobble: number = 0,
  velocityFadeout: boolean = false,
  edgeAttraction: number = 0,
  lineFatigue: number = 0,
  spacingVariation: number = 0
): FlowLinesResult {
  const lines: FlowLine[] = [];
  // Use small cell size for spatial grid to allow dense packing
  const spatialGrid = new SpatialGrid(Math.max(minSeparation * 0.5, 1));

  // Build config objects once
  const densityConfig: DensityConfig = {
    points: densityPoints,
    variation: densityVariation,
    noiseScale: densityNoiseScale,
    minSeparation,
    noise: densityVariation > 0 ? createNoise(seed + 12345) : null,
  };

  const organicConfig: OrganicConfig = {
    wobble: organicWobble,
    velocityFadeout,
    edgeAttraction,
    wobbleNoise: organicWobble > 0 ? createNoise(seed + 54321) : null,
    lineFatigue,
    fatigueNoise: lineFatigue > 0 ? createNoise(seed + 99999) : null,
  };

  const traceConfig: TraceConfig = {
    stepLength,
    maxSteps,
    margin,
    baseSeparation,
    attractors,
    density: densityConfig,
    organic: organicConfig,
    canvasWidth: width,
    canvasHeight: height,
  };

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
    const sep = calculateSeparationWithConfig(x, y, baseSeparation, densityConfig);
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
    const effectiveSep = calculateSeparationWithConfig(
      seedPoint.x, seedPoint.y, baseSeparation, densityConfig
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
      field, seedPoint, spatialGrid, traceConfig, skipCollisionCheck
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
      // Random skip for organic gaps (controlled by spacingVariation)
      if (spacingVariation > 0 && random() < 0.2 * spacingVariation) {
        continue;
      }

      const p0 = finalLine.points[i];
      const p1 = finalLine.points[Math.min(i + 1, finalLine.points.length - 1)];

      // Calculate local separation for seeding
      const localSep = calculateSeparationWithConfig(
        p0.x, p0.y, baseSeparation, densityConfig
      );

      // Direction along line
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len < 0.001) continue;

      // Perpendicular (normal) direction - base angle
      let nx = -dy / len;
      let ny = dx / len;

      // Add angular jitter for irregular spacing (not always perfectly perpendicular)
      if (spacingVariation > 0) {
        const angleJitter = (random() - 0.5) * 0.5 * spacingVariation;
        const cos = Math.cos(angleJitter);
        const sin = Math.sin(angleJitter);
        const newNx = nx * cos - ny * sin;
        const newNy = nx * sin + ny * cos;
        nx = newNx;
        ny = newNy;
      }

      // Create seeds on both sides - offset varies more with spacingVariation
      // Without variation: 50-100% of localSep
      // With full variation: 30-150% of localSep (more clusters and gaps)
      const offsetMin = spacingVariation > 0 ? 0.3 : 0.5;
      const offsetRange = spacingVariation > 0 ? 1.2 : 0.5;
      const offset = localSep * (offsetMin + random() * offsetRange);

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
 * Includes organic aesthetics: wobble, velocity fadeout, edge attraction
 */
function traceStreamlineVariable(
  field: FlowField,
  start: Point,
  spatialGrid: SpatialGrid,
  config: TraceConfig,
  skipCollisionCheck: boolean = false
): FlowLine {
  const { stepLength, maxSteps, margin, baseSeparation, attractors, density, organic, canvasWidth, canvasHeight } = config;

  // Wobble scale affects the frequency of perturbations
  const wobbleScale = 0.02;
  // Minimum steps before fatigue can terminate a line
  const minStepsBeforeFatigue = 10;
  // Velocity threshold for step reduction (steps shrink below this velocity)
  const velocityThreshold = 0.3;
  // Minimum step size before termination (smaller = more gradual fadeout)
  const minStepSize = 0.5;

  // Helper to compute a single trace step
  const computeStep = (
    current: Point,
    direction: 1 | -1,
    stepIdx: number
  ): { next: Point; shouldStop: boolean } => {
    let vector = field.getVector(current.x, current.y, attractors);

    // Calculate velocity for gradual fadeout
    const velocity = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

    // Gradual velocity fadeout - reduce step length at low-velocity areas
    // instead of hard cutoff, creating smoother, more natural line endings
    let effectiveStep = stepLength;
    if (organic.velocityFadeout && velocity < velocityThreshold) {
      // Step shrinks proportionally to velocity, with minimum 10% of normal
      effectiveStep = stepLength * Math.max(0.1, velocity / velocityThreshold);
      // Stop when step becomes too small to be visible
      if (effectiveStep < minStepSize) {
        return { next: current, shouldStop: true };
      }
    }

    // Line fatigue - random early termination for natural length variation
    // Creates regions of short lines and regions of long lines based on noise
    if (organic.lineFatigue > 0 && organic.fatigueNoise && stepIdx > minStepsBeforeFatigue) {
      // Noise determines base termination probability in this area
      const fatigueNoiseVal = organic.fatigueNoise.noise2D(current.x * 0.008, current.y * 0.008);
      // Second noise sample acts as pseudo-random for termination decision
      const randomVal = organic.fatigueNoise.noise2D(
        current.x * 0.1 + stepIdx * 0.5,
        current.y * 0.1 + direction * 100
      );
      // Termination chance increases with fatigue setting and noise value
      // At fatigue=1, base chance is ~3% per step in "fatigued" areas
      const terminationChance = organic.lineFatigue * 0.03 * (1 + fatigueNoiseVal);
      // Terminate if pseudo-random value falls below threshold
      if ((randomVal + 1) * 0.5 < terminationChance) {
        return { next: current, shouldStop: true };
      }
    }

    // Add edge attraction - pull toward nearest edge for graceful endings
    if (organic.edgeAttraction > 0 && canvasWidth > 0 && canvasHeight > 0) {
      const edgeInfluence = calculateEdgeInfluence(
        current.x, current.y, canvasWidth, canvasHeight, margin, organic.edgeAttraction
      );
      vector = {
        x: vector.x + edgeInfluence.x,
        y: vector.y + edgeInfluence.y,
      };
      // Re-normalize
      const newLen = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
      if (newLen > 0.001) {
        vector.x /= newLen;
        vector.y /= newLen;
      }
    }

    let next: Point = {
      x: current.x + direction * vector.x * effectiveStep,
      y: current.y + direction * vector.y * effectiveStep,
    };

    // Add organic wobble - perpendicular perturbation for hand-drawn look
    // Uses two noise frequencies: high-freq for jitter, low-freq for broader curves
    if (organic.wobbleNoise && organic.wobble > 0) {
      // High-frequency wobble (fine jitter)
      const highFreqWobble = organic.wobbleNoise.noise2D(
        current.x * wobbleScale + direction * stepIdx * 0.1,
        current.y * wobbleScale
      );
      // Low-frequency wobble (broad, sweeping curves)
      const lowFreqWobble = organic.wobbleNoise.noise2D(
        current.x * wobbleScale * 0.2 + direction * stepIdx * 0.02,
        current.y * wobbleScale * 0.2
      );
      // Blend: 60% high-freq jitter + 40% low-freq curves
      const wobbleVal = highFreqWobble * 0.6 + lowFreqWobble * 0.4;
      // Perpendicular direction (flip for backward)
      const perpX = direction === 1 ? -vector.y : vector.y;
      const perpY = direction === 1 ? vector.x : -vector.x;
      // 6x stronger than before (was 0.5, now 3.0)
      const wobbleAmount = wobbleVal * organic.wobble * stepLength * 3.0;
      next.x += perpX * wobbleAmount;
      next.y += perpY * wobbleAmount;
    }

    if (!field.isInBounds(next.x, next.y, margin)) {
      return { next, shouldStop: true };
    }

    // In dense areas, skip collision check to allow overlapping lines
    if (!skipCollisionCheck) {
      const localSep = calculateSeparationWithConfig(next.x, next.y, baseSeparation, density);
      if (spatialGrid.hasNearby(next.x, next.y, localSep * 0.5)) {
        return { next, shouldStop: true };
      }
    }

    return { next, shouldStop: false };
  };

  // Trace forward
  const forwardPoints: Point[] = [{ ...start }];
  let current = { ...start };
  for (let i = 0; i < maxSteps; i++) {
    const { next, shouldStop } = computeStep(current, 1, i);
    if (shouldStop) break;
    forwardPoints.push(next);
    current = next;
  }

  // Trace backward
  const backwardPoints: Point[] = [];
  current = { ...start };
  for (let i = 0; i < maxSteps; i++) {
    const { next, shouldStop } = computeStep(current, -1, i);
    if (shouldStop) break;
    backwardPoints.push(next);
    current = next;
  }

  // Combine: backward (reversed) + forward
  backwardPoints.reverse();
  return { points: [...backwardPoints, ...forwardPoints] };
}

/**
 * Calculate separation using DensityConfig
 */
function calculateSeparationWithConfig(
  x: number,
  y: number,
  baseSeparation: number,
  density: DensityConfig
): number {
  return calculateSeparation(
    x, y, baseSeparation, density.minSeparation,
    density.points, density.noise, density.noiseScale, density.variation
  );
}

/**
 * Calculate edge attraction influence - pulls lines toward nearest edge
 * for graceful endings at canvas boundaries
 */
function calculateEdgeInfluence(
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number,
  strength: number
): { x: number; y: number } {
  // Distance to each edge (from inside margin)
  const distToLeft = x - margin;
  const distToRight = (width - margin) - x;
  const distToTop = y - margin;
  const distToBottom = (height - margin) - y;

  // Find the closest edge
  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

  // Only apply edge attraction when close to edge (within 30% of smaller dimension)
  const threshold = Math.min(width, height) * 0.3;
  if (minDist > threshold) {
    return { x: 0, y: 0 };
  }

  // Influence grows exponentially as we get closer to edge
  // Exponential curve (power 1.5) creates gentle pull that accelerates near edge
  const influence = strength * Math.pow(1 - minDist / threshold, 1.5);

  // Direction toward nearest edge
  let edgeX = 0;
  let edgeY = 0;

  if (minDist === distToLeft) edgeX = -1;
  else if (minDist === distToRight) edgeX = 1;
  else if (minDist === distToTop) edgeY = -1;
  else if (minDist === distToBottom) edgeY = 1;

  return {
    x: edgeX * influence,
    y: edgeY * influence,
  };
}

/**
 * Generate lines using particle/agent swarm system
 * Creates organic, chaotic patterns with natural clustering and voids
 */
function generateSwarmLines(
  field: FlowField,
  width: number,
  height: number,
  maxLines: number,
  stepLength: number,
  maxSteps: number,
  margin: number,
  minLineLength: number,
  seed: number,
  attractors?: Attractor[],
  agentCount: number = 200,
  clusterBias: number = 0.6,
  childSpawnRate: number = 0.3,
  flowInfluence: number = 0.7,
  clusterAttraction: number = 0.3,
  formInfluence: number = 0.4,
  voidSize: number = 0.3,
  energyVariation: number = 0.6
): FlowLinesResult {
  // Build swarm config
  const config: SwarmConfig = {
    initialAgentCount: agentCount,
    maxAgents: agentCount * 10,
    maxLinesOutput: maxLines,
    spawnClusterBias: clusterBias,
    childSpawnRate,
    childSpawnDistance: stepLength * 5,
    baseStepLength: stepLength,
    flowFieldInfluence: flowInfluence,
    noiseWanderScale: 0.01,
    baseEnergy: maxSteps * 0.5,
    energyVariation,
    lowEnergySlowdown: true,
    clusterRadius: Math.min(width, height) * 0.1,
    clusterAttraction,
    densityNoise: createNoise(seed + 11111),
    densityNoiseScale: 0.003,
    spawnDensityBias: clusterBias,
    voidThreshold: -0.2 - voidSize * 0.6,
    voidRepulsion: voidSize,
    formNoise: createNoise(seed + 22222),
    formNoiseScale: 0.005,
    formInfluence,
    wanderNoise: createNoise(seed + 33333),
    width,
    height,
    margin,
    minLineLength,
  };

  // Seeded random
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  // Generate initial agents with clustered spawning
  const agents: Agent[] = [];
  let nextId = 0;

  for (let i = 0; i < config.initialAgentCount; i++) {
    const agent = trySpawnAgent(config, random, nextId++, field, null);
    if (agent) {
      agents.push(agent);
    }
  }

  const completedLines: FlowLine[] = [];
  let iteration = 0;
  const maxIterations = maxSteps * 100;

  // Main simulation loop
  while (
    agents.some(a => a.isAlive) &&
    completedLines.length < config.maxLinesOutput &&
    iteration < maxIterations
  ) {
    // Update all living agents
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      if (!agent.isAlive) continue;

      // Move agent
      updateSwarmAgent(agent, field, config, agents, random, attractors);

      // Check termination
      if (shouldAgentTerminate(agent, config, field)) {
        agent.isAlive = false;
        if (agent.trail.length >= config.minLineLength) {
          completedLines.push({ points: [...agent.trail] });
        }
        continue;
      }

      // Try to spawn child
      if (agents.length < config.maxAgents && agent.energy > agent.maxEnergy * 0.3) {
        const localDensity = getDensityValue(agent.position.x, agent.position.y, config);
        const spawnChance = config.childSpawnRate * (0.5 + localDensity * 0.5);
        if (random() < spawnChance * 0.1) {
          const child = spawnChildAgent(agent, config, random, nextId++, field);
          if (child) {
            agents.push(child);
          }
        }
      }
    }

    iteration++;
  }

  // Collect remaining trails from living agents
  for (const agent of agents) {
    if (agent.trail.length >= config.minLineLength) {
      if (!completedLines.some(l => l.points === agent.trail)) {
        completedLines.push({ points: [...agent.trail] });
      }
    }
  }

  return {
    lines: completedLines,
    width,
    height,
    seed,
  };
}

/**
 * Try to spawn an agent at a position based on density
 */
function trySpawnAgent(
  config: SwarmConfig,
  random: () => number,
  id: number,
  field: FlowField,
  parent: Agent | null
): Agent | null {
  let x: number, y: number;
  let attempts = 0;
  const maxAttempts = 50;

  // Find a valid spawn position
  while (attempts < maxAttempts) {
    if (parent) {
      // Spawn near parent (perpendicular to velocity)
      const perpX = -parent.velocity.y;
      const perpY = parent.velocity.x;
      const side = random() > 0.5 ? 1 : -1;
      const dist = config.childSpawnDistance * (0.5 + random());
      x = parent.position.x + perpX * dist * side;
      y = parent.position.y + perpY * dist * side;
    } else {
      // Initial spawn - use cluster bias
      x = config.margin + random() * (config.width - 2 * config.margin);
      y = config.margin + random() * (config.height - 2 * config.margin);
    }

    // Check bounds
    if (!field.isInBounds(x, y, config.margin)) {
      attempts++;
      continue;
    }

    // Check density-based spawn probability
    const densityVal = getDensityValue(x, y, config);

    // In void regions, reject spawn
    if (densityVal < config.voidThreshold) {
      attempts++;
      continue;
    }

    // Higher density = higher spawn chance (for clustering)
    const spawnProb = Math.pow((densityVal + 1) * 0.5, 2 - config.spawnClusterBias * 1.5);
    if (random() > spawnProb && !parent) {
      attempts++;
      continue;
    }

    // Create the agent
    const energyMult = 0.5 + (densityVal + 1) * 0.5; // Dense areas = more energy
    const baseEnergy = config.baseEnergy * (1 - config.energyVariation * 0.5 + random() * config.energyVariation);
    const maxEnergy = baseEnergy * energyMult;

    return {
      id,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      energy: maxEnergy,
      maxEnergy,
      energyDecayRate: 1,
      trail: [{ x, y }],
      wanderStrength: 0.2 + random() * 0.6,
      speedMultiplier: 0.7 + random() * 0.6,
      clusterAffinity: 0.3 + random() * 0.4,
      isAlive: true,
      stepsAlive: 0,
    };
  }

  return null;
}

/**
 * Get density value at position using noise
 */
function getDensityValue(x: number, y: number, config: SwarmConfig): number {
  if (!config.densityNoise) return 0;
  return config.densityNoise.fbm(
    x * config.densityNoiseScale,
    y * config.densityNoiseScale,
    4, 0.5, 2
  );
}

/**
 * Update an agent's position and state
 */
function updateSwarmAgent(
  agent: Agent,
  field: FlowField,
  config: SwarmConfig,
  allAgents: Agent[],
  random: () => number,
  attractors?: Attractor[]
): void {
  // 1. Get base direction from flow field
  let dir = field.getVector(agent.position.x, agent.position.y, attractors);

  // 2. Add wandering noise for organic deviation
  if (config.wanderNoise) {
    const wanderAngle = config.wanderNoise.noise2D(
      agent.position.x * config.noiseWanderScale + agent.id * 100,
      agent.position.y * config.noiseWanderScale
    ) * Math.PI * agent.wanderStrength;

    const cos = Math.cos(wanderAngle);
    const sin = Math.sin(wanderAngle);
    const newX = dir.x * cos - dir.y * sin;
    const newY = dir.x * sin + dir.y * cos;
    dir = { x: newX, y: newY };
  }

  // 3. Add cluster attraction (pull toward nearby agents)
  if (config.clusterAttraction > 0 && agent.clusterAffinity > 0) {
    let clusterX = 0, clusterY = 0, clusterCount = 0;

    for (const other of allAgents) {
      if (!other.isAlive || other.id === agent.id) continue;

      const dx = other.position.x - agent.position.x;
      const dy = other.position.y - agent.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < config.clusterRadius && dist > 0.001) {
        // Weight by inverse distance
        const weight = 1 - dist / config.clusterRadius;
        clusterX += (dx / dist) * weight;
        clusterY += (dy / dist) * weight;
        clusterCount++;
      }
    }

    if (clusterCount > 0) {
      clusterX /= clusterCount;
      clusterY /= clusterCount;
      const strength = config.clusterAttraction * agent.clusterAffinity;
      dir.x = dir.x * (1 - strength) + clusterX * strength;
      dir.y = dir.y * (1 - strength) + clusterY * strength;
    }
  }

  // 4. Add form wrapping (curl-like effect for 3D illusion)
  if (config.formInfluence > 0 && config.formNoise) {
    // Use gradient of noise to create curl effect
    const eps = 5;
    const nx = config.formNoise.noise2D(
      agent.position.x * config.formNoiseScale,
      agent.position.y * config.formNoiseScale
    );
    const nxr = config.formNoise.noise2D(
      (agent.position.x + eps) * config.formNoiseScale,
      agent.position.y * config.formNoiseScale
    );
    const nyu = config.formNoise.noise2D(
      agent.position.x * config.formNoiseScale,
      (agent.position.y + eps) * config.formNoiseScale
    );

    // Curl = perpendicular to gradient
    const gradX = (nxr - nx) / eps;
    const gradY = (nyu - nx) / eps;
    const curlX = -gradY;
    const curlY = gradX;

    dir.x = dir.x * (1 - config.formInfluence) + curlX * config.formInfluence;
    dir.y = dir.y * (1 - config.formInfluence) + curlY * config.formInfluence;
  }

  // 5. Add void repulsion (push away from empty areas)
  if (config.voidRepulsion > 0 && config.densityNoise) {
    const densityVal = getDensityValue(agent.position.x, agent.position.y, config);
    if (densityVal < config.voidThreshold + 0.2) {
      // Compute gradient of density to push toward denser areas
      const eps = 5;
      const dRight = getDensityValue(agent.position.x + eps, agent.position.y, config);
      const dUp = getDensityValue(agent.position.x, agent.position.y + eps, config);
      const gradX = (dRight - densityVal) / eps;
      const gradY = (dUp - densityVal) / eps;

      const repulsion = config.voidRepulsion * (1 - (densityVal - config.voidThreshold) / 0.2);
      dir.x += gradX * repulsion * 2;
      dir.y += gradY * repulsion * 2;
    }
  }

  // Normalize direction
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  if (len > 0.001) {
    dir.x /= len;
    dir.y /= len;
  }

  // Calculate speed with energy slowdown
  let speed = config.baseStepLength * agent.speedMultiplier;
  if (config.lowEnergySlowdown) {
    const energyRatio = agent.energy / agent.maxEnergy;
    speed *= 0.3 + energyRatio * 0.7;
  }

  // Update position
  agent.velocity = dir;
  agent.position.x += dir.x * speed;
  agent.position.y += dir.y * speed;
  agent.trail.push({ x: agent.position.x, y: agent.position.y });

  // Deplete energy
  agent.energy -= agent.energyDecayRate;
  agent.stepsAlive++;
}

/**
 * Check if agent should terminate
 */
function shouldAgentTerminate(agent: Agent, config: SwarmConfig, field: FlowField): boolean {
  // Energy depleted
  if (agent.energy <= 0) return true;

  // Out of bounds
  if (!field.isInBounds(agent.position.x, agent.position.y, config.margin)) return true;

  // Deep in void region
  const densityVal = getDensityValue(agent.position.x, agent.position.y, config);
  if (densityVal < config.voidThreshold - 0.1) return true;

  // Trail too long (safety)
  if (agent.trail.length > 5000) return true;

  return false;
}

/**
 * Spawn a child agent from parent
 */
function spawnChildAgent(
  parent: Agent,
  config: SwarmConfig,
  random: () => number,
  id: number,
  field: FlowField
): Agent | null {
  // Child spawns perpendicular to parent's movement
  const perpX = -parent.velocity.y;
  const perpY = parent.velocity.x;
  const side = random() > 0.5 ? 1 : -1;
  const dist = config.childSpawnDistance * (0.5 + random() * 0.5);

  const x = parent.position.x + perpX * dist * side;
  const y = parent.position.y + perpY * dist * side;

  if (!field.isInBounds(x, y, config.margin)) return null;

  // Check void
  const densityVal = getDensityValue(x, y, config);
  if (densityVal < config.voidThreshold) return null;

  // Child inherits reduced energy from parent
  const childEnergy = parent.energy * (0.4 + random() * 0.3);
  parent.energy -= childEnergy * 0.3; // Parent loses some energy

  return {
    id,
    position: { x, y },
    velocity: { ...parent.velocity },
    energy: childEnergy,
    maxEnergy: childEnergy,
    energyDecayRate: parent.energyDecayRate,
    trail: [{ x, y }],
    wanderStrength: parent.wanderStrength * (0.8 + random() * 0.4),
    speedMultiplier: parent.speedMultiplier * (0.8 + random() * 0.4),
    clusterAffinity: parent.clusterAffinity * (0.8 + random() * 0.4),
    isAlive: true,
    stepsAlive: 0,
  };
}

/**
 * Generate form hatching lines - contour-following lines that wrap around implied 3D forms
 * This creates organic, hand-drawn looking art with extreme density variation
 */
function generateFormHatching(
  width: number,
  height: number,
  maxLines: number,
  stepLength: number,
  maxSteps: number,
  margin: number,
  minLineLength: number,
  seed: number,
  formScale: number,
  formContrast: number,
  hatchDensity: number,
  lengthVariation: number,
  angleVariation: number,
  overlap: number,
  wobble: number
): FlowLinesResult {
  // Create noise generators
  const formNoise = createNoise(seed);           // The implied 3D form/surface
  const densityNoise = createNoise(seed + 1111); // Where lines should be dense
  const lengthNoise = createNoise(seed + 2222);  // Line length variation
  const wobbleNoise = createNoise(seed + 3333);  // Organic wobble
  const angleNoise = createNoise(seed + 4444);   // Angle deviation

  // Seeded random
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const lines: FlowLine[] = [];

  // Calculate how many seed points to generate based on density
  // We'll generate MORE seeds and let density filtering reduce them
  const seedMultiplier = 5 + hatchDensity * 10; // 5-15x more seeds than maxLines
  const totalSeeds = Math.floor(maxLines * seedMultiplier);

  // Generate seed points with density-weighted probability
  const seeds: Point[] = [];
  for (let i = 0; i < totalSeeds && seeds.length < maxLines * 3; i++) {
    const x = margin + random() * (width - 2 * margin);
    const y = margin + random() * (height - 2 * margin);

    // Get density at this point - use fbm for organic variation
    const density = densityNoise.fbm(
      x * formScale * 0.5,
      y * formScale * 0.5,
      4, 0.5, 2
    );

    // Density ranges from -1 to 1
    // Apply contrast to make extremes more extreme
    const contrastDensity = Math.sign(density) * Math.pow(Math.abs(density), 1 / (1 + formContrast));

    // Convert to spawn probability (0 to 1)
    // High contrast means dense areas get MANY lines, sparse areas get ZERO
    const spawnProb = Math.pow((contrastDensity + 1) * 0.5, 2 - formContrast * 1.5);

    // Only spawn if random passes density test
    if (random() < spawnProb) {
      seeds.push({ x, y });
    }
  }

  // Trace a line from each seed following contour direction
  for (const seedPoint of seeds) {
    if (lines.length >= maxLines) break;

    const trail: Point[] = [{ ...seedPoint }];
    let x = seedPoint.x;
    let y = seedPoint.y;

    // Determine line length based on noise + variation
    const baseLengthNoise = lengthNoise.noise2D(x * formScale, y * formScale);
    const lengthMult = 0.3 + (baseLengthNoise + 1) * 0.5 * (1 - lengthVariation) + random() * lengthVariation;
    const targetSteps = Math.floor(maxSteps * lengthMult);

    // Trace the line
    for (let step = 0; step < targetSteps; step++) {
      // Compute gradient of form noise (this tells us the "slope" direction)
      const eps = 2;
      const formHere = formNoise.fbm(x * formScale, y * formScale, 3, 0.5, 2);
      const formRight = formNoise.fbm((x + eps) * formScale, y * formScale, 3, 0.5, 2);
      const formUp = formNoise.fbm(x * formScale, (y + eps) * formScale, 3, 0.5, 2);

      // Gradient direction (slope of the form)
      const gradX = (formRight - formHere) / eps;
      const gradY = (formUp - formHere) / eps;

      // Contour direction is perpendicular to gradient (like elevation lines on a map)
      let dirX = -gradY;
      let dirY = gradX;

      // Normalize
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len > 0.001) {
        dirX /= len;
        dirY /= len;
      } else {
        // Flat area - use random direction
        const angle = random() * Math.PI * 2;
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
      }

      // Add angle variation (deviation from perfect contour)
      if (angleVariation > 0) {
        const angleOffset = angleNoise.noise2D(
          x * formScale * 2 + step * 0.1,
          y * formScale * 2
        ) * Math.PI * 0.5 * angleVariation;

        const cos = Math.cos(angleOffset);
        const sin = Math.sin(angleOffset);
        const newDirX = dirX * cos - dirY * sin;
        const newDirY = dirX * sin + dirY * cos;
        dirX = newDirX;
        dirY = newDirY;
      }

      // Calculate next position
      let nextX = x + dirX * stepLength;
      let nextY = y + dirY * stepLength;

      // Add organic wobble
      if (wobble > 0) {
        const wobbleVal = wobbleNoise.noise2D(
          x * 0.02 + step * 0.1,
          y * 0.02
        );
        // Perpendicular to direction
        const perpX = -dirY;
        const perpY = dirX;
        const wobbleAmount = wobbleVal * wobble * stepLength * 2;
        nextX += perpX * wobbleAmount;
        nextY += perpY * wobbleAmount;
      }

      // Check bounds
      if (nextX < margin || nextX > width - margin ||
          nextY < margin || nextY > height - margin) {
        break;
      }

      // Update position and add to trail
      x = nextX;
      y = nextY;
      trail.push({ x, y });

      // Early termination based on density (lines can end in sparse areas)
      const localDensity = densityNoise.fbm(x * formScale * 0.5, y * formScale * 0.5, 4, 0.5, 2);
      if (localDensity < -0.3 && random() < 0.1 * (1 + formContrast)) {
        break;
      }
    }

    // Only keep lines that meet minimum length
    if (trail.length >= minLineLength) {
      lines.push({ points: trail });
    }
  }

  return {
    lines,
    width,
    height,
    seed,
  };
}

