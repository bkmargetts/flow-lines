import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFrame, type FrameSettings } from './FrameContext';
import { useLayerStore, type Layer } from './LayerStore';
import {
  createHistory,
  commit,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
  createRecorder,
  type History,
  type Recorder,
} from './lib/history';

/**
 * One shared linear undo history for the whole plot: the layer stack and the
 * page frame together, so Ctrl+Z is never ambiguous about which store it
 * hits. Snapshots are plain references — both stores update immutably, so
 * fifty entries share almost all of their structure.
 *
 * Recording is observational: rather than wrapping every store mutation, an
 * effect watches `layers`/`frame` and commits after a quiet period, which
 * coalesces a slider drag's burst of updates into a single entry for free.
 * Layer *selection* is captured in snapshots but never triggers a commit —
 * clicking around the stack shouldn't pollute history, yet undoing a remove
 * still restores what was selected.
 *
 * Deliberately outside history: `liveOutputs` (derived render output) and
 * image-ink's photo/ML data (local to the live hook — so undoing an image
 * layer's *deletion* restores its settings but the photo needs re-uploading;
 * keeping ghost hosts alive would pin bitmaps for every history entry).
 */

interface Snapshot {
  layers: Layer[];
  selectedId: string;
  frame: FrameSettings;
}

interface HistoryContextValue {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

const timers = {
  set: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
  clear: (id: unknown) => window.clearTimeout(id as number),
};

export function HistoryProvider({ children }: { children: ReactNode }) {
  const { frame, restoreFrame } = useFrame();
  const { layers, selectedId, restoreLayers } = useLayerStore();

  // The history lives in a ref — commits during a drag must not re-render
  // the app. A version counter refreshes canUndo/canRedo for the buttons.
  const historyRef = useRef<History<Snapshot> | null>(null);
  if (historyRef.current === null) {
    historyRef.current = createHistory<Snapshot>({ layers, selectedId, frame });
  }
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const recorderRef = useRef<Recorder<Snapshot> | null>(null);
  if (recorderRef.current === null) {
    recorderRef.current = createRecorder<Snapshot>((snap) => {
      historyRef.current = commit(historyRef.current!, snap);
      bump();
    }, timers);
  }

  // Selection rides along in snapshots without being a change trigger.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // After a restore, the observed `layers`/`frame` change is the restore
  // itself — it must not be recorded as a fresh edit.
  const restoredRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const restored = restoredRef.current;
    if (restored && restored.layers === layers && restored.frame === frame) {
      restoredRef.current = null;
      return;
    }
    const present = historyRef.current!.present;
    if (present.layers === layers && present.frame === frame) return;
    recorderRef.current!.report({
      layers,
      selectedId: selectedIdRef.current,
      frame,
    });
  }, [layers, frame]);

  const restore = useCallback(
    (snap: Snapshot) => {
      restoredRef.current = snap;
      restoreLayers(snap.layers, snap.selectedId);
      restoreFrame(snap.frame);
      bump();
    },
    [restoreLayers, restoreFrame, bump]
  );

  const undo = useCallback(() => {
    // A drag followed by an immediate Ctrl+Z undoes the whole drag: commit
    // the pending burst first, then step back over it.
    recorderRef.current!.flush();
    const h = historyRef.current!;
    if (!canUndo(h)) return;
    historyRef.current = undoHistory(h);
    restore(historyRef.current.present);
  }, [restore]);

  const redo = useCallback(() => {
    recorderRef.current!.flush();
    const h = historyRef.current!;
    if (!canRedo(h)) return;
    historyRef.current = redoHistory(h);
    restore(historyRef.current.present);
  }, [restore]);

  // Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y). Text fields keep their
  // native editing undo — EditableValue, SeedControl and the hold-off input
  // all live in <input>s.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (key === 'y' || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const value = useMemo<HistoryContextValue>(
    () => ({
      undo,
      redo,
      canUndo: canUndo(historyRef.current!),
      canRedo: canRedo(historyRef.current!),
    }),
    // The version bump (fired by every commit and restore) recreates this
    // object so the buttons' disabled state tracks the stacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [undo, redo, version]
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used within a HistoryProvider');
  return ctx;
}
