/**
 * Simplex Noise implementation for flow field generation
 * Based on Stefan Gustavson's implementation
 */

// Permutation table
const p = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
  36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234,
  75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237,
  149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48,
  27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105,
  92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73,
  209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86,
  164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38,
  147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189,
  28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101,
  155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
  178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12,
  191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31,
  181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
  138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215,
  61, 156, 180,
];

// Gradient vectors for 2D
const grad2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface NoiseOptions {
  seed?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  scale?: number;
}

export class SimplexNoise {
  private perm: number[];
  private permMod8: number[];

  constructor(seed: number = Math.random() * 65536) {
    this.perm = new Array(512);
    this.permMod8 = new Array(512);

    // Seed the permutation table
    const seedPerm = [...p];

    // Simple seeded shuffle
    let s = seed;
    for (let i = seedPerm.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [seedPerm[i], seedPerm[j]] = [seedPerm[j], seedPerm[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = seedPerm[i & 255];
      this.permMod8[i] = this.perm[i] & 7;
    }
  }

  private dot2(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  /**
   * 2D Simplex noise
   */
  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    // Skew input space
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine simplex
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    // Hash coordinates
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod8[ii + this.perm[jj]];
    const gi1 = this.permMod8[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod8[ii + 1 + this.perm[jj + 1]];

    // Calculate contributions
    let n0 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(grad2[gi0], x0, y0);
    }

    let n1 = 0;
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(grad2[gi1], x1, y1);
    }

    let n2 = 0;
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(grad2[gi2], x2, y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  }

  /**
   * Fractal Brownian Motion noise
   */
  fbm(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2,
    scale: number = 1
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Curl noise - divergence-free noise for smooth, swirling flow
   * Returns a 2D vector that is perpendicular to the noise gradient
   */
  curl2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2,
    epsilon: number = 0.0001
  ): { x: number; y: number } {
    // Compute partial derivatives using central differences
    const n1 = this.fbm(x, y + epsilon, octaves, persistence, lacunarity);
    const n2 = this.fbm(x, y - epsilon, octaves, persistence, lacunarity);
    const n3 = this.fbm(x + epsilon, y, octaves, persistence, lacunarity);
    const n4 = this.fbm(x - epsilon, y, octaves, persistence, lacunarity);

    // Curl = (dN/dy, -dN/dx)
    const curlX = (n1 - n2) / (2 * epsilon);
    const curlY = -(n3 - n4) / (2 * epsilon);

    return { x: curlX, y: curlY };
  }

  /**
   * Ridged multifractal noise - creates sharp ridges/creases
   */
  ridged(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2,
    offset: number = 1
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let weight = 1;

    for (let i = 0; i < octaves; i++) {
      let signal = this.noise2D(x * frequency, y * frequency);
      signal = offset - Math.abs(signal);
      signal *= signal;
      signal *= weight;
      weight = Math.min(1, Math.max(0, signal * 2));
      value += signal * amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value;
  }

  /**
   * Warped/domain-warped noise for organic distortion
   */
  warpedFbm(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2,
    warpStrength: number = 0.5
  ): number {
    // First pass: get warp offsets
    const warpX = this.fbm(x, y, octaves, persistence, lacunarity);
    const warpY = this.fbm(x + 5.2, y + 1.3, octaves, persistence, lacunarity);

    // Second pass: sample noise at warped coordinates
    return this.fbm(
      x + warpX * warpStrength,
      y + warpY * warpStrength,
      octaves,
      persistence,
      lacunarity
    );
  }
}

/**
 * Create a seeded noise instance
 */
export function createNoise(seed?: number): SimplexNoise {
  return new SimplexNoise(seed);
}
