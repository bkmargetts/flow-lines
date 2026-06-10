/**
 * Grayscale image utilities used by the image-to-pen-ink pipeline.
 * Images are stored as Float32Array luminance values in [0, 1] (0 = black).
 */

export interface GrayscaleImage {
  width: number;
  height: number;
  /** Row-major luminance values in [0, 1] */
  data: Float32Array;
}

/**
 * Convert RGBA pixel data (e.g. canvas ImageData or decoded PNG/JPEG) to a
 * grayscale image. Transparent pixels are composited over white.
 */
export function grayscaleFromRGBA(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): GrayscaleImage {
  const data = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4] / 255;
    const g = rgba[i * 4 + 1] / 255;
    const b = rgba[i * 4 + 2] / 255;
    const a = rgba[i * 4 + 3] / 255;

    // Rec. 709 luma, composited over a white background
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i] = lum * a + (1 - a);
  }

  return { width, height, data };
}

/**
 * Sample an image with bilinear interpolation. Coordinates are clamped to
 * the image bounds.
 */
export function sampleBilinear(image: GrayscaleImage, x: number, y: number): number {
  const { width, height, data } = image;

  const cx = Math.max(0, Math.min(x, width - 1));
  const cy = Math.max(0, Math.min(y, height - 1));

  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const i00 = data[y0 * width + x0];
  const i10 = data[y0 * width + x1];
  const i01 = data[y1 * width + x0];
  const i11 = data[y1 * width + x1];

  const top = i00 + (i10 - i00) * fx;
  const bottom = i01 + (i11 - i01) * fx;

  return top + (bottom - top) * fy;
}

/**
 * Resize an image so its largest dimension equals maxDim (no-op if already
 * smaller). Uses box-averaged downsampling to avoid aliasing.
 */
export function resizeGrayscale(image: GrayscaleImage, maxDim: number): GrayscaleImage {
  const scale = maxDim / Math.max(image.width, image.height);

  if (scale >= 1) {
    return image;
  }

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Float32Array(width * height);

  const invScale = 1 / scale;

  for (let y = 0; y < height; y++) {
    const sy0 = Math.floor(y * invScale);
    const sy1 = Math.min(image.height, Math.max(sy0 + 1, Math.floor((y + 1) * invScale)));

    for (let x = 0; x < width; x++) {
      const sx0 = Math.floor(x * invScale);
      const sx1 = Math.min(image.width, Math.max(sx0 + 1, Math.floor((x + 1) * invScale)));

      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          sum += image.data[sy * image.width + sx];
          count++;
        }
      }

      data[y * width + x] = sum / count;
    }
  }

  return { width, height, data };
}

/**
 * Separable Gaussian blur. Returns a new image; sigma <= 0 returns a copy.
 */
export function gaussianBlur(image: GrayscaleImage, sigma: number): GrayscaleImage {
  if (sigma <= 0) {
    return { ...image, data: new Float32Array(image.data) };
  }

  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let kernelSum = 0;

  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    kernelSum += v;
  }
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= kernelSum;
  }

  const { width, height } = image;
  const temp = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        sum += image.data[y * width + sx] * kernel[k + radius];
      }
      temp[y * width + x] = sum;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        sum += temp[sy * width + x] * kernel[k + radius];
      }
      out[y * width + x] = sum;
    }
  }

  return { width, height, data: out };
}

/**
 * Stretch image contrast so the given low/high percentiles map to 0 and 1.
 * Makes hatching tone response consistent across washed-out photos.
 */
export function normalizeLevels(
  image: GrayscaleImage,
  lowPercentile: number = 0.02,
  highPercentile: number = 0.98
): GrayscaleImage {
  const bins = 256;
  const histogram = new Uint32Array(bins);

  for (let i = 0; i < image.data.length; i++) {
    const bin = Math.max(0, Math.min(bins - 1, Math.floor(image.data[i] * (bins - 1))));
    histogram[bin]++;
  }

  const total = image.data.length;
  let low = 0;
  let high = bins - 1;
  let cumulative = 0;

  for (let i = 0; i < bins; i++) {
    cumulative += histogram[i];
    if (cumulative >= total * lowPercentile) {
      low = i;
      break;
    }
  }

  cumulative = 0;
  for (let i = bins - 1; i >= 0; i--) {
    cumulative += histogram[i];
    if (cumulative >= total * (1 - highPercentile)) {
      high = i;
      break;
    }
  }

  const lowValue = low / (bins - 1);
  const highValue = high / (bins - 1);
  const range = highValue - lowValue;

  if (range < 0.05) {
    return { ...image, data: new Float32Array(image.data) };
  }

  const data = new Float32Array(image.data.length);
  for (let i = 0; i < image.data.length; i++) {
    data[i] = Math.max(0, Math.min(1, (image.data[i] - lowValue) / range));
  }

  return { width: image.width, height: image.height, data };
}
