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

  it('exposes the vine generator and renders a multi-pen botanical SVG', async () => {
    const { generateVines, toSVG } = await import('@flow-lines/core');
    expect(generateVines).toBeDefined();

    const result = generateVines({
      width: 444,
      height: 630,
      seed: 42,
      composition: 'bouquet',
      vessel: 'vase',
      groundLine: true,
    });

    const svg = toSVG(result, {
      physicalWidth: '148mm',
      physicalHeight: '210mm',
      layerColors: { stem: '#2a2a26', leaf: '#3f6b3a', vein: '#34602f', flower: '#9c2b52' },
    });

    expect(svg).toContain('<path');
    expect(svg).toContain('width="148mm"');
    expect(svg).toContain('height="210mm"');
  });
});
