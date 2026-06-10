import {
  GrayscaleImage,
  gaussianBlur,
  normalizeLevels,
  resizeGrayscale,
  sampleBilinear,
} from './image.js';

export interface ImageFieldOptions {
  /** Output canvas width the field is sampled in */
  width: number;
  /** Output canvas height the field is sampled in */
  height: number;
  /** Max dimension of the internal working raster (default 600) */
  workingSize?: number;
  /** Pre-blur applied to the tone image, in working pixels (default 1) */
  blurSigma?: number;
  /** Structure tensor smoothing radius — higher gives smoother, longer strokes (default 4) */
  fieldSmoothing?: number;
  /** Fallback hatch angle in radians used where the image has no clear structure (default -45°) */
  hatchAngle?: number;
  /** When false, ignore image structure and hatch at the fixed angle everywhere (default true) */
  followTone?: boolean;
  /** Auto-stretch contrast before rendering (default true) */
  normalizeContrast?: boolean;
}

/**
 * Tone, stroke orientation, and edge strength derived from an image,
 * sampled in output canvas coordinates.
 *
 * The orientation field follows image contours: it is the minor eigenvector
 * of the smoothed structure tensor (perpendicular to the local gradient),
 * so strokes wrap around forms like shading in a pen drawing. In flat
 * regions it blends toward a fixed hatch angle. Orientations are
 * pi-periodic; tracing code picks a consistent sign as it integrates.
 */
export class ImageField {
  readonly width: number;
  readonly height: number;

  private tone: GrayscaleImage;
  /** Doubled-angle orientation vectors, weighted by local coherence */
  private orientCos: GrayscaleImage;
  private orientSin: GrayscaleImage;
  private edge: GrayscaleImage;
  private scaleX: number;
  private scaleY: number;

  constructor(image: GrayscaleImage, options: ImageFieldOptions) {
    this.width = options.width;
    this.height = options.height;

    const workingSize = options.workingSize ?? 600;
    const blurSigma = options.blurSigma ?? 1;
    const fieldSmoothing = options.fieldSmoothing ?? 4;
    const hatchAngle = options.hatchAngle ?? -Math.PI / 4;
    const followTone = options.followTone ?? true;
    const normalizeContrast = options.normalizeContrast ?? true;

    let working = resizeGrayscale(image, workingSize);
    if (normalizeContrast) {
      working = normalizeLevels(working);
    }

    this.tone = gaussianBlur(working, blurSigma);
    this.scaleX = this.tone.width / this.width;
    this.scaleY = this.tone.height / this.height;

    const { width, height } = this.tone;
    const gx = new Float32Array(width * height);
    const gy = new Float32Array(width * height);

    // Sobel gradients on the blurred tone image
    const at = (x: number, y: number) => {
      const cx = Math.max(0, Math.min(width - 1, x));
      const cy = Math.max(0, Math.min(height - 1, y));
      return this.tone.data[cy * width + cx];
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tl = at(x - 1, y - 1);
        const tc = at(x, y - 1);
        const tr = at(x + 1, y - 1);
        const ml = at(x - 1, y);
        const mr = at(x + 1, y);
        const bl = at(x - 1, y + 1);
        const bc = at(x, y + 1);
        const br = at(x + 1, y + 1);

        gx[y * width + x] = (tr + 2 * mr + br - tl - 2 * ml - bl) / 4;
        gy[y * width + x] = (bl + 2 * bc + br - tl - 2 * tc - tr) / 4;
      }
    }

    // Structure tensor components, smoothed so orientation propagates
    // coherently into nearby flat regions
    const jxx: GrayscaleImage = { width, height, data: new Float32Array(width * height) };
    const jxy: GrayscaleImage = { width, height, data: new Float32Array(width * height) };
    const jyy: GrayscaleImage = { width, height, data: new Float32Array(width * height) };

    for (let i = 0; i < width * height; i++) {
      jxx.data[i] = gx[i] * gx[i];
      jxy.data[i] = gx[i] * gy[i];
      jyy.data[i] = gy[i] * gy[i];
    }

    const sxx = gaussianBlur(jxx, fieldSmoothing);
    const sxy = gaussianBlur(jxy, fieldSmoothing);
    const syy = gaussianBlur(jyy, fieldSmoothing);

    // Reference energy for deciding how "structured" a region is
    let meanEnergy = 0;
    for (let i = 0; i < width * height; i++) {
      meanEnergy += sxx.data[i] + syy.data[i];
    }
    meanEnergy = Math.max(meanEnergy / (width * height), 1e-8);

    const fallbackCos = Math.cos(2 * hatchAngle);
    const fallbackSin = Math.sin(2 * hatchAngle);

    this.orientCos = { width, height, data: new Float32Array(width * height) };
    this.orientSin = { width, height, data: new Float32Array(width * height) };

    for (let i = 0; i < width * height; i++) {
      let w = 0;
      let tangentCos = fallbackCos;
      let tangentSin = fallbackSin;

      if (followTone) {
        const xx = sxx.data[i];
        const xy = sxy.data[i];
        const yy = syy.data[i];

        const energy = xx + yy;
        const diff = Math.sqrt((xx - yy) * (xx - yy) + 4 * xy * xy);
        const coherence = energy > 1e-12 ? diff / energy : 0;

        // Gradient orientation doubled-angle vector is (xx - yy, 2 xy);
        // the contour tangent is rotated 90°, which negates it in
        // doubled-angle space.
        if (diff > 1e-12) {
          tangentCos = -(xx - yy) / diff;
          tangentSin = -(2 * xy) / diff;
        }

        // Saturating energy weight: well below the image's mean energy
        // counts as flat, anywhere near it counts as fully structured
        w = coherence * (energy / (energy + 0.1 * meanEnergy));
      }

      this.orientCos.data[i] = w * tangentCos + (1 - w) * fallbackCos;
      this.orientSin.data[i] = w * tangentSin + (1 - w) * fallbackSin;
    }

    // Edge strength, normalized by a high percentile so isolated extreme
    // gradients don't crush the scale
    const edgeData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      edgeData[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    }

    const sorted = Float32Array.from(edgeData).sort();
    const ref = Math.max(sorted[Math.floor(sorted.length * 0.99)], 1e-6);

    for (let i = 0; i < width * height; i++) {
      edgeData[i] = Math.min(1, edgeData[i] / ref);
    }

    this.edge = { width, height, data: edgeData };
  }

  /** Darkness in [0, 1] at canvas coordinates (1 = black) */
  getDarkness(x: number, y: number): number {
    return 1 - sampleBilinear(this.tone, x * this.scaleX, y * this.scaleY);
  }

  /** Stroke orientation in radians at canvas coordinates (pi-periodic) */
  getOrientation(x: number, y: number): number {
    const c = sampleBilinear(this.orientCos, x * this.scaleX, y * this.scaleY);
    const s = sampleBilinear(this.orientSin, x * this.scaleX, y * this.scaleY);
    return 0.5 * Math.atan2(s, c);
  }

  /** Edge strength in [0, 1] at canvas coordinates */
  getEdgeStrength(x: number, y: number): number {
    return sampleBilinear(this.edge, x * this.scaleX, y * this.scaleY);
  }

  isInBounds(x: number, y: number, margin: number = 0): boolean {
    return x >= margin && x < this.width - margin && y >= margin && y < this.height - margin;
  }
}
