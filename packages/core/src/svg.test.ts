import { describe, it, expect } from 'vitest';
import { toSVG, parseSVGOptions } from './svg.js';
import { generateFlowLines } from './flow-lines.js';

describe('toSVG', () => {
  it('should generate valid SVG', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result);

    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="400"');
    expect(svg).toContain('<path');
    expect(svg).toContain('</svg>');
  });

  it('should tag physical mm dimensions while keeping a px viewBox', () => {
    const result = generateFlowLines({
      width: 630,
      height: 891,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result, { physicalWidth: '210mm', physicalHeight: '297mm' });

    // Plotter/printer reads the real sheet size...
    expect(svg).toContain('width="210mm"');
    expect(svg).toContain('height="297mm"');
    // ...while geometry and preview stay in the pixel coordinate space
    expect(svg).toContain('viewBox="0 0 630 891"');
  });

  it('should use custom stroke color', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result, { strokeColor: '#ff0000' });

    expect(svg).toContain('stroke="#ff0000"');
  });

  it('should use custom stroke width', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result, { strokeWidth: 2.5 });

    expect(svg).toContain('stroke-width="2.5"');
  });

  it('should include background when requested', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result, {
      includeBackground: true,
      backgroundColor: '#eeeeee',
    });

    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="#eeeeee"');
  });

  it('should not include background by default', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result);

    expect(svg).not.toContain('<rect');
  });

  it('should generate paths with M and Q commands', () => {
    const result = generateFlowLines({
      width: 400,
      height: 400,
      lineCount: 5,
      seed: 42,
    });

    const svg = toSVG(result);

    expect(svg).toMatch(/d="M[\d.]+,[\d.]+/);
  });

  it('orders background texture layers (incl. multi-ink texture-NN) behind the drawing', () => {
    const result = {
      width: 100,
      height: 100,
      seed: 1,
      lines: [
        { points: [{ x: 0, y: 0 }, { x: 9, y: 9 }], layer: 'default' },
        { points: [{ x: 0, y: 1 }, { x: 9, y: 8 }], layer: 'texture-01' },
        { points: [{ x: 0, y: 2 }, { x: 9, y: 7 }], layer: 'texture-00' },
      ],
    };
    const svg = toSVG(result, {
      layerColors: { 'texture-00': '#aa0000', 'texture-01': '#00aa00', default: '#000000' },
    });
    const i00 = svg.indexOf('#aa0000');
    const i01 = svg.indexOf('#00aa00');
    const iDraw = svg.indexOf('#000000');
    // Both texture bands render before (behind) the drawing's default layer.
    expect(i00).toBeGreaterThanOrEqual(0);
    expect(i00).toBeLessThan(iDraw);
    expect(i01).toBeLessThan(iDraw);
    // texture-00 sorts before texture-01.
    expect(i00).toBeLessThan(i01);
  });

  it('wraps a layer in a mix-blend-mode group when layerBlend is set', () => {
    const result = {
      width: 100,
      height: 100,
      seed: 1,
      lines: [
        { points: [{ x: 0, y: 0 }, { x: 9, y: 9 }], layer: 'band-00' },
        { points: [{ x: 0, y: 1 }, { x: 9, y: 8 }], layer: 'band-01' },
      ],
    };
    const svg = toSVG(result, {
      layerColors: { 'band-00': '#ffd23f', 'band-01': '#1f6feb' },
      layerBlend: { 'band-00': 'multiply', 'band-01': 'multiply' },
    });
    expect(svg).toContain('mix-blend-mode:multiply');
    expect((svg.match(/<g style="mix-blend-mode:multiply">/g) ?? []).length).toBe(2);
    // Absent layerBlend → no group wrapper (byte-stable default).
    const plain = toSVG(result, { layerColors: { 'band-00': '#ffd23f', 'band-01': '#1f6feb' } });
    expect(plain).not.toContain('<g');
  });
});

describe('toSVG single pen width', () => {
  const twoPenResult = {
    width: 100,
    height: 100,
    seed: 1,
    lines: [
      {
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 10 },
        ],
      },
      {
        points: [
          { x: 10, y: 50 },
          { x: 90, y: 50 },
        ],
        pen: 'bold' as const,
      },
    ],
  };

  it('renders all lines with one stroke width regardless of pen class', () => {
    const svg = toSVG(twoPenResult, { strokeWidth: 0.8 });

    const widths = [...svg.matchAll(/stroke-width="([^"]+)"/g)].map((m) => m[1]);
    expect(widths.length).toBe(2);
    expect(new Set(widths)).toEqual(new Set(['0.8']));
    expect(svg).not.toContain('inkscape');
  });
});

describe('parseSVGOptions', () => {
  it('should parse valid options', () => {
    const options = parseSVGOptions({
      strokeColor: '#123456',
      strokeWidth: 2,
      backgroundColor: '#ffffff',
      includeBackground: true,
      precision: 3,
      optimizePaths: false,
    });

    expect(options.strokeColor).toBe('#123456');
    expect(options.strokeWidth).toBe(2);
    expect(options.backgroundColor).toBe('#ffffff');
    expect(options.includeBackground).toBe(true);
    expect(options.precision).toBe(3);
    expect(options.optimizePaths).toBe(false);
  });

  it('should ignore invalid types', () => {
    const options = parseSVGOptions({
      strokeColor: 123,
      strokeWidth: 'invalid',
      includeBackground: 'yes',
    });

    expect(options.strokeColor).toBeUndefined();
    expect(options.strokeWidth).toBeUndefined();
    expect(options.includeBackground).toBeUndefined();
  });
});
