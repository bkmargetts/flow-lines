import { SimplexNoise, createNoise } from './noise.js';

export type FieldMode = 'normal' | 'curl' | 'spiral' | 'turbulent' | 'ridged' | 'warped';

export interface FlowFieldOptions {
  width: number;
  height: number;
  resolution: number;
  seed?: number;
  noiseScale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  fieldMode?: FieldMode;
  spiralStrength?: number;  // For spiral mode - how much to rotate toward center
  warpStrength?: number;    // For warped mode - domain warp intensity
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
  readonly fieldMode: FieldMode;

  private noise: SimplexNoise;
  private noiseScale: number;
  private octaves: number;
  private persistence: number;
  private lacunarity: number;
  private spiralStrength: number;
  private warpStrength: number;
  private field: Vector2D[][];  // Store vectors directly for curl/spiral modes

  constructor(options: FlowFieldOptions) {
    this.width = options.width;
    this.height = options.height;
    this.resolution = options.resolution;
    this.noiseScale = options.noiseScale ?? 0.005;
    this.octaves = options.octaves ?? 4;
    this.persistence = options.persistence ?? 0.5;
    this.lacunarity = options.lacunarity ?? 2;
    this.fieldMode = options.fieldMode ?? 'normal';
    this.spiralStrength = options.spiralStrength ?? 0.5;
    this.warpStrength = options.warpStrength ?? 0.5;

    this.cols = Math.ceil(this.width / this.resolution);
    this.rows = Math.ceil(this.height / this.resolution);

    this.noise = createNoise(options.seed);
    this.field = this.generateField();
  }

  private generateField(): Vector2D[][] {
    const field: Vector2D[][] = [];
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (let row = 0; row < this.rows; row++) {
      field[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const x = col * this.resolution;
        const y = row * this.resolution;
        const nx = x * this.noiseScale;
        const ny = y * this.noiseScale;

        let vx: number;
        let vy: number;

        switch (this.fieldMode) {
          case 'curl': {
            // Curl noise creates smooth, swirling flow
            const curl = this.noise.curl2D(
              nx, ny,
              this.octaves,
              this.persistence,
              this.lacunarity
            );
            vx = curl.x;
            vy = curl.y;
            break;
          }

          case 'spiral': {
            // Curl noise with spiral toward/away from center
            const curl = this.noise.curl2D(
              nx, ny,
              this.octaves,
              this.persistence,
              this.lacunarity
            );
            // Add rotation component toward center
            const dx = centerX - x;
            const dy = centerY - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              const spiralX = dx / dist;
              const spiralY = dy / dist;
              vx = curl.x + spiralX * this.spiralStrength;
              vy = curl.y + spiralY * this.spiralStrength;
            } else {
              vx = curl.x;
              vy = curl.y;
            }
            break;
          }

          case 'turbulent': {
            // Higher frequency curl for more turbulent flow
            const curl = this.noise.curl2D(
              nx * 2, ny * 2,  // Higher frequency
              this.octaves + 2,  // More octaves for detail
              this.persistence * 1.2,
              this.lacunarity
            );
            vx = curl.x;
            vy = curl.y;
            break;
          }

          case 'ridged': {
            // Use ridged noise for sharp angular patterns
            const angle = this.noise.ridged(
              nx, ny,
              this.octaves,
              this.persistence,
              this.lacunarity
            ) * Math.PI * 2;
            vx = Math.cos(angle);
            vy = Math.sin(angle);
            break;
          }

          case 'warped': {
            // Domain-warped noise for organic distortion
            const angle = this.noise.warpedFbm(
              nx, ny,
              this.octaves,
              this.persistence,
              this.lacunarity,
              this.warpStrength
            ) * Math.PI * 2;
            vx = Math.cos(angle);
            vy = Math.sin(angle);
            break;
          }

          case 'normal':
          default: {
            // Standard fbm noise mapped to angle
            const noiseValue = this.noise.fbm(
              nx, ny,
              this.octaves,
              this.persistence,
              this.lacunarity
            );
            const angle = noiseValue * Math.PI * 2;
            vx = Math.cos(angle);
            vy = Math.sin(angle);
            break;
          }
        }

        // Normalize the vector
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0) {
          vx /= len;
          vy /= len;
        }

        field[row][col] = { x: vx, y: vy };
      }
    }

    return field;
  }

  /**
   * Get the base vector at a given position (before attractor influence)
   */
  getBaseVector(x: number, y: number): Vector2D {
    const col = Math.floor(x / this.resolution);
    const row = Math.floor(y / this.resolution);

    // Clamp to bounds
    const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, this.rows - 1));

    return this.field[clampedRow][clampedCol];
  }

  /**
   * Get the angle at a given position
   */
  getAngle(x: number, y: number): number {
    const vec = this.getBaseVector(x, y);
    return Math.atan2(vec.y, vec.x);
  }

  /**
   * Get the direction vector at a given position, optionally influenced by attractors
   */
  getVector(x: number, y: number, attractors?: Attractor[]): Vector2D {
    const baseVec = this.getBaseVector(x, y);
    let vx = baseVec.x;
    let vy = baseVec.y;

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
