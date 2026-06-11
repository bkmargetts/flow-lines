import { GrayscaleImage } from './image.js';
import { Point } from './flow-lines.js';

/**
 * Trace iso-contours of a scalar raster at a threshold using marching
 * squares with linear interpolation, then chain the cell segments into
 * polylines. Coordinates are in raster pixel space (cell corners sit on
 * integer coordinates).
 *
 * Used to carve tonal mass boundaries — e.g. cloud shapes out of a
 * stippled sky — so they can be drawn as deliberate outlines rather than
 * left to the edge detector, which misses soft tonal transitions.
 */
export function traceIsoContours(raster: GrayscaleImage, iso: number): Point[][] {
  const { width, height, data } = raster;
  if (width < 2 || height < 2) return [];

  type Segment = { a: Point; b: Point };
  const segments: Segment[] = [];

  const valueAt = (x: number, y: number): number => data[y * width + x];

  // Interpolated crossing point along a cell edge
  const cross = (
    x0: number,
    y0: number,
    v0: number,
    x1: number,
    y1: number,
    v1: number
  ): Point => {
    const t = Math.abs(v1 - v0) < 1e-12 ? 0.5 : (iso - v0) / (v1 - v0);
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = valueAt(x, y);
      const tr = valueAt(x + 1, y);
      const br = valueAt(x + 1, y + 1);
      const bl = valueAt(x, y + 1);

      let caseIndex = 0;
      if (tl >= iso) caseIndex |= 1;
      if (tr >= iso) caseIndex |= 2;
      if (br >= iso) caseIndex |= 4;
      if (bl >= iso) caseIndex |= 8;
      if (caseIndex === 0 || caseIndex === 15) continue;

      const top = (): Point => cross(x, y, tl, x + 1, y, tr);
      const right = (): Point => cross(x + 1, y, tr, x + 1, y + 1, br);
      const bottom = (): Point => cross(x, y + 1, bl, x + 1, y + 1, br);
      const left = (): Point => cross(x, y, tl, x, y + 1, bl);

      switch (caseIndex) {
        case 1:
        case 14:
          segments.push({ a: left(), b: top() });
          break;
        case 2:
        case 13:
          segments.push({ a: top(), b: right() });
          break;
        case 3:
        case 12:
          segments.push({ a: left(), b: right() });
          break;
        case 4:
        case 11:
          segments.push({ a: right(), b: bottom() });
          break;
        case 6:
        case 9:
          segments.push({ a: top(), b: bottom() });
          break;
        case 7:
        case 8:
          segments.push({ a: left(), b: bottom() });
          break;
        case 5: {
          // Saddle: disambiguate with the cell center value
          const center = (tl + tr + br + bl) / 4;
          if (center >= iso) {
            segments.push({ a: left(), b: bottom() });
            segments.push({ a: top(), b: right() });
          } else {
            segments.push({ a: left(), b: top() });
            segments.push({ a: right(), b: bottom() });
          }
          break;
        }
        case 10: {
          const center = (tl + tr + br + bl) / 4;
          if (center >= iso) {
            segments.push({ a: left(), b: top() });
            segments.push({ a: right(), b: bottom() });
          } else {
            segments.push({ a: left(), b: bottom() });
            segments.push({ a: top(), b: right() });
          }
          break;
        }
      }
    }
  }

  // Chain segments end-to-end. Crossing points are computed identically
  // from both adjacent cells, so quantized endpoint keys match exactly.
  const keyOf = (p: Point): string => `${Math.round(p.x * 64)},${Math.round(p.y * 64)}`;

  // Raster values exactly equal to the iso level pinch the contour to a
  // point and emit zero-length segments — drop them before chaining
  const cleaned = segments.filter((s) => keyOf(s.a) !== keyOf(s.b));

  const ends = new Map<string, number[]>();
  for (let i = 0; i < cleaned.length; i++) {
    for (const p of [cleaned[i].a, cleaned[i].b]) {
      const key = keyOf(p);
      const list = ends.get(key);
      if (list) list.push(i);
      else ends.set(key, [i]);
    }
  }

  const used = new Uint8Array(cleaned.length);
  const polylines: Point[][] = [];

  const takeNext = (at: Point, exclude: number): number => {
    const list = ends.get(keyOf(at));
    if (!list) return -1;
    for (const i of list) {
      if (!used[i] && i !== exclude) return i;
    }
    return -1;
  };

  for (let i = 0; i < cleaned.length; i++) {
    if (used[i]) continue;
    used[i] = 1;

    const line: Point[] = [cleaned[i].a, cleaned[i].b];

    // Extend forward from the tail, then backward from the head
    for (const dir of [1, -1] as const) {
      for (;;) {
        const at = dir === 1 ? line[line.length - 1] : line[0];
        const next = takeNext(at, -1);
        if (next < 0) break;
        used[next] = 1;
        const seg = cleaned[next];
        const tail =
          keyOf(seg.a) === keyOf(at) ? seg.b : keyOf(seg.b) === keyOf(at) ? seg.a : null;
        if (!tail) break;
        if (dir === 1) line.push(tail);
        else line.unshift(tail);
      }
    }

    polylines.push(line);
  }

  return polylines;
}
