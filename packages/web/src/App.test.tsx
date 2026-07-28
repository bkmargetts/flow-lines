import { describe, it, expect } from 'vitest';
import { MODULES, getModule, DEFAULT_MODULE_ID } from './modules/registry';

describe('Module registry', () => {
  it('leads with Image → Ink as the default add-layer choice', () => {
    expect(MODULES[0].id).toBe('image-ink');
    expect(DEFAULT_MODULE_ID).toBe('image-ink');
  });

  it('every module is a well-formed pure or live module', () => {
    const CATEGORIES = ['image', 'scenes', 'flow', 'simulations', 'textures'];
    for (const mod of MODULES) {
      expect(mod.id).toMatch(/^[a-z0-9-]+$/);
      expect(typeof mod.label).toBe('string');
      expect(CATEGORIES).toContain(mod.category);
      expect(typeof mod.description).toBe('string');
      expect(mod.description.length).toBeGreaterThan(10);
      expect(mod.description.length).toBeLessThanOrEqual(110);
      expect(typeof mod.defaultState).toBe('function');
      expect(typeof mod.Controls).toBe('function');
      expect(mod.kind === 'pure' || mod.kind === 'live').toBe(true);
      if (mod.kind === 'pure') expect(typeof mod.render).toBe('function');
      else expect(typeof mod.useInstance).toBe('function');
    }
  });

  it('defaultState returns a fresh object per call (independent instances)', () => {
    for (const mod of MODULES) {
      const a = mod.defaultState();
      const b = mod.defaultState();
      expect(a).not.toBe(b);
    }
  });

  it('includes the former background textures as modules', () => {
    expect(getModule('classic').kind).toBe('pure');
    expect(getModule('grating').kind).toBe('pure');
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
