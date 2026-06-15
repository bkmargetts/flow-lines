import { describe, it, expect } from 'vitest';
import { toSVGLayers } from './svg.js';
import type { FlowLinesResult } from './flow-lines.js';

const mixed: FlowLinesResult = {
  width: 100,
  height: 80,
  seed: 1,
  lines: [
    { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], layer: 'present', pen: 'bold' },
    { points: [{ x: 0, y: 10 }, { x: 50, y: 10 }], layer: 'ghost' },
    { points: [{ x: 0, y: 20 }, { x: 50, y: 20 }], layer: 'trail' },
    { points: [{ x: 0, y: 30 }, { x: 50, y: 30 }], layer: 'trail' },
  ],
};

describe('toSVGLayers', () => {
  it('returns one SVG per distinct layer', () => {
    const layers = toSVGLayers(mixed);
    expect(layers.map((l) => l.layer)).toEqual(['present', 'ghost', 'trail']);
  });

  it('puts only that layer\'s strokes in each SVG', () => {
    const layers = toSVGLayers(mixed);
    const byLayer = Object.fromEntries(layers.map((l) => [l.layer, l.svg]));
    const count = (svg: string) => (svg.match(/<path /g) || []).length;
    expect(count(byLayer.present)).toBe(1);
    expect(count(byLayer.ghost)).toBe(1);
    expect(count(byLayer.trail)).toBe(2);
  });

  it('shares the viewBox and physical dimensions across layers', () => {
    const layers = toSVGLayers(mixed, { physicalWidth: '100mm', physicalHeight: '80mm' });
    for (const { svg } of layers) {
      expect(svg).toContain('viewBox="0 0 100 80"');
      expect(svg).toContain('width="100mm"');
      expect(svg).toContain('height="80mm"');
    }
  });

  it('falls back to pen then default when no layer is set', () => {
    const result: FlowLinesResult = {
      width: 10,
      height: 10,
      seed: 1,
      lines: [
        { points: [{ x: 0, y: 0 }, { x: 9, y: 0 }], pen: 'bold' },
        { points: [{ x: 0, y: 5 }, { x: 9, y: 5 }] },
      ],
    };
    const layers = toSVGLayers(result);
    expect(layers.map((l) => l.layer).sort()).toEqual(['bold', 'default']);
  });

  it('produces valid standalone SVG documents', () => {
    for (const { svg } of toSVGLayers(mixed)) {
      expect(svg).toContain('<?xml version="1.0"');
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    }
  });
});
