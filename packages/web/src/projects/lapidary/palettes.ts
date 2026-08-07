/**
 * Curated pen sets for Lapidary, indexed pen 0..n (unlike the landscape's
 * semantic roles — here every pen draws every texture, interleaved). Each
 * palette carries its own pen count: picking one decides how many pens the
 * plot is for. `vein` colours the kintsugi accent layer when veins are on.
 * The CLI mirrors this table in packages/cli/src/palettes.ts — keep the two
 * in sync.
 *
 * Beyond the table, `randomLapidaryPalette` invents a whole pen set from
 * scratch (seeded, plotter-plausible inks) — it backs the Ink section's
 * "invent a palette" button and a slice of the randomise-everything genome.
 * This file is imported by the worker-run render.ts, so it must stay free of
 * React and DOM.
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
  { id: 'sepia', label: 'Sepia & walnut', inks: ['#3a2a1a', '#8a6a3a'], vein: '#b87333' },
  { id: 'bordeaux-slate', label: 'Bordeaux & slate', inks: ['#6e1f33', '#3a4a5c'], vein: '#b8860b' },
  { id: 'verdigris-rust', label: 'Verdigris & rust', inks: ['#1f6f5e', '#8a3324'], vein: '#b87333' },
  { id: 'glacier', label: 'Glacier', inks: ['#20243f', '#3a6fa0'], vein: '#8a8a92' },
  { id: 'ember', label: 'Ember', inks: ['#2a2a26', '#8a2a1f', '#d4551a'], vein: '#b8860b' },
  { id: 'olive-plum', label: 'Olive, plum & ochre', inks: ['#55601f', '#5a2a4a', '#a8642a'], vein: '#b8860b' },
  { id: 'quartet', label: 'Quartet', inks: ['#1f1f1d', '#c3401f', '#1f6f6a', '#b8860b'], vein: '#b87333' },
  { id: 'mono', label: 'Single ink', inks: ['#1f1f1d'], vein: '#b8860b' },
];

export function getLapidaryPalette(id: string): LapidaryPalette | null {
  return LAPIDARY_PALETTES.find((p) => p.id === id) ?? null;
}

/** HSL → `#rrggbb` (h wraps in degrees, s/l 0..1). Local so the worker-run
 *  render path never pulls in lib/random-artwork's React-adjacent imports. */
function hslHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Invent a whole pen set: 2-4 inks dealt by one of three schemes, all held in
 * the "real bottled ink" corner of colour space (deep, a touch muted — never
 * neon, never pastel). Deterministic per rng stream.
 *
 * - anchor: a near-black pen with a hue cast, plus saturated accents fanned
 *   around the wheel — the classic specimen look (most curated sets share it).
 * - harmony: 2-3 mid-dark inks spread complement-to-triad apart, no anchor.
 * - tonal: one hue stepping deep→light, an etching-style monochrome ramp.
 *
 * The vein accent rolls its own metallic band (gold→copper) so kintsugi seams
 * stay believable against any deal.
 */
export function randomLapidaryPalette(rng: () => number): LapidaryPalette {
  const pens = rng() < 0.4 ? 2 : rng() < 0.65 ? 3 : 4;
  const baseHue = rng() * 360;
  const scheme = rng();
  const inks: string[] = [];
  if (scheme < 0.5) {
    // Anchor + accents.
    inks.push(hslHex(baseHue, 0.08 + rng() * 0.14, 0.1 + rng() * 0.06));
    const spread = 100 + rng() * 160;
    for (let i = 1; i < pens; i++) {
      inks.push(
        hslHex(baseHue + spread * i + (rng() - 0.5) * 30, 0.45 + rng() * 0.3, 0.3 + rng() * 0.16)
      );
    }
  } else if (scheme < 0.8) {
    // Harmony fan.
    const spread = 120 + rng() * 120;
    for (let i = 0; i < pens; i++) {
      inks.push(
        hslHex(baseHue + (spread * i) / Math.max(1, pens - 1), 0.35 + rng() * 0.3, 0.2 + rng() * 0.18)
      );
    }
  } else {
    // Tonal ramp, deepest pen first.
    const s = 0.25 + rng() * 0.35;
    for (let i = 0; i < pens; i++) {
      inks.push(hslHex(baseHue + (rng() - 0.5) * 16, s, 0.14 + (0.3 * i) / Math.max(1, pens - 1)));
    }
  }
  const vein = hslHex(30 + rng() * 18, 0.5 + rng() * 0.25, 0.34 + rng() * 0.1);
  return { id: CUSTOM_PALETTE, label: 'Custom', inks, vein };
}
