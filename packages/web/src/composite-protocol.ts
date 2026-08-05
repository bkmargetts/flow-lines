import type { PageMetrics } from '@flow-lines/core';
import type { FrameSettings } from './FrameContext';
import type { LayerOutput } from './modules/types';
import { RENDERERS } from './modules/render-registry';
import type { CompositeLayer, LayerClipState, LayerTransformState } from './lib/composite';

/**
 * The wire format between the composite client and worker: a fully
 * serializable snapshot of the layer stack, rehydrated into compositor layers
 * via the render registry on whichever side actually composites (the worker,
 * or the client's synchronous fallback).
 */

/** One layer of a serializable stack snapshot. `state` is omitted for live
 *  layers — the compositor never renders them, it takes their published
 *  `liveOutput` — so live-module state never needs to be cloneable. */
export interface SnapshotLayer {
  instanceId: string;
  moduleId: string;
  kind: 'pure' | 'live';
  state?: unknown;
  visible: boolean;
  holdOffMm: number;
  overprint: boolean;
  // Combination options — optional so absent stays absent across the wire
  // (an option dropped here would silently die in the worker; the round-trip
  // test in composite-protocol.test.ts pins the pass-through).
  transform?: LayerTransformState;
  clip?: LayerClipState;
  haloOutline?: boolean;
  haloExempt?: boolean;
  liveOutput: LayerOutput | null;
}

export interface CompositeSnapshot {
  frame: FrameSettings;
  page: PageMetrics;
  layers: SnapshotLayer[];
}

/** Rehydrate a snapshot into compositor layers via the render registry. */
export function snapshotToStack(layers: SnapshotLayer[]): CompositeLayer[] {
  return layers.map((l) => ({
    instanceId: l.instanceId,
    module:
      l.kind === 'live'
        ? { kind: 'live' as const }
        : { kind: 'pure' as const, ...RENDERERS[l.moduleId] },
    state: l.state,
    visible: l.visible,
    holdOffMm: l.holdOffMm,
    overprint: l.overprint,
    transform: l.transform,
    clip: l.clip,
    haloOutline: l.haloOutline,
    haloExempt: l.haloExempt,
    liveOutput: l.liveOutput,
  }));
}
