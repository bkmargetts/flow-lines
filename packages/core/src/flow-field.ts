import { SimplexNoise, createNoise } from './noise.js';

export interface FlowFieldOptions {
  width: number;
  height: number;
  resolution: number;
  seed?: number;
  noiseScale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Attractor {
  x: number;
  y: number;
  radius: number;
  strength: number; // positive = attract, negative = repel
}

/**
 * A flow field that generates directional vectors based on noise
 */
export class FlowField {
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
  readonly cols: number;
  readonly rows: number;

  private noise: SimplexNoise;
  private noiseScale: number;
  private octaves: number;
  private persistence: number;
  private lacunarity: number;
  private field: number[][];

  constructor(options: FlowFieldOptions) {
    this.width = options.width;
    this.height = options.height;
    this.resolution = options.resolution;
    this.noiseScale = options.noiseScale ?? 0.005;
    this.octaves = options.octaves ?? 4;
    this.persistence = options.persistence ?? 0.5;
    this.lacunarity = options.lacunarity ?? 2;

    this.cols = Math.ceil(this.width / this.resolution);
    this.rows = Math.ceil(this.height / this.resolution);

    this.noise = createNoise(options.seed);
    this.field = this.generateField();
  }

  private generateField(): number[][] {
    const field: number[][] = [];

    for (let y = 0; y < this.rows; y++) {
      field[y] = [];
      for (let x = 0; x < this.cols; x++) {
        const noiseValue = this.noise.fbm(
          x * this.noiseScale * this.resolution,
          y * this.noiseScale * this.resolution,
          this.octaves,
          this.persistence,
          this.lacunarity
        );
        // Map noise to angle (0 to 2*PI)
        field[y][x] = noiseValue * Math.PI * 2;
      }
    }

    return field;
  }

  /**
   * Get the angle at a given position
   */
  getAngle(x: number, y: number): number {
    const col = Math.floor(x / this.resolution);
    const row = Math.floor(y / this.resolution);

    // Clamp to bounds
    const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, this.rows - 1));

    return this.field[clampedRow][clampedCol];
  }

  /**
   * Get the direction vector at a given position, optionally influenced by attractors
   */
  getVector(x: number, y: number, attractors?: Attractor[]): Vector2D {
    const angle = this.getAngle(x, y);
    let vx = Math.cos(angle);
    let vy = Math.sin(angle);

    // Apply attractor influences
    if (attractors && attractors.length > 0) {
      for (const attractor of attractors) {
        const dx = attractor.x - x;
        const dy = attractor.y - y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        // Only apply influence within the attractor's radius
        if (dist < attractor.radius && dist > 0) {
          // Falloff: stronger effect closer to center
          const falloff = 1 - dist / attractor.radius;
          const influence = falloff * falloff * attractor.strength;

          // Normalize direction to/from attractor
          const dirX = dx / dist;
          const dirY = dy / dist;

          // Blend with the noise-based vector
          vx += dirX * influence;
          vy += dirY * influence;
        }
      }

      // Normalize the resulting vector
      const len = Math.sqrt(vx * vx + vy * vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }
    }

    return { x: vx, y: vy };
  }

  /**
   * Check if a point is within the field bounds
   */
  isInBounds(x: number, y: number, margin: number = 0): boolean {
    return (
      x >= margin &&
      x < this.width - margin &&
      y >= margin &&
      y < this.height - margin
    );
  }
}
