/**
 * Colour palettes for the Complex Flow project. On a pen plotter colour is
 * realised as separate pen layers: each streamline carries a `band-NN` layer,
 * and `buildPaletteLayerColors` samples a named ramp into the
 * `SVGOptions.layerColors` record (`{ 'band-00': hex, … }`) used by `toSVG`
 * (preview) and `toSVGLayers` (one SVG per pen).
 */

export interface PaletteDef {
  id: string;
  label: string;
  /** Best on a dark or a light ground (for the preview swatch hint). */
  ground: 'dark' | 'light' | 'either';
  ramp: string[];
}

export const PALETTES: PaletteDef[] = [
  {
    id: 'spectral',
    label: 'Spectral',
    ground: 'dark',
    ramp: ['#d7263d', '#f46036', '#ffd23f', '#1b998b', '#3a86ff', '#2e294e'],
  },
  {
    id: 'ice',
    label: 'Ice',
    ground: 'dark',
    ramp: ['#caf0f8', '#90e0ef', '#48cae4', '#0096c7', '#0077b6', '#023e8a'],
  },
  {
    id: 'ember',
    label: 'Ember',
    ground: 'dark',
    ramp: ['#ffba08', '#faa307', '#f48c06', '#e85d04', '#dc2f02', '#9d0208'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    ground: 'either',
    ramp: ['#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600'],
  },
  {
    id: 'forest',
    label: 'Forest',
    ground: 'light',
    ramp: ['#1b4332', '#2d6a4f', '#40916c', '#74c69d', '#b7e4c7'],
  },
  {
    id: 'ink',
    label: 'Ink (warm greys)',
    ground: 'light',
    ramp: ['#111111', '#3a3a3a', '#6b6b6b', '#8a7f72', '#b8a999'],
  },
  {
    id: 'riso',
    label: 'Riso (black + red)',
    ground: 'light',
    ramp: ['#111111', '#e2231a'],
  },
  {
    id: 'mono',
    label: 'Mono (single pen)',
    ground: 'either',
    ramp: ['#111111'],
  },
  {
    id: 'custom',
    label: 'Custom…',
    ground: 'either',
    ramp: ['#111111', '#e2231a'],
  },
];

export const CUSTOM_PALETTE_ID = 'custom';

const PALETTE_BY_ID = new Map(PALETTES.map((p) => [p.id, p]));

/** The export layer name for band index i (zero-padded so layers sort in order). */
export const bandLayerName = (i: number): string => `band-${String(i).padStart(2, '0')}`;

/** Pad or trim a custom ramp to exactly `count` colours, repeating the last. */
export function padRamp(ramp: string[] | undefined, count: number): string[] {
  const base = ramp && ramp.length > 0 ? ramp : PALETTE_BY_ID.get(CUSTOM_PALETTE_ID)!.ramp;
  const out: string[] = [];
  for (let i = 0; i < Math.max(1, count); i++) out.push(base[Math.min(i, base.length - 1)]);
  return out;
}

/**
 * Sample a palette ramp into `{ 'band-00': hex, … }` for `layerCount` bands.
 * A single-colour ramp ('mono') maps every band to one ink — a true one-pen
 * plot. The 'custom' palette maps each band directly to the matching entry of
 * `customRamp` (repeating the last if short), so the user picks every ink.
 */
export function buildPaletteLayerColors(
  paletteId: string,
  layerCount: number,
  customRamp?: string[]
): Record<string, string> {
  const n = Math.max(1, layerCount);
  const out: Record<string, string> = {};
  if (paletteId === CUSTOM_PALETTE_ID) {
    const ramp = padRamp(customRamp, n);
    for (let i = 0; i < n; i++) out[bandLayerName(i)] = ramp[i];
    return out;
  }
  const ramp = (PALETTE_BY_ID.get(paletteId) ?? PALETTES[0]).ramp;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    out[bandLayerName(i)] = ramp[Math.round(t * (ramp.length - 1))];
  }
  return out;
}
