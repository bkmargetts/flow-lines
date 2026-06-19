import { describe, it, expect } from 'vitest';
import { getPaperSize, pageMetrics } from '@flow-lines/core';
import { composite, type CompositeLayer } from './composite';
import { defaultFrame } from '../FrameContext';
import type { PureModule } from '../modules/types';

const page = pageMetrics(getPaperSize('a4'), 'portrait', defaultFrame.resolution);

/** A trivial pure module that draws one horizontal line. */
function stripe(id: string, color: string, y: number, x1 = 10, x2 = 200): PureModule<unknown> {
  return {
    kind: 'pure',
    id,
    label: id,
    defaultState: () => ({}),
    Controls: () => null,
    render: () => ({
      lines: [{ points: [{ x: x1, y }, { x: x2, y }], pen: 'fine' }],
      strokeColor: color,
      strokeWidthPx: 1,
    }),
  };
}

function layer(module: PureModule<unknown>, over: Partial<CompositeLayer> = {}): CompositeLayer {
  return {
    instanceId: module.id,
    module,
    state: {},
    visible: true,
    holdOffMm: 0,
    ...over,
  };
}

describe('composite', () => {
  it('namespaces each layer per stack slot and colours them independently', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20)),
      layer(stripe('b', '#00ff00', 40)),
    ]);
    const keys = new Set(result.result.lines.map((l) => l.layer));
    expect(keys.has('L0/fine')).toBe(true);
    expect(keys.has('L1/fine')).toBe(true);
    expect(result.svgOptions.layerColors?.['L0/fine']).toBe('#ff0000');
    expect(result.svgOptions.layerColors?.['L1/fine']).toBe('#00ff00');
  });

  it('renders bottom layer first (explicit stack z-order)', () => {
    const svg = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20)),
      layer(stripe('b', '#00ff00', 40)),
    ]).exportSvg;
    expect(svg.indexOf('stroke="#ff0000"')).toBeLessThan(svg.indexOf('stroke="#00ff00"'));
  });

  it('drops hidden layers from the composite', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20)),
      layer(stripe('b', '#00ff00', 40), { visible: false }),
    ]);
    const keys = new Set(result.result.lines.map((l) => l.layer));
    expect(keys.has('L0/fine')).toBe(true);
    expect(keys.has('L1/fine')).toBe(false);
  });

  it('holds a lower layer off the lines stacked above it', () => {
    // Bottom: a long horizontal line. Top: a vertical line crossing its middle.
    // With hold-off on, the bottom line is trimmed where the top line crosses,
    // splitting it into two fragments.
    const top: PureModule<unknown> = {
      kind: 'pure',
      id: 'top',
      label: 'top',
      defaultState: () => ({}),
      Controls: () => null,
      render: () => ({
        lines: [{ points: [{ x: 105, y: 0 }, { x: 105, y: 200 }], pen: 'fine' }],
        strokeColor: '#000',
        strokeWidthPx: 1,
      }),
    };
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('bottom', '#ff0000', 100, 10, 200), { holdOffMm: 1.5 }),
      layer(top),
    ]);
    const bottomFrags = result.result.lines.filter((l) => l.layer === 'L0/fine');
    expect(bottomFrags.length).toBe(2);
  });

  it('is a clean empty sheet when there are no visible layers', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20), { visible: false }),
    ]);
    expect(result.result.lines.length).toBe(0);
    expect(result.exportSvg).toContain('</svg>');
  });
});
