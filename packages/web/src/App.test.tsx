import { describe, it, expect } from 'vitest';
import { PROJECTS } from './projects/registry';

describe('Project registry', () => {
  it('registers Image → Ink and Flow Field as the first two projects', () => {
    expect(PROJECTS[0].id).toBe('image-ink');
    expect(PROJECTS[1].id).toBe('flow-field');
  });

  it('gives every project at least one feature with Controls and Canvas', () => {
    for (const project of PROJECTS) {
      expect(project.id).toMatch(/^[a-z0-9-]+$/);
      expect(project.features.length).toBeGreaterThan(0);
      for (const feature of project.features) {
        expect(typeof feature.Controls).toBe('function');
        expect(typeof feature.Canvas).toBe('function');
      }
    }
  });
});

// Basic sanity tests for web app module imports
describe('Web App', () => {
  it('should be able to import core module', async () => {
    const core = await import('@flow-lines/core');
    expect(core.generateFlowLines).toBeDefined();
    expect(core.toSVG).toBeDefined();
  });

  it('should generate valid SVG output', async () => {
    const { generateFlowLines, toSVG } = await import('@flow-lines/core');

    const result = generateFlowLines({
      width: 100,
      height: 100,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="100"');
  });

  it('should generate flow lines from custom start points', async () => {
    const { generateFlowLines } = await import('@flow-lines/core');

    const startPoints = [
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 75, y: 75 },
    ];

    const result = generateFlowLines({
      width: 100,
      height: 100,
      lineCount: startPoints.length,
      seed: 42,
      startPoints,
    });

    expect(result.lines.length).toBeLessThanOrEqual(startPoints.length);
    expect(result.lines.length).toBeGreaterThan(0);
  });
});
