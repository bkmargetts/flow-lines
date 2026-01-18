import { describe, it, expect } from 'vitest';
import { SimplexNoise, createNoise } from './noise.js';

describe('SimplexNoise', () => {
  it('should create a noise instance', () => {
    const noise = new SimplexNoise();
    expect(noise).toBeInstanceOf(SimplexNoise);
  });

  it('should create deterministic noise with seed', () => {
    const noise1 = new SimplexNoise(12345);
    const noise2 = new SimplexNoise(12345);

    expect(noise1.noise2D(0.5, 0.5)).toBe(noise2.noise2D(0.5, 0.5));
    expect(noise1.noise2D(1.5, 2.5)).toBe(noise2.noise2D(1.5, 2.5));
  });

  it('should return values in range [-1, 1]', () => {
    const noise = new SimplexNoise(42);

    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const value = noise.noise2D(x, y);

      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('should produce different values for different seeds', () => {
    const noise1 = new SimplexNoise(111);
    const noise2 = new SimplexNoise(222);

    const value1 = noise1.noise2D(0.5, 0.5);
    const value2 = noise2.noise2D(0.5, 0.5);

    expect(value1).not.toBe(value2);
  });

  it('should produce smooth transitions', () => {
    const noise = new SimplexNoise(42);

    const v1 = noise.noise2D(0, 0);
    const v2 = noise.noise2D(0.01, 0);
    const v3 = noise.noise2D(0.02, 0);

    // Values should change gradually
    expect(Math.abs(v2 - v1)).toBeLessThan(0.1);
    expect(Math.abs(v3 - v2)).toBeLessThan(0.1);
  });
});

describe('createNoise', () => {
  it('should create a SimplexNoise instance', () => {
    const noise = createNoise(42);
    expect(noise).toBeInstanceOf(SimplexNoise);
  });
});

describe('fbm', () => {
  it('should produce fractal brownian motion noise', () => {
    const noise = new SimplexNoise(42);
    const value = noise.fbm(0.5, 0.5, 4, 0.5, 2);

    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });

  it('should be deterministic with same parameters', () => {
    const noise1 = new SimplexNoise(42);
    const noise2 = new SimplexNoise(42);

    const v1 = noise1.fbm(1.5, 2.5, 3, 0.5, 2);
    const v2 = noise2.fbm(1.5, 2.5, 3, 0.5, 2);

    expect(v1).toBe(v2);
  });
});
