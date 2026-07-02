import { FlowLine } from '../flow-lines.js';
import { createNoise, SimplexNoise } from '../noise.js';
import { makeRandom } from '../lib/rng.js';
import { clamp01 } from '../lib/math.js';
import { type Vec3, TAU, DEG, dot, cross, norm, makeRotation } from './vec3.js';
import { DEFAULTS, type BodyParams } from './body.js';

/** Vertical squash factor for a body type: only fast-spinning gas bodies
 *  flatten, and only when the option is set (1 elsewhere, so the spherical
 *  arithmetic is untouched). */
export function bodyKy(bodyType: BodyParams['bodyType'], oblateness: number): number {
  return (bodyType === 'gas-giant' || bodyType === 'ringed') && oblateness > 0
    ? 1 - Math.min(0.4, oblateness)
    : 1;
}

/** Options with every default applied (frame + seed stay caller-provided). */
export type ResolvedOptions = typeof DEFAULTS & {
  width: number;
  height: number;
  margin: number;
  seed?: number;
};

/** Everything shared by the whole plate: resolved options, page frame, the
 *  scene light and spin frames, and the one output line list. */
export interface SceneCtx {
  o: ResolvedOptions;
  seed: number;
  width: number;
  height: number;
  margin: number;
  cx: number;
  cy: number;
  usableR: number;
  R: number;
  /** Scene light direction + an orthonormal frame around it. */
  L: Vec3;
  U: Vec3;
  V: Vec3;
  /** Spin axis (vertical in screen space) + its frame — belts and graticule. */
  SPIN: Vec3;
  US: Vec3;
  VS: Vec3;
  lines: FlowLine[];
}

/** Per-body state: screen placement, this body's light frame, its noise
 *  fields, and the sampling/tone closures every renderer shares. */
export interface BodyCtx {
  scene: SceneCtx;
  b: BodyParams;
  bx: number;
  by: number;
  br: number;
  /** Vertical squash for oblate bodies (1 = spherical). Screen projection is
   *  (bx + br·N.x, by + bry·N.y); inversion divides dy by ky. Both reduce to
   *  the exact spherical arithmetic when ky === 1. */
  ky: number;
  bry: number;
  /** Per-body light + its form-following hatch frame. */
  bL: Vec3;
  bA: Vec3;
  bU: Vec3;
  bV: Vec3;
  rot: (v: Vec3) => Vec3;
  nCap: SimplexNoise;
  scale: number;
  capLatRad: number;
  storms: { dir: Vec3; rad: number; dark: number }[];
  occluded: (sx: number, sy: number) => boolean;
  surface: (N: Vec3) => { n: number; lat: number; band: number };
  isCap: (N: Vec3, lat: number) => boolean;
  stormDark: (N: Vec3) => number;
  albedoDarkness: (N: Vec3, f: { n: number; lat: number; band: number }) => number;
  darknessAt: (N: Vec3) => number;
  toneAt: (N: Vec3) => number;
  hatchMask: (N: Vec3) => boolean;
  /** Signed clearance (px) from the eclipse shadow cylinder: negative inside
   *  the umbra, 0 at its edge. Only present when a shadow caster applies. */
  eclipseField?: (N: Vec3) => number;
}

export function makeSceneCtx(o: ResolvedOptions, seed: number): SceneCtx {
  const { width, height, margin } = o;
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

  return { o, seed, width, height, margin, cx, cy, usableR, R, L, U, V, SPIN, US, VS, lines: [] };
}

export function makeBodyCtx(scene: SceneCtx, b: BodyParams): BodyCtx {
  const { o, L, SPIN, US, VS } = scene;
  const { cx: bx, cy: by, R: br, bodyType, bodySeed } = b;
  // Per-body light + its form-following hatch frame (defaults to the scene
  // light; phase strips override it so each disk shows a different phase).
  const bL = b.light ? norm(b.light) : L;
  const bA = bL;
  let bU = cross(bA, { x: 0, y: 0, z: 1 });
  if (bU.x * bU.x + bU.y * bU.y + bU.z * bU.z < 1e-6) bU = cross(bA, { x: 0, y: 1, z: 0 });
  bU = norm(bU);
  const bV = cross(bA, bU);
  const ky = bodyKy(bodyType, o.oblateness);
  const bry = br * ky;
  // Per-body noise/RNG streams, each on its own seed offset so features can be
  // toggled without shifting unrelated geometry. Offsets in use elsewhere:
  // +202 (reserved), +505 storms, +606 clouds, +707 stipple, +808/+909 craters,
  // +1212 mountains, +1414/+1515 aurora, +1717/+1818/+2525 rivers,
  // +1919/+2626 rilles; scene-level: +1001 starfield, +1313 corona,
  // +1616 haze atmosphere, +4242 moon, +9100 layouts.
  const nSurf = createNoise(bodySeed);
  const nBand = createNoise(bodySeed + 101);
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
      const dy = occ.ky ? (sy - occ.cy) / occ.ky : sy - occ.cy;
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

  const baseTone = (N: Vec3): number => {
    const f = surface(N);
    const dk = darknessAt(N);
    const al = albedoDarkness(N, f);
    return clamp01(dk * o.lightWeight + al * o.albedoWeight);
  };

  // --- Eclipse: a caster disk (the moon, in this body's z=0 plane) throws a
  // cylindrical shadow along the light direction. A surface point P is in the
  // umbra when the ray from P toward the light passes within the caster's
  // radius. Fully gated behind the option so tone is bit-identical when off.
  const casters = o.eclipse && b.shadowCasters && b.shadowCasters.length > 0 ? b.shadowCasters : undefined;
  let eclipseField: ((N: Vec3) => number) | undefined;
  let toneAt = baseTone;
  if (casters) {
    eclipseField = (N: Vec3): number => {
      let g = 1000;
      for (const c of casters) {
        const wx = br * N.x - (c.cx - bx);
        const wy = bry * N.y - (c.cy - by);
        const wz = br * N.z - c.z;
        const t = wx * bL.x + wy * bL.y + wz * bL.z;
        if (t >= 0) continue; // caster is behind the light path from here
        const qx = wx - t * bL.x;
        const qy = wy - t * bL.y;
        const qz = wz - t * bL.z;
        const q = Math.sqrt(qx * qx + qy * qy + qz * qz);
        if (q - c.R < g) g = q - c.R;
      }
      return g;
    };
    const soft = Math.max(0.02, o.eclipseSoftness);
    const eclipseDark = (N: Vec3): number => {
      let dk = 0;
      for (const c of casters) {
        const wx = br * N.x - (c.cx - bx);
        const wy = bry * N.y - (c.cy - by);
        const wz = br * N.z - c.z;
        const t = wx * bL.x + wy * bL.y + wz * bL.z;
        if (t >= 0) continue;
        const qx = wx - t * bL.x;
        const qy = wy - t * bL.y;
        const qz = wz - t * bL.z;
        const q = Math.sqrt(qx * qx + qy * qy + qz * qz);
        const edge = c.R * (1 + soft);
        if (q >= edge) continue;
        let s = q <= c.R ? 1 : (edge - q) / (edge - c.R);
        s = s * s * (3 - 2 * s); // smooth penumbra ramp
        if (0.9 * s > dk) dk = 0.9 * s;
      }
      return dk;
    };
    toneAt = (N: Vec3): number => clamp01(baseTone(N) + eclipseDark(N));
  }

  // Aurora holds the hatch off in a band around the polar oval — the glow is
  // reserved paper, the way engravers carve light out of tone; the dashes and
  // curtain rays are then inked over the clean band (features.ts shares the
  // same noise stream so the band tracks the drawn ovals).
  let auroraHold: ((N: Vec3) => boolean) | undefined;
  if (o.aurora && bodyType !== 'star') {
    const nAur = createNoise(bodySeed + 1515);
    const theta0 = (90 - o.auroraLatitude) * DEG;
    auroraHold = (N: Vec3): boolean => {
      const u = dot(N, US);
      const v = dot(N, VS);
      const lon = Math.atan2(v, u);
      const cl = Math.cos(lon);
      const sl = Math.sin(lon);
      const ny = dot(N, SPIN);
      for (const pole of [1, -1]) {
        const colat = Math.acos(Math.max(-1, Math.min(1, pole * ny)));
        if (colat > theta0 * 1.6 + 0.35) continue; // fast reject away from the pole
        const wob = nAur.fbm3D(cl * 1.6, pole * 0.7, sl * 1.6, 2, 0.5, 2, 1);
        const th = theta0 * (1 + 0.22 * wob);
        if (colat > th - 3 * DEG && colat < th + 9 * DEG) return true;
      }
      return false;
    };
  }

  // Where we keep clean paper rather than lay line hatch.
  const hatchMask = (N: Vec3): boolean => {
    if (bodyType === 'star') return false; // granulation is stipple, not line
    if (auroraHold && auroraHold(N)) return false; // auroral glow stays open
    const f = surface(N);
    if (isCap(N, f.lat)) return false;
    if (bodyType === 'lava') {
      if (Math.abs(f.n) < o.lavaFissureWidth) return false; // glowing crack stays open
    }
    return true;
  };

  return {
    scene,
    b,
    bx,
    by,
    br,
    ky,
    bry,
    bL,
    bA,
    bU,
    bV,
    rot,
    nCap,
    scale,
    capLatRad,
    storms,
    occluded,
    surface,
    isCap,
    stormDark,
    albedoDarkness,
    darknessAt,
    toneAt,
    hatchMask,
    ...(eclipseField ? { eclipseField } : {}),
  };
}
