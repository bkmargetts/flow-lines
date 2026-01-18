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
