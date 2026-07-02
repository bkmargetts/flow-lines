import { Point } from '../flow-lines.js';
import { makeRandom } from '../lib/rng.js';
import { type Vec3, TAU, DEG, norm } from './vec3.js';
import { pushRun } from './geometry.js';
import type { PlanetType } from './types.js';
import { bodyKy, type SceneCtx } from './context.js';
import { renderBody } from './render-body.js';
import { renderRings } from './rings.js';
import { renderOrbitLabels } from './labels.js';

/** Multi-body plates: a phase strip, a size-comparison row, or an orbital
 *  diagram. Each body is a normal renderBody at a computed centre/radius. */
export function composeLayout(scene: SceneCtx): void {
  const { o, seed, width, margin, cx, cy, usableR, lines } = scene;
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
      renderBody(scene, { cx: bxp, cy, R: br, bodyType: o.planetType, bodySeed: seed, craters: o.craters, light });
      if (o.rings) renderRings(scene, bxp, cy, br, norm(light), bodyKy(o.planetType, o.oblateness)); // ring each phase
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
      renderBody(scene, { cx: bxp, cy: baseline - br, R: br, bodyType: bt, bodySeed: seed + i * 131, craters: bt === 'moon' || bt === 'barren' });
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
    // Asteroid belt: tangent-oriented dashes filling the gap between the two
    // middle orbits, hidden behind the star and nearer bodies like orbit arcs.
    if (o.asteroidBelt && n >= 2) {
      const ar = makeRandom(seed + 2424);
      const k0 = Math.max(0, Math.floor(n / 2) - 1);
      const r1 = planets[k0].orbR;
      const r2 = planets[Math.min(n - 1, k0 + 1)].orbR;
      for (let i = 0; i < 300; i++) {
        const th = ar() * TAU;
        const rad = r1 + (r2 - r1) * (0.3 + ar() * 0.4);
        const px = rad * Math.cos(th);
        const py = rad * Math.sin(th) * sT;
        const ez = rad * Math.sin(th) * cT;
        const sx = cx + px;
        const sy = cy + py;
        const rd2 = px * px + py * py;
        if (rd2 < starR * starR && ez < Math.sqrt(starR * starR - rd2)) continue;
        let hidden = false;
        for (const pl of planets) {
          if (pl.ez <= ez) continue;
          const dx = sx - pl.cx;
          const dy = sy - pl.cy;
          if (dx * dx + dy * dy < pl.R * pl.R) {
            hidden = true;
            break;
          }
        }
        if (hidden) continue;
        const tx = -Math.sin(th);
        const ty = Math.cos(th) * sT;
        const tl = Math.hypot(tx, ty) || 1;
        const dl = 1.2 + ar() * 2.4;
        lines.push({
          points: [
            { x: sx - (tx / tl) * dl, y: sy - (ty / tl) * dl },
            { x: sx + (tx / tl) * dl, y: sy + (ty / tl) * dl },
          ],
          layer: 'orbit',
        });
      }
    }
    const starOcc = planets.filter((pl) => pl.ez > 0).map((pl) => ({ cx: pl.cx, cy: pl.cy, R: pl.R }));
    renderBody(scene, { cx, cy, R: starR, bodyType: 'star', bodySeed: seed, craters: false, occluders: starOcc });
    for (let k = 0; k < n; k++) {
      const pl = planets[k];
      const bt = pool[k % pool.length];
      // Every body nearer than this one (plus the star) hides its far side.
      const occluders = bodies.filter((o2) => o2 !== pl && o2.ez > pl.ez).map((o2) => ({ cx: o2.cx, cy: o2.cy, R: o2.R }));
      renderBody(scene, { cx: pl.cx, cy: pl.cy, R: pl.R, bodyType: bt, bodySeed: seed + k * 257, craters: bt === 'moon' || bt === 'barren', occluders });
    }
    renderOrbitLabels(scene, planets.map((pl) => ({ orbR: pl.orbR, sT })));
  }
}
