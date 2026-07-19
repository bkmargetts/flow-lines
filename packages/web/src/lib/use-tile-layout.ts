import { useMemo } from 'react';
import { computeTiling, resolvePaperSize, type TilingLayout, type TilingOptions } from '@flow-lines/core';
import { useFrame, type FrameSettings } from '../FrameContext';
import { usePage } from '../LayerStore';

/** Core tiling options derived from the frame's split settings. */
export function tilingOptionsFromFrame(frame: FrameSettings): TilingOptions {
  return {
    sheet: resolvePaperSize(frame.tileSheet),
    sheetOrientation: frame.tileOrientation,
    marginMm: frame.marginMm,
    perSheetMargin: frame.tilePerSheetMargin,
    overlapMm: frame.tileOverlapMm,
    registrationMarks: frame.tileMarks,
    markOffsetMm: frame.tileMarkOffsetMm,
  };
}

/**
 * The current sheet-split layout, or null when splitting is off. Degenerate
 * margin/overlap combinations (sheet smaller than its margins) surface as
 * `error` instead of a throw, so controls can show a message while the
 * preview and export simply skip the overlay.
 */
export function useTileLayout(): { layout: TilingLayout | null; error: string | null } {
  const { frame } = useFrame();
  const page = usePage();
  return useMemo(() => {
    if (!frame.tileEnabled) return { layout: null, error: null };
    try {
      return { layout: computeTiling(page, tilingOptionsFromFrame(frame)), error: null };
    } catch {
      return { layout: null, error: 'Sheet too small for this margin/overlap' };
    }
  }, [frame, page]);
}
