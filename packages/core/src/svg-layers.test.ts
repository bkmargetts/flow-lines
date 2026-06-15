import { describe, it, expect } from 'vitest';
import { toSVG, toSVGLayers } from './svg.js';
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

  it('applies per-layer colors, falling back to strokeColor', () => {
    const layers = toSVGLayers(mixed, {
      strokeColor: '#000000',
      layerColors: { present: '#1a1a1a', trail: '#8a7a5c' },
    });
    const byLayer = Object.fromEntries(layers.map((l) => [l.layer, l.svg]));
    expect(byLayer.present).toContain('stroke="#1a1a1a"');
    expect(byLayer.trail).toContain('stroke="#8a7a5c"');
    // ghost has no override → falls back to strokeColor
    expect(byLayer.ghost).toContain('stroke="#000000"');
  });
});

describe('texture layer ordering', () => {
  const withTexture: FlowLinesResult = {
    width: 100,
    height: 80,
    seed: 1,
    lines: [
      { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], layer: 'present', pen: 'bold' },
      { points: [{ x: 0, y: 40 }, { x: 50, y: 40 }], layer: 'texture' },
    ],
  };

  it('renders the texture layer first (behind) in toSVG with layerColors', () => {
    const svg = toSVG(withTexture, {
      strokeColor: '#000000',
      layerColors: { texture: '#cccccc', present: '#111111' },
    });
    expect(svg.indexOf('stroke="#cccccc"')).toBeLessThan(svg.indexOf('stroke="#111111"'));
  });

  it('orders the texture layer first in toSVGLayers', () => {
    const layers = toSVGLayers(withTexture);
    expect(layers[0].layer).toBe('texture');
  });
});

describe('toSVG per-layer colors', () => {
  it('colors each layer when layerColors is given', () => {
    const svg = toSVG(mixed, {
      strokeColor: '#000000',
      layerColors: { present: '#111111', ghost: '#666666' },
    });
    expect(svg).toContain('stroke="#111111"');
    expect(svg).toContain('stroke="#666666"');
    // trail falls back to strokeColor
    expect(svg).toContain('stroke="#000000"');
  });

  it('is unchanged from a single-color render when layerColors is absent', () => {
    const plain = toSVG(mixed, { strokeColor: '#222222' });
    const explicit = toSVG(mixed, { strokeColor: '#222222', layerColors: undefined });
    expect(explicit).toBe(plain);
    // every stroke is the one color
    expect((plain.match(/stroke="#222222"/g) || []).length).toBe(4);
  });
});
