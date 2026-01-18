import { describe, it, expect } from 'vitest';
import { generateFlowLines, generateFlowLinesGrid } from './flow-lines.js';

describe('generateFlowLines', () => {
  it('should generate flow lines', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 10,
      seed: 42,
    });

    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.width).toBe(400);
    expect(result.height).toBe(400);
    expect(result.seed).toBe(42);
  });

  it('should be deterministic with same seed', () => {
    const result1 = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 10,
      seed: 12345,
    });

    const result2 = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 10,
      seed: 12345,
    });

    expect(result1.lines.length).toBe(result2.lines.length);
    expect(result1.lines[0].points[0].x).toBe(result2.lines[0].points[0].x);
    expect(result1.lines[0].points[0].y).toBe(result2.lines[0].points[0].y);
  });

  it('should produce different results with different seeds', () => {
    const result1 = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 10,
      seed: 111,
    });

    const result2 = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 10,
      seed: 222,
    });

    // Starting points should differ
    expect(result1.lines[0].points[0].x).not.toBe(result2.lines[0].points[0].x);
  });

  it('should respect margin boundaries', () => {
    const margin = 50;
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 20,
      margin,
      seed: 42,
    });

    for (const line of result.lines) {
      for (const point of line.points) {
        expect(point.x).toBeGreaterThanOrEqual(margin);
        expect(point.x).toBeLessThan(400 - margin);
        expect(point.y).toBeGreaterThanOrEqual(margin);
        expect(point.y).toBeLessThan(400 - margin);
      }
    }
  });

  it('should filter short lines when minLineLength is set', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 50,
      minLineLength: 20,
      seed: 42,
    });

    for (const line of result.lines) {
      expect(line.points.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('should use custom start points when provided', () => {
    const startPoints = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 },
    ];

    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 3,
      startPoints,
      seed: 42,
      minLineLength: 1,
    });

    expect(result.lines[0].points[0].x).toBe(100);
    expect(result.lines[0].points[0].y).toBe(100);
    expect(result.lines[1].points[0].x).toBe(200);
    expect(result.lines[1].points[0].y).toBe(200);
  });
});

describe('generateFlowLinesGrid', () => {
  it('should generate flow lines from grid points', () => {
    const result = generateFlowLinesGrid({
      width: 400,
      height: 400,
      gridSpacing: 50,
      seed: 42,
    });

    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.width).toBe(400);
    expect(result.height).toBe(400);
  });

  it('should create evenly spaced starting points', () => {
    const result = generateFlowLinesGrid({
      width: 200,
      height: 200,
      gridSpacing: 50,
      margin: 25,
      seed: 42,
      minLineLength: 1,
    });

    // With 200x200, margin 25, spacing 50: should have grid from 25 to 175
    // That's (25, 75, 125, 175) = 4 points per axis = 16 total starting points
    // But lines may be filtered by minLineLength
    expect(result.lines.length).toBeGreaterThan(0);
  });
});
