import { FlowLine, Point } from '../flow-lines.js';
import { createNoise, SimplexNoise } from '../noise.js';
import { traceIsoContours } from '../iso-contours.js';
import { GrayscaleImage } from '../image.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { textToStrokes, textWidth } from '../stroke-font.js';
import { getSketchStyleConfig, type SketchStyle } from '../sketch-styles.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { clamp01 } from '../lib/math.js';
import { type Vec3, TAU, DEG, dot, cross, norm, makeRotation } from './vec3.js';
import { DEFAULTS, type BodyParams } from './body.js';

/**
 * Procedural planets drawn as plottable pen-and-ink: a sphere shaded by
 * form-following cross-contour hatching (curved strokes that wrap the globe and
 * thicken into the shadow), confident traced contours for coastlines / band
 * edges / crater rims, stipple texture, and optional rings, craters, a
 * starfield and a companion moon. Everything is single-pen stroked polylines,
 * deterministic per seed — no fills, no stroke-width tricks. Mirrors the Vine
 * Generator: heavy algorithm here in core, a thin web/CLI wrapper feeds it.
 */

export type PlanetType =
  | 'terrestrial'
  | 'gas-giant'
  | 'ringed'
  | 'moon'
  | 'ice'
  | 'lava'
  | 'star'
  | 'barren';

export interface PlanetOptions {
  width: number;
  height: number;
  margin: number;
  seed?: number;

  /** Disk radius as a fraction of the usable half-frame (0..1). */
  radiusFrac?: number;
  planetType?: PlanetType;

  // Light
  lightAngle?: number; // degrees, azimuth in the screen plane
  lightElevation?: number; // degrees, 0 = grazing (crescent) .. 90 = full face
  ambient?: number; // 0..1 fill so the shadow side never goes pure white
  limbDarkening?: number; // 0..1 darkening toward the disk edge (star/gas)

  // Surface noise
  noiseScale?: number;
  octaves?: number;
  persistence?: number;
  contrast?: number; // >1 sharpens coast/cracks
  seaLevel?: number; // terrestrial land/sea threshold on noise (-1..1)
  mareLevel?: number; // moon dark-plain threshold
  coastlines?: boolean; // trace feature outlines
  lavaFissureWidth?: number; // |noise| band kept as open glowing cracks
  lavaGlow?: number; // 0..1 ember-stipple density along the fissures

  // Gas giant
  bands?: boolean;
  bandCount?: number;
  bandTurbulence?: number;
  storms?: number; // count of oval spots (Great Red Spot)
  stormSize?: number; // 0..n scale on the storm ovals

  // Ice caps
  iceCaps?: boolean;
  capLatitude?: number; // degrees from the equator where caps begin
  capRaggedness?: number; // 0..1 noisy cap edge

  // Mark-making
  hatchSpacing?: number; // base stroke spacing in px
  crossHatchLayers?: number; // 1..5
  lightWeight?: number; // tone = darkness*lightWeight + albedo*albedoWeight
  albedoWeight?: number;
  stipple?: number; // 0..1 shadow/texture dots
  atmosphere?: number; // 0..n glow rings (star: corona)

  // Rings
  rings?: boolean;
  ringInner?: number; // in disk radii
  ringOuter?: number;
  ringTilt?: number; // degrees
  ringYaw?: number; // degrees
  ringGap?: number; // 0..1 fraction of the span left as a Cassini gap
  ringCount?: number; // concentric stroke bands
  ringDensity?: number; // strokes per band (tone by spacing)
  ringShadow?: boolean; // cut the planet's shadow into the rings

  // Craters
  craters?: boolean;
  craterCount?: number;
  craterMinR?: number; // fraction of disk radius
  craterMaxR?: number;
  craterDetail?: boolean; // central peaks + ejecta rays on big craters

  // Surface relief
  terminatorEmphasis?: number; // 0..1 extra hatch hugging the terminator
  mountains?: boolean; // chevron hachures on high terrestrial land
  clouds?: boolean; // soft cloud shapes traced over terrestrial worlds

  // Engraved-plate annotation
  graticule?: boolean; // lat/long lines on the globe
  graticuleSpacingDeg?: number; // degrees between lines
  plateFrame?: boolean; // graduated neatline just inside the margin
  scaleBar?: boolean; // divided scale bar along the bottom
  title?: string; // engraved plate title, centred along the top
  caption?: string; // engraved caption, centred along the bottom

  // Composition (multi-body plates)
  layout?: 'single' | 'phases' | 'comparison' | 'orbital';
  layoutCount?: number; // bodies in the plate

  // Extras
  starfield?: boolean;
  starCount?: number;
  moon?: boolean;
  moonDist?: number; // in disk radii from centre
  moonAngle?: number; // degrees
  moonRadiusFrac?: number; // of the primary radius

  // Pen / finishing
  penWidth?: number; // px
  wobble?: number; // px wobble amplitude
  sketch?: number; // 0..1 hand-drawn overdraw intensity (multi-pass)
  sketchStyle?: SketchStyle; // character of the overdraw
}

/** Append `pts` as a FlowLine if it has enough points to draw. */
function pushRun(out: FlowLine[], pts: Point[], layer: string, pen?: 'fine' | 'bold'): void {
  if (pts.length >= 2) out.push({ points: pts, layer, ...(pen ? { pen } : {}) });
}

export function generatePlanet(options: PlanetOptions): {
  lines: FlowLine[];
  width: number;
  height: number;
} {
  const o = { ...DEFAULTS, ...options };
  const seed = options.seed ?? randomSeed();
  const { width, height, margin } = options;
  const cx = width / 2;
  const cy = height / 2;
  const usableR = Math.min(width, height) / 2 - margin;
  const R = Math.max(10, o.radiusFrac * usableR);

  // Light direction (shared by every body in the scene).
  const la = o.lightAngle * DEG;
  const le = o.lightElevation * DEG;
  const L: Vec3 = norm({
    x: Math.cos(le) * Math.cos(la),
    y: Math.cos(le) * Math.sin(la),
    z: Math.sin(le),
  });
  // Orthonormal frame around the light axis, for form-following hatch families.
  const A = L;
  let U = cross(A, { x: 0, y: 0, z: 1 });
  if (U.x * U.x + U.y * U.y + U.z * U.z < 1e-6) U = cross(A, { x: 0, y: 1, z: 0 });
  U = norm(U);
  const V = cross(A, U);

  // A second frame around the planet's spin axis (vertical in screen space), so
  // gas-giant hatch and the graticule run along latitude/longitude, not the
  // light axis. "Ring" passes in this frame are parallels (the belts).
  const SPIN: Vec3 = { x: 0, y: 1, z: 0 };
  const US = norm(cross(SPIN, { x: 0, y: 0, z: 1 }));
  const VS = cross(SPIN, US);

  const lines: FlowLine[] = [];

  /** Render one spherical body (planet or moon) into `lines`. */
  function renderBody(b: BodyParams): void {
    const { cx: bx, cy: by, R: br, bodyType, bodySeed } = b;
    // Per-body light + its form-following hatch frame (defaults to the scene
    // light; phase strips override it so each disk shows a different phase).
    const bL = b.light ? norm(b.light) : L;
    const bA = bL;
    let bU = cross(bA, { x: 0, y: 0, z: 1 });
    if (bU.x * bU.x + bU.y * bU.y + bU.z * bU.z < 1e-6) bU = cross(bA, { x: 0, y: 1, z: 0 });
    bU = norm(bU);
    const bV = cross(bA, bU);
    const nSurf = createNoise(bodySeed);
    const nBand = createNoise(bodySeed + 101);
    const nStorm = createNoise(bodySeed + 202);
    const nCap = createNoise(bodySeed + 303);
    const rot = makeRotation(makeRandom(bodySeed + 404));
    const scale = o.noiseScale;

    // Storm spots (gas giants): a few oval high-contrast cells.
    const storms: { dir: Vec3; rad: number; dark: number }[] = [];
    if ((bodyType === 'gas-giant' || bodyType === 'ringed') && o.storms > 0) {
      const sr = makeRandom(bodySeed + 505);
      for (let i = 0; i < o.storms; i++) {
        const lat = (sr() - 0.5) * 1.1; // keep away from the poles
        const lon = sr() * TAU;
        const cl = Math.cos(lat);
        storms.push({
          dir: { x: cl * Math.cos(lon), y: Math.sin(lat), z: cl * Math.sin(lon) },
          rad: 0.18 + sr() * 0.16,
          dark: 0.45 + sr() * 0.2,
        });
      }
    }

    const occluded = (sx: number, sy: number): boolean => {
      if (!b.occluders) return false;
      for (const occ of b.occluders) {
        const dx = sx - occ.cx;
        const dy = sy - occ.cy;
        if (dx * dx + dy * dy < occ.R * occ.R) return true;
      }
      return false;
    };

    // --- Surface fields, sampled at the 3D normal so features wrap the sphere.
    const surface = (N: Vec3): { n: number; lat: number; band: number } => {
      const r = rot(N);
      let n = nSurf.fbm3D(r.x * scale, r.y * scale, r.z * scale, o.octaves, o.persistence, 2, 1);
      n = Math.sign(n) * Math.pow(Math.abs(n), 1 / Math.max(0.2, o.contrast));
      const lat = Math.asin(Math.max(-1, Math.min(1, N.y)));
      let band = 0;
      if (bodyType === 'gas-giant' || bodyType === 'ringed') {
        const warp =
          o.bandTurbulence *
          nBand.fbm3D(r.x * 1.3, r.y * 0.6, r.z * 1.3, 3, 0.55, 2, 1);
        band = Math.sin((lat + warp * 0.5) * o.bandCount);
      }
      return { n, lat, band };
    };

    const capLatRad = o.capLatitude * DEG;
    const isCap = (N: Vec3, lat: number): boolean => {
      if (!o.iceCaps) return false;
      const r = rot(N);
      const ragged = o.capRaggedness * 0.4 * nCap.fbm3D(r.x * 2.4, r.y * 2.4, r.z * 2.4, 2, 0.5, 2, 1);
      return Math.abs(lat) > capLatRad - ragged;
    };

    const stormDark = (N: Vec3): number => {
      let d = 0;
      for (const s of storms) {
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(N, s.dir))));
        if (ang < s.rad) d = Math.max(d, s.dark * (1 - ang / s.rad));
      }
      return d;
    };

    // Surface albedo expressed as added darkness (0 bright .. 1 inky).
    const albedoDarkness = (N: Vec3, f: { n: number; lat: number; band: number }): number => {
      if (isCap(N, f.lat)) return 0;
      switch (bodyType) {
        case 'terrestrial':
          return f.n < o.seaLevel ? 0.5 : 0.08;
        case 'moon':
        case 'barren':
          return f.n < o.mareLevel ? 0.42 : 0.16;
        case 'gas-giant':
        case 'ringed': {
          // Sharpen the sinusoid toward a square wave so belts (dark) and zones
          // (clean paper) read as committed bands, not a soft gradient.
          const dark = 0.5 - 0.5 * Math.tanh(f.band * 2.2);
          return Math.max(0.06 + 0.5 * dark, stormDark(N));
        }
        case 'ice':
          return 0.06 + (f.n < 0 ? 0.12 : 0);
        case 'lava':
          // Dark hatched crust everywhere except thin glowing fissures (|n|≈0),
          // which stay as clean paper — the molten cracks.
          return Math.abs(f.n) < o.lavaFissureWidth ? 0 : 0.52;
        case 'star':
          return 0;
        default:
          return 0.1;
      }
    };

    // Lit-ness → darkness, with optional limb darkening.
    const darknessAt = (N: Vec3): number => {
      const lam = Math.max(0, dot(N, bL));
      let shade = o.ambient + (1 - o.ambient) * lam;
      if (o.limbDarkening > 0) shade *= 1 - o.limbDarkening * (1 - N.z);
      return 1 - clamp01(shade);
    };

    const toneAt = (N: Vec3): number => {
      const f = surface(N);
      const dk = darknessAt(N);
      const al = albedoDarkness(N, f);
      return clamp01(dk * o.lightWeight + al * o.albedoWeight);
    };

    // Where we keep clean paper rather than lay line hatch.
    const hatchMask = (N: Vec3): boolean => {
      if (bodyType === 'star') return false; // granulation is stipple, not line
      const f = surface(N);
      if (isCap(N, f.lat)) return false;
      if (bodyType === 'lava') {
        if (Math.abs(f.n) < o.lavaFissureWidth) return false; // glowing crack stays open
      }
      return true;
    };

    // --- Form-following cross-contour hatching.
    // The lit cap is held clean (tone below the base threshold gets no marks),
    // so curved single-direction hatch carries the midtones and cross-hatch only
    // builds in the shadow — a tonal sphere, not a wireframe globe. Keeping the
    // base threshold up also blanks the sub-light point, avoiding a bullseye.
    const PASSES: { kind: 'ring' | 'meridian'; phase: number; thr: number }[] = [
      { kind: 'ring', phase: 0, thr: 0.2 },
      { kind: 'ring', phase: 0.5, thr: 0.44 },
      { kind: 'meridian', phase: 0, thr: 0.6 },
      { kind: 'ring', phase: 0.25, thr: 0.74 },
      { kind: 'meridian', phase: 0.5, thr: 0.86 },
    ];
    const layerCount = Math.max(1, Math.min(PASSES.length, Math.round(o.crossHatchLayers)));
    const dt = Math.max(0.01, o.hatchSpacing / br); // angular step ≈ hatchSpacing px

    // Gas giants hatch around the spin axis so "ring" passes lay down as
    // horizontal belts; everything else hatches around the light axis so the
    // shading bunches toward the terminator. Tone gating (which folds the belt
    // albedo) still tightens the shadow side in both frames.
    const beltHatch = bodyType === 'gas-giant' || bodyType === 'ringed';
    const HA = beltHatch ? SPIN : bA;
    const HU = beltHatch ? US : bU;
    const HV = beltHatch ? VS : bV;

    const sampleAndEmit = (N: Vec3, thr: number, run: Point[]): boolean => {
      // returns whether the point was kept (continues the run)
      if (N.z <= 0) return false;
      const sx = bx + br * N.x;
      const sy = by + br * N.y;
      if (occluded(sx, sy)) return false;
      if (!hatchMask(N)) return false;
      if (toneAt(N) < thr) return false;
      run.push({ x: sx, y: sy });
      return true;
    };

    for (let p = 0; p < layerCount; p++) {
      const pass = PASSES[p];
      if (pass.kind === 'ring') {
        // Circles of constant colatitude around the light axis (parallel to the
        // terminator) — concentric shading that bunches into the shadow.
        for (let m = 1; (m + pass.phase) * dt < Math.PI; m++) {
          const t0 = (m + pass.phase) * dt;
          const sinT = Math.sin(t0);
          const cosT = Math.cos(t0);
          const ns = Math.max(16, Math.ceil((TAU * br * sinT) / o.hatchSpacing));
          let run: Point[] = [];
          for (let s = 0; s <= ns; s++) {
            const ss = (s / ns) * TAU;
            const dir = Math.cos(ss);
            const dir2 = Math.sin(ss);
            const N: Vec3 = {
              x: HA.x * cosT + (HU.x * dir + HV.x * dir2) * sinT,
              y: HA.y * cosT + (HU.y * dir + HV.y * dir2) * sinT,
              z: HA.z * cosT + (HU.z * dir + HV.z * dir2) * sinT,
            };
            if (!sampleAndEmit(N, pass.thr, run)) {
              pushRun(lines, run, 'hatch');
              run = [];
            }
          }
          pushRun(lines, run, 'hatch');
        }
      } else {
        // Meridian arcs from the lit pole to the anti-lit pole — the cross-hatch.
        const dPhi = dt;
        for (let m = 0; (m + pass.phase) * dPhi < TAU; m++) {
          const phi = (m + pass.phase) * dPhi;
          const cphi = Math.cos(phi);
          const sphi = Math.sin(phi);
          const dirU = { x: HU.x * cphi + HV.x * sphi, y: HU.y * cphi + HV.y * sphi, z: HU.z * cphi + HV.z * sphi };
          const nt = Math.max(24, Math.ceil(Math.PI / dt));
          let run: Point[] = [];
          for (let s = 0; s <= nt; s++) {
            const t = (s / nt) * Math.PI;
            const sinT = Math.sin(t);
            const cosT = Math.cos(t);
            const N: Vec3 = {
              x: HA.x * cosT + dirU.x * sinT,
              y: HA.y * cosT + dirU.y * sinT,
              z: HA.z * cosT + dirU.z * sinT,
            };
            if (!sampleAndEmit(N, pass.thr, run)) {
              pushRun(lines, run, 'hatch');
              run = [];
            }
          }
          pushRun(lines, run, 'hatch');
        }
      }
    }

    // --- Terminator emphasis: extra rings hugging the day/night boundary (the
    // great circle at colatitude π/2 around the light axis), for the classic
    // engraved ramp from light into shadow.
    if (o.terminatorEmphasis > 0 && bodyType !== 'star') {
      const eband = 0.5;
      const estep = Math.max(0.012, dt * (1 - 0.55 * o.terminatorEmphasis));
      for (let t0 = Math.PI / 2 - eband; t0 <= Math.PI / 2 + eband + 1e-9; t0 += estep) {
        const sinT = Math.sin(t0);
        const cosT = Math.cos(t0);
        const ns = Math.max(16, Math.ceil((TAU * br * Math.abs(sinT)) / o.hatchSpacing));
        let run: Point[] = [];
        for (let s = 0; s <= ns; s++) {
          const ss = (s / ns) * TAU;
          const dir = Math.cos(ss);
          const dir2 = Math.sin(ss);
          const N: Vec3 = {
            x: bA.x * cosT + (bU.x * dir + bV.x * dir2) * sinT,
            y: bA.y * cosT + (bU.y * dir + bV.y * dir2) * sinT,
            z: bA.z * cosT + (bU.z * dir + bV.z * dir2) * sinT,
          };
          if (!sampleAndEmit(N, 0.12, run)) { pushRun(lines, run, 'hatch'); run = []; }
        }
        pushRun(lines, run, 'hatch');
      }
    }

    // --- Traced feature contours from a screen-space raster of the field.
    const traceField = (fieldFn: (N: Vec3) => number, iso: number, pen?: 'fine' | 'bold', layer = 'feature'): void => {
      const grid = Math.max(48, Math.min(220, Math.round(br * 1.5)));
      const data = new Float32Array(grid * grid);
      const step = (2 * br) / (grid - 1);
      const SENT = iso - 1000;
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const sx = bx - br + gx * step;
          const sy = by - br + gy * step;
          const dx = sx - bx;
          const dy = sy - by;
          const r2 = dx * dx + dy * dy;
          if (r2 <= br * br) {
            const z = Math.sqrt(br * br - r2);
            data[gy * grid + gx] = fieldFn({ x: dx / br, y: dy / br, z: z / br });
          } else {
            data[gy * grid + gx] = SENT;
          }
        }
      }
      const raster: GrayscaleImage = { width: grid, height: grid, data };
      const polys = traceIsoContours(raster, iso);
      const lim2 = (br * 0.985) * (br * 0.985);
      for (const poly of polys) {
        let run: Point[] = [];
        for (const gp of poly) {
          const sx = bx - br + gp.x * step;
          const sy = by - br + gp.y * step;
          const dx = sx - bx;
          const dy = sy - by;
          if (dx * dx + dy * dy > lim2 || occluded(sx, sy)) {
            pushRun(lines, run, layer, pen);
            run = [];
            continue;
          }
          run.push({ x: sx, y: sy });
        }
        pushRun(lines, run, layer, pen);
      }
    };

    if (o.coastlines) {
      if (bodyType === 'terrestrial') traceField((N) => surface(N).n, o.seaLevel);
      else if (bodyType === 'moon' || bodyType === 'barren') traceField((N) => surface(N).n, o.mareLevel);
      else if (bodyType === 'gas-giant' || bodyType === 'ringed') traceField((N) => surface(N).band, 0);
      else if (bodyType === 'lava') traceField((N) => Math.abs(surface(N).n), o.lavaFissureWidth);
    }
    if (o.iceCaps) {
      traceField((N) => {
        const f = surface(N);
        const r = rot(N);
        const ragged = o.capRaggedness * 0.4 * nCap.fbm3D(r.x * 2.4, r.y * 2.4, r.z * 2.4, 2, 0.5, 2, 1);
        return Math.abs(f.lat) - (capLatRad - ragged);
      }, 0);
    }

    // --- Clouds: soft blobs from a low-frequency field, traced as light
    // outlines over terrestrial worlds (the edge detector misses them).
    if (o.clouds && bodyType === 'terrestrial') {
      const nCloud = createNoise(bodySeed + 606);
      traceField((N) => {
        const r = rot(N);
        return nCloud.fbm3D(r.x * scale * 0.7, r.y * scale * 0.7, r.z * scale * 0.7, 3, 0.55, 2, 1);
      }, 0.32, undefined, 'cloud');
    }

    // --- Storms (gas giants): an oval cell with a couple of internal swirl
    // rings — a drawn Great Red Spot, not just a darker patch.
    for (const s of storms) {
      if (s.dir.z <= 0.12) continue; // front-facing only
      const scx = bx + br * s.dir.x;
      const scy = by + br * s.dir.y;
      if (occluded(scx, scy)) continue;
      const span = br * Math.sin(s.rad) * o.stormSize;
      if (span < 3) continue;
      const orient = Math.atan2(s.dir.y, s.dir.x) + Math.PI / 2; // tangent to the limb
      const major = span * 1.25;
      const minor = span * 0.8 * Math.max(0.4, s.dir.z);
      pushRun(lines, ellipse(scx, scy, major, minor, orient, 0, TAU), 'feature', span > br * 0.12 ? 'bold' : undefined);
      for (const k of [0.66, 0.4]) {
        pushRun(lines, ellipse(scx, scy, major * k, minor * k, orient, 0, TAU), 'feature');
      }
    }

    // --- Stipple (shadow / texture dots), gated by tone.
    if (o.stipple > 0) {
      const sr = makeRandom(bodySeed + 707);
      const cell = Math.max(2.2, o.hatchSpacing * 0.7);
      for (let sy = by - br; sy <= by + br; sy += cell) {
        for (let sx = bx - br; sx <= bx + br; sx += cell) {
          const jx = sx + (sr() - 0.5) * cell;
          const jy = sy + (sr() - 0.5) * cell;
          const dx = jx - bx;
          const dy = jy - by;
          const r2 = dx * dx + dy * dy;
          if (r2 > br * br) continue;
          if (occluded(jx, jy)) continue;
          const z = Math.sqrt(br * br - r2);
          const N: Vec3 = { x: dx / br, y: dy / br, z: z / br };
          let prob: number;
          if (bodyType === 'star') {
            prob = clamp01(0.35 + 0.5 * (1 - N.z)) * o.stipple;
          } else if (bodyType === 'lava') {
            // Embers cluster along the glowing fissures; the crust gets only a
            // light scatter so it reads as texture, not noise.
            const onFissure = Math.abs(surface(N).n) < o.lavaFissureWidth * 1.6;
            prob = onFissure ? o.lavaGlow : toneAt(N) * o.stipple * 0.3;
          } else {
            prob = toneAt(N) * o.stipple;
          }
          if (sr() < prob) {
            const rr = o.penWidth * 0.55;
            lines.push({ points: dot4(jx, jy, rr), layer: 'stipple' });
          }
        }
      }
    }

    // --- Craters: foreshortened rim ellipses + a shaded inner cup.
    if (b.craters) {
      const cr = makeRandom(bodySeed + 808);
      const crot = makeRotation(makeRandom(bodySeed + 909));
      const golden = Math.PI * (3 - Math.sqrt(5));
      const Ls = norm({ x: bL.x, y: bL.y, z: 0.0001 });
      const antiAng = Math.atan2(-Ls.y, -Ls.x);
      for (let i = 0; i < o.craterCount; i++) {
        const yy = 1 - ((i + 0.5) / o.craterCount) * 2;
        const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
        const th = i * golden;
        let d: Vec3 = { x: Math.cos(th) * rad, y: yy, z: Math.sin(th) * rad };
        d = crot(d);
        if (d.z <= 0.14) continue; // front-facing only
        const sz = (o.craterMinR + (o.craterMaxR - o.craterMinR) * cr() * cr()) * br;
        const ccx = bx + br * d.x;
        const ccy = by + br * d.y;
        if (occluded(ccx, ccy)) continue;
        const radialAng = Math.atan2(d.y, d.x);
        const major = sz;
        const minor = Math.max(0.16, d.z) * sz;
        const orient = radialAng + Math.PI / 2; // major axis tangent to the limb
        pushRun(lines, ellipse(ccx, ccy, major, minor, orient, 0, TAU), 'feature', sz > br * 0.09 ? 'bold' : undefined);
        // Inner shaded cup: nested partial arcs on the anti-light side.
        const a0 = antiAng - orient - 1.9;
        const a1 = antiAng - orient + 1.9;
        for (const k of [0.78, 0.56, 0.36]) {
          pushRun(lines, ellipse(ccx, ccy, major * k, minor * k, orient, a0, a1), 'feature');
        }
        // Central peak + ejecta rays on the bigger, fresher craters.
        if (o.craterDetail && sz > br * 0.06) {
          lines.push({ points: dot4(ccx, ccy, Math.max(o.penWidth * 0.6, sz * 0.12)), layer: 'feature' });
          if (sz > br * 0.09) {
            const rays = 6 + Math.floor(cr() * 4);
            for (let rI = 0; rI < rays; rI++) {
              const ra = (rI / rays) * TAU + cr() * 0.4;
              const r0 = sz * 1.05;
              const r1 = r0 + sz * (0.4 + cr() * 0.5);
              lines.push({ points: [
                { x: ccx + Math.cos(ra) * r0, y: ccy + Math.sin(ra) * r0 * Math.max(0.3, d.z) },
                { x: ccx + Math.cos(ra) * r1, y: ccy + Math.sin(ra) * r1 * Math.max(0.3, d.z) },
              ], layer: 'feature' });
            }
          }
        }
      }
    }

    // --- Mountain hachures: short chevrons on the highest terrestrial land,
    // apex toward the light, so ranges read as relief.
    if (o.mountains && bodyType === 'terrestrial') {
      const mr = makeRandom(bodySeed + 1212);
      const cell = Math.max(4, o.hatchSpacing * 1.5);
      const ld = Math.hypot(bL.x, bL.y) || 1;
      const ux = bL.x / ld;
      const uy = bL.y / ld; // up-light screen direction
      const px = -uy;
      const py = ux; // perpendicular
      const sz = cell * 0.5;
      for (let yy = by - br; yy <= by + br; yy += cell) {
        for (let xx = bx - br; xx <= bx + br; xx += cell) {
          const jx = xx + (mr() - 0.5) * cell;
          const jy = yy + (mr() - 0.5) * cell;
          const dx = jx - bx;
          const dy = jy - by;
          const r2 = dx * dx + dy * dy;
          if (r2 > br * br * 0.97) continue;
          if (occluded(jx, jy)) continue;
          const z = Math.sqrt(br * br - r2);
          const N: Vec3 = { x: dx / br, y: dy / br, z: z / br };
          const f = surface(N);
          if (f.n < o.seaLevel + 0.28) continue; // peaks only
          if (mr() > 0.55) continue; // sparse
          const apex = { x: jx + ux * sz * 0.7, y: jy + uy * sz * 0.7 };
          const baseL = { x: jx + px * sz * 0.7 - ux * sz * 0.3, y: jy + py * sz * 0.7 - uy * sz * 0.3 };
          const baseR = { x: jx - px * sz * 0.7 - ux * sz * 0.3, y: jy - py * sz * 0.7 - uy * sz * 0.3 };
          lines.push({ points: [baseL, apex, baseR], layer: 'relief' });
        }
      }
    }

    // --- Graticule: latitude/longitude lines on the globe, front hemisphere
    // only, stopping a sliver short of the limb. Built in the spin-axis frame
    // (US/VS), the same great-circle math as the hatch but ungated by tone.
    if (o.graticule) {
      const gstep = Math.max(5, o.graticuleSpacingDeg) * DEG;
      const res = Math.max(2, o.hatchSpacing * 0.8);
      const emit = (N: Vec3, run: Point[]): boolean => {
        if (N.z <= 0.03) return false; // hold off the limb
        const sx = bx + br * N.x;
        const sy = by + br * N.y;
        if (occluded(sx, sy)) return false;
        run.push({ x: sx, y: sy });
        return true;
      };
      // Parallels (constant latitude).
      for (let lat = -Math.PI / 2 + gstep; lat < Math.PI / 2 - 1e-3; lat += gstep) {
        const sLat = Math.sin(lat);
        const cLat = Math.cos(lat);
        const ns = Math.max(48, Math.ceil((TAU * br * cLat) / res));
        let run: Point[] = [];
        for (let s = 0; s <= ns; s++) {
          const lon = (s / ns) * TAU;
          const cl = Math.cos(lon);
          const sl = Math.sin(lon);
          const N: Vec3 = {
            x: SPIN.x * sLat + (US.x * cl + VS.x * sl) * cLat,
            y: SPIN.y * sLat + (US.y * cl + VS.y * sl) * cLat,
            z: SPIN.z * sLat + (US.z * cl + VS.z * sl) * cLat,
          };
          if (!emit(N, run)) { pushRun(lines, run, 'graticule'); run = []; }
        }
        pushRun(lines, run, 'graticule');
      }
      // Meridians (constant longitude), pole to pole.
      const nt = Math.max(48, Math.ceil((Math.PI * br) / res));
      for (let lon = 0; lon < TAU - 1e-3; lon += gstep) {
        const cl = Math.cos(lon);
        const sl = Math.sin(lon);
        const dU = { x: US.x * cl + VS.x * sl, y: US.y * cl + VS.y * sl, z: US.z * cl + VS.z * sl };
        let run: Point[] = [];
        for (let s = 0; s <= nt; s++) {
          const t = (s / nt) * Math.PI;
          const cT = Math.cos(t);
          const sT = Math.sin(t);
          const N: Vec3 = {
            x: SPIN.x * cT + dU.x * sT,
            y: SPIN.y * cT + dU.y * sT,
            z: SPIN.z * cT + dU.z * sT,
          };
          if (!emit(N, run)) { pushRun(lines, run, 'graticule'); run = []; }
        }
        pushRun(lines, run, 'graticule');
      }
    }

    // --- Limb: a bold silhouette built from concentric single-pen passes.
    const limbPasses = Math.max(2, Math.round(o.penWidth > 0 ? 3 : 2));
    for (let k = 0; k < limbPasses; k++) {
      const rr = br - k * o.penWidth * 0.9;
      if (rr < 2) break;
      let run: Point[] = [];
      const n = 110;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * TAU;
        const sx = bx + Math.cos(t) * rr;
        const sy = by + Math.sin(t) * rr;
        if (occluded(sx, sy)) {
          pushRun(lines, run, 'limb', 'bold');
          run = [];
          continue;
        }
        run.push({ x: sx, y: sy });
      }
      pushRun(lines, run, 'limb', 'bold');
    }
  }

  // Helper: a small closed dot polygon.
  function dot4(x: number, y: number, r: number): Point[] {
    return ellipse(x, y, r, r, 0, 0, TAU);
  }

  // Helper: ellipse (or arc) polyline.
  function ellipse(
    x: number,
    y: number,
    a: number,
    bb: number,
    rot: number,
    start: number,
    end: number
  ): Point[] {
    const span = end - start;
    const n = Math.max(10, Math.ceil((Math.abs(span) / TAU) * 48));
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const pts: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const t = start + (i / n) * span;
      const lx = Math.cos(t) * a;
      const ly = Math.sin(t) * bb;
      pts.push({ x: x + lx * cr - ly * sr, y: y + lx * sr + ly * cr });
    }
    return pts;
  }

  /** Tilted ring system around a body at (rcx, rcy) of disk radius rR, lit by rL;
   *  occluded behind the sphere and cut by the planet's shadow. */
  function renderRings(rcx: number, rcy: number, rR: number, rL: Vec3): void {
    const tau = o.ringTilt * DEG; // opening angle from edge-on
    const sinTau = Math.sin(tau);
    const cosTau = Math.cos(tau);
    const yaw = o.ringYaw * DEG;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const inner = o.ringInner * rR;
    const outer = o.ringOuter * rR;
    const span = Math.max(1, outer - inner);
    const gapStart = inner + span * (0.5 - o.ringGap / 2);
    const gapEnd = inner + span * (0.5 + o.ringGap / 2);
    const N = 540;
    const traceRing = (rr: number): void => {
      let run: Point[] = [];
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * TAU;
        const ex = rr * Math.cos(th);
        const ey = rr * Math.sin(th) * sinTau; // foreshortened minor axis
        const ez = rr * Math.sin(th) * cosTau; // depth toward the viewer
        const px = ex * cosYaw - ey * sinYaw;
        const py = ex * sinYaw + ey * cosYaw;
        const sx = rcx + px;
        const sy = rcy + py;
        const rd2 = px * px + py * py;
        let hidden = rd2 < rR * rR && ez < Math.sqrt(rR * rR - rd2);
        if (!hidden && o.ringShadow) {
          const p: Vec3 = { x: px, y: py, z: ez };
          const d = dot(p, rL);
          if (d < 0) {
            const qx = p.x - d * rL.x;
            const qy = p.y - d * rL.y;
            const qz = p.z - d * rL.z;
            if (qx * qx + qy * qy + qz * qz < rR * rR) hidden = true;
          }
        }
        if (hidden) {
          pushRun(lines, run, 'ring');
          run = [];
          continue;
        }
        run.push({ x: sx, y: sy });
      }
      pushRun(lines, run, 'ring');
    };
    const sub = Math.max(1, Math.round(o.ringDensity));
    const subSpacing = Math.max(1.2, o.penWidth * 1.6);
    for (let bandi = 0; bandi < o.ringCount; bandi++) {
      const rrC = inner + (span * (bandi + 0.5)) / o.ringCount;
      if (o.ringGap > 0 && rrC >= gapStart && rrC <= gapEnd) continue; // Cassini gap
      const subN = Math.max(1, Math.round(sub * (1.35 - 0.6 * (bandi / o.ringCount))));
      for (let k = 0; k < subN; k++) {
        const rr = rrC + (k - (subN - 1) / 2) * subSpacing;
        traceRing(rr);
      }
    }
  }

  /** Multi-body plates: a phase strip, a size-comparison row, or an orbital
   *  diagram. Each body is a normal renderBody at a computed centre/radius. */
  function composeLayout(): void {
    const n = Math.max(2, Math.min(12, Math.round(o.layoutCount)));
    const usableW = width - 2 * margin;
    const lrng = makeRandom(seed + 9100);
    const pool: PlanetType[] = ['terrestrial', 'gas-giant', 'ice', 'barren', 'moon', 'lava'];

    if (o.layout === 'phases') {
      // One body, lit from a sweep of directions: full at the centre, thinning
      // to crescents at both ends — the classic phase strip.
      const slotW = usableW / n;
      const br = Math.min(slotW * 0.42, usableR * 0.5);
      for (let i = 0; i < n; i++) {
        const bxp = margin + slotW * (i + 0.5);
        const f = n === 1 ? 0.5 : i / (n - 1);
        const theta = -Math.PI * 0.92 + 1.84 * Math.PI * f;
        const light: Vec3 = { x: Math.sin(theta), y: 0.12, z: Math.cos(theta) };
        renderBody({ cx: bxp, cy, R: br, bodyType: o.planetType, bodySeed: seed, craters: o.craters, light });
        if (o.rings) renderRings(bxp, cy, br, norm(light)); // ring each phase
      }
    } else if (o.layout === 'comparison') {
      // A baseline row of different worlds at decreasing radii.
      const slotW = usableW / n;
      const baseline = cy + usableR * 0.5;
      const maxR = Math.min(slotW * 0.46, usableR * 0.52);
      for (let i = 0; i < n; i++) {
        const frac = n === 1 ? 1 : 1 - 0.62 * (i / (n - 1));
        const br = Math.max(usableR * 0.08, maxR * frac);
        const bxp = margin + slotW * (i + 0.5);
        const bt = pool[i % pool.length];
        renderBody({ cx: bxp, cy: baseline - br, R: br, bodyType: bt, bodySeed: seed + i * 131, craters: bt === 'moon' || bt === 'barren' });
      }
    } else {
      // Orbital diagram: a central star ringed by concentric foreshortened
      // orbits, a small world riding each one. Nearer bodies occlude the ones
      // (and orbit arcs) behind them, and everything behind the star is hidden.
      const tilt = 20 * DEG;
      const sT = Math.sin(tilt);
      const cT = Math.cos(tilt);
      const maxOrb = usableR * 0.95;
      const starR = Math.max(8, usableR * 0.12);
      // Lay out every body first so we know each one's screen disk + depth.
      type Orb = { cx: number; cy: number; R: number; ez: number; orbR: number };
      const star: Orb = { cx, cy, R: starR, ez: 0, orbR: 0 };
      const planets: Orb[] = [];
      for (let k = 0; k < n; k++) {
        const orbR = (maxOrb * (k + 1.5)) / (n + 0.5);
        const a = (k / n) * TAU + (lrng() - 0.5) * 0.9;
        const px = orbR * Math.cos(a);
        const py = orbR * Math.sin(a) * sT;
        const ez = orbR * Math.sin(a) * cT; // depth toward the viewer
        const br = Math.max(usableR * 0.05, usableR * (0.13 - 0.006 * k));
        planets.push({ cx: cx + px, cy: cy + py, R: br, ez, orbR });
      }
      const bodies = [star, ...planets];
      // Orbit ellipses, cut where they pass behind the star or a nearer body.
      for (let k = 0; k < n; k++) {
        const orbR = planets[k].orbR;
        const M = Math.max(64, Math.ceil((TAU * orbR) / 6));
        let run: Point[] = [];
        for (let i = 0; i <= M; i++) {
          const th = (i / M) * TAU;
          const px = orbR * Math.cos(th);
          const py = orbR * Math.sin(th) * sT;
          const ez = orbR * Math.sin(th) * cT;
          const sx = cx + px;
          const sy = cy + py;
          const rd2 = px * px + py * py;
          let hidden = rd2 < starR * starR && ez < Math.sqrt(starR * starR - rd2);
          if (!hidden) {
            for (const pl of planets) {
              if (pl.ez <= ez) continue; // only nearer bodies occlude
              const dx = sx - pl.cx;
              const dy = sy - pl.cy;
              if (dx * dx + dy * dy < pl.R * pl.R) { hidden = true; break; }
            }
          }
          if (hidden) { pushRun(lines, run, 'orbit'); run = []; continue; }
          run.push({ x: sx, y: sy });
        }
        pushRun(lines, run, 'orbit');
      }
      const starOcc = planets.filter((pl) => pl.ez > 0).map((pl) => ({ cx: pl.cx, cy: pl.cy, R: pl.R }));
      renderBody({ cx, cy, R: starR, bodyType: 'star', bodySeed: seed, craters: false, occluders: starOcc });
      for (let k = 0; k < n; k++) {
        const pl = planets[k];
        const bt = pool[k % pool.length];
        // Every body nearer than this one (plus the star) hides its far side.
        const occluders = bodies.filter((o2) => o2 !== pl && o2.ez > pl.ez).map((o2) => ({ cx: o2.cx, cy: o2.cy, R: o2.R }));
        renderBody({ cx: pl.cx, cy: pl.cy, R: pl.R, bodyType: bt, bodySeed: seed + k * 257, craters: bt === 'moon' || bt === 'barren', occluders });
      }
    }
  }

  // --- Scene background: starfield (behind everything).
  if (o.starfield) {
    const sr = makeRandom(seed + 1001);
    const x0 = margin;
    const y0 = margin;
    const w = width - 2 * margin;
    const h = height - 2 * margin;
    const reach = R * 1.06;
    for (let i = 0; i < o.starCount; i++) {
      const sx = x0 + sr() * w;
      const sy = y0 + sr() * h;
      const dx = sx - cx;
      const dy = sy - cy;
      if (dx * dx + dy * dy < reach * reach) continue; // keep the disk clear
      const big = sr();
      if (big > 0.9) {
        // a sparkle cross
        const r = o.penWidth * 1.8;
        lines.push({ points: [{ x: sx - r, y: sy }, { x: sx + r, y: sy }], layer: 'star' });
        lines.push({ points: [{ x: sx, y: sy - r }, { x: sx, y: sy + r }], layer: 'star' });
      } else {
        const r = o.penWidth * (0.45 + big * 0.4);
        lines.push({ points: dot4(sx, sy, r), layer: 'star' });
      }
    }
  }

  // --- Atmosphere / corona around the limb (behind the body strokes).
  if (o.atmosphere > 0 && o.layout === 'single') {
    if (o.planetType === 'star') {
      // Corona: short radial flares of varying length.
      const sr = makeRandom(seed + 1313);
      const flares = Math.round(120 * o.atmosphere);
      for (let i = 0; i < flares; i++) {
        const t = (i / flares) * TAU + (sr() - 0.5) * 0.05;
        const len = R * (0.04 + sr() * 0.12 * o.atmosphere);
        const c = Math.cos(t);
        const s = Math.sin(t);
        lines.push({
          points: [
            { x: cx + c * R, y: cy + s * R },
            { x: cx + c * (R + len), y: cy + s * (R + len) },
          ],
          layer: 'atmosphere',
        });
      }
    } else {
      const rings = Math.max(1, Math.round(o.atmosphere));
      for (let i = 0; i < rings; i++) {
        const rr = R * (1.02 + i * 0.035);
        lines.push({ points: dot4(cx, cy, rr), layer: 'atmosphere' });
      }
    }
  }

  if (o.layout !== 'single') {
    composeLayout();
  } else {
  // --- The primary planet.
  renderBody({
    cx,
    cy,
    R,
    bodyType: o.planetType,
    bodySeed: seed,
    craters: o.craters,
  });

  // --- Rings (Saturn): a flat disc of bands tilted toward edge-on, occluded
  //  where it passes behind the sphere. `renderRings` is defined at scene scope
  //  (below) so phase strips can ring each body too.
  if (o.rings) renderRings(cx, cy, R, L);

  // --- Companion moon.
  if (o.moon) {
    const ma = o.moonAngle * DEG;
    const mx = cx + Math.cos(ma) * o.moonDist * R;
    const my = cy + Math.sin(ma) * o.moonDist * R;
    renderBody({
      cx: mx,
      cy: my,
      R: Math.max(6, o.moonRadiusFrac * R),
      bodyType: 'moon',
      bodySeed: seed + 4242,
      craters: true,
      occluders: [{ cx, cy, R }],
    });
  }
  }

  // --- Graduated neatline just inside the margin: an outer rule, an inner
  // rule, and graduation ticks between them — the frame of an engraved plate.
  if (o.plateFrame) {
    const x0 = margin;
    const y0 = margin;
    const x1 = width - margin;
    const y1 = height - margin;
    const inset = Math.max(3, margin * 0.18);
    const rect = (a: number, b: number, c: number, d: number): void => {
      lines.push({ points: [{ x: a, y: b }, { x: c, y: b }, { x: c, y: d }, { x: a, y: d }, { x: a, y: b }], layer: 'annotation' });
    };
    rect(x0, y0, x1, y1);
    rect(x0 + inset, y0 + inset, x1 - inset, y1 - inset);
    const divX = Math.max(8, Math.round((x1 - x0) / Math.max(20, (x1 - x0) / 24)));
    for (let i = 0; i <= divX; i++) {
      const fx = x0 + ((x1 - x0) * i) / divX;
      lines.push({ points: [{ x: fx, y: y0 }, { x: fx, y: y0 + inset }], layer: 'annotation' });
      lines.push({ points: [{ x: fx, y: y1 }, { x: fx, y: y1 - inset }], layer: 'annotation' });
    }
    const divY = Math.max(6, Math.round((divX * (y1 - y0)) / (x1 - x0)));
    for (let i = 0; i <= divY; i++) {
      const fy = y0 + ((y1 - y0) * i) / divY;
      lines.push({ points: [{ x: x0, y: fy }, { x: x0 + inset, y: fy }], layer: 'annotation' });
      lines.push({ points: [{ x: x1, y: fy }, { x: x1 - inset, y: fy }], layer: 'annotation' });
    }
  }

  // --- Scale bar: a divided rule near the bottom of the plate.
  if (o.scaleBar) {
    const usableW = width - 2 * margin;
    const len = usableW * 0.28;
    const bx0 = cx - len / 2;
    const by0 = height - margin - Math.max(16, margin * 0.6);
    const h = Math.max(5, usableW * 0.012);
    const segs = 5;
    lines.push({ points: [{ x: bx0, y: by0 }, { x: bx0 + len, y: by0 }], layer: 'annotation' });
    lines.push({ points: [{ x: bx0, y: by0 - h }, { x: bx0 + len, y: by0 - h }], layer: 'annotation' });
    for (let i = 0; i <= segs; i++) {
      const sx = bx0 + (len * i) / segs;
      lines.push({ points: [{ x: sx, y: by0 - h }, { x: sx, y: by0 }], layer: 'annotation' });
    }
  }

  // --- Engraved title / caption (single-stroke, plottable).
  const usableW = width - 2 * margin;
  if (o.title) {
    const size = Math.max(11, usableW * 0.05);
    const tx = cx - textWidth(o.title, size) / 2;
    const ty = margin + (o.plateFrame ? margin * 0.5 : size * 0.4);
    for (const stroke of textToStrokes(o.title, tx, ty, size)) lines.push({ points: stroke, layer: 'label' });
  }
  if (o.caption) {
    const size = Math.max(9, usableW * 0.032);
    const cxs = cx - textWidth(o.caption, size) / 2;
    const cyy = height - margin - size - (o.scaleBar ? Math.max(16, margin * 0.6) + size * 1.4 : o.plateFrame ? margin * 0.5 : 0);
    for (const stroke of textToStrokes(o.caption, cxs, cyy, size)) lines.push({ points: stroke, layer: 'label' });
  }

  // --- Hand-drawn finish: a multi-pass sketch overdraw (shared with the Vine
  // Generator) when `sketch` is set, otherwise a single low-frequency wobble.
  let finished: FlowLine[];
  if (o.sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(o.sketchStyle, o.sketch);
    const acc: FlowLine[] = [];
    for (let p = 0; p < passes; p++) {
      const pseed = subSeed(seed, p);
      const styled = applyHandDrawnStyle({ lines, width, height, seed: pseed }, { amplitude, wavelength, jitter, seed: pseed }).lines;
      for (const l of styled) acc.push(l);
    }
    finished = acc;
  } else {
    finished = applyHandDrawnStyle({ lines, width, height, seed }, { amplitude: o.wobble, wavelength: 42, seed }).lines;
  }

  // --- Scale the planetary body to fit inside the page margin. Plate furniture
  // (frame, scale bar, labels, background starfield) is already margin-bound and
  // stays pinned; only the body (disk, rings, moon, orbits, …) is fitted, so a
  // ringed planet shrinks to fit rather than spilling past the margin.
  finished = fitBodyToMargin(finished);

  return { lines: finished, width, height };

  /** Uniformly scale the non-furniture lines about the page centre so their
   *  bounding box fits within the margin box. */
  function fitBodyToMargin(all: FlowLine[]): FlowLine[] {
    const isFurniture = (layer?: string): boolean =>
      layer === 'annotation' || layer === 'label' || layer === 'star';
    const halfW = width / 2 - margin;
    const halfH = height / 2 - margin;
    if (halfW <= 0 || halfH <= 0) return all;
    let maxDx = 0;
    let maxDy = 0;
    for (const ln of all) {
      if (isFurniture(ln.layer)) continue;
      for (const p of ln.points) {
        const ax = Math.abs(p.x - cx);
        const ay = Math.abs(p.y - cy);
        if (ax > maxDx) maxDx = ax;
        if (ay > maxDy) maxDy = ay;
      }
    }
    const scale = Math.min(1, maxDx > 0 ? halfW / maxDx : 1, maxDy > 0 ? halfH / maxDy : 1);
    if (scale >= 0.999) return all;
    return all.map((ln) =>
      isFurniture(ln.layer)
        ? ln
        : { ...ln, points: ln.points.map((p) => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale })) }
    );
  }
}
