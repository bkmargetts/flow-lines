import { describe, it, expect } from 'vitest';

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
});
