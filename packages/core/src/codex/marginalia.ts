import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import type { CodexCtx } from './context.js';

/**
 * Marginalia — blocks of asemic script beside the drawing. Regularity, not
 * randomness, is what sells "writing": a fixed per-seed alphabet of a dozen
 * glyphlets on a strict baseline / x-height / slant grid, composed into
 * Zipf-ish words with a justified left edge. The slight *left* slant and the
 * ragged left-page look are the mirror-writing nod. `patent` style swaps the
 * asemic blocks for stroke-font pseudo-Latin.
 */

interface Glyph {
  strokes: Point[][];
  width: number;
}

/** Build the seed's alphabet in a unit cell: baseline y=0, x-height -0.62,
 *  ascenders to -1, descenders to +0.35, y down. */
function makeAlphabet(rng: () => number): Glyph[] {
  const xh = 0.62;
  const glyphs: Glyph[] = [];
  const jitter = (v: number, amt: number): number => v + (rng() - 0.5) * amt;

  const templates: (() => Glyph)[] = [
    // Bare stem.
    () => ({
      strokes: [
        [
          { x: jitter(0.12, 0.05), y: 0 },
          { x: jitter(0.14, 0.05), y: -xh },
        ],
      ],
      width: 0.3,
    }),
    // Stem with an arch to the right (n-like).
    () => {
      const w = jitter(0.5, 0.08);
      return {
        strokes: [
          [
            { x: 0.1, y: 0 },
            { x: 0.1, y: -xh },
          ],
          [
            { x: 0.1, y: -xh * 0.55 },
            { x: w * 0.5, y: -xh * jitter(1.05, 0.15) },
            { x: w, y: -xh * 0.5 },
            { x: jitter(w, 0.06), y: 0 },
          ],
        ],
        width: w + 0.12,
      };
    },
    // Bowl (o-like).
    () => {
      const r = jitter(0.26, 0.05);
      const pts: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        pts.push({ x: r + Math.cos(a) * r, y: -xh * 0.5 + Math.sin(a) * xh * 0.48 });
      }
      return { strokes: [pts], width: r * 2 + 0.1 };
    },
    // Zigzag (z/w-like).
    () => ({
      strokes: [
        [
          { x: 0.05, y: -xh },
          { x: jitter(0.3, 0.08), y: 0 },
          { x: jitter(0.42, 0.08), y: -xh },
          { x: 0.6, y: 0 },
        ],
      ],
      width: 0.68,
    }),
    // Ascender stem with a flag.
    () => ({
      strokes: [
        [
          { x: 0.12, y: 0 },
          { x: jitter(0.15, 0.04), y: -1 },
          { x: jitter(0.34, 0.1), y: jitter(-0.88, 0.08) },
        ],
      ],
      width: 0.4,
    }),
    // Descender hook (p/q-like).
    () => ({
      strokes: [
        [
          { x: 0.12, y: -xh },
          { x: 0.12, y: 0.35 },
          { x: jitter(-0.08, 0.06), y: jitter(0.28, 0.06) },
        ],
        [
          { x: 0.12, y: -xh * 0.6 },
          { x: 0.38, y: -xh * jitter(0.75, 0.2) },
          { x: 0.4, y: -xh * 0.2 },
        ],
      ],
      width: 0.5,
    }),
    // Double wave (m-like).
    () => ({
      strokes: [
        [
          { x: 0.05, y: 0 },
          { x: 0.08, y: -xh * 0.9 },
          { x: 0.24, y: -xh },
          { x: 0.3, y: -xh * 0.3 },
          { x: 0.36, y: -xh },
          { x: 0.52, y: -xh * 0.9 },
          { x: 0.56, y: 0 },
        ],
      ],
      width: 0.64,
    }),
    // Crossed stem (t/f-like).
    () => ({
      strokes: [
        [
          { x: 0.2, y: -jitter(0.85, 0.15) },
          { x: 0.2, y: 0.05 },
        ],
        [
          { x: 0.02, y: -xh },
          { x: 0.4, y: -xh * jitter(1, 0.1) },
        ],
      ],
      width: 0.46,
    }),
    // Small tick (i-like) with a dot.
    () => ({
      strokes: [
        [
          { x: 0.1, y: -xh * 0.9 },
          { x: 0.13, y: 0 },
        ],
        [
          { x: 0.1, y: -xh * 1.25 },
          { x: 0.14, y: -xh * 1.22 },
        ],
      ],
      width: 0.28,
    }),
    // Open c.
    () => {
      const pts: Point[] = [];
      for (let i = 0; i <= 7; i++) {
        const a = 0.7 + (i / 7) * 4.5;
        pts.push({ x: 0.26 + Math.cos(a) * 0.24, y: -xh * 0.5 + Math.sin(a) * xh * 0.46 });
      }
      return { strokes: [pts], width: 0.5 };
    },
  ];

  // 10–14 glyphs: every template once, then jittered repeats.
  const count = 10 + Math.floor(rng() * 5);
  for (let i = 0; i < count; i++) glyphs.push(templates[i % templates.length]());
  return glyphs;
}

/** Fill a rect with asemic script. Returns the y the text finished at. */
function asemicBlock(
  ctx: CodexCtx,
  block: { x0: number; y0: number; x1: number; y1: number },
  fill: number
): void {
  const rng = makeRandom(subSeed(ctx.seed, 55));
  const alphabet = makeAlphabet(rng);
  const usableW = ctx.width - 2 * ctx.margin;
  const size = Math.max(5, usableW * 0.016);
  const slant = -0.16; // mirror-writing lean
  const pitch = size * 1.55;
  const maxY = block.y0 + (block.y1 - block.y0) * Math.min(1, fill);

  for (let y = block.y0 + size; y < maxY; y += pitch) {
    // Ragged line end: most lines run nearly full width, some stop short.
    const lineEnd = block.x1 - (rng() < 0.25 ? (0.15 + rng() * 0.3) * (block.x1 - block.x0) : rng() * size * 2);
    let x = block.x0;
    while (x < lineEnd) {
      const wordLen = 2 + Math.floor(Math.pow(rng(), 1.6) * 7);
      for (let g = 0; g < wordLen && x < lineEnd; g++) {
        const glyph = alphabet[Math.floor(rng() * alphabet.length)];
        for (const stroke of glyph.strokes) {
          const pts = stroke.map((p) => ({
            x: x + (p.x + slant * -p.y) * size,
            y: y + p.y * size,
          }));
          ctx.lines.push({ points: pts, layer: 'marginalia' });
        }
        x += (glyph.width + 0.14) * size;
      }
      x += size * 0.55; // word space
    }
    // The occasional underline flourish.
    if (rng() < 0.08) {
      const fx = block.x0 + rng() * (block.x1 - block.x0) * 0.4;
      ctx.lines.push({
        points: [
          { x: fx, y: y + size * 0.35 },
          { x: fx + size * (2 + rng() * 3), y: y + size * (0.3 + rng() * 0.15) },
        ],
        layer: 'marginalia',
      });
    }
  }
}

const SYLLABLES = ['RO', 'TA', 'DEN', 'TIS', 'MA', 'CHI', 'NA', 'PON', 'DE', 'RIS', 'VOL', 'VENS', 'AQ', 'VA', 'MO', 'LA', 'FER', 'RI', 'LIG', 'NVM', 'IN', 'GE', 'NI'];

/** Patent-style block: ruled lines of stroke-font pseudo-Latin. */
function latinBlock(
  ctx: CodexCtx,
  block: { x0: number; y0: number; x1: number; y1: number },
  fill: number
): void {
  const rng = makeRandom(subSeed(ctx.seed, 55));
  const usableW = ctx.width - 2 * ctx.margin;
  const size = Math.max(5, usableW * 0.014);
  const pitch = size * 1.7;
  const maxY = block.y0 + (block.y1 - block.y0) * Math.min(1, fill);
  for (let y = block.y0 + size; y < maxY; y += pitch) {
    let text = '';
    while (textWidth(text, size) < (block.x1 - block.x0) * 0.92) {
      let word = '';
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) word += SYLLABLES[Math.floor(rng() * SYLLABLES.length)];
      const next = text.length === 0 ? word : `${text} ${word}`;
      if (textWidth(next, size) > (block.x1 - block.x0)) break;
      text = next;
    }
    if (text.length === 0) break;
    for (const stroke of textToStrokes(text, block.x0, y - size, size)) {
      ctx.lines.push({ points: stroke, layer: 'marginalia' });
    }
  }
}

export function renderMarginalia(
  ctx: CodexCtx,
  blocks: { x0: number; y0: number; x1: number; y1: number }[]
): void {
  const { o } = ctx;
  if (o.marginalia <= 0.02) return;
  for (const raw of blocks) {
    // Breathe off the neatline / block edges.
    const block = { x0: raw.x0 + 5, y0: raw.y0 + 3, x1: raw.x1 - 5, y1: raw.y1 };
    if (block.y1 - block.y0 < 10 || block.x1 - block.x0 < 20) continue;
    if (o.style === 'patent') latinBlock(ctx, block, o.marginalia);
    else asemicBlock(ctx, block, o.marginalia);
  }
}
