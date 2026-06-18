import { pageBorder, type FlowLine, type PageMetrics } from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';

/**
 * Build the shared page border for a sheet, or null when it's off. A pure
 * overlay (four ruled edges on their own 'border' pen layer) that never changes
 * where the drawing sits, so adding it can't shift any module's output. The
 * lines should be appended after the drawing and included in the texture's
 * `avoid` set so the texture holds its halo off them too.
 */
export function buildBorder(frame: FrameSettings, page: PageMetrics): FlowLine[] {
  if (!frame.borderEnabled) return [];
  // A negative inset pushes the rule outward into the clear margin (a gap
  // between art and border); clamp so it never leaves the sheet, even if the
  // margin was later reduced below the stored inset.
  const insetMm = Math.max(frame.borderInsetMm, -frame.marginMm);
  return pageBorder({
    width: page.widthPx,
    height: page.heightPx,
    marginPx: frame.marginMm * page.pxPerMm,
    insetPx: insetMm * page.pxPerMm,
    cornerRadiusPx: frame.borderCornerRadiusMm * page.pxPerMm,
  });
}
