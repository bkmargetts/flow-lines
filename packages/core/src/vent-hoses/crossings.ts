import { sampleAtOpen, type HoseStrand } from './strand.js';

/**
 * Geometric crossing detection, adapted from the ribbons module for open
 * strands with per-hose radii. Segments are bucketed into a uniform spatial
 * hash, candidate pairs are intersected exactly, and near-tangent multi-hits
 * between the same strand pair are merged into one crossing (an osculating
 * pair wiggles across itself several times; letting each wiggle be its own
 * crossing makes the weave alternate through the graze and mutually shred
 * both hoses). Every threshold that was a global band width in the original
 * is the pair's physical overlap width here: rA + rB.
 */

export interface CrossingEnd {
  strand: number;
  /** Arc position of the crossing along this strand. */
  arc: number;
  /** Unit tangent of this strand at the crossing. */
  tx: number;
  ty: number;
}

export interface Crossing {
  id: number;
  a: CrossingEnd;
  b: CrossingEnd;
  x: number;
  y: number;
  /** Acute angle between the two tangents, radians. */
  angle: number;
}

interface RawHit {
  sa: number;
  sb: number;
  arcA: number;
  arcB: number;
  x: number;
  y: number;
  taX: number;
  taY: number;
  tbX: number;
  tbY: number;
  /** Acute angle between the tangents at the hit. */
  ang: number;
}

export function findHoseCrossings(strands: HoseStrand[], maxCrossings: number): Crossing[] {
  // Global bounds for the hash grid.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  for (const s of strands) {
    maxR = Math.max(maxR, s.r);
    for (const p of s.pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!isFinite(minX)) return [];
  const cell = Math.max(4, 4 * maxR);
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);

  // Global segment ids: strandOffset[k] + segment index (n-1 segments each).
  const strandOffset: number[] = new Array(strands.length);
  let total = 0;
  for (let k = 0; k < strands.length; k++) {
    strandOffset[k] = total;
    total += Math.max(0, strands[k].pts.length - 1);
  }
  const strandOf = (g: number): number => {
    let lo = 0;
    let hi = strands.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (strandOffset[mid] <= g) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const buckets = new Map<number, number[]>();
  for (let k = 0; k < strands.length; k++) {
    const s = strands[k];
    const n = s.pts.length;
    for (let i = 0; i < n - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const cx0 = Math.floor((Math.min(a.x, b.x) - minX) / cell);
      const cx1 = Math.floor((Math.max(a.x, b.x) - minX) / cell);
      const cy0 = Math.floor((Math.min(a.y, b.y) - minY) / cell);
      const cy1 = Math.floor((Math.max(a.y, b.y) - minY) / cell);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
          const key = cy * cols + cx;
          let arr = buckets.get(key);
          if (!arr) {
            arr = [];
            buckets.set(key, arr);
          }
          arr.push(strandOffset[k] + i);
        }
      }
    }
  }

  // Candidate pairs, deduped across shared buckets. Bucket keys are visited
  // in sorted order so discovery order is deterministic.
  const tested = new Set<number>();
  const hits: RawHit[] = [];
  const keys = [...buckets.keys()].sort((p, q) => p - q);
  for (const key of keys) {
    const arr = buckets.get(key)!;
    for (let u = 0; u < arr.length; u++) {
      for (let v = u + 1; v < arr.length; v++) {
        let g1 = arr[u];
        let g2 = arr[v];
        if (g1 === g2) continue;
        if (g1 > g2) {
          const t = g1;
          g1 = g2;
          g2 = t;
        }
        const pairKey = g1 * total + g2;
        if (tested.has(pairKey)) continue;
        tested.add(pairKey);

        const ka = strandOf(g1);
        const kb = strandOf(g2);
        const sa = strands[ka];
        const sb = strands[kb];
        const ia = g1 - strandOffset[ka];
        const ib = g2 - strandOffset[kb];
        if (ka === kb) {
          // Adjacent segments of one strand never register.
          if (Math.abs(ia - ib) <= 1) continue;
        }
        const a0 = sa.pts[ia];
        const a1 = sa.pts[ia + 1];
        const b0 = sb.pts[ib];
        const b1 = sb.pts[ib + 1];

        const rX = a1.x - a0.x;
        const rY = a1.y - a0.y;
        const sX = b1.x - b0.x;
        const sY = b1.y - b0.y;
        const denom = rX * sY - rY * sX;
        if (Math.abs(denom) < 1e-12) continue;
        const qpX = b0.x - a0.x;
        const qpY = b0.y - a0.y;
        const t = (qpX * sY - qpY * sX) / denom;
        const w = (qpX * rY - qpY * rX) / denom;
        if (t < 0 || t > 1 || w < 0 || w > 1) continue;

        const arcA = sa.arc[ia] + t * (sa.arc[ia + 1] - sa.arc[ia]);
        const arcB = sb.arc[ib] + w * (sb.arc[ib + 1] - sb.arc[ib]);
        if (ka === kb) {
          // A self-crossing needs real arc separation.
          if (Math.abs(arcA - arcB) < 6 * sa.r) continue;
        }
        const rl = Math.hypot(rX, rY) || 1;
        const sl = Math.hypot(sX, sY) || 1;
        // Canonical end order: on a self-crossing, end `a` is the earlier pass.
        const swap = ka === kb && arcB < arcA;
        hits.push({
          sa: ka,
          sb: kb,
          arcA: swap ? arcB : arcA,
          arcB: swap ? arcA : arcB,
          x: a0.x + t * rX,
          y: a0.y + t * rY,
          taX: swap ? sX / sl : rX / rl,
          taY: swap ? sY / sl : rY / rl,
          tbX: swap ? rX / rl : sX / sl,
          tbY: swap ? rY / rl : sY / sl,
          ang: Math.acos(Math.min(1, Math.abs((rX * sX + rY * sY) / (rl * sl)))),
        });
      }
    }
  }

  /** Min distance from a point to strand `s` within an arc window. */
  const distNear = (
    s: HoseStrand,
    p: { x: number; y: number },
    arc: number,
    win: number
  ): number => {
    const n = s.pts.length;
    let lo = 0;
    let hi = n - 1;
    const target = Math.max(0, Math.min(s.len, arc));
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s.arc[mid] <= target) lo = mid;
      else hi = mid - 1;
    }
    let best = Infinity;
    const span = Math.ceil(win / Math.max(1, s.len / n));
    for (let d = -span; d <= span; d++) {
      const idx = Math.max(0, Math.min(n - 1, lo + d));
      const q = s.pts[idx];
      const dd = Math.hypot(q.x - p.x, q.y - p.y);
      if (dd < best) best = dd;
    }
    return best;
  };

  // Canonical order, then merge multi-hits between the same strand pair when
  // the strands stay HUGGING between the hits — one crossing per contact
  // region is what a real pile does; the occluder window's separation walk
  // covers the full extent. Genuine double-crossings (strands that separate
  // and come back) survive via the midpoint-separation test.
  hits.sort((p, q) => p.sa - q.sa || p.sb - q.sb || p.arcA - q.arcA || p.arcB - q.arcB);
  const merged: RawHit[] = [];
  for (const h of hits) {
    const prev = merged[merged.length - 1];
    if (prev && prev.sa === h.sa && prev.sb === h.sb) {
      const pairBand = strands[h.sa].r + strands[h.sb].r;
      const nearDist = 1.4 * pairBand;
      const hugDist = 5 * pairBand;
      const dA = Math.abs(h.arcA - prev.arcA);
      const dB = Math.abs(h.arcB - prev.arcB);
      let merge = dA < nearDist && dB < nearDist;
      // The wide merge is for OSCULATIONS only — near-tangent multi-hits of a
      // hugging pair. Steep double-crossings are genuine weave anatomy and
      // must keep their own crossings.
      const nearTangent = prev.ang < 0.7 && h.ang < 0.7;
      if (!merge && nearTangent && dA < hugDist && dB < hugDist) {
        const midArcA = (prev.arcA + h.arcA) / 2;
        const smp = sampleAtOpen(strands[h.sa], midArcA);
        const midArcB = (prev.arcB + h.arcB) / 2;
        merge = distNear(strands[h.sb], smp.p, midArcB, 2 * pairBand) < 1.2 * pairBand;
      }
      if (merge) {
        prev.x = (prev.x + h.x) / 2;
        prev.y = (prev.y + h.y) / 2;
        continue;
      }
    }
    merged.push(h);
  }

  const capped = merged.length > maxCrossings ? merged.slice(0, maxCrossings) : merged;
  return capped.map((h, id) => ({
    id,
    a: { strand: h.sa, arc: h.arcA, tx: h.taX, ty: h.taY },
    b: { strand: h.sb, arc: h.arcB, tx: h.tbX, ty: h.tbY },
    x: h.x,
    y: h.y,
    angle: h.ang,
  }));
}
