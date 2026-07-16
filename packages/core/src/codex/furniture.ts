import type { FlowLine } from '../flow-lines.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig } from '../sketch-styles.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import { romanNumeral } from './drafting.js';
import type { CodexCtx } from './context.js';

/** Layers pinned to the page (never refitted): plate furniture, text blocks.
 *  RULED layers stay unwobbled in `patent` style — wobbly dimension lines
 *  kill the patent read. */
const PINNED = new Set(['annotation', 'label', 'marginalia', 'inset']);
const RULED = new Set(['annotation', 'label', 'marginalia', 'inset', 'dim', 'center', 'hidden', 'callout']);

const NOUNS = ['MACHINA', 'ROTA', 'INGENIVM', 'MOLA', 'HOROLOGIVM', 'TORCVLAR'];
const ADJS = ['VOLVENS', 'PERPETVA', 'DENTATA', 'PONDERIS', 'AQVARIA', 'MIRABILIS'];

/** Plate frame, invented title, and the plate number in the corner. */
export function renderPlateFurniture(ctx: CodexCtx): void {
  const { o, width, height, margin, lines } = ctx;
  const rng = makeRandom(subSeed(ctx.seed, 77));
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;
  const usableW = x1 - x0;
  const patent = o.style === 'patent';

  const rect = (a: number, b: number, c: number, d: number): void => {
    lines.push({
      points: [
        { x: a, y: b },
        { x: c, y: b },
        { x: c, y: d },
        { x: a, y: d },
        { x: a, y: b },
      ],
      layer: 'annotation',
    });
  };
  if (patent) {
    // Graduated neatline: outer + inner rule with corner ticks.
    const inset = Math.max(3, margin * 0.16);
    rect(x0, y0, x1, y1);
    rect(x0 + inset, y0 + inset, x1 - inset, y1 - inset);
  } else if (rng() < 0.6) {
    // A single rough rule (the finish pass gives it the hand).
    rect(x0, y0, x1, y1);
  }

  // Title: invented per seed unless the caller supplied (or suppressed) one.
  const title =
    o.title !== undefined
      ? o.title
      : `${NOUNS[Math.floor(rng() * NOUNS.length)]} ${ADJS[Math.floor(rng() * ADJS.length)]}`;
  if (title) {
    const size = Math.max(11, usableW * 0.042);
    const tx = (x0 + x1) / 2 - textWidth(title, size) / 2;
    for (const stroke of textToStrokes(title, tx, y0 + margin * 0.3, size)) {
      lines.push({ points: stroke, layer: 'label' });
    }
  }

  // Plate number in the corner.
  const plate = patent
    ? `FIG ${1 + Math.floor(rng() * 4)}`
    : `TAV ${romanNumeral(2 + Math.floor(rng() * 38))}`;
  const psize = Math.max(7, usableW * 0.022);
  const px = x1 - textWidth(plate, psize) - psize * 0.6;
  for (const stroke of textToStrokes(plate, px, y1 - psize * 1.5, psize)) {
    lines.push({ points: stroke, layer: 'label' });
  }
}

/** Hand-drawn finish: multi-pass sketch overdraw when `sketch` is set, else a
 *  single low-frequency wobble — the planet/botanical pattern. In `patent`
 *  style the drafting layers (dimensions, centerlines, hidden dashes, text)
 *  stay ruled straight: wobbly dimension lines kill the patent read. */
export function applyFinish(ctx: CodexCtx): FlowLine[] {
  const { o, seed, width, height, lines } = ctx;
  const keepRuled = o.style === 'patent';
  // Insets never take the multi-pass sketch overdraw — a scribbled-over
  // detail figure defeats its purpose. In codex they get one light wobble.
  const isInset = (l: FlowLine): boolean => l.layer === 'inset';
  const drawn = lines.filter((l) => !(keepRuled ? RULED.has(l.layer ?? '') : isInset(l)));
  const ruled = keepRuled ? lines.filter((l) => RULED.has(l.layer ?? '')) : [];
  const inset = keepRuled ? [] : lines.filter(isInset);

  let finished: FlowLine[];
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    finished = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, p);
      const styled = applyHandDrawnStyle(
        { lines: drawn, width, height, seed: pseed },
        { amplitude, wavelength, jitter, seed: pseed }
      ).lines;
      for (const l of styled) finished.push(l);
    }
  } else {
    finished = applyHandDrawnStyle(
      { lines: drawn, width, height, seed },
      { amplitude: o.wobble, wavelength: 42, seed }
    ).lines;
  }
  if (inset.length > 0) {
    const styled = applyHandDrawnStyle(
      { lines: inset, width, height, seed },
      { amplitude: Math.min(o.wobble, 0.6), wavelength: 42, seed }
    ).lines;
    for (const l of styled) finished.push(l);
  }
  return keepRuled ? finished.concat(ruled) : finished;
}

/** Uniformly scale the machine (and its drafting) about the region centre so
 *  it fits the layout's drawing region; plate furniture, text blocks and
 *  insets live on pinned page layers and never move (the planet
 *  `fitBodyToMargin` pattern). */
export function fitMachineToMargin(ctx: CodexCtx, all: FlowLine[]): FlowLine[] {
  const { region } = ctx;
  const cx = (region.x0 + region.x1) / 2;
  const cy = (region.y0 + region.y1) / 2;
  const halfW = (region.x1 - region.x0) / 2;
  const halfH = (region.y1 - region.y0) / 2;
  if (halfW <= 0 || halfH <= 0) return all;
  let maxDx = 0;
  let maxDy = 0;
  for (const ln of all) {
    if (PINNED.has(ln.layer ?? '')) continue;
    for (const p of ln.points) {
      const ax = Math.abs(p.x - cx);
      const ay = Math.abs(p.y - cy);
      if (ax > maxDx) maxDx = ax;
      if (ay > maxDy) maxDy = ay;
    }
  }
  const scale = Math.min(1, maxDx > 0 ? halfW / maxDx : 1, maxDy > 0 ? halfH / maxDy : 1);
  if (scale >= 0.999) return all;
  return all.map((ln) =>
    PINNED.has(ln.layer ?? '')
      ? ln
      : { ...ln, points: ln.points.map((p) => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale })) }
  );
}
