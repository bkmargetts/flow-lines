import { readFileSync } from 'node:fs';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  grayscaleFromRGBA,
  type DirectionMap,
  type GrayscaleImage,
  type LabelImage,
} from '@flow-lines/core';

/**
 * Decode a PNG or JPEG file (detected by magic bytes) into RGBA pixels
 */
export function loadRGBA(path: string): { data: Uint8Array; width: number; height: number } {
  const buffer = readFileSync(path);

  // PNG signature
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    const png = PNG.sync.read(buffer);
    return { data: png.data, width: png.width, height: png.height };
  }

  // JPEG signature
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpeg = decodeJpeg(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return { data: jpeg.data, width: jpeg.width, height: jpeg.height };
  }

  throw new Error(`Unsupported image format: ${path} (only PNG and JPEG are supported)`);
}

/**
 * Load a normal/flow map: R and G channels encode the X and Y direction
 * components (128 = zero), as in a tangent-space normal map
 */
export function loadDirectionMap(path: string): DirectionMap {
  const { data, width, height } = loadRGBA(path);
  const x = new Float32Array(width * height);
  const y = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    x[i] = (data[i * 4] / 255) * 2 - 1;
    y[i] = (data[i * 4 + 1] / 255) * 2 - 1;
  }

  return { width, height, x, y };
}

/**
 * Load a semantic label raster: the red channel carries the taxonomy id
 * directly (0 unknown, 1 sky, 2 water, 3 foliage, 4 ground, 5 building,
 * 6 person, 7 object), e.g. from scripts/segment-labels.mjs
 */
export function loadLabelImage(path: string): LabelImage {
  const { data, width, height } = loadRGBA(path);
  const labels = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    labels[i] = data[i * 4];
  }
  return { width, height, data: labels };
}

/**
 * Decode a PNG or JPEG file (detected by magic bytes) into a grayscale image
 */
export function loadImage(path: string): GrayscaleImage {
  const buffer = readFileSync(path);

  // PNG signature
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    const png = PNG.sync.read(buffer);
    return grayscaleFromRGBA(png.data, png.width, png.height);
  }

  // JPEG signature
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpeg = decodeJpeg(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return grayscaleFromRGBA(jpeg.data, jpeg.width, jpeg.height);
  }

  throw new Error(`Unsupported image format: ${path} (only PNG and JPEG are supported)`);
}
