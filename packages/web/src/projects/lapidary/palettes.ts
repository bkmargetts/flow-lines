/**
 * Curated pen sets for Lapidary, indexed pen 0..n (unlike the landscape's
 * semantic roles — here every pen draws every texture, interleaved). Each
 * palette carries its own pen count: picking one decides how many pens the
 * plot is for. `vein` colours the kintsugi accent layer when veins are on.
 * The CLI mirrors this table in packages/cli/src/palettes.ts — keep the two
 * in sync.
 */
export interface LapidaryPalette {
  id: string;
  label: string;
  inks: string[]; // 1..4 hexes, pen 0 first
  vein: string;
}

export const CUSTOM_PALETTE = 'custom';

export const LAPIDARY_PALETTES: LapidaryPalette[] = [
  { id: 'specimen', label: 'Black & orange', inks: ['#1f1f1d', '#d4551a'], vein: '#b8860b' },
  { id: 'indigo-vermilion', label: 'Indigo & vermilion', inks: ['#1f3a5f', '#c3401f'], vein: '#b8860b' },
  { id: 'graphite-rust-teal', label: 'Graphite, rust & teal', inks: ['#2a2a26', '#8a3324', '#1f6f6a'], vein: '#b8860b' },
  { id: 'garden', label: 'Garden', inks: ['#3d5a28', '#c3401f', '#5a4a7f'], vein: '#b8860b' },
  { id: 'midnight-gold', label: 'Midnight & gold', inks: ['#20243f', '#b8860b'], vein: '#b8860b' },
  { id: 'mono', label: 'Single ink', inks: ['#1f1f1d'], vein: '#b8860b' },
];

export function getLapidaryPalette(id: string): LapidaryPalette | null {
  return LAPIDARY_PALETTES.find((p) => p.id === id) ?? null;
}
