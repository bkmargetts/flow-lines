import { describe, it, expect } from 'vitest';
import { snapshotToStack, type SnapshotLayer } from './composite-protocol';

/**
 * The failure mode this pins: a per-layer option added to `Layer` and the
 * compositor but not threaded through the snapshot → the feature works in the
 * synchronous fallback and silently dies in the worker. Every field on
 * `SnapshotLayer` must survive `snapshotToStack`.
 */
describe('snapshotToStack', () => {
  it('round-trips every per-layer field, absent options staying absent', () => {
    const full: SnapshotLayer = {
      instanceId: 'a',
      moduleId: 'flow-field',
      kind: 'pure',
      state: { seed: 7 },
      visible: true,
      holdOffMm: 1.5,
      overprint: false,
      transform: {
        dxMm: 3,
        dyMm: -2,
        rotateDeg: 15,
        scale: 1.1,
        echoCopies: 3,
        echoDxMm: 1,
        echoDyMm: 1,
        echoRotateDeg: 0,
        echoScale: 1,
      },
      clip: { sourceId: 'b', mode: 'outside', growMm: 2, expandMm: -1, featherMm: 0.5 },
      haloOutline: true,
      haloExempt: true,
      liveOutput: null,
    };
    const bare: SnapshotLayer = {
      instanceId: 'b',
      moduleId: 'classic',
      kind: 'pure',
      state: {},
      visible: true,
      holdOffMm: 0,
      overprint: false,
      liveOutput: null,
    };

    const [a, b] = snapshotToStack([full, bare]);

    expect(a.instanceId).toBe('a');
    expect(a.state).toEqual({ seed: 7 });
    expect(a.holdOffMm).toBe(1.5);
    expect(a.transform).toEqual(full.transform);
    expect(a.clip).toEqual(full.clip);
    expect(a.haloOutline).toBe(true);
    expect(a.haloExempt).toBe(true);

    expect(b.transform).toBeUndefined();
    expect(b.clip).toBeUndefined();
    expect(b.haloOutline).toBeUndefined();
    expect(b.haloExempt).toBeUndefined();
  });

  it('maps live layers to the live module marker without state', () => {
    const live: SnapshotLayer = {
      instanceId: 'ink',
      moduleId: 'image-ink',
      kind: 'live',
      visible: true,
      holdOffMm: 2,
      overprint: false,
      haloOutline: true,
      liveOutput: { lines: [], strokeColor: '#111', strokeWidthPx: 1 },
    };
    const [l] = snapshotToStack([live]);
    expect(l.module).toEqual({ kind: 'live' });
    expect(l.haloOutline).toBe(true);
    expect(l.liveOutput).toBe(live.liveOutput);
  });
});
