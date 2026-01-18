import { describe, it, expect } from 'vitest';

// Basic sanity tests for CLI module imports
describe('CLI', () => {
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
  });
});
