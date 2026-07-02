import { readFileSync } from 'node:fs';
import type { Point } from '@flow-lines/core';

/**
 * Flatten the `d` attributes of every <path> (and <polyline>) in an SVG file
 * into polylines, then fit them into the page's margin box. Supports the common
 * absolute/relative commands (M L H V C S Q T Z); curves are subdivided. This
 * lets `flow-lines vines --composition guide --guide-svg shape.svg` grow vines
 * along any traced outline or letterform.
 */
export function loadGuidePathsFromSvg(file: string, width: number, height: number, margin: number): Point[][] {
  const text = readFileSync(file, 'utf8');
  const polys: Point[][] = [];

  const flattenCubic = (p0: Point, p1: Point, p2: Point, p3: Point, out: Point[]) => {
    const N = 16;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
  };
  const flattenQuad = (p0: Point, p1: Point, p2: Point, out: Point[]) => {
    const N = 12;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
    }
  };

  for (const m of text.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    const d = m[1];
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    let i = 0;
    const num = () => parseFloat(tokens[i++]);
    let cur: Point = { x: 0, y: 0 };
    let start: Point = { x: 0, y: 0 };
    let prevCtrl: Point | null = null;
    let cmd = '';
    let poly: Point[] = [];
    const flush = () => { if (poly.length >= 2) polys.push(poly); poly = []; };
    while (i < tokens.length) {
      const t = tokens[i];
      if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === 'M') {
        const x = num(); const y = num();
        cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        flush();
        poly = [{ ...cur }];
        start = { ...cur };
        cmd = rel ? 'l' : 'L';
        prevCtrl = null;
      } else if (C === 'L') {
        const x = num(); const y = num();
        cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        poly.push({ ...cur });
        prevCtrl = null;
      } else if (C === 'H') {
        const x = num();
        cur = { x: rel ? cur.x + x : x, y: cur.y };
        poly.push({ ...cur });
        prevCtrl = null;
      } else if (C === 'V') {
        const y = num();
        cur = { x: cur.x, y: rel ? cur.y + y : y };
        poly.push({ ...cur });
        prevCtrl = null;
      } else if (C === 'C' || C === 'S') {
        let c1: Point;
        if (C === 'S') {
          c1 = prevCtrl ? { x: 2 * cur.x - prevCtrl.x, y: 2 * cur.y - prevCtrl.y } : { ...cur };
        } else {
          const x1 = num(); const y1 = num();
          c1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        }
        const x2 = num(); const y2 = num(); const x = num(); const y = num();
        const c2 = rel ? { x: cur.x + x2, y: cur.y + y2 } : { x: x2, y: y2 };
        const end = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        flattenCubic(cur, c1, c2, end, poly);
        prevCtrl = c2;
        cur = end;
      } else if (C === 'Q' || C === 'T') {
        let c1: Point;
        if (C === 'T') {
          c1 = prevCtrl ? { x: 2 * cur.x - prevCtrl.x, y: 2 * cur.y - prevCtrl.y } : { ...cur };
        } else {
          const x1 = num(); const y1 = num();
          c1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        }
        const x = num(); const y = num();
        const end = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        flattenQuad(cur, c1, end, poly);
        prevCtrl = c1;
        cur = end;
      } else if (C === 'Z') {
        poly.push({ ...start });
        flush();
        cur = { ...start };
        prevCtrl = null;
      } else {
        i++; // unknown token, skip
      }
    }
    flush();
  }

  for (const m of text.matchAll(/<(?:polyline|polygon)[^>]*\spoints="([^"]+)"/g)) {
    const nums = (m[1].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const poly: Point[] = [];
    for (let k = 0; k + 1 < nums.length; k += 2) poly.push({ x: nums[k], y: nums[k + 1] });
    if (poly.length >= 2) polys.push(poly);
  }

  if (polys.length === 0) return [];
  // Fit every path together into the margin box, preserving aspect ratio.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polys) for (const p of poly) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const bw = Math.max(1e-6, maxX - minX);
  const bh = Math.max(1e-6, maxY - minY);
  const availW = width - 2 * margin;
  const availH = height - 2 * margin;
  const scale = Math.min(availW / bw, availH / bh);
  const offX = margin + (availW - bw * scale) / 2;
  const offY = margin + (availH - bh * scale) / 2;
  return polys.map((poly) => poly.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale })));
}
