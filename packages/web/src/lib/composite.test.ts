import { describe, it, expect } from 'vitest';
import { getPaperSize, pageMetrics } from '@flow-lines/core';
import { composite, compositeLayers, type CompositeLayer } from './composite';
import { defaultFrame } from '../FrameContext';
import { getModule } from '../modules/registry';
import type { PureModule } from '../modules/types';

const page = pageMetrics(getPaperSize('a4'), 'portrait', defaultFrame.resolution);

/** A trivial pure module that draws one horizontal line. */
function stripe(id: string, color: string, y: number, x1 = 10, x2 = 200): PureModule<unknown> {
  return {
    kind: 'pure',
    id,
    label: id,
    category: 'textures',
    description: 'test fixture module for compositing',
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
      category: 'textures',
      description: 'test fixture module for compositing',
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

  it('composites a real generative module (conway) into stroked paths', () => {
    const conway = getModule('conway') as PureModule<unknown>;
    const result = composite({ ...defaultFrame }, page, [
      layer(conway, { instanceId: 'c', state: conway.defaultState() }),
    ]);
    // The generator produced lines, namespaced into this layer's slot.
    expect(result.result.lines.length).toBeGreaterThan(0);
    expect(result.result.lines.every((l) => (l.layer ?? '').startsWith('L0/'))).toBe(true);
    expect(result.exportSvg).toContain('<path');
  });

  it('runs density protection across the whole stack when enabled', () => {
    // Two layers of identical coincident lines; with density on at one pass and
    // a short overlap floor, each layer keeps its own line (per-pen grid) but a
    // single layer's piled duplicates would be trimmed.
    const dense = (id: string): PureModule<unknown> => ({
      kind: 'pure',
      id,
      label: id,
      category: 'textures',
      description: 'test fixture module for compositing',
      defaultState: () => ({}),
      Controls: () => null,
      render: () => ({
        lines: Array.from({ length: 6 }, () => ({
          points: [{ x: 20, y: 60 }, { x: 300, y: 60 }],
          pen: 'fine' as const,
        })),
        strokeColor: '#000',
        strokeWidthPx: 2,
      }),
    });
    const frame = { ...defaultFrame, densityEnabled: true, densityMaxPasses: 1, densityMinOverlapMm: 1 };
    const result = composite(frame, page, [layer(dense('d'), { instanceId: 'd' })]);
    // 6 coincident passes on one pen → only the first survives.
    expect(result.result.lines.filter((l) => l.layer === 'L0/fine').length).toBe(1);
  });

  it('holds a live layer off the lines above it (cheap trim, no re-render)', () => {
    // A live layer publishes a long horizontal line; a pure layer crosses it.
    // Hold-off must trim the live layer's published lines too (the worker is
    // never re-run — the trim is a post-process on the published output).
    const liveMod = {
      kind: 'live' as const,
      id: 'ink',
      label: 'ink',
      category: 'image' as const,
      description: 'test fixture module for compositing',
      defaultState: () => ({}),
      Controls: () => null,
      useInstance: () => {},
    };
    const top: PureModule<unknown> = {
      kind: 'pure',
      id: 'top',
      label: 'top',
      category: 'textures',
      description: 'test fixture module for compositing',
      defaultState: () => ({}),
      Controls: () => null,
      render: () => ({
        lines: [{ points: [{ x: 150, y: 0 }, { x: 150, y: 200 }], pen: 'fine' }],
        strokeColor: '#000',
        strokeWidthPx: 1,
      }),
    };
    const result = composite({ ...defaultFrame }, page, [
      {
        instanceId: 'ink',
        module: liveMod,
        state: {},
        visible: true,
        holdOffMm: 1.5,
        liveOutput: {
          lines: [{ points: [{ x: 10, y: 80 }, { x: 300, y: 80 }], pen: 'fine' }],
          strokeColor: '#000',
          strokeWidthPx: 1,
        },
      },
      layer(top),
    ]);
    expect(result.result.lines.filter((l) => l.layer === 'L0/fine').length).toBe(2);
  });

  it('overprint layers never carve hold-off halos in layers beneath', () => {
    // Same geometry as the hold-off split test, but the crossing top layer
    // overprints — the bottom line must stay whole.
    const top: PureModule<unknown> = {
      kind: 'pure',
      id: 'top',
      label: 'top',
      category: 'textures',
      description: 'test fixture module for compositing',
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
      layer(top, { overprint: true }),
    ]);
    const bottomFrags = result.result.lines.filter((l) => l.layer === 'L0/fine');
    expect(bottomFrags.length).toBe(1);
  });

  it("ignores an overprint layer's own hold-off", () => {
    // The bottom layer asks for a halo *and* overprint: overprint wins, so the
    // crossing top layer doesn't split it.
    const top: PureModule<unknown> = {
      kind: 'pure',
      id: 'top',
      label: 'top',
      category: 'textures',
      description: 'test fixture module for compositing',
      defaultState: () => ({}),
      Controls: () => null,
      render: () => ({
        lines: [{ points: [{ x: 105, y: 0 }, { x: 105, y: 200 }], pen: 'fine' }],
        strokeColor: '#000',
        strokeWidthPx: 1,
      }),
    };
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('bottom', '#ff0000', 100, 10, 200), { holdOffMm: 1.5, overprint: true }),
      layer(top),
    ]);
    expect(result.result.lines.filter((l) => l.layer === 'L0/fine').length).toBe(1);
  });

  it('previews overprint layers with multiply blend, but never in per-pen files', () => {
    const stack = [
      layer(stripe('a', '#ff0000', 20)),
      layer(stripe('b', '#00ff00', 40), { overprint: true }),
    ];
    const on = composite({ ...defaultFrame }, page, stack);
    expect(on.exportSvg).toContain('mix-blend-mode:multiply');
    // Only the overprint layer's pen blends.
    expect(on.svgOptions.layerBlend?.['L1/fine']).toBe('multiply');
    expect(on.svgOptions.layerBlend?.['L0/fine']).toBeUndefined();
    // Per-pen plotter files stay unstyled.
    for (const { svg } of compositeLayers(on)) {
      expect(svg).not.toContain('mix-blend-mode');
    }

    const off = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20)),
      layer(stripe('b', '#00ff00', 40)),
    ]);
    expect(off.exportSvg).not.toContain('mix-blend-mode');
  });

  it('is a clean empty sheet when there are no visible layers', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20), { visible: false }),
    ]);
    expect(result.result.lines.length).toBe(0);
    expect(result.exportSvg).toContain('</svg>');
  });

  /** A module drawing a dense hatch block spanning x∈[80,160], y∈[80,160]. */
  function block(id: string): PureModule<unknown> {
    return {
      kind: 'pure',
      id,
      label: id,
      category: 'textures',
      description: 'test fixture module for compositing',
      defaultState: () => ({}),
      Controls: () => null,
      render: () => ({
        lines: Array.from({ length: 21 }, (_, i) => ({
          points: [{ x: 80, y: 80 + i * 4 }, { x: 160, y: 80 + i * 4 }],
          pen: 'fine' as const,
        })),
        strokeColor: '#000',
        strokeWidthPx: 1,
      }),
    };
  }

  const spanOf = (lines: { points: { x: number }[] }[]): [number, number] => {
    const xs = lines.flatMap((l) => l.points.map((p) => p.x));
    return [Math.min(...xs), Math.max(...xs)];
  };

  it('clips a layer inside another layer\'s shape', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('probe', '#ff0000', 120, 0, 400), {
        clip: { sourceId: 'shape', mode: 'inside', growMm: 2, expandMm: 0, featherMm: 0 },
      }),
      layer(block('shape'), { instanceId: 'shape' }),
    ]);
    const probe = result.result.lines.filter((l) => l.layer === 'L0/fine');
    expect(probe.length).toBe(1);
    const [min, max] = spanOf(probe);
    expect(min).toBeGreaterThan(40);
    expect(max).toBeLessThan(200);
  });

  it('clips outside, keeping the flanking runs', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('probe', '#ff0000', 120, 0, 400), {
        clip: { sourceId: 'shape', mode: 'outside', growMm: 2, expandMm: 0, featherMm: 0 },
      }),
      layer(block('shape'), { instanceId: 'shape' }),
    ]);
    const probe = result.result.lines.filter((l) => l.layer === 'L0/fine');
    expect(probe.length).toBe(2);
  });

  it('resolves the clip source by instanceId regardless of stack order', () => {
    // Shape below, probe above — the source needn't be stacked above.
    const result = composite({ ...defaultFrame }, page, [
      layer(block('shape'), { instanceId: 'shape' }),
      layer(stripe('probe', '#ff0000', 120, 0, 400), {
        clip: { sourceId: 'shape', mode: 'inside', growMm: 2, expandMm: 0, featherMm: 0 },
      }),
    ]);
    const probe = result.result.lines.filter((l) => l.layer === 'L1/fine');
    expect(probe.length).toBe(1);
    expect(spanOf(probe)[1]).toBeLessThan(200);
  });

  it('leaves a layer unclipped when its source is hidden or missing', () => {
    const hidden = composite({ ...defaultFrame }, page, [
      layer(stripe('probe', '#ff0000', 120, 0, 400), {
        clip: { sourceId: 'shape', mode: 'inside', growMm: 2, expandMm: 0, featherMm: 0 },
      }),
      layer(block('shape'), { instanceId: 'shape', visible: false }),
    ]);
    const probe = hidden.result.lines.filter((l) => l.layer === 'L0/fine');
    expect(probe.length).toBe(1);
    expect(spanOf(probe)).toEqual([0, 400]);

    const missing = composite({ ...defaultFrame }, page, [
      layer(stripe('probe', '#ff0000', 120, 0, 400), {
        clip: { sourceId: 'gone', mode: 'inside', growMm: 2, expandMm: 0, featherMm: 0 },
      }),
    ]);
    expect(spanOf(missing.result.lines.filter((l) => l.layer === 'L0/fine'))).toEqual([0, 400]);
  });

  it('ignores a self-referencing clip', () => {
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('probe', '#ff0000', 120, 0, 400), {
        instanceId: 'probe',
        clip: { sourceId: 'probe', mode: 'inside', growMm: 2, expandMm: 0, featherMm: 0 },
      }),
    ]);
    expect(spanOf(result.result.lines.filter((l) => l.layer === 'L0/fine'))).toEqual([0, 400]);
  });

  it('translates a layer by its transform (mm → px)', () => {
    const t = {
      dxMm: 10, dyMm: 0, rotateDeg: 0, scale: 1,
      echoCopies: 1, echoDxMm: 0, echoDyMm: 0, echoRotateDeg: 0, echoScale: 1,
    };
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20, 10, 200), { transform: t }),
    ]);
    const [min, max] = spanOf(result.result.lines.filter((l) => l.layer === 'L0/fine'));
    expect(min).toBeCloseTo(10 + 10 * page.pxPerMm, 6);
    expect(max).toBeCloseTo(200 + 10 * page.pxPerMm, 6);
  });

  it('echoes a layer into N copies on the same pen', () => {
    const t = {
      dxMm: 0, dyMm: 0, rotateDeg: 0, scale: 1,
      echoCopies: 3, echoDxMm: 2, echoDyMm: 0, echoRotateDeg: 0, echoScale: 1,
    };
    const result = composite({ ...defaultFrame }, page, [
      layer(stripe('a', '#ff0000', 20), { transform: t }),
    ]);
    const copies = result.result.lines.filter((l) => l.layer === 'L0/fine');
    expect(copies.length).toBe(3);
    const ys = new Set(copies.map((l) => l.points[0].y));
    expect(ys.size).toBe(1); // dx-only echo keeps y
  });

  it('halo-exempt layers never carve halos in layers beneath', () => {
    // Mirror of the overprint test: the crossing top layer is halo-exempt,
    // so the holding-off bottom stripe stays whole.
    const top: PureModule<unknown> = {
      kind: 'pure',
      id: 'top',
      label: 'top',
      category: 'textures',
      description: 'test fixture module for compositing',
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
      layer(top, { haloExempt: true }),
    ]);
    expect(result.result.lines.filter((l) => l.layer === 'L0/fine').length).toBe(1);
    // Unlike overprint, exemption doesn't force a multiply preview.
    expect(result.svgOptions.layerBlend?.['L1/fine']).toBeUndefined();
  });

  it('emits a halo outline pen only while holding off', () => {
    const on = composite({ ...defaultFrame }, page, [
      layer(block('bottom'), { instanceId: 'bottom', holdOffMm: 2, haloOutline: true }),
      layer(stripe('top', '#000', 120, 0, 400)),
    ]);
    const outline = on.result.lines.filter((l) => l.layer === 'L0/halo');
    expect(outline.length).toBeGreaterThan(0);
    // The outline inherits the layer's ink.
    expect(on.svgOptions.layerColors?.['L0/halo']).toBe('#000');

    const off = composite({ ...defaultFrame }, page, [
      layer(block('bottom'), { instanceId: 'bottom', haloOutline: true }),
      layer(stripe('top', '#000', 120, 0, 400)),
    ]);
    expect(off.result.lines.filter((l) => l.layer === 'L0/halo').length).toBe(0);
  });

  it('still trims a transformed consumesAvoid module (generic fallback)', () => {
    // A consumesAvoid module that ignores env.avoid entirely: with a
    // transform active it must NOT be trusted to reserve the halo natively —
    // the generic post-transform trim splits its line.
    const texture: PureModule<unknown> = {
      kind: 'pure',
      id: 'tex',
      label: 'tex',
      category: 'textures',
      description: 'test fixture module for compositing',
      consumesAvoid: true,
      defaultState: () => ({}),
      Controls: () => null,
      render: () => ({
        lines: [{ points: [{ x: 10, y: 100 }, { x: 200, y: 100 }], pen: 'fine' }],
        strokeColor: '#000',
        strokeWidthPx: 1,
      }),
    };
    const t = {
      dxMm: 1, dyMm: 0, rotateDeg: 0, scale: 1,
      echoCopies: 1, echoDxMm: 0, echoDyMm: 0, echoRotateDeg: 0, echoScale: 1,
    };
    const cross: PureModule<unknown> = {
      ...stripe('cross', '#000', 0),
      render: () => ({
        lines: [{ points: [{ x: 110, y: 0 }, { x: 110, y: 200 }], pen: 'fine' }],
        strokeColor: '#000',
        strokeWidthPx: 1,
      }),
    };
    const result = composite({ ...defaultFrame }, page, [
      layer(texture, { holdOffMm: 1.5, transform: t }),
      layer(cross, { instanceId: 'cross' }),
    ]);
    expect(result.result.lines.filter((l) => l.layer === 'L0/fine').length).toBe(2);
  });
});
