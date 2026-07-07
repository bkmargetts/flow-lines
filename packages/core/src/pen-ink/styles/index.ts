import type { PenInkOptions } from '../options.js';
import type { PenInkStyle } from './types.js';
import { COMIC_STYLE } from './comic.js';
import { DORE_STYLE } from './dore.js';
import { BALLPOINT_STYLE } from './ballpoint.js';
import { SUMIE_STYLE } from './sumie.js';

export type { PenInkStyle } from './types.js';

/** The artist styles, keyed by id */
export const PEN_INK_STYLES: Record<string, PenInkStyle> = {
  [COMIC_STYLE.id]: COMIC_STYLE,
  [DORE_STYLE.id]: DORE_STYLE,
  [BALLPOINT_STYLE.id]: BALLPOINT_STYLE,
  [SUMIE_STYLE.id]: SUMIE_STYLE,
};

/**
 * Resolve a style id plus explicit user overrides into render options.
 * Overrides win over the style, but only where actually set — undefined
 * fields must not clobber the style's choices.
 */
export function resolvePenInkStyle(
  id: string,
  overrides: Partial<PenInkOptions> = {}
): Partial<PenInkOptions> {
  const style = PEN_INK_STYLES[id];
  if (!style) {
    throw new Error(
      `Unknown pen-ink style "${id}" (available: ${Object.keys(PEN_INK_STYLES).join(', ')})`
    );
  }
  const resolved: Partial<PenInkOptions> = { ...style.options };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (resolved as Record<string, unknown>)[key] = value;
    }
  }
  return resolved;
}
