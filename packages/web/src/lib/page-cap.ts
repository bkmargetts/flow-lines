/**
 * Long-edge pixel budget for the shared page raster. Large formats (A0, 2A0,
 * big custom sheets) would otherwise quadruple the coordinate-space cost of
 * every stroke; capping lowers the effective render density uniformly while
 * `PageMetrics.scale` keeps *physical* stroke spacing — and therefore the
 * plotted drawing — correct. Every pre-large-format sheet stays under the cap
 * at all resolution presets, so existing output is untouched.
 */
import { detectLowMemory } from '../projects/image-ink/ml-scheduler';

const IS_MOBILE =
  typeof navigator !== 'undefined' && /iP(hone|ad|od)|Android/.test(navigator.userAgent);

export function pageLongEdgeCapPx(): number {
  return IS_MOBILE || detectLowMemory() ? 2048 : 4096;
}
