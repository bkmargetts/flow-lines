import { describe, it, expect } from 'vitest';
import { cloneLayer, type Layer } from './LayerStore';

describe('cloneLayer', () => {
  const src: Layer = {
    instanceId: 'flow-field-1-abc',
    moduleId: 'flow-field',
    state: { seed: 7, nested: { depth: 2 } },
    visible: false,
    holdOffMm: 2.5,
    overprint: true,
    transform: {
      dxMm: 3,
      dyMm: 0,
      rotateDeg: 10,
      scale: 1.2,
      echoCopies: 2,
      echoDxMm: 1,
      echoDyMm: 1,
      echoRotateDeg: 0,
      echoScale: 1,
    },
    clip: { sourceId: 'other', mode: 'inside', growMm: 2, expandMm: 0, featherMm: 1 },
    haloOutline: true,
    haloExempt: true,
  };

  it('copies every per-layer field onto a fresh instance', () => {
    const copy = cloneLayer(src);
    expect(copy.instanceId).not.toBe(src.instanceId);
    expect(copy.moduleId).toBe(src.moduleId);
    expect(copy.visible).toBe(false);
    expect(copy.holdOffMm).toBe(2.5);
    expect(copy.overprint).toBe(true);
    expect(copy.transform).toEqual(src.transform);
    expect(copy.clip).toEqual(src.clip);
    expect(copy.haloOutline).toBe(true);
    expect(copy.haloExempt).toBe(true);
  });

  it('deep-copies state and detaches option objects', () => {
    const copy = cloneLayer(src);
    expect(copy.state).toEqual(src.state);
    expect(copy.state).not.toBe(src.state);
    expect((copy.state as { nested: object }).nested).not.toBe(
      (src.state as { nested: object }).nested
    );
    expect(copy.transform).not.toBe(src.transform);
    expect(copy.clip).not.toBe(src.clip);
  });

  it('keeps absent options absent', () => {
    const bare = cloneLayer({
      instanceId: 'x',
      moduleId: 'flow-field',
      state: {},
      visible: true,
      holdOffMm: 0,
      overprint: false,
    });
    expect(bare.transform).toBeUndefined();
    expect(bare.clip).toBeUndefined();
    expect(bare.haloOutline).toBeUndefined();
    expect(bare.haloExempt).toBeUndefined();
  });

  it('covers every Layer key — extend cloneLayer when adding fields', () => {
    // A field added to Layer but not to cloneLayer silently drops off every
    // duplicate. This enumeration forces the pairing to stay in sync.
    expect(Object.keys(cloneLayer(src)).sort()).toEqual(
      [
        'instanceId',
        'moduleId',
        'state',
        'visible',
        'holdOffMm',
        'overprint',
        'transform',
        'clip',
        'haloOutline',
        'haloExempt',
      ].sort()
    );
  });
});
