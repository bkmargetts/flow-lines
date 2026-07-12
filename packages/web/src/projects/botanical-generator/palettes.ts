/**
 * Curated botanical ink palettes for the Botanical Generator. Each maps the module's
 * pen layers (stem/cane, leaf, vein, flower, shadow) to an ink, so a plot uses
 * one pen per layer — multi-pen but still plottable. `custom` defers to the
 * per-element colour pickers in the Controls.
 */
export interface BotanicalPalette {
  id: string;
  label: string;
  stem: string;
  leaf: string;
  vein: string;
  flower: string;
  shadow: string;
}

export const CUSTOM_PALETTE = 'custom';

export const BOTANICAL_PALETTES: BotanicalPalette[] = [
  { id: 'ink', label: 'Ink (mono)', stem: '#2a2a26', leaf: '#2a2a26', vein: '#2a2a26', flower: '#2a2a26', shadow: '#2a2a26' },
  { id: 'sepia', label: 'Sepia', stem: '#5b4636', leaf: '#5b4636', vein: '#5b4636', flower: '#8a3b2e', shadow: '#8a7152' },
  { id: 'botanical', label: 'Botanical plate', stem: '#5b4636', leaf: '#3f6b3a', vein: '#34602f', flower: '#9c2b52', shadow: '#8a7a60' },
  { id: 'rose', label: 'Rose garden', stem: '#4a5d3a', leaf: '#3f6b3a', vein: '#34602f', flower: '#c0306a', shadow: '#9aa07e' },
  { id: 'autumn', label: 'Autumn', stem: '#6e4326', leaf: '#a8662a', vein: '#7d4a1f', flower: '#b23b2e', shadow: '#9b7b53' },
  { id: 'indigo', label: 'Indigo & gold', stem: '#2b3a55', leaf: '#34506e', vein: '#2b3a55', flower: '#caa23a', shadow: '#6b7790' },
];

export function getBotanicalPalette(id: string): BotanicalPalette | null {
  if (id === CUSTOM_PALETTE) return null;
  return BOTANICAL_PALETTES.find((p) => p.id === id) ?? BOTANICAL_PALETTES[0];
}
