import type { Point } from '../flow-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { TAU, circle, radialOffset } from './geometry.js';
import { type CodexCtx } from './context.js';
import type { Gear } from './types.js';
import { outerR, pitchR, rootR } from './synth.js';

/**
 * Gear rendering — wooden-clockwork wheels in elevation. One closed tooth
 * profile (trapezoid teeth with a slight mid-flank bow standing in for the
 * involute), rim + hub circles, double-line spokes, and shadow-side rim hatch.
 * Bold emphasis on the outer profile is a repeated radial-offset pass of the
 * same pen — never stroke-width.
 */

/** The closed tooth-profile polygon. Teeth are narrower than half the pitch
 *  period (working backlash — real clockwork shows it) and small pinions get
 *  stub teeth (shorter addendum), the hand-drawn stand-in for the undercut
 *  low tooth counts need; without both, trapezoid flanks jam into the mate. */
export function toothProfile(g: Gear): Point[] {
  const rp = pitchR(g);
  const rr = rootR(g);
  const stub = g.teeth < 12 ? 0.72 : g.teeth < 18 ? 0.85 : 1;
  const ro = rp + g.module * stub;
  const tau = TAU / g.teeth;
  const pts: Point[] = [];
  const at = (a: number, r: number): Point => ({
    x: g.cx + Math.cos(a) * r,
    y: g.cy + Math.sin(a) * r,
  });
  for (let k = 0; k < g.teeth; k++) {
    const a = g.phase + k * tau;
    // Root gap leading into the tooth (sampled so the root reads as an arc).
    pts.push(at(a - 0.5 * tau, rr));
    pts.push(at(a - 0.36 * tau, rr));
    // Leading flank with a mid-flank bow point at the pitch circle.
    pts.push(at(a - 0.26 * tau, rr));
    pts.push(at(a - 0.2 * tau, rp * 1.002));
    pts.push(at(a - 0.13 * tau, ro));
    // Top land.
    pts.push(at(a, ro));
    // Trailing flank.
    pts.push(at(a + 0.13 * tau, ro));
    pts.push(at(a + 0.2 * tau, rp * 1.002));
    pts.push(at(a + 0.26 * tau, rr));
    pts.push(at(a + 0.36 * tau, rr));
  }
  pts.push({ x: pts[0].x, y: pts[0].y });
  return pts;
}

export function renderGear(ctx: CodexCtx, g: Gear): Point[][] {
  const { o, lines, shadowAngle } = ctx;
  const rng = makeRandom(subSeed(ctx.seed, 100 + g.id));
  const rp = pitchR(g);
  const rr = rootR(g);
  const m = g.module;
  const big = g.teeth >= 16;

  // Outer profile, bold via repeated radial offsets (2 extra passes on big
  // wheels, 1 on pinions).
  const profile = toothProfile(g);
  lines.push({ points: profile, layer: 'part' });
  // Bold emphasis passes on a separate layer so hidden-line re-emission only
  // dashes the base profile once.
  const passes = big ? 2 : 1;
  for (let p = 1; p <= passes; p++) {
    lines.push({
      points: radialOffset(profile, g.cx, g.cy, -o.penWidth * 0.45 * p),
      layer: 'part2',
    });
  }

  // Rim ring just inside the root circle (big wheels only — pinions are solid).
  const rimR = big ? rr - 1.4 * m : 0;
  if (big) lines.push({ points: circle(g.cx, g.cy, rimR), layer: 'part' });

  // Hub + axle, with a keyway notch that rotates with the wheel's phase.
  const hubR = Math.max(m * 1.15, rp * 0.14);
  const axleR = hubR * 0.45;
  lines.push({ points: circle(g.cx, g.cy, hubR), layer: 'part' });
  lines.push({ points: circle(g.cx, g.cy, axleR), layer: 'part' });
  const ka = g.phase;
  const kw = axleR * 0.42;
  const k0 = axleR * 0.9;
  const k1 = axleR * 1.45;
  const kdx = Math.cos(ka);
  const kdy = Math.sin(ka);
  const kpx = -kdy;
  const kpy = kdx;
  lines.push({
    points: [
      { x: g.cx + kdx * k0 + kpx * kw, y: g.cy + kdy * k0 + kpy * kw },
      { x: g.cx + kdx * k1 + kpx * kw, y: g.cy + kdy * k1 + kpy * kw },
      { x: g.cx + kdx * k1 - kpx * kw, y: g.cy + kdy * k1 - kpy * kw },
      { x: g.cx + kdx * k0 - kpx * kw, y: g.cy + kdy * k0 - kpy * kw },
    ],
    layer: 'part',
  });

  // Spokes: 4–6 double-line spokes from hub to rim (big wheels only).
  if (big && rimR > hubR * 1.6) {
    const nsp = 4 + Math.floor(rng() * 3);
    const half = m * 0.32;
    const spokeStart = g.phase + rng() * TAU;
    for (let j = 0; j < nsp; j++) {
      const sa = spokeStart + (j * TAU) / nsp;
      const dx = Math.cos(sa);
      const dy = Math.sin(sa);
      const px = -dy;
      const py = dx;
      for (const s of [1, -1]) {
        lines.push({
          points: [
            { x: g.cx + dx * (hubR + 0.5) + px * half * s, y: g.cy + dy * (hubR + 0.5) + py * half * s },
            { x: g.cx + dx * (rimR - 0.5) + px * half * s, y: g.cy + dy * (rimR - 0.5) + py * half * s },
          ],
          layer: 'part',
        });
      }
    }
  }

  // Shadow-side tone: straight parallel hatch clipped to the face annulus
  // (rim ring on big wheels, the whole solid face on pinions), only on the
  // shadow half — the way etchers shade a turned wheel, not concentric arcs.
  if (o.shading > 0.05) {
    const step = Math.max(1.6, o.hatchSpacing) / Math.max(0.35, o.shading);
    const rIn = big ? rimR : hubR;
    const start = big ? -rr * 0.1 : step * 0.6;
    annulusHatch(ctx, g.cx, g.cy, rIn, rr, shadowAngle, step, start);
  }

  return [profile];
}

/** Straight hatch chords across the annulus [rIn, rOut], perpendicular to
 *  `angle`, starting `from` px down-shadow of the centre (negative reaches a
 *  little into the lit half so the tone fades in rather than switching on). */
function annulusHatch(
  ctx: CodexCtx,
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  angle: number,
  step: number,
  from: number
): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  for (let s = from; s < rOut - step * 0.4; s += step) {
    const half = Math.sqrt(Math.max(0, rOut * rOut - s * s));
    const bx = cx + dx * s;
    const by = cy + dy * s;
    // Chord minus the inner-circle interval (two runs when the chord crosses it).
    const innerHalf = Math.abs(s) < rIn ? Math.sqrt(rIn * rIn - s * s) : 0;
    const spans: [number, number][] =
      innerHalf > 0
        ? [
            [-half, -innerHalf],
            [innerHalf, half],
          ]
        : [[-half, half]];
    for (const [t0, t1] of spans) {
      if (t1 - t0 < step * 0.8) continue;
      ctx.lines.push({
        points: [
          { x: bx + px * t0, y: by + py * t0 },
          { x: bx + px * t1, y: by + py * t1 },
        ],
        layer: 'hatch',
      });
    }
  }
}
