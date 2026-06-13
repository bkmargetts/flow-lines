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
