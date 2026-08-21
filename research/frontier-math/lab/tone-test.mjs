// THE DENSITY PRE-TEST
//
// The lesson of the sandpile: a construction can have every mechanical virtue
// — exact sampling, straight rational-slope edges, balanced junctions, a real
// variational characterisation — and still make an inert picture. What Arctic
// has and the sandpile lacked is TONE: an ink density that varies across the
// page, produced by the mathematics rather than by a shading function, with a
// sharp boundary between regimes.
//
// So before building anything as a module, render ONLY the density and ask
// whether it is a tonal image or a wireframe.
//
// The first version of this file measured the COEFFICIENT OF VARIATION of
// per-cell inked length, and calibration killed it: arctic/dissolve scored
// 0.783 against sandpile/facet at 0.510 — overlapping — and arctic/weave (0.177)
// came out BELOW sandpile/lattice (0.370). Density variance is the wrong
// quantity, because a sparse wireframe has enormous variance (line vs no line)
// and no tone whatsoever. Its densest cell is still two thin strokes.
//
// What separates them is ABSOLUTE INK COVERAGE — how dark the darkest region
// actually gets. Coverage is physical: inked length x pen width / cell area, so
// 1.0 is solid ink and 0.02 is a wireframe. Hence:
//
//   1. DARKNESS  — p98 local coverage. Can this drawing produce a black?
//   2. RANGE     — p98 minus p20 coverage. Does it span black to paper?
//   3. SHARPNESS — p99 coverage gradient divided by range: what fraction of the
//                  full tonal range is crossed in a single cell at the steepest
//                  point. ~1 is a phase boundary; ~0.05 is a smooth ramp. The
//                  earlier version divided by the MEDIAN gradient, which went to
//                  4e8 on a uniform field.
//
// CALIBRATION RESULT (run-calibrate.mjs), against Arctic as known-good and the
// cut Sandpile as known-bad:
//
//                            dark   range
//   arctic/dissolve         0.250   0.222     <- the two presets I would pick
//   arctic/horizon          0.273   0.176     <- by eye, independently
//   arctic/brick            0.305   0.071
//   arctic/weave            0.180   0.030
//   sandpile/facet          0.121   0.091
//   sandpile/crystal        0.080   0.052
//   sandpile/lattice        0.077   0.046
//   REF uniform hatching    0.208   0.042     <- dark but toneless: wallpaper
//   REF hard 5:1 split      0.206   0.165     <- genuinely two regimes
//
// So, empirically:
//   DARKNESS >= 0.15 is NECESSARY. Every Arctic preset clears it; no Sandpile
//     preset comes close. A drawing that cannot make a black cannot make tone.
//   RANGE >= 0.15 marks the STRONG ones, and it picked dissolve and horizon
//     without being told which those were.
//   SHARPNESS did not survive calibration — uniform hatching scores 1.5 on it.
//     Kept as an informational column, not used as a gate. Reporting a metric
//     that failed its own calibration as though it worked is exactly the error
//     this file exists to prevent.
import { writePNG } from './raster.mjs';

/** Rasterise total inked length per cell. */
export function densityField(lines, W, H, cell = 24) {
  const gw = Math.ceil(W / cell);
  const gh = Math.ceil(H / cell);
  const grid = new Float64Array(gw * gh);
  for (const line of lines) {
    const pts = line.points || line;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      // Walk the segment in sub-cell steps so long strokes deposit along their
      // whole length rather than only in their endpoints' cells.
      const steps = Math.max(1, Math.ceil(len / (cell * 0.25)));
      const per = len / steps;
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const gx = Math.min(gw - 1, Math.max(0, (x / cell) | 0));
        const gy = Math.min(gh - 1, Math.max(0, (y / cell) | 0));
        grid[gy * gw + gx] += per;
      }
    }
  }
  return { grid, gw, gh, cell };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

/**
 * Convert the density field to physical ink COVERAGE — the fraction of each
 * cell the pen actually blackens — then score darkness, range and sharpness.
 * `penWidth` is in the same units as the line coordinates (px).
 */
export function toneScore(field, penWidth = 1) {
  const { grid, gw, gh, cell } = field;
  const cellArea = cell * cell;
  const cov = new Float64Array(grid.length);
  for (let i = 0; i < grid.length; i++) cov[i] = Math.min(1, (grid[i] * penWidth) / cellArea);

  const inked = [];
  for (const v of cov) if (v > 0) inked.push(v);
  if (inked.length < 16) return { darkness: 0, range: 0, sharpness: 0, coverage: 0, inkedCells: inked.length };
  inked.sort((a, b) => a - b);

  const darkness = pct(inked, 0.98);
  const range = darkness - pct(inked, 0.2);

  // Gradients only where the cell has inked neighbours all round, so the
  // drawing's own silhouette doesn't register as an internal phase boundary.
  const grads = [];
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1; x < gw - 1; x++) {
      if (cov[y * gw + x] <= 0) continue;
      const l = cov[y * gw + x - 1], r = cov[y * gw + x + 1];
      const u = cov[(y - 1) * gw + x], d = cov[(y + 1) * gw + x];
      if (l <= 0 || r <= 0 || u <= 0 || d <= 0) continue;
      grads.push(Math.hypot(r - l, d - u) / 2);
    }
  }
  grads.sort((a, b) => a - b);
  const sharpness = grads.length >= 16 && range > 1e-6 ? pct(grads, 0.99) / range : 0;

  return {
    darkness,
    range,
    sharpness,
    coverage: inked.length / grid.length,
    inkedCells: inked.length,
  };
}

/** Heatmap PNG — dark = dense ink, white = bare paper. */
export function writeDensityPNG(path, field, scale = 6) {
  const { grid, gw, gh } = field;
  let max = 0;
  for (const v of grid) if (v > max) max = v;
  if (max <= 0) max = 1;
  return writePNG(path, gw * scale, gh * scale, (px, py) => {
    const v = grid[((py / scale) | 0) * gw + ((px / scale) | 0)] / max;
    const t = Math.round(255 * (1 - Math.pow(v, 0.6)));
    return [t, t, t];
  });
}

/** One call: density field, scores, and a heatmap. */
export function tonePreTest(name, lines, W, H, { cell = 24, dir, penWidth = 1 } = {}) {
  const field = densityField(lines, W, H, cell);
  const score = toneScore(field, penWidth);
  // Names carry slashes and spaces for readability in the report table; the
  // filename must not.
  const slug = name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  if (dir) writeDensityPNG(`${dir}/tone-${slug}.png`, field);
  return { name, ...score };
}

export function reportRow(r) {
  const f = (v) => v.toFixed(3).padStart(7);
  return `${r.name.padEnd(28)}${f(r.darkness)}${f(r.range)}${f(r.sharpness)}   ${(100 * r.coverage).toFixed(0)}%`;
}

export const REPORT_HEADER =
  'name'.padEnd(28) + 'dark'.padStart(7) + 'range'.padStart(7) + 'sharp'.padStart(7) + '   area';
