import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getPaperSize, pageMetrics } from '@flow-lines/core';
import { useFrame } from './FrameContext';
import { getModule, DEFAULT_MODULE_ID } from './modules/registry';
import type { LayerOutput, LiveModule, RenderEnv, StateUpdate } from './modules/types';
import { composite, type CompositeLayer, type CompositeResult } from './lib/composite';

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
  // A fresh plot starts with one layer of the default module.
  const [layers, setLayers] = useState<Layer[]>(() => [makeLayer(DEFAULT_MODULE_ID)]);
  const [selectedId, setSelectedId] = useState<string>(() => layers[0].instanceId);
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

  const removeLayer = useCallback((instanceId: string) => {
    setLayers((prev) => {
      if (prev.length <= 1) return prev; // a plot always has at least one layer
      const next = prev.filter((l) => l.instanceId !== instanceId);
      setSelectedId((sel) =>
        sel === instanceId ? next[next.length - 1].instanceId : sel
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
      {children}
    </LayerStoreContext.Provider>
  );
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
    () => pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution),
    [frame.paper, frame.orientation, frame.resolution]
  );
}

/**
 * The composited sheet for the whole stack. Pure layers are rendered inside the
 * memo; live layers contribute their published output. Recomputes when any
 * layer's state, the stack shape, a live output, or the frame changes.
 *
 * NOTE: every visible pure layer re-renders whenever this memo recomputes —
 * fine for the common light stack, but a heavy generative layer (lenia) stacked
 * under a frequently-publishing live layer would re-render on each publish. A
 * per-layer render cache keyed by (state, page) is the optimisation if that
 * bites.
 */
export function useComposite(): CompositeResult {
  const { frame } = useFrame();
  const { layers, liveOutputs } = useLayerStore();
  const page = usePage();
  return useMemo(() => {
    const stack: CompositeLayer[] = layers.map((l) => ({
      instanceId: l.instanceId,
      module: getModule(l.moduleId),
      state: l.state,
      visible: l.visible,
      holdOffMm: l.holdOffMm,
      liveOutput: liveOutputs[l.instanceId]?.output ?? null,
    }));
    return composite(frame, page, stack);
  }, [frame, layers, liveOutputs, page]);
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
