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
  /** Max dimension of the internal working raster (default 720) */
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
  /**
   * Posterize large-scale tone into this many discrete value bands —
   * the "value plan" an artist commits to before rendering. The tone
   * image is blurred so bands form big simple shapes, then snapped to
   * evenly spread levels from paper to black. 0/1 disables (default 0)
   */
  valueBands?: number;
  /**
   * Estimated depth map (bright = near), e.g. from a monocular depth
   * model. Drives form-following stroke orientation and silhouette edges
   */
  depthMap?: GrayscaleImage;
  /** How strongly depth overrides the image-gradient orientation, 0-1 (default 0.8) */
  formStrength?: number;
  /**
   * External direction field (e.g. derived from a surface-normal map).
   * Vector magnitude is the blend weight, so zero vectors leave the
   * image-derived orientation untouched. Takes precedence over both the
   * luminance tensor and the depth field where its magnitude is high
   */
  flowMap?: DirectionMap;
}

/** A per-pixel direction field; any resolution, stretched over the canvas */
export interface DirectionMap {
  width: number;
  height: number;
  /** X components, row-major */
  x: Float32Array;
  /** Y components, row-major (positive = down, image convention) */
  y: Float32Array;
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
  /** Tone before contrast normalization — absolute photo brightness */
  private absTone: GrayscaleImage;
  /** Heavily blurred darkness — large-scale tonal masses before banding */
  private massBlur: GrayscaleImage;
  /** One-sided mass-scale contrast: how much darker than its
   * surroundings a region is, peaking at mass boundaries */
  private counterBoost: GrayscaleImage;
  /** Blurred tone snapped to discrete value bands (darkness, 1 = black) */
  private massDarkness: GrayscaleImage | null = null;
  /** Doubled-angle orientation vectors, weighted by local coherence */
  private orientCos: GrayscaleImage;
  private orientSin: GrayscaleImage;
  private edge: GrayscaleImage;
  private detail: GrayscaleImage;
  private gx: Float32Array;
  private gy: Float32Array;
  private scaleX: number;
  private scaleY: number;
  private depth: GrayscaleImage | null = null;
  private depthEdge: GrayscaleImage | null = null;
  private formConfidence: GrayscaleImage | null = null;

  constructor(image: GrayscaleImage, options: ImageFieldOptions) {
    this.width = options.width;
    this.height = options.height;

    const workingSize = options.workingSize ?? 720;
    const blurSigma = options.blurSigma ?? 1;
    const fieldSmoothing = options.fieldSmoothing ?? 4;
    const hatchAngle = options.hatchAngle ?? -Math.PI / 4;
    const followTone = options.followTone ?? true;
    const normalizeContrast = options.normalizeContrast ?? true;

    const resized = resizeGrayscale(image, workingSize);
    const working = normalizeContrast ? normalizeLevels(resized) : resized;

    this.tone = gaussianBlur(working, blurSigma);
    // Pre-normalization tone: contrast stretching reallocates the tonal
    // range for ink coverage, but material judgments ("is this sky grey
    // or white?") need the photo's absolute brightness — a grey sky that
    // happens to be the brightest region must not normalize to paper
    this.absTone = normalizeContrast ? gaussianBlur(resized, blurSigma) : this.tone;
    this.scaleX = this.tone.width / this.width;
    this.scaleY = this.tone.height / this.height;

    const { width, height } = this.tone;

    // Heavy blur so tonal masses come out as big simple shapes rather
    // than per-pixel noise — feeds the value plan and cloud-edge carving
    const massSigma = Math.max(2.5, Math.max(width, height) / 150);
    const massTone = gaussianBlur(this.tone, massSigma);
    const massData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      massData[i] = 1 - massTone.data[i];
    }
    this.massBlur = { width, height, data: massData };

    // Counterchange boost: one-sided local contrast on the mass tone. A
    // wide blur gives the neighbourhood average; where a mass is darker
    // than its surroundings the difference peaks at the boundary and
    // decays inward — tone darkens right where a dark mass meets a
    // lighter one (background swelling behind a light subject, shadow
    // biting at its edge) and relaxes in the interior. The lighter side
    // is left untouched.
    const wideSigma = Math.max(6, Math.max(width, height) / 40);
    const wide = gaussianBlur(this.massBlur, wideSigma);
    const boostData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      boostData[i] = Math.max(0, massData[i] - wide.data[i]);
    }
    this.counterBoost = { width, height, data: boostData };

    const valueBands = Math.round(options.valueBands ?? 0);
    if (valueBands >= 2) {
      // Band levels are spread across the full paper-to-black range so
      // the plan commits to real darks
      const data = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const d = this.massBlur.data[i];
        const band = Math.max(0, Math.min(valueBands - 1, Math.floor(d * valueBands)));
        data[i] = band / (valueBands - 1);
      }
      this.massDarkness = { width, height, data };
    }
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

    // Detail map: gradient energy pooled over a neighbourhood, so textured
    // and structured regions score high while flat areas score near zero
    const energy: GrayscaleImage = { width, height, data: new Float32Array(width * height) };
    for (let i = 0; i < width * height; i++) {
      energy.data[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    }

    const pooled = gaussianBlur(energy, Math.max(3, Math.max(width, height) / 50));
    const pooledSorted = Float32Array.from(pooled.data).sort();
    const detailRef = Math.max(pooledSorted[Math.floor(pooledSorted.length * 0.9)], 1e-6);

    const detailData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      detailData[i] = Math.min(1, pooled.data[i] / detailRef);
    }

    this.detail = { width, height, data: detailData };
    this.gx = gx;
    this.gy = gy;

    if (options.depthMap) {
      this.attachDepth(options.depthMap, options.formStrength ?? 0.8);
    }
    if (options.flowMap) {
      this.attachFlow(options.flowMap);
    }
  }

  /**
   * Override orientation with an external direction field, weighted by
   * the field's local vector magnitude (clamped to 1)
   */
  private attachFlow(flow: DirectionMap): void {
    const { width, height } = this.tone;
    const sx = flow.width / width;
    const sy = flow.height / height;

    const fx: GrayscaleImage = { width: flow.width, height: flow.height, data: flow.x };
    const fy: GrayscaleImage = { width: flow.width, height: flow.height, data: flow.y };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vx = sampleBilinear(fx, x * sx, y * sy);
        const vy = sampleBilinear(fy, x * sx, y * sy);
        const mag = Math.hypot(vx, vy);
        if (mag < 1e-6) continue;

        const w = Math.min(1, mag);
        // Doubled-angle vector of the direction (pi-periodic)
        const c2 = (vx * vx - vy * vy) / (mag * mag);
        const s2 = (2 * vx * vy) / (mag * mag);

        const i = y * width + x;
        this.orientCos.data[i] = w * c2 + (1 - w) * this.orientCos.data[i];
        this.orientSin.data[i] = w * s2 + (1 - w) * this.orientSin.data[i];
      }
    }
  }

  /**
   * Blend a depth map into the field: stroke orientation follows the 3D
   * form (tangent to the depth gradient, i.e. along the surface), and
   * depth discontinuities become silhouette edges that strengthen the
   * edge map and let strokes terminate cleanly at object boundaries.
   */
  private attachDepth(depthMap: GrayscaleImage, formStrength: number): void {
    const { width, height } = this.tone;

    // Resample the depth map onto the working raster
    const raw = new Float32Array(width * height);
    const sx = depthMap.width / width;
    const sy = depthMap.height / height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        raw[y * width + x] = sampleBilinear(depthMap, x * sx, y * sy);
      }
    }

    const depth = gaussianBlur({ width, height, data: raw }, 1.5);
    this.depth = depth;

    // Sobel gradients of depth
    const at = (x: number, y: number): number => {
      const cx = Math.max(0, Math.min(width - 1, x));
      const cy = Math.max(0, Math.min(height - 1, y));
      return depth.data[cy * width + cx];
    };

    const energy = new Float32Array(width * height);
    const tanCos = new Float32Array(width * height);
    const tanSin = new Float32Array(width * height);
    const dgxArr = new Float32Array(width * height);
    const dgyArr = new Float32Array(width * height);
    let meanEnergy = 0;

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

        const dgx = (tr + 2 * mr + br - tl - 2 * ml - bl) / 4;
        const dgy = (bl + 2 * bc + br - tl - 2 * tc - tr) / 4;

        const i = y * width + x;
        dgxArr[i] = dgx;
        dgyArr[i] = dgy;
        const e = dgx * dgx + dgy * dgy;
        energy[i] = e;
        meanEnergy += e;

        // Tangent to the depth gradient = direction along the form.
        // In doubled-angle space, rotating by 90° negates the vector.
        if (e > 1e-12) {
          tanCos[i] = -((dgx * dgx - dgy * dgy) / e);
          tanSin[i] = -((2 * dgx * dgy) / e);
        }
      }
    }
    meanEnergy = Math.max(meanEnergy / (width * height), 1e-12);

    // Depth discontinuities: normalize gradient magnitude by a high
    // percentile, then fold into the edge map so contours trace silhouettes
    const mag = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      mag[i] = Math.sqrt(energy[i]);
    }
    const sorted = Float32Array.from(mag).sort();
    const ref = Math.max(sorted[Math.floor(sorted.length * 0.99)], 1e-6);

    const edgeData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      edgeData[i] = Math.min(1, mag[i] / ref);
      this.edge.data[i] = Math.max(this.edge.data[i], edgeData[i]);
    }

    this.depthEdge = { width, height, data: edgeData };

    // Principal curvature frame from the depth Hessian (Hertzmann & Zorin):
    // the gradient tangent vanishes on crests (tube centerlines, sphere
    // tops) exactly where curvature is strongest, so the eigenvector of
    // the dominant second derivative supplies the stable along-form
    // direction there. A depth STEP is a discontinuity, not curvature —
    // its gradients are zeroed before the Hessian so silhouettes cannot
    // leak ~1000x-stronger second derivatives into the frame.
    // Surface gradients live near the image's median magnitude; a step's
    // skirt is orders of magnitude above it. An absolute cut at a few
    // medians removes the discontinuity entirely without touching form.
    const medianMag = sorted[Math.floor(sorted.length * 0.5)];
    const gradCut = Math.max(8 * medianMag, 1e-9);
    const maskedGx = new Float32Array(width * height);
    const maskedGy = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const keepIt = mag[i] <= gradCut ? 1 : 0;
      maskedGx[i] = dgxArr[i] * keepIt;
      maskedGy[i] = dgyArr[i] * keepIt;
    }
    const sgx = gaussianBlur({ width, height, data: maskedGx }, 2);
    const sgy = gaussianBlur({ width, height, data: maskedGy }, 2);

    const curvCos = new Float32Array(width * height);
    const curvSin = new Float32Array(width * height);
    const curvWeight = new Float32Array(width * height);

    const gAt = (arr: Float32Array, x: number, y: number): number => {
      const cx = Math.max(0, Math.min(width - 1, x));
      const cy = Math.max(0, Math.min(height - 1, y));
      return arr[cy * width + cx];
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const dxx = (gAt(sgx.data, x + 1, y) - gAt(sgx.data, x - 1, y)) / 2;
        const dxy =
          (gAt(sgx.data, x, y + 1) - gAt(sgx.data, x, y - 1)) / 4 +
          (gAt(sgy.data, x + 1, y) - gAt(sgy.data, x - 1, y)) / 4;
        const dyy = (gAt(sgy.data, x, y + 1) - gAt(sgy.data, x, y - 1)) / 2;

        const mean = (dxx + dyy) / 2;
        const disc = Math.sqrt(((dxx - dyy) / 2) ** 2 + dxy * dxy);
        const lamPlus = mean + disc;
        const lamMinus = mean - disc;

        const big = Math.abs(lamPlus) >= Math.abs(lamMinus) ? lamPlus : lamMinus;
        const small = Math.abs(lamPlus) >= Math.abs(lamMinus) ? lamMinus : lamPlus;

        // Eigenvector direction for lamPlus; the dominant-|curvature|
        // direction runs ACROSS the form, so along-form is its normal
        const thetaPlus = 0.5 * Math.atan2(2 * dxy, dxx - dyy);
        const across = big === lamPlus ? thetaPlus : thetaPlus + Math.PI / 2;
        const along = across + Math.PI / 2;

        const magBig = Math.abs(big);
        const anisotropy = (magBig - Math.abs(small)) / (magBig + Math.abs(small) + 1e-12);

        curvCos[i] = Math.cos(2 * along);
        curvSin[i] = Math.sin(2 * along);
        // Masked-gradient discontinuities at the zeroed band still create
        // artificial bending right next to the rim — damp it locally
        curvWeight[i] = anisotropy * magBig * Math.max(0, 1 - 2 * edgeData[i]);
      }
    }

    // Normalize against a high percentile of genuine surface bending
    const curvSorted = Float32Array.from(curvWeight).sort();
    const curvRef = Math.max(curvSorted[Math.floor(curvSorted.length * 0.9)], 1e-12);

    // Blend depth-derived orientation over the luminance-derived field,
    // combining the gradient tangent with the curvature frame; keep the
    // combined confidence around for per-stroke style dispatch
    const confidence = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const wg = energy[i] / (energy[i] + 0.1 * meanEnergy);
      const wc = Math.min(1, curvWeight[i] / (curvWeight[i] + 0.1 * curvRef));

      const vx = wc * curvCos[i] + wg * tanCos[i];
      const vy = wc * curvSin[i] + wg * tanSin[i];
      const vmag = Math.hypot(vx, vy);

      const conf = Math.min(1, Math.max(wg, wc));
      confidence[i] = conf;

      if (vmag < 1e-9) continue;
      const w = formStrength * conf;
      this.orientCos.data[i] = w * (vx / vmag) + (1 - w) * this.orientCos.data[i];
      this.orientSin.data[i] = w * (vy / vmag) + (1 - w) * this.orientSin.data[i];
    }
    this.formConfidence = { width, height, data: confidence };
  }

  /** Whether a depth map is attached */
  hasDepth(): boolean {
    return this.depth !== null;
  }

  /** Depth in [0, 1] at canvas coordinates (1 = near); 0.5 when no depth map */
  getDepth(x: number, y: number): number {
    if (!this.depth) return 0.5;
    return sampleBilinear(this.depth, x * this.scaleX, y * this.scaleY);
  }

  /** Depth discontinuity strength in [0, 1] at canvas coordinates */
  getDepthEdge(x: number, y: number): number {
    if (!this.depthEdge) return 0;
    return sampleBilinear(this.depthEdge, x * this.scaleX, y * this.scaleY);
  }

  /**
   * How confidently the depth map describes a curved 3D form here,
   * in [0, 1]; 0 without a depth map or on depth-flat regions
   */
  getFormConfidence(x: number, y: number): number {
    if (!this.formConfidence) return 0;
    return sampleBilinear(this.formConfidence, x * this.scaleX, y * this.scaleY);
  }

  /**
   * Raw working-resolution edge data for contour extraction: normalized
   * edge magnitudes, Sobel gradients, and the canvas-to-raster scale
   */
  getEdgeData(): {
    width: number;
    height: number;
    magnitude: Float32Array;
    gx: Float32Array;
    gy: Float32Array;
    scaleX: number;
    scaleY: number;
  } {
    return {
      width: this.edge.width,
      height: this.edge.height,
      magnitude: this.edge.data,
      gx: this.gx,
      gy: this.gy,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
    };
  }

  /** Darkness in [0, 1] at canvas coordinates (1 = black) */
  getDarkness(x: number, y: number): number {
    return 1 - sampleBilinear(this.tone, x * this.scaleX, y * this.scaleY);
  }

  /**
   * Absolute darkness in [0, 1] at canvas coordinates, before contrast
   * normalization — the photo's actual brightness, for material
   * judgments that must not depend on the rest of the frame
   */
  getAbsoluteDarkness(x: number, y: number): number {
    return 1 - sampleBilinear(this.absTone, x * this.scaleX, y * this.scaleY);
  }

  /**
   * The blurred large-scale darkness raster (pre-banding) with the
   * raster-to-canvas scale — for tracing tonal mass boundaries
   */
  getMassRaster(): { raster: GrayscaleImage; scaleX: number; scaleY: number } {
    return { raster: this.massBlur, scaleX: this.scaleX, scaleY: this.scaleY };
  }

  /**
   * Counterchange boost in [0, 1) at canvas coordinates: how much darker
   * than its wide surroundings the local tonal mass is. Peaks at the
   * dark side of mass boundaries, ~0 in mass interiors and on the
   * lighter side
   */
  getCounterBoost(x: number, y: number): number {
    return sampleBilinear(this.counterBoost, x * this.scaleX, y * this.scaleY);
  }

  /** Whether a posterized value plan was built (valueBands >= 2) */
  hasMassTone(): boolean {
    return this.massDarkness !== null;
  }

  /**
   * Posterized large-scale darkness in [0, 1] at canvas coordinates —
   * the committed value band for this region. Falls back to raw darkness
   * when no value plan was requested
   */
  getMassDarkness(x: number, y: number): number {
    if (!this.massDarkness) return this.getDarkness(x, y);
    return sampleBilinear(this.massDarkness, x * this.scaleX, y * this.scaleY);
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

  /** Local detail/texture density in [0, 1] at canvas coordinates */
  getDetail(x: number, y: number): number {
    return sampleBilinear(this.detail, x * this.scaleX, y * this.scaleY);
  }

  isInBounds(x: number, y: number, margin: number = 0): boolean {
    return x >= margin && x < this.width - margin && y >= margin && y < this.height - margin;
  }
}
