import { Point } from './flow-lines.js';
import { GrayscaleImage, gaussianBlur, sampleBilinear } from './image.js';

/**
 * Face geometry for portrait-aware rendering. All coordinates are
 * normalized to [0, 1] relative to the output canvas (the format face
 * landmark detectors produce), so they are independent of output size.
 */
export interface PortraitOptions {
  /** One polygon per detected face; skin inside is lightened so paper does the work */
  faceOvals?: Point[][];
  /** Polygons around features (eyes, brows, lips) that must keep full detail */
  featureRegions?: Point[][];
  /** Polylines drawn directly as clean strokes (eyelids, brows, lip lines) */
  featureStrokes?: Point[][];
  /** How much skin tone is lightened inside face ovals, 0-1 (default 0.55) */
  skinLightening?: number;
  /** Importance floor inside feature regions, 0-1 (default 0.9) */
  featureBoost?: number;
}

/** Resolution of the rasterized face maps (max dimension) */
const MAP_SIZE = 256;

export interface PortraitMaps {
  /** 1 inside face skin, soft-edged */
  skin: ((x: number, y: number) => number) | null;
  /** 1 inside feature regions, soft-edged */
  feature: ((x: number, y: number) => number) | null;
  skinLightening: number;
  featureBoost: number;
}

/**
 * Rasterize portrait polygons into soft-edged lookup maps sampled in
 * output canvas coordinates.
 */
export function buildPortraitMaps(
  portrait: PortraitOptions,
  width: number,
  height: number
): PortraitMaps {
  const skinLightening = Math.max(0, Math.min(1, portrait.skinLightening ?? 0.55));
  const featureBoost = Math.max(0, Math.min(1, portrait.featureBoost ?? 0.9));

  const scale = MAP_SIZE / Math.max(width, height);
  const mapW = Math.max(1, Math.round(width * scale));
  const mapH = Math.max(1, Math.round(height * scale));

  const toMapPolygon = (polygon: Point[]): Point[] =>
    polygon.map((p) => ({ x: p.x * mapW, y: p.y * mapH }));

  const makeSampler = (
    polygons: Point[][] | undefined,
    blurSigma: number
  ): ((x: number, y: number) => number) | null => {
    if (!polygons || polygons.length === 0) return null;

    const raster: GrayscaleImage = {
      width: mapW,
      height: mapH,
      data: new Float32Array(mapW * mapH),
    };

    for (const polygon of polygons) {
      if (polygon.length >= 3) {
        fillPolygon(raster, toMapPolygon(polygon));
      }
    }

    const soft = gaussianBlur(raster, blurSigma);
    const sx = mapW / width;
    const sy = mapH / height;
    return (x: number, y: number) => sampleBilinear(soft, x * sx, y * sy);
  };

  return {
    skin: makeSampler(portrait.faceOvals, 3),
    feature: makeSampler(portrait.featureRegions, 2),
    skinLightening,
    featureBoost,
  };
}

/**
 * Scanline even-odd polygon fill into a grayscale raster
 */
function fillPolygon(raster: GrayscaleImage, polygon: Point[]): void {
  const { width, height, data } = raster;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));

  for (let y = y0; y <= y1; y++) {
    const scanY = y + 0.5;
    const crossings: number[] = [];

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];

      if (a.y <= scanY === b.y <= scanY) continue;
      crossings.push(a.x + ((scanY - a.y) / (b.y - a.y)) * (b.x - a.x));
    }

    crossings.sort((p, q) => p - q);

    for (let c = 0; c + 1 < crossings.length; c += 2) {
      const x0 = Math.max(0, Math.round(crossings[c]));
      const x1 = Math.min(width - 1, Math.round(crossings[c + 1]));
      for (let x = x0; x <= x1; x++) {
        data[y * width + x] = 1;
      }
    }
  }
}

/**
 * Convert normalized feature polylines into canvas-space strokes,
 * resampled to an even step so they blend with traced hatching.
 */
export function featureStrokesToLines(
  strokes: Point[][] | undefined,
  width: number,
  height: number,
  stepLength: number
): Point[][] {
  if (!strokes) return [];

  const lines: Point[][] = [];

  for (const stroke of strokes) {
    if (stroke.length < 2) continue;

    const scaled = stroke.map((p) => ({ x: p.x * width, y: p.y * height }));
    const resampled: Point[] = [scaled[0]];
    let carry = 0;

    for (let i = 1; i < scaled.length; i++) {
      let prev = resampled[resampled.length - 1];
      const target = scaled[i];
      let segment = Math.hypot(target.x - prev.x, target.y - prev.y);

      while (carry + segment >= stepLength) {
        const t = (stepLength - carry) / segment;
        const next = {
          x: prev.x + (target.x - prev.x) * t,
          y: prev.y + (target.y - prev.y) * t,
        };
        resampled.push(next);
        segment = Math.hypot(target.x - next.x, target.y - next.y);
        prev = next;
        carry = 0;
      }

      carry += segment;
    }

    const last = scaled[scaled.length - 1];
    const tail = resampled[resampled.length - 1];
    if (Math.hypot(last.x - tail.x, last.y - tail.y) > stepLength * 0.25) {
      resampled.push(last);
    }

    if (resampled.length >= 2) {
      lines.push(resampled);
    }
  }

  return lines;
}
