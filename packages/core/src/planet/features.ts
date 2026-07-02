import { Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { traceIsoContours } from '../iso-contours.js';
import { GrayscaleImage } from '../image.js';
import { makeRandom } from '../lib/rng.js';
import { clamp01 } from '../lib/math.js';
import { type Vec3, TAU, DEG, cross, norm, makeRotation } from './vec3.js';
import { smoothPolyline, offsetPolyline } from '../lib/polyline.js';
import { pushRun, dot4, ellipse } from './geometry.js';
import type { BodyCtx } from './context.js';

/** Tangent-plane gradient of the surface field at N (finite differences). */
function surfaceGradient(ctx: BodyCtx, N: Vec3): Vec3 {
  const eps = 0.02;
  let T1 = cross(N, { x: 0, y: 0, z: 1 });
  if (T1.x * T1.x + T1.y * T1.y + T1.z * T1.z < 1e-6) T1 = cross(N, { x: 0, y: 1, z: 0 });
  T1 = norm(T1);
  const T2 = cross(N, T1);
  const at = (T: Vec3, s: number): number =>
    ctx.surface(norm({ x: N.x + T.x * s, y: N.y + T.y * s, z: N.z + T.z * s })).n;
  const g1 = at(T1, eps) - at(T1, -eps);
  const g2 = at(T2, eps) - at(T2, -eps);
  return {
    x: T1.x * g1 + T2.x * g2,
    y: T1.y * g1 + T2.y * g2,
    z: T1.z * g1 + T2.z * g2,
  };
}

/** Rotate tangent vector D around the normal N by angle a. */
function rotateAround(N: Vec3, D: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const K = cross(N, D);
  return { x: D.x * c + K.x * s, y: D.y * c + K.y * s, z: D.z * c + K.z * s };
}

/** Traced feature contours from a screen-space raster of the field. */
export function traceField(
  ctx: BodyCtx,
  fieldFn: (N: Vec3) => number,
  iso: number,
  pen?: 'fine' | 'bold',
  layer = 'feature'
): void {
  const { bx, by, br, ky, occluded } = ctx;
  const { lines } = ctx.scene;
  const grid = Math.max(48, Math.min(220, Math.round(br * 1.5)));
  const data = new Float32Array(grid * grid);
  const step = (2 * br) / (grid - 1);
  const SENT = iso - 1000;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const sx = bx - br + gx * step;
      const sy = by - br + gy * step;
      const dx = sx - bx;
      const dy = (sy - by) / ky;
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
      const dy = (sy - by) / ky;
      if (dx * dx + dy * dy > lim2 || occluded(sx, sy)) {
        pushRun(lines, run, layer, pen);
        run = [];
        continue;
      }
      run.push({ x: sx, y: sy });
    }
    pushRun(lines, run, layer, pen);
  }
}

/** Coastlines / mare / band edges / fissures, plus the ice-cap edge. */
export function renderContours(ctx: BodyCtx): void {
  const { b, surface, rot, nCap, capLatRad } = ctx;
  const { o } = ctx.scene;
  const bodyType = b.bodyType;
  if (o.coastlines) {
    if (bodyType === 'terrestrial') traceField(ctx, (N) => surface(N).n, o.seaLevel);
    else if (bodyType === 'moon' || bodyType === 'barren') traceField(ctx, (N) => surface(N).n, o.mareLevel);
    else if (bodyType === 'gas-giant' || bodyType === 'ringed') traceField(ctx, (N) => surface(N).band, 0);
    else if (bodyType === 'lava') traceField(ctx, (N) => Math.abs(surface(N).n), o.lavaFissureWidth);
  }
  if (o.iceCaps) {
    traceField(ctx, (N) => {
      const f = surface(N);
      const r = rot(N);
      const ragged = o.capRaggedness * 0.4 * nCap.fbm3D(r.x * 2.4, r.y * 2.4, r.z * 2.4, 2, 0.5, 2, 1);
      return Math.abs(f.lat) - (capLatRad - ragged);
    }, 0);
  }
}

/** Eclipse: the hard edge of the caster's shadow, traced across the disk and
 *  inked bold — the engraved umbra boundary. The tonal darkening itself lives
 *  in the tone model (context.ts); this draws only the committed edge. */
export function renderEclipseOutline(ctx: BodyCtx): void {
  if (!ctx.eclipseField) return;
  traceField(ctx, ctx.eclipseField, 0, 'bold');
}

/** Aurora: dashed, noise-wobbled ovals around the spin poles with short
 *  curtain rays hanging toward the equator — the classic engraved corona
 *  borealis. Ungated by tone (an aurora glows on the night side). */
export function renderAurora(ctx: BodyCtx): void {
  const { b, bx, by, br, bry, occluded } = ctx;
  const { o, SPIN, US, VS, lines } = ctx.scene;
  if (!o.aurora || b.bodyType === 'star') return;
  const nAur = createNoise(b.bodySeed + 1515);
  const ar = makeRandom(b.bodySeed + 1414);
  const inten = clamp01(o.auroraIntensity);
  const breakProb = 0.26 * (1.15 - inten);
  const theta0 = (90 - o.auroraLatitude) * DEG; // colatitude of the oval
  const pointAt = (pole: number, lon: number, th: number): Vec3 => {
    const cl = Math.cos(lon);
    const sl = Math.sin(lon);
    const sT = Math.sin(th);
    const cT = Math.cos(th) * pole;
    return {
      x: SPIN.x * cT + (US.x * cl + VS.x * sl) * sT,
      y: SPIN.y * cT + (US.y * cl + VS.y * sl) * sT,
      z: SPIN.z * cT + (US.z * cl + VS.z * sl) * sT,
    };
  };
  const wobAt = (pole: number, lon: number, k: number): number =>
    nAur.fbm3D(Math.cos(lon) * 1.6, pole * 0.7 + k * 0.31, Math.sin(lon) * 1.6, 2, 0.5, 2, 1);
  for (const pole of [1, -1]) {
    // 2-3 nested ovals, colatitude modulated by low-frequency noise.
    const ovals = inten > 0.75 ? 3 : 2;
    for (let k = 0; k < ovals; k++) {
      const thBase = theta0 + k * 3 * DEG;
      const ns = Math.max(48, Math.ceil((TAU * br * Math.sin(thBase)) / Math.max(2, o.hatchSpacing * 0.6)));
      let run: Point[] = [];
      for (let s = 0; s <= ns; s++) {
        const lon = (s / ns) * TAU;
        const th = thBase * (1 + 0.22 * wobAt(pole, lon, k));
        const N = pointAt(pole, lon, th);
        const sx = bx + br * N.x;
        const sy = by + bry * N.y;
        const visible = N.z > 0.03 && !occluded(sx, sy);
        if (!visible || ar() < breakProb) {
          pushRun(lines, run, 'aurora');
          run = [];
          continue;
        }
        run.push({ x: sx, y: sy });
      }
      pushRun(lines, run, 'aurora');
    }
    // Curtain rays: short strokes along the local meridian, falling away from
    // the pole off the outer oval.
    const rays = Math.round(44 * inten);
    for (let i = 0; i < rays; i++) {
      const lon = ar() * TAU;
      const th0 = theta0 * (1 + 0.22 * wobAt(pole, lon, 0)) + ar() * 2 * DEG;
      const len = (2.2 + ar() * 3.2) * Math.max(3, o.hatchSpacing);
      const dth = len / br;
      const steps = 3;
      const pts: Point[] = [];
      let ok = true;
      for (let q = 0; q <= steps; q++) {
        const N = pointAt(pole, lon, th0 + (q / steps) * dth);
        const sx = bx + br * N.x;
        const sy = by + bry * N.y;
        if (N.z <= 0.03 || occluded(sx, sy)) {
          ok = false;
          break;
        }
        pts.push({ x: sx, y: sy });
      }
      if (ok) pushRun(lines, pts, 'aurora');
    }
  }
}

/** Rivers: descend the surface field from high-ground springs to the sea,
 *  with a gentle noise meander — drainage the coastline tracer implies but
 *  never draws. The lower reach gets a second offset pass so the mouth reads
 *  bolder, single-pen taper by repetition. Terrestrial only. */
export function renderRivers(ctx: BodyCtx): void {
  const { b, bx, by, br, bry, occluded, surface } = ctx;
  const { o, lines } = ctx.scene;
  if (!(o.rivers > 0 && b.bodyType === 'terrestrial')) return;
  const rr = makeRandom(b.bodySeed + 1717);
  const rrot = makeRotation(makeRandom(b.bodySeed + 1818));
  const nMeander = createNoise(b.bodySeed + 2525);
  const golden = Math.PI * (3 - Math.sqrt(5));
  // Springs: Fibonacci-sphere candidates on front-facing ground, highest
  // first — the highest springs run the longest rivers.
  const cands: { d: Vec3; n: number }[] = [];
  const CAND = 220;
  for (let i = 0; i < CAND; i++) {
    const yy = 1 - ((i + 0.5) / CAND) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
    const th = i * golden + rr() * 0.4;
    const d = rrot({ x: Math.cos(th) * rad, y: yy, z: Math.sin(th) * rad });
    if (d.z <= 0.15) continue;
    const n = surface(d).n;
    if (n <= o.seaLevel + 0.22) continue;
    cands.push({ d, n });
  }
  cands.sort((a, b) => b.n - a.n);
  // Highest first, but no two springs on the same peak.
  const springs: Vec3[] = [];
  for (const c of cands) {
    if (springs.length >= Math.round(o.rivers)) break;
    if (springs.some((s) => s.x * c.d.x + s.y * c.d.y + s.z * c.d.z > Math.cos(0.25))) continue;
    springs.push(c.d);
  }
  const stepAng = Math.max(0.008, o.hatchSpacing / (2.5 * br));
  for (const spring of springs) {
    let N = spring;
    const pts = [{ x: bx + br * N.x, y: by + bry * N.y }];
    // Flow with momentum: pure gradient descent zigzags across the valley
    // floor and stalls; carrying the previous direction runs the river down
    // the valley the way real drainage does.
    let prev: Vec3 | null = null;
    let lastN = surface(N).n;
    let sinceDrop = 0;
    for (let step = 0; step < 400; step++) {
      const G = surfaceGradient(ctx, N);
      const gl = Math.hypot(G.x, G.y, G.z);
      let D: Vec3;
      if (gl > 1e-5) {
        D = { x: -G.x / gl, y: -G.y / gl, z: -G.z / gl };
      } else if (prev) {
        D = prev;
      } else {
        D = norm(cross(N, { x: 0.3, y: 0.9, z: 0.1 }));
      }
      if (prev) {
        D = { x: prev.x * 0.65 + D.x * 0.35, y: prev.y * 0.65 + D.y * 0.35, z: prev.z * 0.65 + D.z * 0.35 };
      }
      // Re-tangentialize after the blend, then a gentle noise meander.
      const dn = D.x * N.x + D.y * N.y + D.z * N.z;
      D = norm({ x: D.x - N.x * dn, y: D.y - N.y * dn, z: D.z - N.z * dn });
      const rn = ctx.rot(N);
      const meander = nMeander.fbm3D(rn.x * 2.2, rn.y * 2.2, rn.z * 2.2, 2, 0.5, 2, 1);
      D = rotateAround(N, D, meander * 0.5);
      prev = D;
      N = norm({ x: N.x + D.x * stepAng, y: N.y + D.y * stepAng, z: N.z + D.z * stepAng });
      const sx = bx + br * N.x;
      const sy = by + bry * N.y;
      if (N.z <= 0.03 || occluded(sx, sy)) break;
      pts.push({ x: sx, y: sy });
      const f = surface(N);
      if (f.n < o.seaLevel) break; // reached the sea
      if (f.n < lastN - 0.004) {
        lastN = f.n;
        sinceDrop = 0;
      } else if (++sinceDrop > 120) {
        break; // stuck in a basin — end the river there
      }
    }
    if (pts.length < 10) continue;
    const smooth = smoothPolyline(pts, 2);
    pushRun(lines, smooth, 'feature');
    if (smooth.length >= 30) {
      const tail = smooth.slice(-Math.floor(smooth.length / 3));
      pushRun(lines, offsetPolyline(tail, o.penWidth * 0.9), 'feature');
    }
  }
}

/** Rilles: sinuous collapsed channels on moons and barren worlds. The walk
 *  follows the iso-direction of the mare field (perpendicular to its
 *  gradient — rilles hug basin edges) with a noise heading wobble; inked as a
 *  double line (near wall + offset far wall) with collapse ticks at the ends. */
export function renderRilles(ctx: BodyCtx): void {
  const { b, bx, by, br, bry, occluded, surface } = ctx;
  const { o, lines } = ctx.scene;
  if (!(o.rilles > 0 && (b.bodyType === 'moon' || b.bodyType === 'barren'))) return;
  const rr = makeRandom(b.bodySeed + 1919);
  const nHead = createNoise(b.bodySeed + 2626);
  const stepAng = Math.max(0.008, o.hatchSpacing / (2.5 * br));
  for (let i = 0; i < Math.round(o.rilles); i++) {
    // A deterministic scatter of front-facing starts.
    let N: Vec3 | null = null;
    for (let tries = 0; tries < 8; tries++) {
      const yy = (rr() - 0.5) * 1.7;
      const lon = rr() * TAU;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const cand = { x: Math.cos(lon) * rad, y: yy, z: Math.sin(lon) * rad };
      if (cand.z > 0.25) {
        N = cand;
        break;
      }
    }
    if (!N) continue;
    const sign = rr() < 0.5 ? 1 : -1;
    const steps = 60 + Math.floor(rr() * 90);
    const pts = [{ x: bx + br * N.x, y: by + bry * N.y }];
    for (let step = 0; step < steps; step++) {
      const G = surfaceGradient(ctx, N);
      const gl = Math.hypot(G.x, G.y, G.z);
      let D: Vec3;
      if (gl > 1e-5) {
        D = norm(cross(N, { x: G.x / gl, y: G.y / gl, z: G.z / gl }));
        D = { x: D.x * sign, y: D.y * sign, z: D.z * sign };
      } else {
        D = norm(cross(N, { x: 0.2, y: 1, z: 0.3 }));
      }
      const rn = ctx.rot(N);
      const wob = nHead.fbm3D(rn.x * 1.8, rn.y * 1.8, rn.z * 1.8, 2, 0.5, 2, 1);
      D = rotateAround(N, D, wob * 0.7);
      N = norm({ x: N.x + D.x * stepAng, y: N.y + D.y * stepAng, z: N.z + D.z * stepAng });
      const sx = bx + br * N.x;
      const sy = by + bry * N.y;
      if (N.z <= 0.03 || occluded(sx, sy)) break;
      pts.push({ x: sx, y: sy });
    }
    if (pts.length < 8) continue;
    const center = smoothPolyline(pts, 1);
    const wall = offsetPolyline(center, o.penWidth * 1.4);
    pushRun(lines, center, 'feature');
    pushRun(lines, wall, 'feature');
    // Collapse ticks: short cross-strokes near both ends of the trench.
    for (const idx of [1, 3, 5, center.length - 2, center.length - 4, center.length - 6]) {
      if (idx < 1 || idx >= center.length - 1) continue;
      const a = center[idx - 1];
      const c = center[idx + 1];
      const tx = c.x - a.x;
      const ty = c.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      const px = -ty / tl;
      const py = tx / tl;
      const t = o.penWidth * 1.6;
      lines.push({
        points: [
          { x: center[idx].x - px * t * 0.4, y: center[idx].y - py * t * 0.4 },
          { x: center[idx].x + px * t * 1.4, y: center[idx].y + py * t * 1.4 },
        ],
        layer: 'feature',
      });
    }
  }
}

/** Clouds: soft blobs from a low-frequency field, traced as light outlines
 *  over terrestrial worlds (the edge detector misses them). */
export function renderClouds(ctx: BodyCtx): void {
  const { b, rot, scale } = ctx;
  const { o } = ctx.scene;
  if (!(o.clouds && b.bodyType === 'terrestrial')) return;
  const nCloud = createNoise(b.bodySeed + 606);
  traceField(ctx, (N) => {
    const r = rot(N);
    return nCloud.fbm3D(r.x * scale * 0.7, r.y * scale * 0.7, r.z * scale * 0.7, 3, 0.55, 2, 1);
  }, 0.32, undefined, 'cloud');
}

/** Storms (gas giants): an oval cell with a couple of internal swirl rings —
 *  a drawn Great Red Spot, not just a darker patch. */
export function renderStorms(ctx: BodyCtx): void {
  const { bx, by, br, bry, storms, occluded } = ctx;
  const { o, lines } = ctx.scene;
  for (const s of storms) {
    if (s.dir.z <= 0.12) continue; // front-facing only
    const scx = bx + br * s.dir.x;
    const scy = by + bry * s.dir.y;
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
}

/** Craters: foreshortened rim ellipses + a shaded inner cup. */
export function renderCraters(ctx: BodyCtx): void {
  const { b, bx, by, br, bry, bL, occluded } = ctx;
  const { o, lines } = ctx.scene;
  if (!b.craters) return;
  const cr = makeRandom(b.bodySeed + 808);
  const crot = makeRotation(makeRandom(b.bodySeed + 909));
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
    const ccy = by + bry * d.y;
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

/** Mountain hachures: short chevrons on the highest terrestrial land, apex
 *  toward the light, so ranges read as relief. */
export function renderMountains(ctx: BodyCtx): void {
  const { b, bx, by, br, ky, bL, surface, occluded } = ctx;
  const { o, lines } = ctx.scene;
  if (!(o.mountains && b.bodyType === 'terrestrial')) return;
  const mr = makeRandom(b.bodySeed + 1212);
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
      const dy = (jy - by) / ky;
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

/** Graticule: latitude/longitude lines on the globe, front hemisphere only,
 *  stopping a sliver short of the limb. Built in the spin-axis frame (US/VS),
 *  the same great-circle math as the hatch but ungated by tone. */
export function renderGraticule(ctx: BodyCtx): void {
  const { bx, by, br, bry, occluded } = ctx;
  const { o, SPIN, US, VS, lines } = ctx.scene;
  if (!o.graticule) return;
  const gstep = Math.max(5, o.graticuleSpacingDeg) * DEG;
  const res = Math.max(2, o.hatchSpacing * 0.8);
  const emit = (N: Vec3, run: Point[]): boolean => {
    if (N.z <= 0.03) return false; // hold off the limb
    const sx = bx + br * N.x;
    const sy = by + bry * N.y;
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
