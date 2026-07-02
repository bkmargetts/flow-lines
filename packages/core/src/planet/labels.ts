import { makeRandom } from '../lib/rng.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import { TAU } from './vec3.js';
import { dot4 } from './geometry.js';
import type { BodyCtx, SceneCtx, LabelKind, LabelCandidate } from './context.js';

const ONSETS = ['T', 'K', 'V', 'H', 'PL', 'CR', 'M', 'S', 'TH', 'BR'];
const VOWELS = ['A', 'E', 'I', 'O', 'U', 'AE'];
const CODAS = ['', 'N', 'R', 'S', 'X', 'M'];
const PREFIX: Record<LabelKind, string> = {
  crater: '',
  mare: 'MARE ',
  sea: 'MARE ',
  storm: 'OCULUS ',
  rille: 'RIMA ',
};

/** A deterministic invented Latin name: 2-3 syllables from fixed tables,
 *  prefixed by the feature kind the way lunar atlases do (MARE ~, RIMA ~). */
export function inventName(rng: () => number, kind: LabelKind): string {
  const pick = (arr: string[]): string => arr[Math.floor(rng() * arr.length) % arr.length];
  const syllables = 2 + (rng() < 0.35 ? 1 : 0);
  let name = '';
  for (let i = 0; i < syllables; i++) name += pick(ONSETS) + pick(VOWELS);
  name += pick(CODAS);
  return PREFIX[kind] + name;
}

/** Roman numeral for small n (orbit indices). */
export function romanNumeral(n: number): string {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let v = Math.max(1, Math.round(n));
  for (const [k, sym] of table) {
    while (v >= k) {
      out += sym;
      v -= k;
    }
  }
  return out;
}

/**
 * Engraved feature callouts: the largest collected candidates get an invented
 * name set outside the limb, a leader line back to the feature, and a small
 * anchor dot. Angular slots keep labels from colliding; a taken slot tries its
 * neighbours, then drops the label. Everything goes on the 'callout' layer —
 * NOT 'label'/'annotation', which fitBodyToMargin pins to the page while the
 * body scales; callouts must follow the features they annotate.
 */
export function renderFeatureLabels(ctx: BodyCtx): void {
  const { b, bx, by, br, occluded } = ctx;
  const { o, lines } = ctx.scene;
  if (!o.featureLabels) return;
  const rng = makeRandom(b.bodySeed + 2323);

  // Tonal-region candidates (maria / seas) are sampled here rather than
  // plumbed out of the contour tracer: the deepest front-facing spot of the
  // dark field, if any, anchors one region label.
  const tonal: LabelCandidate[] = [];
  if (b.bodyType !== 'star' && b.bodyType !== 'gas-giant' && b.bodyType !== 'ringed') {
    const golden = Math.PI * (3 - Math.sqrt(5));
    let best: { x: number; y: number; n: number } | null = null;
    const isSea = b.bodyType === 'terrestrial';
    const thr = isSea ? o.seaLevel : o.mareLevel;
    for (let i = 0; i < 140; i++) {
      const yy = 1 - ((i + 0.5) / 140) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = i * golden;
      const d = { x: Math.cos(th) * rad, y: yy, z: Math.sin(th) * rad };
      if (d.z <= 0.35) continue;
      const n = ctx.surface(d).n;
      if (n >= thr) continue;
      if (!best || n < best.n) best = { x: bx + br * d.x, y: by + ctx.bry * d.y, n };
    }
    if (best) tonal.push({ x: best.x, y: best.y, r: br * 0.5, kind: isSea ? 'sea' : 'mare' });
  }

  const cands = [...tonal, ...ctx.labelCandidates]
    .filter((c) => !occluded(c.x, c.y))
    .sort((a, b2) => b2.r - a.r)
    .slice(0, Math.max(1, Math.round(o.labelCount)));

  const SLOTS = 24;
  const taken = new Array<boolean>(SLOTS).fill(false);
  const size = Math.max(8, br * 0.055);
  const anchorR = br * (1.12 + (ctx.warp ? 0.14 : 0));
  for (const c of cands) {
    const rawAng = Math.atan2(c.y - by, c.x - bx);
    const slot0 = Math.round(((rawAng + TAU) % TAU) / (TAU / SLOTS)) % SLOTS;
    let slot = -1;
    for (const off of [0, 1, -1, 2, -2]) {
      const s = (slot0 + off + SLOTS) % SLOTS;
      if (!taken[s]) {
        slot = s;
        break;
      }
    }
    if (slot < 0) continue; // crowded — drop the label
    taken[slot] = true;
    const ang = slot * (TAU / SLOTS);
    const ax = bx + Math.cos(ang) * anchorR;
    const ay = by + Math.sin(ang) * anchorR;
    const name = inventName(rng, c.kind);
    const w = textWidth(name, size);
    const rightSide = ax >= bx;
    const gap = size * 0.5;
    const tx = rightSide ? ax + gap : ax - gap - w;
    const ty = ay - size / 2;
    // Anchor dot on the feature, leader out to the text, landing rule under it.
    lines.push({ points: dot4(c.x, c.y, Math.max(0.8, o.penWidth * 0.7)), layer: 'callout' });
    lines.push({ points: [{ x: c.x, y: c.y }, { x: ax, y: ay }], layer: 'callout' });
    lines.push({
      points: [
        { x: rightSide ? ax : ax - gap - w, y: ay + size * 0.75 },
        { x: rightSide ? ax + gap + w : ax, y: ay + size * 0.75 },
      ],
      layer: 'callout',
    });
    for (const stroke of textToStrokes(name, tx, ty, size)) {
      lines.push({ points: stroke, layer: 'callout' });
    }
  }
}

/** Roman orbit numerals + invented body names for the orbital layout. */
export function renderOrbitLabels(
  scene: SceneCtx,
  orbits: { orbR: number; sT: number }[]
): void {
  const { o, seed, cx, cy, usableR, lines } = scene;
  if (!o.orbitLabels) return;
  const rng = makeRandom(seed + 2323);
  const size = Math.max(8, usableR * 0.042);
  const ang = (135 * Math.PI) / 180;
  for (let k = 0; k < orbits.length; k++) {
    const { orbR, sT } = orbits[k];
    const px = cx + Math.cos(ang) * (orbR + size * 0.9);
    const py = cy + Math.sin(ang) * (orbR + size * 0.9) * sT;
    const numeral = romanNumeral(k + 1);
    const name = inventName(rng, 'crater');
    const wN = textWidth(numeral, size);
    for (const stroke of textToStrokes(numeral, px - wN / 2, py - size / 2, size)) {
      lines.push({ points: stroke, layer: 'callout' });
    }
    const sizeSm = size * 0.72;
    const wName = textWidth(name, sizeSm);
    for (const stroke of textToStrokes(name, px - wName / 2, py + size * 0.7, sizeSm)) {
      lines.push({ points: stroke, layer: 'callout' });
    }
  }
}
