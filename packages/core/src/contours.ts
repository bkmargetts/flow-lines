import { Point } from './flow-lines.js';
import { ImageField } from './image-field.js';

export interface ContourOptions {
  /** Edge strength to seed a contour, 0-1 (default 0.3) */
  highThreshold?: number;
  /** Edge strength a contour may continue through, 0-1 (default 0.12) */
  lowThreshold?: number;
  /** Minimum contour length in canvas px (default 15) */
  minLength?: number;
  /** Resample step along the contour in canvas px (default 2) */
  stepLength?: number;
  /** Margin from canvas edges (default 0) */
  margin?: number;
  /** Optional importance sampler; contours fade out in unimportant areas */
  importance?: ((x: number, y: number) => number) | null;
  /**
   * Optional per-location multiplier on minLength, sampled at each
   * segment's midpoint — busy regions can demand longer commitment so
   * texture doesn't shatter into outline confetti
   */
  minLengthScale?: ((x: number, y: number) => number) | null;
  /**
   * Reject contours whose tonal step is spread out rather than sharp:
   * the ratio of the tone change within ±2px of the line to the change
   * within ±6px must average at least this much. A real edge concentrates
   * its step at the line (ratio near 1); a soft mass boundary or water
   * reflection spreads it (ratio near 0.3) — and outlining a soft
   * gradient is the strongest "computer" tell in the output. Depth
   * silhouettes are exempt: real but often tonally soft.
   * 0 disables (default 0.5)
   */
  minSharpness?: number;
}

/**
 * Extract long, smooth contour lines from an image field — the confident
 * outline strokes of a drawing. Canny-style: non-maximum suppression thins
 * edges to ridges, hysteresis keeps weak ridge pixels only when connected
 * to strong ones, then ridges are chained into ordered paths, smoothed,
 * and resampled. Far more coherent than tracing the edge band with
 * streamlines, which produces short wiggly fragments.
 */
export function traceContours(field: ImageField, options: ContourOptions = {}): Point[][] {
  const highThreshold = options.highThreshold ?? 0.3;
  const lowThreshold = Math.min(options.lowThreshold ?? 0.12, highThreshold);
  const minLength = options.minLength ?? 15;
  const stepLength = options.stepLength ?? 2;
  const margin = options.margin ?? 0;
  const importance = options.importance ?? null;
  const minLengthScale = options.minLengthScale ?? null;
  const minSharpness = options.minSharpness ?? 0.5;

  const { width, height, magnitude, gx, gy, scaleX, scaleY } = field.getEdgeData();

  // 1. Non-maximum suppression: keep pixels that are local maxima along
  // the gradient direction
  const ridge = new Uint8Array(width * height);

  const magAt = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
    return magnitude[cy * width + cx];
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const m = magnitude[i];
      if (m < lowThreshold) continue;

      const g = Math.hypot(gx[i], gy[i]);
      if (g < 1e-9) continue;

      const ux = gx[i] / g;
      const uy = gy[i] / g;

      if (m >= magAt(x + ux, y + uy) && m >= magAt(x - ux, y - uy)) {
        ridge[i] = 1;
      }
    }
  }

  // 2. Hysteresis: keep weak ridge pixels only when connected to a strong one
  const keep = new Uint8Array(width * height);
  const stack: number[] = [];

  for (let i = 0; i < width * height; i++) {
    if (ridge[i] && magnitude[i] >= highThreshold) {
      keep[i] = 1;
      stack.push(i);
    }
  }

  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i / width) | 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (ridge[ni] && !keep[ni]) {
          keep[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }

  // 3. Chain ridge pixels into ordered paths, preferring straight-ahead
  // continuation so junctions don't create zigzags
  const visited = new Uint8Array(width * height);
  const chains: number[][] = [];

  const neighborsOf = (i: number): number[] => {
    const x = i % width;
    const y = (i / width) | 0;
    const result: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (keep[ni]) result.push(ni);
      }
    }
    return result;
  };

  const walk = (start: number): number[] => {
    const chain = [start];
    visited[start] = 1;
    let current = start;
    let dirX = 0;
    let dirY = 0;

    for (;;) {
      const candidates = neighborsOf(current).filter((n) => !visited[n]);
      if (candidates.length === 0) break;

      let next = candidates[0];
      if (candidates.length > 1 && (dirX !== 0 || dirY !== 0)) {
        let bestDot = -Infinity;
        for (const c of candidates) {
          const sx = (c % width) - (current % width);
          const sy = ((c / width) | 0) - ((current / width) | 0);
          const len = Math.hypot(sx, sy);
          const dot = (sx * dirX + sy * dirY) / len;
          if (dot > bestDot) {
            bestDot = dot;
            next = c;
          }
        }
      }

      const sx = (next % width) - (current % width);
      const sy = ((next / width) | 0) - ((current / width) | 0);
      const len = Math.hypot(sx, sy);
      dirX = sx / len;
      dirY = sy / len;

      chain.push(next);
      visited[next] = 1;
      current = next;
    }

    return chain;
  };

  // Endpoints first so open curves are traced end-to-end, then loops
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < width * height; i++) {
      if (!keep[i] || visited[i]) continue;

      const degree = neighborsOf(i).length;
      if (pass === 0 && degree > 1) continue;

      // Extend an endpoint walk backwards too, in case we started mid-chain
      const forward = walk(i);
      chains.push(forward);
    }
  }

  // 4. Convert to canvas coordinates, apply importance fading, smooth,
  // resample, and drop short fragments
  const contours: Point[][] = [];

  for (const chain of chains) {
    let points: Point[] = chain.map((i) => ({
      x: (i % width) / scaleX,
      y: ((i / width) | 0) / scaleY,
    }));

    // Importance fading: split the chain where the region is unimportant —
    // background contours break up into fragments and short bits vanish
    const segments: Point[][] = [];
    let current: Point[] = [];
    for (const p of points) {
      const keepPoint =
        (margin === 0 || (p.x >= margin && p.x < field.width - margin && p.y >= margin && p.y < field.height - margin)) &&
        (!importance || importance(p.x, p.y) > 0.2);
      if (keepPoint) {
        current.push(p);
      } else if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    }
    if (current.length > 0) segments.push(current);

    for (const segment of segments) {
      points = smoothPolyline(segment, 2);
      points = resamplePolyline(points, stepLength);

      if (minSharpness > 0 && !isSharp(field, points, minSharpness)) continue;

      let length = 0;
      for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }

      const mid = points[points.length >> 1];
      const required =
        minLength * (minLengthScale && mid ? Math.max(1, minLengthScale(mid.x, mid.y)) : 1);

      if (length >= required && points.length >= 2) {
        contours.push(points);
      }
    }
  }

  return contours;
}

/**
 * Mean edge sharpness along a contour: tone is probed across the line at
 * ±2px and ±6px; a genuine step concentrates its change inside the narrow
 * probe, a soft gradient keeps accumulating contrast out to the wide one.
 * Depth silhouettes count as sharp regardless of tone.
 */
function isSharp(field: ImageField, points: Point[], minSharpness: number): boolean {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < points.length; i += 4) {
    const ahead = points[Math.min(i + 1, points.length - 1)];
    const behind = points[Math.max(i - 1, 0)];
    let nx = -(ahead.y - behind.y);
    let ny = ahead.x - behind.x;
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) continue;
    nx /= len;
    ny /= len;

    const p = points[i];
    if (field.getDepthEdge(p.x, p.y) > 0.3) {
      sum += 1;
      count++;
      continue;
    }

    const near = Math.abs(
      field.getDarkness(p.x + nx * 2, p.y + ny * 2) - field.getDarkness(p.x - nx * 2, p.y - ny * 2)
    );
    const wide = Math.abs(
      field.getDarkness(p.x + nx * 6, p.y + ny * 6) - field.getDarkness(p.x - nx * 6, p.y - ny * 6)
    );
    sum += Math.min(1.2, near / (wide + 0.02));
    count++;
  }

  return count === 0 || sum / count >= minSharpness;
}

/** Iterated moving-average smoothing, keeping endpoints fixed */
function smoothPolyline(points: Point[], iterations: number): Point[] {
  let current = points;

  for (let it = 0; it < iterations; it++) {
    if (current.length < 3) return current;
    const out: Point[] = [current[0]];
    for (let i = 1; i < current.length - 1; i++) {
      out.push({
        x: (current[i - 1].x + current[i].x * 2 + current[i + 1].x) / 4,
        y: (current[i - 1].y + current[i].y * 2 + current[i + 1].y) / 4,
      });
    }
    out.push(current[current.length - 1]);
    current = out;
  }

  return current;
}

/** Resample a polyline at an even arc-length step */
function resamplePolyline(points: Point[], step: number): Point[] {
  if (points.length < 2) return points;

  const out: Point[] = [points[0]];
  let carry = 0;

  for (let i = 1; i < points.length; i++) {
    let prev = out[out.length - 1];
    const target = points[i];
    let segment = Math.hypot(target.x - prev.x, target.y - prev.y);

    while (carry + segment >= step) {
      const t = (step - carry) / segment;
      const next = {
        x: prev.x + (target.x - prev.x) * t,
        y: prev.y + (target.y - prev.y) * t,
      };
      out.push(next);
      segment = Math.hypot(target.x - next.x, target.y - next.y);
      prev = next;
      carry = 0;
    }

    carry += segment;
  }

  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.25) {
    out.push(last);
  }

  return out;
}
