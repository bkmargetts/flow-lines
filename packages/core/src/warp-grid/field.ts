import { Point } from '../flow-lines.js';
import { WarpBasePattern } from './types.js';

export interface BaseLine {
  points: Point[];
  /** Unit normal per sample — the direction the relief shift pushes */
  normals: Point[];
}

export interface BaseField {
  /** Lines in occlusion/compression order; every line has the same sample
   *  count, index-aligned with its neighbours */
  lines: BaseLine[];
  /** Whether hidden-line occlusion is meaningful ('lines'/'waves' only) */
  occludable: boolean;
  /** The shared frame normal occlusion projects onto ('lines'/'waves') */
  nx: number;
  ny: number;
}

export interface FieldParams {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Line pitch in px */
  spacing: number;
  /** Base direction in degrees ('lines'/'waves') */
  angle: number;
  /** Transverse sine amplitude 0..1 of pitch ('waves') */
  waveAmp: number;
  /** Sine wavelength in px ('waves') */
  wavelength: number;
  /** Sample step along lines in px */
  detail: number;
  /** Overscan beyond the inner rect so warps can't pull gaps in from the edge */
  pad: number;
  /** Total point budget — detail coarsens uniformly to fit */
  pointCap: number;
}

/**
 * Sample the undeformed grating. Fields are generated oversized (the rotated
 * inner-rect diagonal plus the warp reach) and clipped after warping; sample
 * grids are index-aligned across neighbouring lines so occlusion and the
 * compression floor can compare like with like.
 */
export function buildField(pattern: WarpBasePattern, p: FieldParams): BaseField {
  const innerW = p.x1 - p.x0;
  const innerH = p.y1 - p.y0;
  const cx = (p.x0 + p.x1) / 2;
  const cy = (p.y0 + p.y1) / 2;
  const halfDiag = Math.hypot(innerW, innerH) / 2;
  const minDim = Math.min(innerW, innerH);

  if (pattern === 'circles') {
    const rMax = halfDiag + p.pad;
    const ringCount = Math.floor(rMax / p.spacing);
    const circumference = 2 * Math.PI * rMax;
    const est = ringCount * (circumference / p.detail);
    const detail = p.detail * Math.max(1, est / p.pointCap);
    const n = Math.max(24, Math.ceil(circumference / detail));
    const lines: BaseLine[] = [];
    for (let k = 1; k <= ringCount; k++) {
      const r = k * p.spacing;
      const points: Point[] = new Array(n + 1);
      const normals: Point[] = new Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        points[i] = { x: cx + ca * r, y: cy + sa * r };
        normals[i] = { x: ca, y: sa };
      }
      lines.push({ points, normals });
    }
    return { lines, occludable: false, nx: 0, ny: 1 };
  }

  if (pattern === 'rays') {
    const rMax = halfDiag + p.pad;
    // Spoke count set where the tangential gap equals the pitch at a third of
    // the sheet; the hollow centre keeps convergence from pooling outright.
    const count = Math.max(12, Math.round((2 * Math.PI * (minDim * 0.3)) / p.spacing));
    const rInner = minDim * 0.05;
    const est = count * ((rMax - rInner) / p.detail);
    const detail = p.detail * Math.max(1, est / p.pointCap);
    const n = Math.max(8, Math.ceil((rMax - rInner) / detail));
    const lines: BaseLine[] = [];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const points: Point[] = new Array(n + 1);
      const normals: Point[] = new Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const r = rInner + ((rMax - rInner) * i) / n;
        points[i] = { x: cx + ca * r, y: cy + sa * r };
        normals[i] = { x: -sa, y: ca };
      }
      lines.push({ points, normals });
    }
    return { lines, occludable: false, nx: 0, ny: 1 };
  }

  // 'lines' / 'waves'
  const rad = (p.angle * Math.PI) / 180;
  const tx = Math.cos(rad);
  const ty = Math.sin(rad);
  const nx = -ty;
  const ny = tx;
  const halfU = halfDiag + p.pad;
  const halfV = halfDiag + p.pad;
  const lineCount = Math.floor((2 * halfV) / p.spacing) + 1;
  const est = lineCount * ((2 * halfU) / p.detail);
  const detail = p.detail * Math.max(1, est / p.pointCap);
  const n = Math.max(8, Math.ceil((2 * halfU) / detail));
  const vStart = -Math.floor(halfV / p.spacing) * p.spacing;
  const lines: BaseLine[] = [];
  for (let k = 0; ; k++) {
    const v = vStart + k * p.spacing;
    if (v > halfV) break;
    const points: Point[] = new Array(n + 1);
    const normals: Point[] = new Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const u = -halfU + ((2 * halfU) * i) / n;
      const vEff =
        pattern === 'waves'
          ? v +
            p.waveAmp *
              p.spacing *
              0.9 *
              Math.sin((2 * Math.PI * u) / p.wavelength + (v / p.spacing) * 0.55)
          : v;
      points[i] = { x: cx + tx * u + nx * vEff, y: cy + ty * u + ny * vEff };
      normals[i] = { x: nx, y: ny };
    }
    lines.push({ points, normals });
  }
  return { lines, occludable: true, nx, ny };
}
