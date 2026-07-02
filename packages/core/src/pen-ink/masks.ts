import { Point } from '../flow-lines.js';
import { ImageField } from '../image-field.js';
import { sampleBilinear } from '../image.js';
import { SemanticMap } from '../semantic-map.js';
import { PenInkOptions } from './options.js';

/**
 * Mark grid cells in the reserved-white halo beside long contours. The
 * halo is one-sided and contrast-gated: at each contour point the tone is
 * sampled a little way out on both sides, and only a genuine tonal step —
 * a silhouette against a differently-toned region — stamps a halo, on the
 * darker side, where hatching would otherwise crash into the line. Edges
 * inside an evenly-toned mass (architectural detail, fur, foliage) leave
 * no halo, so the mass keeps its tone.
 */
export function buildHaloMask(
  contours: Point[][],
  width: number,
  height: number,
  radius: number,
  minContourLength: number,
  darknessAt: (x: number, y: number) => number
): (x: number, y: number) => boolean {
  const cell = Math.max(1, radius / 2);
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const grid = new Uint8Array(cols * rows);

  // Tone probes sit beyond the halo itself so they read the masses on
  // either side, not the edge's own gradient skirt
  const probe = Math.max(radius * 2.5, 5);
  const minStep = 0.12;

  for (const points of contours) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    // Short fragments (texture flecks, broken background edges) don't
    // earn a halo — only lines long enough to read as silhouettes
    if (length < minContourLength) continue;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const ahead = points[Math.min(i + 1, points.length - 1)];
      const behind = points[Math.max(i - 1, 0)];
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const tlen = Math.hypot(tx, ty);
      if (tlen < 1e-9) continue;
      const nx = -ty / tlen;
      const ny = tx / tlen;

      const dA = darknessAt(p.x + nx * probe, p.y + ny * probe);
      const dB = darknessAt(p.x - nx * probe, p.y - ny * probe);
      if (Math.abs(dA - dB) < minStep) continue;
      // A halo separates a dark mass from genuinely light ground. An edge
      // between dark and darker (fur over deep shadow) must not carve a
      // reserved-paper vein through what should read as one black mass
      if (Math.min(dA, dB) > 0.5) continue;

      // Stamp a disk just off the line on the darker side — the gap
      // shows where tone work approaches the silhouette
      const side = dA > dB ? 1 : -1;
      const cx0 = p.x + nx * side * radius * 0.7;
      const cy0 = p.y + ny * side * radius * 0.7;

      const c0 = Math.max(0, Math.floor((cx0 - radius) / cell));
      const c1 = Math.min(cols - 1, Math.floor((cx0 + radius) / cell));
      const r0 = Math.max(0, Math.floor((cy0 - radius) / cell));
      const r1 = Math.min(rows - 1, Math.floor((cy0 + radius) / cell));
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const dx = (cx + 0.5) * cell - cx0;
          const dy = (cy + 0.5) * cell - cy0;
          if (dx * dx + dy * dy <= radius * radius) grid[cy * cols + cx] = 1;
        }
      }
    }
  }

  return (x: number, y: number): boolean => {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cell)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cell)));
    return grid[cy * cols + cx] === 1;
  };
}

/**
 * Build the importance sampler in [0, 1]: 1 = render with full detail,
 * 0 = fade toward blank paper. Sources (auto detail, focal point, subject
 * mask) compose multiplicatively — each can only demote a region.
 */
export function buildImportance(
  field: ImageField,
  width: number,
  height: number,
  options: PenInkOptions,
  semantic: SemanticMap | null
): ((x: number, y: number) => number) | null {
  const detailEmphasis = Math.max(0, Math.min(1, options.detailEmphasis ?? 0.3));
  const mask = options.subjectMask;
  const maskStrength = Math.max(0, Math.min(1, options.maskStrength ?? 1));

  const focusList = (Array.isArray(options.focus) ? options.focus : options.focus ? [options.focus] : [])
    .map((f) => ({
      x: f.x,
      y: f.y,
      radius: f.radius,
      falloff: Math.max(1, f.falloff ?? f.radius),
      strength: Math.max(0, Math.min(1, f.strength ?? 0.85)),
    }))
    .filter((f) => f.strength > 0);

  // Depth-based isolation: fade far regions toward paper, but only when
  // the scene actually has meaningful depth separation
  const depthIsolation = Math.max(0, Math.min(1, options.depthIsolation ?? 0.5));
  let depthRemap: ((x: number, y: number) => number) | null = null;
  if (options.depthMap && depthIsolation > 0) {
    const data = options.depthMap.data;
    const stride = Math.max(1, Math.floor(data.length / 5000));
    const sample: number[] = [];
    for (let i = 0; i < data.length; i += stride) sample.push(data[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.15)];
    const hi = sample[Math.floor(sample.length * 0.85)];

    if (hi - lo > 0.15) {
      const range = hi - lo;
      depthRemap = (x: number, y: number): number => {
        const t = Math.max(0, Math.min(1, (field.getDepth(x, y) - lo) / range));
        const near = t * t * (3 - 2 * t); // smoothstep
        return 1 - depthIsolation * (1 - near);
      };
    }
  }

  const useDetail = detailEmphasis > 0;
  const useFocus = focusList.length > 0;
  const useMask = !!mask && maskStrength > 0;
  const useDepth = !!depthRemap;
  // People are never background: a person label floors importance so the
  // other sources (depth, detail, focus) cannot dissolve a figure into
  // loose background gestures. The floor sits well below 1 — it guards
  // against dissolution, not against tonal selectivity: pinning people
  // at full importance hatches smooth clothing into flat dark masses.
  // Labels promote, never demote.
  const personFloor = semantic?.has('person') ? semantic : null;

  if (!useDetail && !useFocus && !useMask && !useDepth) return null;

  const maskScaleX = mask ? mask.width / width : 0;
  const maskScaleY = mask ? mask.height / height : 0;

  return (x: number, y: number): number => {
    let importance = 1;

    if (useDetail) {
      importance *= 1 - detailEmphasis * (1 - field.getDetail(x, y));
    }

    if (useFocus) {
      // A region keeps detail if it is near any focal point
      let best = 0;
      for (const f of focusList) {
        const dist = Math.hypot(x - f.x, y - f.y);
        const t = Math.max(0, Math.min(1, (dist - f.radius) / f.falloff));
        const fade = t * t * (3 - 2 * t); // smoothstep
        best = Math.max(best, 1 - f.strength * fade);
        if (best >= 1) break;
      }
      importance *= best;
    }

    if (useMask && mask) {
      const m = sampleBilinear(mask, x * maskScaleX, y * maskScaleY);
      importance *= 1 - maskStrength * (1 - m);
    }

    if (depthRemap) {
      importance *= depthRemap(x, y);
    }

    if (personFloor) {
      importance = Math.max(importance, 0.6 * personFloor.confidence(x, y, 'person'));
    }

    return importance;
  };
}
