import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolvePaperSize, pageMetrics } from '@flow-lines/core';
import { useFrame } from './FrameContext';
import { pageLongEdgeCapPx } from './lib/page-cap';
import { getModule } from './modules/registry';
import type { LayerOutput, LiveModule, RenderEnv, StateUpdate } from './modules/types';
import { composite, type CompositeResult } from './lib/composite';
import { requestComposite, SUPERSEDED, type SnapshotLayer } from './composite-client';

/** The most layers a single plot may stack — "a reasonable number". */
export const MAX_LAYERS = 8;

/** One layer in the stack. `state` is the layer's module state (a fresh
 *  `defaultState()` at birth). Array order is bottom→top. */
export interface Layer {
  instanceId: string;
  moduleId: string;
  state: unknown;
  visible: boolean;
  /** Clean-paper sliver reserved around layers above, in mm (0 = independent). */
  holdOffMm: number;
}

interface LiveEntry {
  output: LayerOutput | null;
  busy: boolean;
}

interface LayerStoreValue {
  layers: Layer[];
  selectedId: string;
  liveOutputs: Record<string, LiveEntry>;
  addLayer: (moduleId: string) => void;
  duplicateLayer: (instanceId: string) => void;
  removeLayer: (instanceId: string) => void;
  reorderLayer: (from: number, to: number) => void;
  selectLayer: (instanceId: string) => void;
  setVisible: (instanceId: string, visible: boolean) => void;
  setHoldOff: (instanceId: string, mm: number) => void;
  updateState: (instanceId: string, update: StateUpdate<unknown>) => void;
  publishOutput: (instanceId: string, output: LayerOutput | null, busy: boolean) => void;
  canAdd: boolean;
}

const LayerStoreContext = createContext<LayerStoreValue | null>(null);

let counter = 0;
function newInstanceId(moduleId: string): string {
  counter += 1;
  return `${moduleId}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeLayer(moduleId: string): Layer {
  return {
    instanceId: newInstanceId(moduleId),
    moduleId,
    state: getModule(moduleId).defaultState(),
    visible: true,
    holdOffMm: 0,
  };
}

export function LayerStoreProvider({ children }: { children: ReactNode }) {
  // A fresh plot starts empty — the user adds the layers they want.
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [liveOutputs, setLiveOutputs] = useState<Record<string, LiveEntry>>({});

  const addLayer = useCallback((moduleId: string) => {
    setLayers((prev) => {
      if (prev.length >= MAX_LAYERS) return prev;
      const layer = makeLayer(moduleId);
      setSelectedId(layer.instanceId);
      // New layers sit on top of the stack (end of the array).
      return [...prev, layer];
    });
  }, []);

  // Clone a layer directly above its source — the copy overprints the
  // original, ready for the tiny change (new seed, offset ink, nudged knob)
  // that makes echo/misregistration stacks. State is deep-copied so the two
  // layers can drift apart; live-module state may hold non-cloneable data
  // (bitmaps), where a shallow copy is fine — updates always patch into a
  // fresh object, they never mutate in place.
  const duplicateLayer = useCallback((instanceId: string) => {
    setLayers((prev) => {
      if (prev.length >= MAX_LAYERS) return prev;
      const index = prev.findIndex((l) => l.instanceId === instanceId);
      if (index < 0) return prev;
      const src = prev[index];
      let state: unknown;
      try {
        state = structuredClone(src.state);
      } catch {
        state = { ...(src.state as object) };
      }
      const copy: Layer = {
        instanceId: newInstanceId(src.moduleId),
        moduleId: src.moduleId,
        state,
        visible: src.visible,
        holdOffMm: src.holdOffMm,
      };
      setSelectedId(copy.instanceId);
      const next = prev.slice();
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  const removeLayer = useCallback((instanceId: string) => {
    setLayers((prev) => {
      const next = prev.filter((l) => l.instanceId !== instanceId);
      // Reselect the new top layer, or clear the selection if the stack is empty.
      setSelectedId((sel) =>
        sel === instanceId ? (next.length ? next[next.length - 1].instanceId : '') : sel
      );
      return next;
    });
    setLiveOutputs((prev) => {
      if (!(instanceId in prev)) return prev;
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });
  }, []);

  const reorderLayer = useCallback((from: number, to: number) => {
    setLayers((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length || from === to) {
        return prev;
      }
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const selectLayer = useCallback((instanceId: string) => setSelectedId(instanceId), []);

  const setVisible = useCallback((instanceId: string, visible: boolean) => {
    setLayers((prev) =>
      prev.map((l) => (l.instanceId === instanceId ? { ...l, visible } : l))
    );
  }, []);

  const setHoldOff = useCallback((instanceId: string, mm: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.instanceId === instanceId ? { ...l, holdOffMm: mm } : l))
    );
  }, []);

  const updateState = useCallback((instanceId: string, update: StateUpdate<unknown>) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.instanceId !== instanceId) return l;
        const patch =
          typeof update === 'function'
            ? (update as (current: unknown) => object)(l.state)
            : update;
        return { ...l, state: { ...(l.state as object), ...(patch as object) } };
      })
    );
  }, []);

  const publishOutput = useCallback(
    (instanceId: string, output: LayerOutput | null, busy: boolean) => {
      setLiveOutputs((prev) => {
        const cur = prev[instanceId];
        if (cur && cur.output === output && cur.busy === busy) return prev;
        return { ...prev, [instanceId]: { output, busy } };
      });
    },
    []
  );

  const value = useMemo<LayerStoreValue>(
    () => ({
      layers,
      selectedId,
      liveOutputs,
      addLayer,
      duplicateLayer,
      removeLayer,
      reorderLayer,
      selectLayer,
      setVisible,
      setHoldOff,
      updateState,
      publishOutput,
      canAdd: layers.length < MAX_LAYERS,
    }),
    [
      layers,
      selectedId,
      liveOutputs,
      addLayer,
      duplicateLayer,
      removeLayer,
      reorderLayer,
      selectLayer,
      setVisible,
      setHoldOff,
      updateState,
      publishOutput,
    ]
  );

  return (
    <LayerStoreContext.Provider value={value}>
      {/* Hidden hosts for live modules (image-ink): they own their workers/ML
          and publish their lines, staying mounted while the layer exists so
          selecting another layer never tears down in-progress work. */}
      {layers
        .filter((l) => getModule(l.moduleId).kind === 'live')
        .map((l) => (
          <LiveInstanceHost key={l.instanceId} instanceId={l.instanceId} />
        ))}
      <CompositeHost>{children}</CompositeHost>
    </LayerStoreContext.Provider>
  );
}

interface CompositeState {
  comp: CompositeResult;
  busy: boolean;
}

const CompositeContext = createContext<CompositeState | null>(null);

/**
 * Composites the whole stack off the main thread and shares the result with
 * every consumer. One host per app, so the worker sees a single latest-wins
 * request stream (two independent consumers would supersede each other), and
 * heavy pure layers (lenia, physarum) render once per change — not once per
 * consumer, as the old per-component `useMemo` did — without freezing the UI.
 * The previous sheet stays visible while a new one renders (`busy`).
 */
function CompositeHost({ children }: { children: ReactNode }) {
  const { frame } = useFrame();
  const { layers, liveOutputs } = useLayerStore();
  const page = usePage();
  // Border-only empty sheet until the first worker result lands — cheap.
  const [comp, setComp] = useState<CompositeResult>(() => composite(frame, page, []));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    const snapshot: SnapshotLayer[] = layers.map((l) => {
      const kind = getModule(l.moduleId).kind;
      return {
        instanceId: l.instanceId,
        moduleId: l.moduleId,
        kind,
        // Live layers composite from their published lines; their state may
        // hold non-cloneable data (bitmaps) and must not cross the wire.
        ...(kind === 'pure' ? { state: l.state } : {}),
        visible: l.visible,
        holdOffMm: l.holdOffMm,
        liveOutput: liveOutputs[l.instanceId]?.output ?? null,
      };
    });
    requestComposite({ frame, page, layers: snapshot }).then(
      (result) => {
        if (!alive) return;
        setComp(result);
        setBusy(false);
      },
      (err) => {
        // Superseded → a newer request is already in flight and will clear
        // `busy`; anything else means a module render threw — keep the last
        // good sheet and stop showing busy.
        if (!alive || err === SUPERSEDED) return;
        console.error('composite failed:', err);
        setBusy(false);
      }
    );
    return () => {
      alive = false;
    };
  }, [frame, layers, liveOutputs, page]);

  const value = useMemo(() => ({ comp, busy }), [comp, busy]);
  return <CompositeContext.Provider value={value}>{children}</CompositeContext.Provider>;
}

/** Drives one live module instance's hook so it can publish its lines. Renders
 *  nothing; mounted once per live layer, keyed by instanceId. */
function LiveInstanceHost({ instanceId }: { instanceId: string }) {
  const store = useLayerStore();
  const env = useRenderEnv();
  const layer = store.layers.find((l) => l.instanceId === instanceId);
  const mod = layer ? (getModule(layer.moduleId) as LiveModule) : null;
  // Hooks must run unconditionally; a live layer always has a module.
  mod?.useInstance({
    instanceId,
    state: layer!.state,
    env,
    selected: store.selectedId === instanceId,
    update: (u) => store.updateState(instanceId, u),
    publish: (output, busy) => store.publishOutput(instanceId, output, busy),
  });
  return null;
}

export function useLayerStore(): LayerStoreValue {
  const ctx = useContext(LayerStoreContext);
  if (!ctx) throw new Error('useLayerStore must be used within a LayerStoreProvider');
  return ctx;
}

/** The shared physical page resolved from the frame. */
export function usePage() {
  const { frame } = useFrame();
  return useMemo(
    () =>
      pageMetrics(
        resolvePaperSize(frame.paper),
        frame.orientation,
        frame.resolution,
        pageLongEdgeCapPx()
      ),
    [frame.paper, frame.orientation, frame.resolution]
  );
}

/**
 * The composited sheet for the whole stack, computed off the main thread by
 * `CompositeHost` (latest-wins; pure layers render in the composite worker,
 * live layers contribute their published output). Returns the last settled
 * sheet — while a new one renders, `useCompositeBusy()` reports true.
 */
export function useComposite(): CompositeResult {
  const ctx = useContext(CompositeContext);
  if (!ctx) throw new Error('useComposite must be used within a LayerStoreProvider');
  return ctx.comp;
}

/** True while the stack is compositing a newer sheet than `useComposite()`
 *  currently returns. */
export function useCompositeBusy(): boolean {
  const ctx = useContext(CompositeContext);
  if (!ctx) throw new Error('useCompositeBusy must be used within a LayerStoreProvider');
  return ctx.busy;
}

/** Build a module render env for a live instance to drive its own worker. */
export function useRenderEnv(): RenderEnv {
  const { frame } = useFrame();
  const page = usePage();
  return useMemo(
    () => ({ page, frame, marginPx: frame.marginMm * page.pxPerMm }),
    [frame, page]
  );
}
