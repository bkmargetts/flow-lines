import { describe, it, expect } from 'vitest';
import { imageToPenInk } from './pen-ink.js';
import { ImageField } from './image-field.js';
import { GrayscaleImage } from './image.js';
import { traceContours } from './contours.js';

/** Build a synthetic grayscale image from a function of normalized coords */
function makeImage(
  width: number,
  height: number,
  fn: (u: number, v: number) => number
): GrayscaleImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = Math.max(0, Math.min(1, fn(x / (width - 1), y / (height - 1))));
    }
  }
  return { width, height, data };
}

// Left half black, right half white
const halfDark = makeImage(120, 120, (u) => (u < 0.5 ? 0 : 1));

describe('imageToPenInk', () => {
  it('generates strokes for a dark image', () => {
    const image = makeImage(100, 100, () => 0.1);
    const result = imageToPenInk(image, { width: 200, seed: 42, wobble: 0 });

    expect(result.lines.length).toBeGreaterThan(10);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('derives output height from the image aspect ratio', () => {
    const image = makeImage(200, 100, () => 0.5);
    const result = imageToPenInk(image, { width: 400, seed: 1 });

    expect(result.height).toBe(200);
  });

  it('leaves white regions blank', () => {
    const result = imageToPenInk(halfDark, {
      width: 240,
      seed: 7,
      wobble: 0,
      drawOutlines: false,
      normalizeContrast: false,
      margin: 5,
    });

    expect(result.lines.length).toBeGreaterThan(0);

    // All stroke points should be in (or very near) the dark half
    for (const line of result.lines) {
      for (const point of line.points) {
        expect(point.x).toBeLessThan(240 * 0.58);
      }
    }
  });

  it('produces an empty result for a blank white image', () => {
    const image = makeImage(80, 80, () => 1);
    const result = imageToPenInk(image, {
      width: 160,
      seed: 3,
      drawOutlines: false,
      normalizeContrast: false,
    });

    expect(result.lines.length).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const image = makeImage(60, 60, (u, v) => (u + v) / 2);
    const a = imageToPenInk(image, { width: 150, seed: 99 });
    const b = imageToPenInk(image, { width: 150, seed: 99 });

    expect(a.lines).toEqual(b.lines);
  });

  it('adds cross-hatch density in darker areas with more layers', () => {
    const image = makeImage(100, 100, () => 0.05);

    const single = imageToPenInk(image, {
      width: 200,
      seed: 5,
      layers: 1,
      wobble: 0,
      drawOutlines: false,
    });
    const triple = imageToPenInk(image, {
      width: 200,
      seed: 5,
      layers: 3,
      wobble: 0,
      drawOutlines: false,
    });

    const totalLength = (lines: typeof single.lines) =>
      lines.reduce((sum, line) => {
        let len = 0;
        for (let i = 1; i < line.points.length; i++) {
          len += Math.hypot(
            line.points[i].x - line.points[i - 1].x,
            line.points[i].y - line.points[i - 1].y
          );
        }
        return sum + len;
      }, 0);

    expect(totalLength(triple.lines)).toBeGreaterThan(totalLength(single.lines) * 1.5);
  });

  it('respects the margin', () => {
    const image = makeImage(80, 80, () => 0.1);
    const margin = 30;
    const result = imageToPenInk(image, { width: 200, seed: 11, margin, wobble: 0 });

    for (const line of result.lines) {
      for (const point of line.points) {
        expect(point.x).toBeGreaterThanOrEqual(margin - 0.01);
        expect(point.x).toBeLessThanOrEqual(200 - margin + 0.01);
        expect(point.y).toBeGreaterThanOrEqual(margin - 0.01);
        expect(point.y).toBeLessThanOrEqual(result.height - margin + 0.01);
      }
    }
  });
});

describe('subject isolation', () => {
  // Uniform mid-dark image: no intrinsic detail anywhere
  const flatDark = makeImage(100, 100, () => 0.4);

  const pointsIn = (
    lines: { points: { x: number; y: number }[] }[],
    cx: number,
    cy: number,
    r: number
  ) =>
    lines.reduce(
      (sum, line) =>
        sum + line.points.filter((p) => Math.hypot(p.x - cx, p.y - cy) < r).length,
      0
    );

  it('concentrates strokes around a focal point', () => {
    const result = imageToPenInk(flatDark, {
      width: 240,
      seed: 21,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      focus: { x: 70, y: 120, radius: 30, strength: 1 },
    });

    const nearFocus = pointsIn(result.lines, 70, 120, 35);
    const farAway = pointsIn(result.lines, 180, 120, 35);

    expect(nearFocus).toBeGreaterThan(100);
    expect(farAway).toBeLessThan(nearFocus * 0.1);
  });

  it('suppresses regions outside a subject mask', () => {
    // Mask: left half subject, right half background
    const mask = makeImage(80, 80, (u) => (u < 0.5 ? 1 : 0));

    const result = imageToPenInk(flatDark, {
      width: 240,
      seed: 22,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      subjectMask: mask,
      maskStrength: 1,
    });

    const leftPoints = pointsIn(result.lines, 60, 120, 50);
    const rightPoints = pointsIn(result.lines, 180, 120, 50);

    expect(leftPoints).toBeGreaterThan(100);
    expect(rightPoints).toBeLessThan(leftPoints * 0.1);
  });

  it('emphasizes textured regions over flat ones', () => {
    // Left half: strong vertical stripes; right half: flat at the same mean tone
    const striped = makeImage(160, 160, (u) =>
      u < 0.5 ? 0.5 + 0.25 * Math.sin(u * Math.PI * 60) : 0.5
    );

    const result = imageToPenInk(striped, {
      width: 240,
      seed: 23,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 1,
      normalizeContrast: false,
    });

    const texturedPoints = pointsIn(result.lines, 60, 120, 50);
    const flatPoints = pointsIn(result.lines, 180, 120, 50);

    expect(texturedPoints).toBeGreaterThan(50);
    expect(flatPoints).toBeLessThan(texturedPoints * 0.25);
  });

  it('protects regions near any of multiple focal points', () => {
    const result = imageToPenInk(flatDark, {
      width: 300,
      seed: 31,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      focus: [
        { x: 60, y: 150, radius: 25, strength: 1 },
        { x: 240, y: 150, radius: 25, strength: 1 },
      ],
    });

    const left = pointsIn(result.lines, 60, 150, 30);
    const right = pointsIn(result.lines, 240, 150, 30);
    const between = pointsIn(result.lines, 150, 150, 30);

    expect(left).toBeGreaterThan(100);
    expect(right).toBeGreaterThan(100);
    expect(between).toBeLessThan(Math.min(left, right) * 0.1);
  });

  it('keeps full rendering when isolation features are disabled', () => {
    const withDefaults = imageToPenInk(flatDark, {
      width: 200,
      seed: 24,
      wobble: 0,
      detailEmphasis: 0,
    });
    const explicit = imageToPenInk(flatDark, {
      width: 200,
      seed: 24,
      wobble: 0,
      detailEmphasis: 0,
      maskStrength: 0,
    });

    expect(withDefaults.lines).toEqual(explicit.lines);
  });
});

describe('portrait rendering', () => {
  // Mid-dark uniform image, like skin tone in shadow
  const flatSkin = makeImage(100, 100, () => 0.45);

  const totalPointsIn = (
    lines: { points: { x: number; y: number }[] }[],
    x0: number,
    x1: number
  ) =>
    lines.reduce(
      (sum, line) => sum + line.points.filter((p) => p.x >= x0 && p.x < x1).length,
      0
    );

  // A face oval covering the left half of the canvas (normalized coords)
  const leftHalfOval = [
    { x: 0.02, y: 0.02 },
    { x: 0.48, y: 0.02 },
    { x: 0.48, y: 0.98 },
    { x: 0.02, y: 0.98 },
  ];

  it('lightens skin inside face ovals', () => {
    const base = {
      width: 240,
      seed: 41,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
    };

    const plain = imageToPenInk(flatSkin, base);
    const portrait = imageToPenInk(flatSkin, {
      ...base,
      portrait: { faceOvals: [leftHalfOval], skinLightening: 0.8 },
    });

    const plainLeft = totalPointsIn(plain.lines, 0, 120);
    const portraitLeft = totalPointsIn(portrait.lines, 0, 120);
    const portraitRight = totalPointsIn(portrait.lines, 120, 240);

    // Skin region got much lighter; the rest is unaffected
    expect(portraitLeft).toBeLessThan(plainLeft * 0.5);
    expect(portraitRight).toBeGreaterThan(plainLeft * 0.7);
  });

  it('draws feature strokes as clean lines', () => {
    const white = makeImage(50, 50, () => 1);
    const result = imageToPenInk(white, {
      width: 200,
      seed: 42,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      portrait: {
        featureStrokes: [
          [
            { x: 0.2, y: 0.5 },
            { x: 0.8, y: 0.5 },
          ],
        ],
      },
    });

    // The blank image contributes nothing; the stroke is the only line
    expect(result.lines.length).toBe(1);
    const points = result.lines[0].points;
    expect(points[0].x).toBeCloseTo(40, 0);
    expect(points[points.length - 1].x).toBeCloseTo(160, 0);
    for (const p of points) {
      expect(p.y).toBeCloseTo(100, 1);
    }
  });

  it('suppresses soft interior contours inside faces, keeps strong ones as fine', () => {
    // Strong edge on the right (outside the face) sets the edge scale;
    // a soft edge sits inside the face oval on the left
    const image = makeImage(160, 160, (u) => {
      if (u > 0.75) return 0.05; // strong dark band, right
      if (u > 0.2 && u < 0.22) return 0.32; // moderate edge inside face
      return 0.55;
    });

    const faceOval = [
      { x: 0.02, y: 0.02 },
      { x: 0.6, y: 0.02 },
      { x: 0.6, y: 0.98 },
      { x: 0.02, y: 0.98 },
    ];

    const base = {
      width: 320,
      seed: 71,
      wobble: 0,
      detailEmphasis: 0,
      normalizeContrast: false,
      layers: 1,
      whiteCutoff: 0.95, // suppress hatching so only contours remain
    };

    const plain = imageToPenInk(image, base);
    const portrait = imageToPenInk(image, {
      ...base,
      portrait: { faceOvals: [faceOval], skinLightening: 0 },
    });

    const leftContours = (lines: typeof plain.lines) =>
      lines.filter((l) => l.points.length > 0 && l.points[0].x < 0.6 * 320);

    // Without a face, the soft interior edge is drawn bold
    expect(leftContours(plain.lines).some((l) => l.pen === 'bold')).toBe(true);
    // With a face over it, the soft interior contour disappears
    expect(leftContours(portrait.lines).filter((l) => l.pen === 'bold').length).toBe(0);
    // The strong band edge outside the face survives in both
    expect(plain.lines.some((l) => l.points[0]?.x > 0.6 * 320)).toBe(true);
    expect(portrait.lines.some((l) => l.points[0]?.x > 0.6 * 320)).toBe(true);
  });

  it('keeps feature regions detailed even when a mask suppresses them', () => {
    const dark = makeImage(80, 80, () => 0.2);
    // Mask marks everything as background
    const emptyMask = makeImage(8, 8, () => 0);

    const suppressed = imageToPenInk(dark, {
      width: 200,
      seed: 43,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      subjectMask: emptyMask,
      maskStrength: 1,
    });

    const withFeature = imageToPenInk(dark, {
      width: 200,
      seed: 43,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      subjectMask: emptyMask,
      maskStrength: 1,
      portrait: {
        featureRegions: [
          [
            { x: 0.3, y: 0.3 },
            { x: 0.7, y: 0.3 },
            { x: 0.7, y: 0.7 },
            { x: 0.3, y: 0.7 },
          ],
        ],
        featureBoost: 1,
      },
    });

    const count = (lines: typeof suppressed.lines) =>
      lines.reduce((sum, line) => sum + line.points.length, 0);

    expect(count(suppressed.lines)).toBe(0);
    expect(count(withFeature.lines)).toBeGreaterThan(50);
  });
});

describe('contour tracing', () => {
  it('links a circle edge into few long contours', () => {
    // White background, dark disk: one strong circular edge
    const disk = makeImage(160, 160, (u, v) =>
      Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0.15 : 1
    );
    const field = new ImageField(disk, {
      width: 320,
      height: 320,
      normalizeContrast: false,
    });

    const contours = traceContours(field, { minLength: 20 });

    expect(contours.length).toBeGreaterThan(0);
    expect(contours.length).toBeLessThan(8); // coherent chains, not fragments

    // The longest contour should cover most of the circle's circumference
    const lengthOf = (points: { x: number; y: number }[]) => {
      let len = 0;
      for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return len;
    };
    const longest = Math.max(...contours.map(lengthOf));
    const circumference = 2 * Math.PI * 0.3 * 320;
    expect(longest).toBeGreaterThan(circumference * 0.6);

    // And its points should sit near the circle
    for (const c of contours) {
      for (const p of c) {
        const r = Math.hypot(p.x - 160, p.y - 160);
        expect(Math.abs(r - 0.3 * 320)).toBeLessThan(12);
      }
    }
  });

  it('drops soft tonal boundaries that a hand would never outline', () => {
    // A wide radial gradient: plenty of cumulative edge magnitude, but the
    // tonal step is spread over many pixels — outlining it is the
    // strongest "computer" tell (water reflections, blurred mass edges)
    const soft = makeImage(160, 160, (u, v) =>
      Math.min(1, Math.max(0.1, Math.hypot(u - 0.5, v - 0.5) * 2.2))
    );
    const field = new ImageField(soft, {
      width: 320,
      height: 320,
      normalizeContrast: false,
    });

    // Low threshold on purpose: without the sharpness gate the gradient
    // ring traces as a wiggly blob outline
    const loose = traceContours(field, { minLength: 20, highThreshold: 0.12, minSharpness: 0 });
    const gated = traceContours(field, { minLength: 20, highThreshold: 0.12 });

    expect(loose.length).toBeGreaterThan(0);
    expect(gated.length).toBe(0);
  });

  it('keeps sharp edges through the sharpness gate', () => {
    const disk = makeImage(160, 160, (u, v) =>
      Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0.15 : 1
    );
    const field = new ImageField(disk, {
      width: 320,
      height: 320,
      normalizeContrast: false,
    });

    const contours = traceContours(field, { minLength: 20 });
    const lengthOf = (points: { x: number; y: number }[]) => {
      let len = 0;
      for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return len;
    };

    expect(Math.max(...contours.map(lengthOf))).toBeGreaterThan(2 * Math.PI * 0.3 * 320 * 0.6);
  });

  it('keeps ink density inside dark masses with internal edges (no white veins)', () => {
    // Dark mass (0.75-0.95 darkness) full of internal structure on a light
    // ground: halos must hug the outer silhouette only, never carve
    // reserved-paper veins through the mass interior
    const scene = makeImage(160, 160, (u, v) => {
      const inside = u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8;
      if (!inside) return 0.95;
      return 0.12 + 0.1 * (Math.sin(u * 50) > 0 ? 1 : 0);
    });

    const result = imageToPenInk(scene, {
      width: 320, seed: 77, wobble: 0, normalizeContrast: false,
      detailEmphasis: 0, textureStrokes: 0, optimize: false, layers: 2,
    });

    // Sample interior cells well away from the silhouette; every one
    // should carry ink
    const cell = 16;
    let empty = 0;
    let total = 0;
    for (let cy = 110; cy <= 190; cy += cell) {
      for (let cx = 110; cx <= 190; cx += cell) {
        total++;
        const hit = result.lines.some((l) =>
          l.points.some(
            (p) => Math.abs(p.x - cx) < cell / 2 && Math.abs(p.y - cy) < cell / 2
          )
        );
        if (!hit) empty++;
      }
    }
    expect(total).toBeGreaterThan(20);
    expect(empty).toBe(0);
  });

  it('marks contours as bold pen strokes in the full render', () => {
    const disk = makeImage(120, 120, (u, v) =>
      Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0.2 : 1
    );
    const result = imageToPenInk(disk, {
      width: 240,
      seed: 51,
      wobble: 0,
      normalizeContrast: false,
    });

    const bold = result.lines.filter((l) => l.pen === 'bold');
    const fine = result.lines.filter((l) => l.pen !== 'bold');
    expect(bold.length).toBeGreaterThan(0);
    expect(fine.length).toBeGreaterThan(0);
  });
});

describe('texture strokes', () => {
  // Left half: clumpy fur-scale texture at mid tone; right half: flat mid tone
  const furry = makeImage(160, 160, (u, v) =>
    u < 0.5 ? 0.45 + 0.2 * Math.sin(u * 80) * Math.sin(v * 80) : 0.45
  );

  const render = (textureStrokes: number) =>
    imageToPenInk(furry, {
      width: 320,
      seed: 61,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      normalizeContrast: false,
      textureStrokes,
    });

  const avgStrokeLength = (
    lines: { points: { x: number; y: number }[] }[],
    x0: number,
    x1: number
  ) => {
    const inRegion = lines.filter(
      (l) => l.points.length > 0 && l.points[0].x >= x0 && l.points[0].x < x1
    );
    if (inRegion.length === 0) return 0;
    const total = inRegion.reduce((sum, l) => {
      let len = 0;
      for (let i = 1; i < l.points.length; i++) {
        len += Math.hypot(
          l.points[i].x - l.points[i - 1].x,
          l.points[i].y - l.points[i - 1].y
        );
      }
      return sum + len;
    }, 0);
    return total / inRegion.length;
  };

  it('shortens strokes into ticks in textured regions', () => {
    const off = render(0);
    const on = render(1);

    const texturedOff = avgStrokeLength(off.lines, 0, 150);
    const texturedOn = avgStrokeLength(on.lines, 0, 150);
    const flatOn = avgStrokeLength(on.lines, 170, 320);

    // Texture mode shortens strokes in the busy half...
    expect(texturedOn).toBeLessThan(texturedOff * 0.6);
    // ...but leaves the flat half drawing long strokes
    expect(flatOn).toBeGreaterThan(texturedOn * 1.5);
  });
});

describe('etching mode', () => {
  // Horizontal luminance ramp: gradient points in x, so along-contour
  // strokes run vertically and cross-contour strokes run horizontally
  const ramp = makeImage(120, 120, (u) => 0.15 + 0.5 * u);

  const meanDirection = (lines: { points: { x: number; y: number }[] }[]) => {
    let dx = 0;
    let dy = 0;
    for (const line of lines) {
      const a = line.points[0];
      const b = line.points[line.points.length - 1];
      dx += Math.abs(b.x - a.x);
      dy += Math.abs(b.y - a.y);
    }
    return { dx, dy };
  };

  const base = {
    width: 240,
    seed: 81,
    wobble: 0,
    drawOutlines: false,
    detailEmphasis: 0,
    textureStrokes: 0,
    normalizeContrast: false,
    layers: 1,
  };

  it('rotates hatching 90° in cross-contour mode', () => {
    const along = meanDirection(imageToPenInk(ramp, base).lines);
    const across = meanDirection(imageToPenInk(ramp, { ...base, crossContour: true }).lines);

    expect(along.dy).toBeGreaterThan(along.dx * 2); // vertical strokes
    expect(across.dx).toBeGreaterThan(across.dy * 2); // horizontal strokes
  });

  it('caps stroke length at maxStrokeLength', () => {
    const dark = makeImage(80, 80, () => 0.2);
    const result = imageToPenInk(dark, { ...base, maxStrokeLength: 20 });

    expect(result.lines.length).toBeGreaterThan(10);
    for (const line of result.lines) {
      let len = 0;
      for (let i = 1; i < line.points.length; i++) {
        len += Math.hypot(
          line.points[i].x - line.points[i - 1].x,
          line.points[i].y - line.points[i - 1].y
        );
      }
      // 1.2x jitter ceiling plus one step of slack
      expect(len).toBeLessThan(20 * 1.2 + 4);
    }
  });
});

describe('depth-aware rendering', () => {
  const flat = makeImage(100, 100, () => 0.45);

  // Vertical cylinder bulging toward the viewer, axis along y
  const tubeDepth = makeImage(100, 100, (u) => {
    const d = (u - 0.5) / 0.4;
    return Math.abs(d) < 1 ? 0.2 + 0.7 * Math.sqrt(1 - d * d) : 0.2;
  });

  it('orients strokes along the 3D form on the flanks of a cylinder', () => {
    const field = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
      depthMap: tubeDepth,
      formStrength: 1,
    });

    // On the cylinder flank the depth gradient points in x, so strokes
    // run along the axis (vertical)
    const angle = field.getOrientation(150, 100);
    const distFromVertical = Math.abs(Math.abs(angle) - Math.PI / 2);
    expect(distFromVertical).toBeLessThan(0.25);

    // Without depth the same flat image falls back to the hatch angle
    const noDepth = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
    });
    expect(Math.abs(noDepth.getOrientation(150, 100) - -Math.PI / 4)).toBeLessThan(0.1);
  });

  it('keeps the along-form direction on crests where the gradient vanishes', () => {
    // On the cylinder's centerline the depth gradient is zero, but the
    // curvature frame still knows the axis direction
    const field = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
      depthMap: tubeDepth,
      formStrength: 1,
    });

    const angle = field.getOrientation(100, 100); // tube centerline
    const distFromVertical = Math.abs(Math.abs(angle) - Math.PI / 2);
    expect(distFromVertical).toBeLessThan(0.25);

    // And the dispatch signal fires there too
    expect(field.getFormConfidence(100, 100)).toBeGreaterThan(0.5);
  });

  it('terminates strokes at depth discontinuities', () => {
    // One flat depth plane in front of another, same luminance everywhere
    const stepDepth = makeImage(100, 100, (u) => (u < 0.5 ? 0.85 : 0.2));

    const result = imageToPenInk(flat, {
      width: 240,
      seed: 91,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      textureStrokes: 0,
      normalizeContrast: false,
      depthMap: stepDepth,
      depthIsolation: 0,
      layers: 1,
    });

    // No single stroke may straddle the silhouette at x = 120
    for (const line of result.lines) {
      const left = line.points.some((p) => p.x < 112);
      const right = line.points.some((p) => p.x > 128);
      expect(left && right).toBe(false);
    }
  });

  it('fades far regions when the scene has depth separation', () => {
    const stepDepth = makeImage(100, 100, (u) => (u < 0.5 ? 0.9 : 0.15));

    const result = imageToPenInk(flat, {
      width: 240,
      seed: 92,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      textureStrokes: 0,
      normalizeContrast: false,
      depthMap: stepDepth,
      depthIsolation: 1,
    });

    const count = (x0: number, x1: number) =>
      result.lines.reduce(
        (sum, l) => sum + l.points.filter((p) => p.x >= x0 && p.x < x1).length,
        0
      );

    const near = count(0, 110);
    const far = count(130, 240);
    expect(near).toBeGreaterThan(100);
    expect(far).toBeLessThan(near * 0.15);
  });

  it('ignores depth isolation when the scene is depth-flat', () => {
    const flatDepth = makeImage(50, 50, () => 0.5);

    const withDepth = imageToPenInk(flat, {
      width: 200,
      seed: 93,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      textureStrokes: 0,
      normalizeContrast: false,
      depthMap: flatDepth,
      depthIsolation: 1,
      formStrength: 0,
    });
    const without = imageToPenInk(flat, {
      width: 200,
      seed: 93,
      wobble: 0,
      drawOutlines: false,
      detailEmphasis: 0,
      textureStrokes: 0,
      normalizeContrast: false,
    });

    expect(withDepth.lines).toEqual(without.lines);
  });
});

describe('auto style dispatch', () => {
  const flat = makeImage(100, 100, () => 0.45);

  // Vertical cylinder bulging toward the viewer, axis along y
  const tubeDepth = makeImage(100, 100, (u) => {
    const d = (u - 0.5) / 0.4;
    return Math.abs(d) < 1 ? 0.2 + 0.7 * Math.sqrt(1 - d * d) : 0.2;
  });

  const meanDirection = (lines: { points: { x: number; y: number }[] }[]) => {
    let dx = 0;
    let dy = 0;
    for (const line of lines) {
      const a = line.points[0];
      const b = line.points[line.points.length - 1];
      dx += Math.abs(b.x - a.x);
      dy += Math.abs(b.y - a.y);
    }
    return { dx, dy };
  };

  const base = {
    width: 200,
    seed: 101,
    wobble: 0,
    drawOutlines: false,
    detailEmphasis: 0,
    textureStrokes: 0,
    normalizeContrast: false,
    layers: 1,
    depthIsolation: 0,
    optimize: false,
  };

  // Strokes seeded on the cylinder flanks
  const flankLines = (lines: { points: { x: number; y: number }[] }[]) =>
    lines.filter((l) => {
      const x = l.points[0].x;
      return (x > 110 && x < 165) || (x > 35 && x < 90);
    });

  it('wraps curved forms with capped cross-contour marks', () => {
    const off = imageToPenInk(flat, { ...base, depthMap: tubeDepth });
    const on = imageToPenInk(flat, { ...base, depthMap: tubeDepth, autoStyle: true });

    // Without dispatch, flank strokes run along the tube (vertical);
    // with dispatch they wrap across it (horizontal)
    const dirOff = meanDirection(flankLines(off.lines));
    const dirOn = meanDirection(flankLines(on.lines));
    expect(dirOff.dy).toBeGreaterThan(dirOff.dx);
    expect(dirOn.dx).toBeGreaterThan(dirOn.dy);
  });

  it('changes nothing without depth or texture', () => {
    const off = imageToPenInk(flat, base);
    const on = imageToPenInk(flat, { ...base, autoStyle: true });
    expect(on.lines).toEqual(off.lines);
  });

  it('reports form confidence only on curved regions', () => {
    const field = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
      depthMap: tubeDepth,
    });

    expect(field.getFormConfidence(150, 100)).toBeGreaterThan(0.5); // flank
    // The form's smoothed skirt extends a few px past the silhouette, so
    // probe genuinely flat background beyond it
    expect(field.getFormConfidence(2, 100)).toBeLessThan(0.4);
  });
});

describe('external flow map', () => {
  it('overrides stroke orientation where the flow field has magnitude', () => {
    const flat = makeImage(60, 60, () => 0.5);

    // Constant horizontal flow at full strength
    const n = 32 * 32;
    const flowMap = {
      width: 32,
      height: 32,
      x: new Float32Array(n).fill(1),
      y: new Float32Array(n).fill(0),
    };

    const withFlow = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
      flowMap,
    });
    const without = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
    });

    // Flow forces horizontal; the flat image alone falls back to -45°
    expect(Math.abs(withFlow.getOrientation(100, 100))).toBeLessThan(0.1);
    expect(Math.abs(without.getOrientation(100, 100) - -Math.PI / 4)).toBeLessThan(0.1);
  });

  it('leaves orientation untouched where the flow field is zero', () => {
    const flat = makeImage(60, 60, () => 0.5);
    const n = 16 * 16;
    const flowMap = {
      width: 16,
      height: 16,
      x: new Float32Array(n),
      y: new Float32Array(n),
    };

    const field = new ImageField(flat, {
      width: 200,
      height: 200,
      normalizeContrast: false,
      flowMap,
    });

    expect(Math.abs(field.getOrientation(100, 100) - -Math.PI / 4)).toBeLessThan(0.1);
  });
});

describe('tapered outline passes', () => {
  it('makes emphasis passes shorter than the main contour', () => {
    const disk = makeImage(120, 120, (u, v) =>
      Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0.2 : 1
    );

    const result = imageToPenInk(disk, {
      width: 240,
      seed: 51,
      wobble: 0,
      normalizeContrast: false,
      outlinePasses: 2,
      optimize: false, // keep main/emphasis passes as separate lines
    });

    const lengthOf = (points: { x: number; y: number }[]) => {
      let len = 0;
      for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return len;
    };

    const bold = result.lines.filter((l) => l.pen === 'bold').map((l) => lengthOf(l.points));
    expect(bold.length).toBeGreaterThanOrEqual(2);

    bold.sort((a, b) => b - a);
    // The longest (main) pass is noticeably longer than its trimmed twin
    expect(bold[1]).toBeLessThan(bold[0] * 0.99);
  });
});

describe('texture styles', () => {
  // Clumpy fur-scale texture everywhere
  const furry = makeImage(160, 160, (u, v) => 0.45 + 0.2 * Math.sin(u * 80) * Math.sin(v * 80));

  const base = {
    width: 320,
    seed: 111,
    wobble: 0,
    drawOutlines: false,
    detailEmphasis: 0,
    normalizeContrast: false,
    textureStrokes: 1,
    layers: 1,
    optimize: false,
  };

  it('renders stipple as many tiny closed dots', () => {
    const result = imageToPenInk(furry, { ...base, textureStyle: 'stipple' });

    const dots = result.lines.filter((l) => {
      if (l.points.length < 6 || l.points.length > 10) return false;
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
    });

    expect(dots.length).toBeGreaterThan(100);
  });

  it('renders scribble as long wandering strokes', () => {
    const ticks = imageToPenInk(furry, { ...base, textureStyle: 'ticks' });
    const scribble = imageToPenInk(furry, { ...base, textureStyle: 'scribble' });

    const avgLen = (lines: typeof ticks.lines) => {
      const lens = lines.map((l) => {
        let len = 0;
        for (let i = 1; i < l.points.length; i++) {
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
        return len;
      });
      return lens.reduce((a, b) => a + b, 0) / lens.length;
    };

    expect(avgLen(scribble.lines)).toBeGreaterThan(avgLen(ticks.lines) * 2);

    // Scribbles wander: total turning per unit length is high
    const turning = (l: (typeof ticks.lines)[0]) => {
      let sum = 0;
      for (let i = 2; i < l.points.length; i++) {
        const a1 = Math.atan2(l.points[i - 1].y - l.points[i - 2].y, l.points[i - 1].x - l.points[i - 2].x);
        const a2 = Math.atan2(l.points[i].y - l.points[i - 1].y, l.points[i].x - l.points[i - 1].x);
        let d = a2 - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        sum += Math.abs(d);
      }
      return sum;
    };
    const longest = [...scribble.lines].sort((a, b) => b.points.length - a.points.length)[0];
    expect(turning(longest)).toBeGreaterThan(2);
  });

  it('is deterministic for each style', () => {
    for (const textureStyle of ['stipple', 'scribble'] as const) {
      const a = imageToPenInk(furry, { ...base, textureStyle });
      const b = imageToPenInk(furry, { ...base, textureStyle });
      expect(a.lines).toEqual(b.lines);
    }
  });
});

describe('art levers', () => {
  it('richBlacks puts substantially more ink into near-black areas', () => {
    const dark = makeImage(80, 80, () => 0.05);
    const base = {
      width: 200, seed: 121, wobble: 0, drawOutlines: false,
      detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
      layers: 1, optimize: false,
    };

    const total = (r: ReturnType<typeof imageToPenInk>) =>
      r.lines.reduce((s, l) => {
        let len = 0;
        for (let i = 1; i < l.points.length; i++) {
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
        return s + len;
      }, 0);

    const flat = imageToPenInk(dark, { ...base, richBlacks: false });
    const rich = imageToPenInk(dark, { ...base, richBlacks: true });

    expect(total(rich)).toBeGreaterThan(total(flat) * 1.4);
  });

  it('skyStipple renders smooth light regions as dots and leaves features hatched', () => {
    // Top half: smooth sky gradient; bottom half: dark textured ground
    const scene = makeImage(160, 160, (u, v) =>
      v < 0.5 ? 0.75 - 0.15 * v : 0.3 + 0.1 * Math.sin(u * 60) * Math.sin(v * 60)
    );

    const base = {
      width: 320, seed: 122, wobble: 0, drawOutlines: false,
      detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
      layers: 1, optimize: false,
    };

    const isDot = (l: { points: { x: number; y: number }[] }) => {
      if (l.points.length < 6 || l.points.length > 10) return false;
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
    };

    const off = imageToPenInk(scene, base);
    const on = imageToPenInk(scene, { ...base, skyStipple: true });

    const skyDots = on.lines.filter((l) => isDot(l) && l.points[0].y < 150).length;
    const groundDots = on.lines.filter((l) => isDot(l) && l.points[0].y > 170).length;

    expect(off.lines.filter(isDot).length).toBe(0);
    expect(skyDots).toBeGreaterThan(80);
    expect(groundDots).toBeLessThan(skyDots * 0.1);
  });

  it('sky stipple density follows tone', () => {
    // Smooth horizontal sky gradient (light left, darker right), with a
    // textured dark ground strip so detail/edge normalization has a
    // reference and the sky itself counts as featureless
    const scene = makeImage(160, 160, (u, v) =>
      v < 0.7 ? 0.85 - 0.3 * u : 0.25 + 0.15 * Math.sin(u * 60) * Math.sin(v * 60)
    );

    const result = imageToPenInk(scene, {
      width: 320, seed: 123, wobble: 0, drawOutlines: false,
      detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
      layers: 1, optimize: false, skyStipple: true,
    });

    const isDot = (l: { points: { x: number; y: number }[] }) => {
      if (l.points.length < 6 || l.points.length > 10) return false;
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
    };

    const sky = result.lines.filter((l) => isDot(l) && l.points[0].y < 200);
    const lightThird = sky.filter((l) => l.points[0].x < 110).length;
    const darkThird = sky.filter((l) => l.points[0].x > 210).length;

    // Darker sky carries visibly more dots (tighter dot spacing)
    expect(darkThird).toBeGreaterThan(lightThird * 1.5);
  });

  it('stipples grey overcast skies that the value plan rounds to paper', () => {
    // Flat light-grey sky (darkness ~0.22): valueBands snaps it to band 0
    // (paper) and auto detail emphasis demotes it for being smooth — the
    // combination that used to leave overcast skies completely blank
    const scene = makeImage(160, 160, (u, v) =>
      v < 0.7 ? 0.78 : 0.25 + 0.15 * Math.sin(u * 60) * Math.sin(v * 60)
    );

    const result = imageToPenInk(scene, {
      width: 320, seed: 125, wobble: 0, drawOutlines: false,
      detailEmphasis: 0.3, textureStrokes: 0, normalizeContrast: false,
      layers: 3, optimize: false, skyStipple: true, valueBands: 4,
    });

    const isDot = (l: { points: { x: number; y: number }[] }) => {
      if (l.points.length < 6 || l.points.length > 10) return false;
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
    };

    const skyDots = result.lines.filter((l) => isDot(l) && l.points[0].y < 200).length;
    expect(skyDots).toBeGreaterThan(100);
  });

  it('stipples a grey sky even when it is the brightest region in the frame', () => {
    // Overcast landscape photo shape: light-grey sky over dark textured
    // ground. Contrast normalization stretches the sky to near-white —
    // absolute pre-normalization tone must keep it stippled
    const scene = makeImage(160, 160, (u, v) =>
      v < 0.6 ? 0.8 : 0.3 + 0.18 * Math.sin(u * 60) * Math.sin(v * 60)
    );

    const result = imageToPenInk(scene, {
      width: 320, seed: 126, wobble: 0, drawOutlines: false,
      detailEmphasis: 0.45, textureStrokes: 0, normalizeContrast: true,
      layers: 3, optimize: false, skyStipple: true, valueBands: 4,
    });

    const isDot = (l: { points: { x: number; y: number }[] }) => {
      if (l.points.length < 6 || l.points.length > 10) return false;
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
    };

    const skyDots = result.lines.filter((l) => isDot(l) && l.points[0].y < 170).length;
    expect(skyDots).toBeGreaterThan(100);
  });

  it('carves cloud shapes with outlines when skyStipple is on', () => {
    // A bright cloud blob in a mid-light sky over textured ground
    const scene = makeImage(160, 160, (u, v) => {
      if (v >= 0.7) return 0.25 + 0.15 * Math.sin(u * 60) * Math.sin(v * 60);
      const r = Math.hypot(u - 0.5, v - 0.35) / 0.2;
      const blob = Math.max(0, Math.min(1, 2 - 2 * r)); // soft edge
      return 0.7 + 0.22 * blob;
    });

    const base = {
      width: 320, seed: 124, wobble: 0, drawOutlines: false,
      detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
      layers: 1, optimize: false, contourHalo: 0,
    };

    const isDot = (l: { points: { x: number; y: number }[] }) => {
      if (l.points.length < 6 || l.points.length > 10) return false;
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
    };

    const on = imageToPenInk(scene, { ...base, skyStipple: true });

    // Sky stipple turns every sky mark into a dot, so any long non-dot
    // sky stroke must be a carved cloud edge — and it should hug the
    // blob boundary
    const edges = on.lines.filter((l) => !isDot(l) && l.points.every((p) => p.y < 200));
    expect(edges.length).toBeGreaterThan(0);

    // Cloud center in canvas coords: (0.5, 0.35) * 320 = (160, 112)
    for (const edge of edges) {
      for (const p of edge.points) {
        const r = Math.hypot(p.x - 160, p.y - 112);
        expect(r).toBeGreaterThan(25);
        expect(r).toBeLessThan(115);
      }
    }
  });

  it('holds hatching off silhouettes with contourHalo', () => {
    // A bright square subject on a mid-dark background: the silhouette is
    // a long, strong contour with a real tonal step across it
    const scene = makeImage(160, 160, (u, v) =>
      u > 0.3 && u < 0.7 && v > 0.3 && v < 0.7 ? 0.95 : 0.3
    );

    const base = {
      width: 320, seed: 31, wobble: 0, drawOutlines: false,
      detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
      layers: 2, optimize: false,
    };

    const off = imageToPenInk(scene, { ...base, contourHalo: 0 });
    const on = imageToPenInk(scene, { ...base, contourHalo: 5 });

    // Count hatch points in a band just outside the subject's left edge
    // (x = 0.3 * 320 = 96), on the darker background side
    const inBand = (l: { points: { x: number; y: number }[] }) =>
      l.points.filter(
        (p) => p.x > 96 - 8 && p.x < 96 && p.y > 96 && p.y < 224
      ).length;

    const offCount = off.lines.reduce((n, l) => n + inBand(l), 0);
    const onCount = on.lines.reduce((n, l) => n + inBand(l), 0);

    expect(offCount).toBeGreaterThan(20);
    expect(onCount).toBeLessThan(offCount * 0.35);

    // The background mass away from the silhouette keeps its tone
    const farBand = (l: { points: { x: number; y: number }[] }) =>
      l.points.filter((p) => p.x > 20 && p.x < 60 && p.y > 96 && p.y < 224).length;
    const offFar = off.lines.reduce((n, l) => n + farBand(l), 0);
    const onFar = on.lines.reduce((n, l) => n + farBand(l), 0);
    expect(onFar).toBeGreaterThan(offFar * 0.7);
  });

  it('renders smooth lower regions as horizontals with calmWater', () => {
    // Textured upper half over a smooth mid-grey "sea"
    const scene = makeImage(160, 160, (u, v) =>
      v < 0.5 ? 0.45 + 0.2 * Math.sin(u * 70) * Math.sin(v * 70) : 0.55
    );

    const result = imageToPenInk(scene, {
      width: 320, seed: 17, wobble: 0, drawOutlines: false,
      detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
      layers: 3, optimize: false, calmWater: true, contourHalo: 0,
      hatchAngle: -45,
    });

    // Strokes fully inside the sea (clear of the boundary and margins)
    const seaLines = result.lines.filter((l) =>
      l.points.every((p) => p.y > 200 && p.y < 290)
    );
    expect(seaLines.length).toBeGreaterThan(10);

    // Each should be horizontal: tiny vertical extent, real length
    for (const line of seaLines) {
      const ys = line.points.map((p) => p.y);
      const xs = line.points.map((p) => p.x);
      const dy = Math.max(...ys) - Math.min(...ys);
      const dx = Math.max(...xs) - Math.min(...xs);
      expect(dy).toBeLessThan(Math.max(3, dx * 0.12));
    }
  });
});

describe('semantic labels', () => {
  /** Label raster split horizontally: `top` id above the boundary, `bottom` below */
  const splitLabels = (top: number, bottom: number, boundary = 0.5) => {
    const size = 64;
    const data = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      data.fill(y < size * boundary ? top : bottom, y * size, (y + 1) * size);
    }
    return { width: size, height: size, data };
  };

  const base = {
    width: 320, seed: 31, wobble: 0, drawOutlines: false,
    detailEmphasis: 0, textureStrokes: 0, normalizeContrast: false,
    layers: 1, optimize: false, contourHalo: 0, hatchAngle: -45,
  };

  const isHorizontal = (l: { points: { x: number; y: number }[] }) => {
    const ys = l.points.map((p) => p.y);
    const xs = l.points.map((p) => p.x);
    const dy = Math.max(...ys) - Math.min(...ys);
    const dx = Math.max(...xs) - Math.min(...xs);
    return dx > 10 && dy < Math.max(3, dx * 0.12);
  };

  const isDot = (l: { points: { x: number; y: number }[] }) => {
    if (l.points.length < 6 || l.points.length > 10) return false;
    const xs = l.points.map((p) => p.x);
    const ys = l.points.map((p) => p.y);
    return Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4;
  };

  it('calm water follows the water label, not frame geometry', () => {
    // Smooth mid-grey everywhere; the labels put water in the TOP half —
    // exactly where the geometric heuristic could never find it
    const scene = makeImage(160, 160, () => 0.55);
    const labelMap = splitLabels(2 /* water */, 4 /* ground */);

    // calmWater left unset: the water label auto-enables it
    const result = imageToPenInk(scene, { ...base, layers: 3, labelMap });

    // Judge strokes long enough to have a direction (water breaks produce
    // some short fragments that fit entirely inside a band)
    const span = (l: { points: { x: number; y: number }[] }) => {
      const xs = l.points.map((p) => p.x);
      const ys = l.points.map((p) => p.y);
      return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    };
    const topLines = result.lines.filter(
      (l) => span(l) > 12 && l.points.every((p) => p.y > 30 && p.y < 130)
    );
    const bottomLines = result.lines.filter(
      (l) => span(l) > 12 && l.points.every((p) => p.y > 190 && p.y < 290)
    );

    expect(topLines.length).toBeGreaterThan(10);
    expect(bottomLines.length).toBeGreaterThan(10);
    // Water (top) is horizontals; ground (bottom) keeps diagonal hatch
    expect(topLines.every(isHorizontal)).toBe(true);
    expect(bottomLines.filter(isHorizontal).length).toBeLessThan(bottomLines.length * 0.1);
  });

  it('sky label drives stipple without skyStipple being set', () => {
    // Flat grey sky over textured dark ground
    const scene = makeImage(160, 160, (u, v) =>
      v < 0.5 ? 0.78 : 0.25 + 0.15 * Math.sin(u * 60) * Math.sin(v * 60)
    );
    const labelMap = splitLabels(1 /* sky */, 4 /* ground */);

    const off = imageToPenInk(scene, base);
    const on = imageToPenInk(scene, { ...base, labelMap });

    const skyDots = (r: ReturnType<typeof imageToPenInk>) =>
      r.lines.filter((l) => isDot(l) && l.points[0].y < 140).length;

    expect(skyDots(off)).toBe(0);
    expect(skyDots(on)).toBeGreaterThan(50);
  });

  it('floors importance over labeled people', () => {
    // Smooth mid-grey frame, focus pinned to the top-left corner so the
    // rest of the frame fades; a person label on the right half holds it
    const scene = makeImage(160, 160, () => 0.5);
    const personRight = {
      width: 64,
      height: 64,
      data: new Uint8Array(64 * 64).map((_, i) => (i % 64 >= 32 ? 6 /* person */ : 0)),
    };

    const focus = { x: 30, y: 30, radius: 40, falloff: 60, strength: 0.85 };
    const inked = (r: ReturnType<typeof imageToPenInk>) =>
      r.lines.reduce((s, l) => {
        if (!l.points.every((p) => p.x > 190)) return s;
        let len = 0;
        for (let i = 1; i < l.points.length; i++) {
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
        return s + len;
      }, 0);

    const without = imageToPenInk(scene, { ...base, focus });
    const withPerson = imageToPenInk(scene, { ...base, focus, labelMap: personRight });

    expect(inked(withPerson)).toBeGreaterThan(inked(without) * 1.3);
  });

  it('gives labeled foliage texture marks instead of long streamlines', () => {
    // Smooth dark mass in the bottom half — without labels it hatches in
    // long streamlines; labeled foliage it breaks into short ticks
    const scene = makeImage(160, 160, (u, v) => (v < 0.5 ? 0.9 : 0.25));
    const labelMap = splitLabels(0, 3 /* foliage */);

    const opts = { ...base, textureStrokes: 0.7 };
    // Mean length of strokes that *start* in the dark mass — without
    // labels the streamlines run long enough to leave any fixed band
    const meanLen = (r: ReturnType<typeof imageToPenInk>) => {
      const lines = r.lines.filter((l) => l.points[0].y > 190 && l.points[0].y < 290);
      if (lines.length === 0) return 0;
      const total = lines.reduce((s, l) => {
        let len = 0;
        for (let i = 1; i < l.points.length; i++) {
          len += Math.hypot(l.points[i].x - l.points[i - 1].x, l.points[i].y - l.points[i - 1].y);
        }
        return s + len;
      }, 0);
      return total / lines.length;
    };

    const without = imageToPenInk(scene, opts);
    const withFoliage = imageToPenInk(scene, { ...opts, labelMap });

    expect(meanLen(withFoliage)).toBeLessThan(meanLen(without) * 0.6);
  });

  it('an all-zero label raster changes nothing', () => {
    const scene = makeImage(160, 160, (u, v) => 0.3 + 0.4 * u + 0.1 * Math.sin(v * 40));
    const empty = { width: 32, height: 32, data: new Uint8Array(32 * 32) };

    const plain = imageToPenInk(scene, { ...base, layers: 2 });
    const labeled = imageToPenInk(scene, { ...base, layers: 2, labelMap: empty });

    expect(labeled.lines.length).toBe(plain.lines.length);
    expect(labeled.lines[0]?.points).toEqual(plain.lines[0]?.points);
  });

  it('is deterministic per seed with labels', () => {
    const scene = makeImage(160, 160, () => 0.55);
    const labelMap = splitLabels(2, 4);

    const a = imageToPenInk(scene, { ...base, labelMap });
    const b = imageToPenInk(scene, { ...base, labelMap });

    expect(a.lines.length).toBe(b.lines.length);
    expect(a.lines.map((l) => l.points)).toEqual(b.lines.map((l) => l.points));
  });
});

describe('ImageField', () => {
  it('reports darkness from the image tone', () => {
    const field = new ImageField(halfDark, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    expect(field.getDarkness(40, 120)).toBeGreaterThan(0.8);
    expect(field.getDarkness(200, 120)).toBeLessThan(0.2);
  });

  it('orients strokes along contours (perpendicular to the gradient)', () => {
    // Horizontal luminance gradient -> gradient points in x -> tangent is vertical
    const ramp = makeImage(120, 120, (u) => u);
    const field = new ImageField(ramp, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    const angle = field.getOrientation(120, 120);
    // Vertical orientation is ±PI/2 (pi-periodic)
    const distFromVertical = Math.abs(Math.abs(angle) - Math.PI / 2);
    expect(distFromVertical).toBeLessThan(0.2);
  });

  it('falls back to the hatch angle in flat regions', () => {
    const flat = makeImage(100, 100, () => 0.5);
    const hatchAngle = -Math.PI / 4;
    const field = new ImageField(flat, {
      width: 200,
      height: 200,
      hatchAngle,
      normalizeContrast: false,
    });

    const angle = field.getOrientation(100, 100);
    expect(Math.abs(angle - hatchAngle)).toBeLessThan(0.1);
  });

  it('detects edges', () => {
    const field = new ImageField(halfDark, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    expect(field.getEdgeStrength(120, 120)).toBeGreaterThan(0.3);
    expect(field.getEdgeStrength(30, 120)).toBeLessThan(0.1);
  });

  it('reports counterchange boost at the dark side of mass boundaries', () => {
    const field = new ImageField(halfDark, {
      width: 240,
      height: 240,
      normalizeContrast: false,
    });

    // Peaks on the dark side near the boundary (x = 120)...
    const nearBoundary = field.getCounterBoost(105, 120);
    expect(nearBoundary).toBeGreaterThan(0.05);
    // ...fades deep inside the dark mass...
    expect(field.getCounterBoost(15, 120)).toBeLessThan(nearBoundary * 0.5);
    // ...and never darkens the lighter side
    expect(field.getCounterBoost(180, 120)).toBeLessThan(0.02);
  });
});
