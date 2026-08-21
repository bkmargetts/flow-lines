import type { Point } from '../flow-lines.js';
import { dominoClass, type Domino, type DominoClass } from './shuffle.js';

/**
 * Turning an exact tiling into ink.
 *
 * Drawing every domino outline gives an even grey grid: the arctic circle is
 * present but carries no tone, because all four classes are equally dense
 * everywhere. The classes are what the theorem separates, so the mark has to
 * separate them too. Inking a SUBSET of the classes as spines does it:
 *
 *   - in the frozen corner belonging to an inked class the dominoes are packed
 *     in perfect brick courses, and collinear spines weld into long unbroken
 *     rules — solid tone;
 *   - in the frozen corners belonging to the others, nothing is drawn at all —
 *     clean paper;
 *   - inside the arctic circle every class appears at random, so the spines
 *     never weld and stay short broken dashes — mid tone.
 *
 * Three textures, one boundary, no shading trick: the tone IS the long-range
 * order, and the razor edge between them is the arctic circle.
 */
export type ArcticMarks = 'one' | 'horizontals' | 'all' | 'outline';

/** Which domino classes each mark strategy inks (null = every domino's outline). */
export const MARK_CLASSES: Record<ArcticMarks, DominoClass[] | null> = {
  one: ['N'],
  horizontals: ['N', 'S'],
  all: ['N', 'S', 'E', 'W'],
  outline: null,
};

/** Pen-layer name for a domino class — one pen per class for multi-pen plots. */
export function arcticLayerName(cls: DominoClass): string {
  return `domino-${cls.toLowerCase()}`;
}

interface Seg {
  a: Point;
  b: Point;
  cls: DominoClass;
}

/** A spine spans the domino's full length, so collinear neighbours share an
 *  endpoint and can weld. */
function spine(d: Domino, cls: DominoClass, scale: number): Seg {
  const a = d.h ? { x: d.x, y: d.y + 0.5 } : { x: d.x + 0.5, y: d.y };
  const b = d.h ? { x: d.x + 2, y: d.y + 0.5 } : { x: d.x + 0.5, y: d.y + 2 };
  return {
    a: { x: a.x * scale, y: -a.y * scale },
    b: { x: b.x * scale, y: -b.y * scale },
    cls,
  };
}

/**
 * Weld collinear touching spines into single strokes. This is the step that
 * turns long-range order into visible tone: a frozen corner's spines fuse into
 * page-length rules while the liquid region's stay isolated dashes.
 */
function weld(segs: Seg[]): { points: Point[]; cls: DominoClass }[] {
  const k = (p: Point) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
  const ends = new Map<string, Seg[]>();
  for (const s of segs) {
    for (const p of [s.a, s.b]) {
      const kk = k(p);
      let list = ends.get(kk);
      if (!list) ends.set(kk, (list = []));
      list.push(s);
    }
  }
  const isHoriz = (s: Seg) => Math.abs(s.a.y - s.b.y) < 1e-9;
  const used = new Set<Seg>();
  const out: { points: Point[]; cls: DominoClass }[] = [];
  for (const s of segs) {
    if (used.has(s)) continue;
    used.add(s);
    const pts: Point[] = [s.a, s.b];
    for (const end of [0, 1]) {
      for (;;) {
        const tip = end === 0 ? pts[0] : pts[pts.length - 1];
        let grew = false;
        for (const c of ends.get(k(tip)) ?? []) {
          if (used.has(c) || isHoriz(c) !== isHoriz(s)) continue;
          const other = k(c.a) === k(tip) ? c.b : c.a;
          used.add(c);
          if (end === 0) pts.unshift(other);
          else pts.push(other);
          grew = true;
          break;
        }
        if (!grew) break;
      }
    }
    out.push({ points: pts, cls: s.cls });
  }
  return out;
}

/** Welded spines for the inked classes, one polyline per welded run. */
export function spineMarks(
  dominoes: Domino[],
  order: number,
  classes: DominoClass[],
  scale: number
): { points: Point[]; cls: DominoClass }[] {
  const wanted = new Set(classes);
  const segs: Seg[] = [];
  for (const d of dominoes) {
    const cls = dominoClass(d, order);
    if (wanted.has(cls)) segs.push(spine(d, cls, scale));
  }
  return weld(segs);
}

/** Every domino's outline, each shared edge drawn once — the brick texture. */
export function outlineMarks(
  dominoes: Domino[],
  order: number,
  scale: number
): { points: Point[]; cls: DominoClass }[] {
  const seen = new Set<string>();
  const out: { points: Point[]; cls: DominoClass }[] = [];
  for (const d of dominoes) {
    const cls = dominoClass(d, order);
    const w = d.h ? 2 : 1;
    const hgt = d.h ? 1 : 2;
    const corners: [number, number][] = [
      [d.x, d.y],
      [d.x + w, d.y],
      [d.x + w, d.y + hgt],
      [d.x, d.y + hgt],
    ];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      // split long sides into unit edges so shared halves dedupe
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      const dx = (b[0] - a[0]) / steps;
      const dy = (b[1] - a[1]) / steps;
      for (let s = 0; s < steps; s++) {
        const p: [number, number] = [a[0] + dx * s, a[1] + dy * s];
        const q: [number, number] = [a[0] + dx * (s + 1), a[1] + dy * (s + 1)];
        const kk = [p, q]
          .map((z) => z.join(','))
          .sort()
          .join('|');
        if (seen.has(kk)) continue;
        seen.add(kk);
        out.push({
          points: [
            { x: p[0] * scale, y: -p[1] * scale },
            { x: q[0] * scale, y: -q[1] * scale },
          ],
          cls,
        });
      }
    }
  }
  return out;
}
