import { useSyncExternalStore } from 'react';
import type { GrayscaleImage, LabelImage, Point } from '@flow-lines/core';
import type {
  SegmentStatus,
  PortraitStatus,
  DepthStatus,
  LabelStatus,
  PortraitState,
} from './types';
import type { InkLayout } from './live';

/**
 * The mounted live instance owns the heavy per-photo image/ML state, but the
 * sidebar Controls that drive it live in a different part of the React tree and
 * there can be N instances. Rather than thread context through, each mounted
 * instance publishes its live API into a keyed external store; its Controls
 * subscribe by instanceId via `useInstanceApi`.
 *
 * Only the non-settings surface lives here — settings/preset come from the
 * layer state (the Updater), and the SVG/downloads are the compositor's job.
 */
export interface ImageInkApi {
  imageName: string | null;
  onImageFile: (file: File) => void;
  randomizeSeed: () => void;
  sourceImage: GrayscaleImage | null;
  isRendering: boolean;
  inkLayout: InkLayout | null;
  focusPoints: Point[];
  setFocus: (normalized: Point) => void;
  clearFocus: () => void;
  subjectMask: GrayscaleImage | null;
  segmentStatus: SegmentStatus;
  isolateSubject: () => void;
  clearSubjectMask: () => void;
  portraitState: PortraitState | null;
  portraitStatus: PortraitStatus;
  detectFaces: () => void;
  clearPortrait: () => void;
  depthMap: GrayscaleImage | null;
  depthStatus: DepthStatus;
  depthError: string | null;
  estimateDepthMap: () => void;
  clearDepth: () => void;
  labelMap: LabelImage | null;
  labelStatus: LabelStatus;
  labelError: string | null;
  estimateSceneLabels: () => void;
  clearLabels: () => void;
  lowMemory: boolean;
  disableLowMemory: () => void;
}

const apis = new Map<string, ImageInkApi>();
const listeners = new Map<string, Set<() => void>>();

function emit(id: string): void {
  const set = listeners.get(id);
  if (set) for (const fn of set) fn();
}

/** A mounted instance publishes (or refreshes) its API. */
export function setInstanceApi(id: string, api: ImageInkApi): void {
  apis.set(id, api);
  emit(id);
}

/** A mounting instance drops its API (unmount). */
export function clearInstanceApi(id: string): void {
  if (apis.delete(id)) emit(id);
}

/** Subscribe a Controls panel to its instance's live API. Returns null until
 *  the matching instance has mounted and registered. */
export function useInstanceApi(id: string): ImageInkApi | null {
  return useSyncExternalStore(
    (onChange) => {
      let set = listeners.get(id);
      if (!set) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(onChange);
      return () => {
        const s = listeners.get(id);
        if (!s) return;
        s.delete(onChange);
        if (s.size === 0) listeners.delete(id);
      };
    },
    () => apis.get(id) ?? null,
    () => null
  );
}
