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

  it('exposes the botanical generator and renders a multi-pen botanical SVG', async () => {
    const { generateBotanical, toSVG } = await import('@flow-lines/core');
    expect(generateBotanical).toBeDefined();

    const result = generateBotanical({
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

  it('exposes the planet generator and renders a ringed-giant SVG', async () => {
    const { generatePlanet, toSVG } = await import('@flow-lines/core');
    expect(generatePlanet).toBeDefined();

    const result = generatePlanet({
      width: 600,
      height: 600,
      margin: 36,
      seed: 42,
      planetType: 'ringed',
      rings: true,
      bands: true,
      starfield: true,
    });

    const svg = toSVG(
      { ...result, seed: 42 },
      { layerColors: { limb: '#2a2a26', hatch: '#3b3a36', ring: '#5b4636' } }
    );

    expect(svg).toContain('<path');
    expect(result.lines.some((l) => l.layer === 'ring')).toBe(true);
  });

  it('exposes the gesture generator and renders a kline SVG', async () => {
    const { generateGesture, toSVG } = await import('@flow-lines/core');
    expect(generateGesture).toBeDefined();

    const result = generateGesture({
      width: 444,
      height: 630,
      margin: 24,
      seed: 42,
      preset: 'kline',
    });

    const svg = toSVG(result, { strokeWidth: 2 });

    expect(svg).toContain('<path');
    expect(result.lines.some((l) => l.layer === 'gesture')).toBe(true);
  });
});
