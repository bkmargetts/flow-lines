import { describe, it, expect } from 'vitest';
import { PEN_INK_STYLES, resolvePenInkStyle } from './pen-ink/index.js';

describe('pen-ink artist styles', () => {
  it('registers every style under its own id', () => {
    for (const [id, style] of Object.entries(PEN_INK_STYLES)) {
      expect(style.id).toBe(id);
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.description.length).toBeGreaterThan(0);
      expect(Object.keys(style.options).length).toBeGreaterThan(0);
    }
  });

  it('resolves a style to its option bundle', () => {
    const resolved = resolvePenInkStyle('comic');
    expect(resolved).toEqual(PEN_INK_STYLES.comic.options);
    // A fresh object — mutating the resolution must not touch the style
    resolved.layers = 99;
    expect(PEN_INK_STYLES.comic.options.layers).not.toBe(99);
  });

  it('lets explicit overrides win, but only where actually set', () => {
    const resolved = resolvePenInkStyle('comic', {
      wobble: 2,
      valueBands: undefined,
    });
    expect(resolved.wobble).toBe(2);
    // undefined override must not clobber the style's choice
    expect(resolved.valueBands).toBe(PEN_INK_STYLES.comic.options.valueBands);
  });

  it('throws on an unknown style id, naming the known ones', () => {
    expect(() => resolvePenInkStyle('vaporwave')).toThrow(/comic/);
  });

  it('comic ink is a two-value world with solid blacks', () => {
    const o = PEN_INK_STYLES.comic.options;
    expect(o.valueBands).toBe(2);
    expect(o.solidBlacks).toBe(true);
    expect(o.textureStrokes).toBe(0);
  });
});
