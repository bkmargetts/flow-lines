import { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { lerp, clamp } from '../lib/math.js';
import { nestedRingTables, ringPolygon, blobBoundaryTable, strataCurves } from './shapes.js';

export type LapidaryMode = 'agate' | 'breccia' | 'strata';

export type LapidaryTexture =
  | 'lines'
  | 'wavy'
  | 'hatch'
  | 'patchy'
  | 'cross'
  | 'stipple'
  | 'blank';

/** Per-band texture spec; a plain kind string means "defaults for that kind". */
export interface BandTexture {
  kind: LapidaryTexture;
  /** Absolute stroke direction in degrees (default: base angle + seeded drift). */
  angleDeg?: number;
  /** Multiplier on the kind's resolved line pitch. */
  spacingScale?: number;
  /** Per-band override of the global waviness (wavy only). */
  waviness?: number;
  /** Per-band override of the global patchiness (patchy/cross only). */
  patchiness?: number;
}

/** A band texture with every knob resolved to concrete numbers. */
export interface ResolvedTexture {
  kind: LapidaryTexture;
  angleRad: number;
  spacing: number;
  waviness: number;
  patchiness: number;
  /** Slides the hatch family so no two bands' lines register alike. */
  phase: number;
  seed: number;
}

/** One drawable region: a closed silhouette plus its resolved texture.
 *  Higher z = drawn on top; lower-z ink is carved away around it. */
export interface Region {
  z: number;
  poly: Point[];
  tex: ResolvedTexture;
}

export interface LayoutConfig {
  seed: number;
  mode: LapidaryMode;
  rect: { x0: number; y0: number; x1: number; y1: number };
  bands: number;
  irregularity: number;
  coverage: number;
  centerX: number;
  centerY: number;
  haloPx: number;
  spacingPx: number;
  textures?: Array<LapidaryTexture | BandTexture>;
  baseAngleDeg: number;
  angleDriftDeg: number;
  densityContrast: number;
  waviness: number;
  patchiness: number;
}

/** Baseline pitch multiplier per texture kind, spread further apart by
 *  `densityContrast`: the reference's dense mottled ring against its airy
 *  line field is a spacing decision, not a different pen. */
const KIND_SPACING: Record<LapidaryTexture, number> = {
  lines: 1.7,
  wavy: 1.1,
  hatch: 0.45,
  patchy: 0.55,
  cross: 0.95,
  stipple: 1.3,
  blank: 1,
};

/** Kinds the seeded picker may deal a band (blank is preset-only — a random
 *  paper band next to the background reads as a hole, not a decision). */
const RANDOM_KINDS: LapidaryTexture[] = ['lines', 'wavy', 'hatch', 'patchy', 'cross', 'stipple'];

/**
 * Resolve the texture for band `z` (0 = the background field). Explicit
 * specs are cycled outer→inner; otherwise a seeded pick that always opens
 * with 'lines' (the reference's ruled field) and never repeats a kind on
 * adjacent bands. Every random draw comes from this band's own sub-seeded
 * stream, so re-rolling one knob never reshuffles a sibling band.
 */
function resolveTexture(cfg: LayoutConfig, z: number, prevKind: LapidaryTexture | null): ResolvedTexture {
  const rng = makeRandom(subSeed(cfg.seed, 200 + z));
  let spec: BandTexture;
  if (cfg.textures && cfg.textures.length > 0) {
    const raw = cfg.textures[z % cfg.textures.length];
    spec = typeof raw === 'string' ? { kind: raw } : raw;
  } else if (z === 0) {
    spec = { kind: 'lines' };
  } else {
    let kind = RANDOM_KINDS[Math.floor(rng() * RANDOM_KINDS.length)];
    if (kind === prevKind) {
      kind = RANDOM_KINDS[(RANDOM_KINDS.indexOf(kind) + 1) % RANDOM_KINDS.length];
    }
    spec = { kind };
  }
  // The background band keeps the base angle exactly — the reference's ruled
  // vertical field is a datum the inner bands drift against.
  const drift = z === 0 ? 0 : (rng() * 2 - 1) * cfg.angleDriftDeg;
  const angleDeg = spec.angleDeg ?? cfg.baseAngleDeg + drift;
  // densityContrast spreads per-band pitch around the kind baseline; explicit
  // spacingScale pins it.
  const contrast = spec.spacingScale ?? lerp(1, 0.7 + 0.9 * rng(), cfg.densityContrast);
  const spacing = Math.max(1.2, cfg.spacingPx * KIND_SPACING[spec.kind] * contrast);
  return {
    kind: spec.kind,
    angleRad: (angleDeg * Math.PI) / 180,
    spacing,
    waviness: clamp(spec.waviness ?? cfg.waviness, 0, 1),
    patchiness: clamp(spec.patchiness ?? cfg.patchiness, 0, 1),
    phase: rng(),
    seed: subSeed(cfg.seed, 400 + z),
  };
}

function rectPolygon(rect: LayoutConfig['rect']): Point[] {
  return [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x1, y: rect.y1 },
    { x: rect.x0, y: rect.y1 },
  ];
}

function agateRegions(cfg: LayoutConfig): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;
  const cx = x0 + halfW + cfg.centerX * halfW;
  const cy = y0 + halfH + cfg.centerY * halfH;
  // Ring shrink must leave room for the seam plus a couple of surviving
  // strokes, or a band exists only as its own halo.
  const minGap = cfg.haloPx * 2 + cfg.spacingPx * 3;
  const tables = nestedRingTables(
    cfg.seed,
    cfg.bands - 1,
    cfg.coverage,
    cfg.irregularity,
    halfW,
    halfH,
    minGap
  );
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  const push = (z: number, poly: Point[]): void => {
    const tex = resolveTexture(cfg, z, prevKind);
    prevKind = tex.kind;
    regions.push({ z, poly, tex });
  };
  push(0, rectPolygon(cfg.rect));
  tables.forEach((g, i) => push(i + 1, ringPolygon(cx, cy, halfW, halfH, g)));
  return regions;
}

/** Fragment count is bands-1 capped: past ~14 blobs the sheet reads as
 *  confetti and the halo carve cost grows for nothing. */
const BRECCIA_CAP = 14;

function brecciaRegions(cfg: LayoutConfig): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;
  const rng = makeRandom(subSeed(cfg.seed, 5));
  const want = Math.min(cfg.bands - 1, BRECCIA_CAP);
  const frags: Array<{ cx: number; cy: number; rx: number; ry: number; seed: number }> = [];
  let attempts = 0;
  while (frags.length < want && attempts < want * 12) {
    attempts++;
    const cx = x0 + halfW * (0.24 + 1.52 * rng()) + cfg.centerX * halfW;
    const cy = y0 + halfH * (0.24 + 1.52 * rng()) + cfg.centerY * halfH;
    const f = lerp(0.16, 0.42, rng()) * cfg.coverage;
    const fragSeed = subSeed(cfg.seed, 120 + attempts);
    // Overlapping skirts are wanted (that's the layering); a centre landing
    // inside an existing fragment's core would just vanish under its halo.
    let coreHit = false;
    for (const e of frags) {
      const dx = (cx - e.cx) / (e.rx * 0.55);
      const dy = (cy - e.cy) / (e.ry * 0.55);
      if (dx * dx + dy * dy < 1) {
        coreHit = true;
        break;
      }
    }
    if (coreHit) continue;
    // Clamp the radius box to the margin rect (the normalized boundary never
    // exceeds it), so fragments stay on the sheet at any throw.
    const rx = Math.min(f * halfW, cx - x0, x1 - cx);
    const ry = Math.min(f * halfH, cy - y0, y1 - cy);
    if (rx < cfg.haloPx * 2 || ry < cfg.haloPx * 2) continue;
    frags.push({ cx, cy, rx, ry, seed: fragSeed });
  }
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  const push = (z: number, poly: Point[]): void => {
    const tex = resolveTexture(cfg, z, prevKind);
    prevKind = tex.kind;
    regions.push({ z, poly, tex });
  };
  push(0, rectPolygon(cfg.rect));
  frags.forEach((fr, i) => {
    const table = blobBoundaryTable(fr.seed, cfg.irregularity, null, 0);
    push(i + 1, ringPolygon(fr.cx, fr.cy, fr.rx, fr.ry, table));
  });
  return regions;
}

function strataRegions(cfg: LayoutConfig): Region[] {
  const { x0, y0, x1, y1 } = cfg.rect;
  const curves = strataCurves(
    cfg.seed,
    cfg.bands - 1,
    x0,
    y0,
    x1,
    y1,
    cfg.irregularity,
    cfg.haloPx * 2 + cfg.spacingPx * 2
  );
  const half = cfg.haloPx / 2;
  const regions: Region[] = [];
  let prevKind: LapidaryTexture | null = null;
  for (let k = 0; k < cfg.bands; k++) {
    const top: Point[] =
      k === 0
        ? [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
          ]
        : curves[k - 1].map((p) => ({ x: p.x, y: p.y + half }));
    const bottom: Point[] =
      k === cfg.bands - 1
        ? [
            { x: x1, y: y1 },
            { x: x0, y: y1 },
          ]
        : curves[k]
            .map((p) => ({ x: p.x, y: p.y - half }))
            .reverse();
    const poly = [...top, ...bottom];
    const tex = resolveTexture(cfg, k, prevKind);
    prevKind = tex.kind;
    regions.push({ z: k, poly, tex });
  }
  return regions;
}

/** Build the mode's region list. Strata partitions the sheet with geometric
 *  seam gaps already built into the polygons; the other modes rely on the
 *  z-order halo carve. */
export function buildRegions(cfg: LayoutConfig): { regions: Region[]; geometricGaps: boolean } {
  if (cfg.mode === 'breccia') return { regions: brecciaRegions(cfg), geometricGaps: false };
  if (cfg.mode === 'strata') return { regions: strataRegions(cfg), geometricGaps: true };
  return { regions: agateRegions(cfg), geometricGaps: false };
}
