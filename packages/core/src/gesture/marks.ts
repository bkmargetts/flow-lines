import type { FlowLine, Point } from '../flow-lines.js';
import type { SimplexNoise } from '../noise.js';
import { offsetPolyline } from '../lib/polyline.js';
import { TAU, type PlacedKnot, type PlacedWhip, type Spine } from './types.js';
import { makeSpine, spineExit } from './spine.js';

/**
 * A calligraphic whip: a fast single-pass flick. One pass of the pen, plus a
 * short second pass over the head so the mark reads heavier where the pen
 * landed and releases into a bare flick.
 */
export function renderWhip(whip: PlacedWhip, passSpacing: number): FlowLine[] {
  const pts = whip.spine.points;
  const lines: FlowLine[] = [{ points: pts, layer: 'secondary' }];
  const headCount = Math.max(3, Math.floor(pts.length * 0.2));
  lines.push({
    points: offsetPolyline(pts.slice(0, headCount), passSpacing * 0.8),
    layer: 'secondary',
  });
  return lines;
}

/**
 * A scribble knot: one continuous orbiting-pen line — the orbit center drifts
 * slowly along a heading while the radius breathes on fbm, so the mass reads
 * as dense self-crossing energy, not a spiral.
 */
export function renderKnot(knot: PlacedKnot, noise: SimplexNoise, rng: () => number): FlowLine {
  const steps = 260 + Math.floor(rng() * 180);
  let phi = rng() * TAU;
  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    // Fine angular steps keep the loops round; the radius churns fast and the
    // orbit center wanders on 2D noise, so loops pile up off-register — a
    // scribble, not a spiral.
    phi += 0.32 * (1 + 0.3 * noise.noise2D(t * 6, knot.track + 3));
    // Soft-squashed radius: never saturates, so no loop flattens into a
    // perfect circle at the knot's rim.
    const v = Math.abs(noise.fbm(t * 9, knot.track, 2, 0.5, 2.1)) * 1.5;
    const r = knot.radius * (0.15 + 1.35 * (v / (1 + v)));
    const cx = knot.center.x + knot.radius * 0.55 * noise.noise2D(t * 2.5, knot.track + 17);
    const cy = knot.center.y + knot.radius * 0.55 * noise.noise2D(t * 2.5, knot.track + 29);
    points.push({ x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r });
  }
  return { points, layer: 'secondary' };
}

/**
 * Spatter flung off a fast exit: droplets in a cone around the exit tangent,
 * quadratically clustered near the tip with rare far-fliers, each a tiny 3-
 * point polyline oriented along its flight and shrinking with distance.
 */
export function makeSpatter(
  spine: Spine,
  amount: number,
  maxHalf: number,
  passSpacing: number,
  rng: () => number
): FlowLine[] {
  const { point, tangent } = spineExit(spine);
  // The bell's true end is speed 0 — judge the flick by the late-stroke peak.
  const tipSpeed = spine.speed[Math.floor(spine.speed.length * 0.88)] ?? 0;
  const lines: FlowLine[] = [];
  const count = Math.round(amount * (4 + 11 * rng()));
  for (let d = 0; d < count; d++) {
    const ang = tangent + (rng() - 0.5) * 0.7;
    const dist = maxHalf * (0.8 + 2.6 * rng() * rng()) * (0.4 + 0.6 * tipSpeed);
    const px = point.x + Math.cos(ang) * dist;
    const py = point.y + Math.sin(ang) * dist;
    const len = (passSpacing * (0.8 + 1.2 * rng())) / (1 + dist / (8 * Math.max(maxHalf, 1)));
    const jitter = (rng() - 0.5) * len * 0.6;
    lines.push({
      points: [
        { x: px, y: py },
        {
          x: px + Math.cos(ang) * len * 0.5 - Math.sin(ang) * jitter,
          y: py + Math.sin(ang) * len * 0.5 + Math.cos(ang) * jitter,
        },
        { x: px + Math.cos(ang) * len, y: py + Math.sin(ang) * len },
      ],
      pen: 'fine',
      layer: 'spatter',
    });
  }
  return lines;
}

/**
 * A drip released from a heavy stroke belly: near-vertical (page-down
 * regardless of the gesture's angle — that's the physics tell), a bead that
 * thins into a thread, with an occasional tiny terminal blob.
 */
export function makeDrip(
  from: Point,
  maxLen: number,
  passSpacing: number,
  noise: SimplexNoise,
  track: number,
  rng: () => number
): FlowLine[] {
  const len = maxLen * (0.35 + 0.65 * rng());
  const steps = Math.max(6, Math.round(len / 4));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = from.y + (len * i) / steps;
    points.push({ x: from.x + 1.5 * noise.noise2D(y * 0.05, track), y });
  }
  const lines: FlowLine[] = [{ points, layer: 'gesture' }];

  // The bead: a second lane over the top quarter, merging into the thread.
  const beadCount = Math.max(3, Math.floor(points.length * 0.25));
  for (const side of [-1, 1]) {
    const bead: Point[] = [];
    for (let i = 0; i < beadCount; i++) {
      const taper = 1 - i / (beadCount - 1);
      bead.push({ x: points[i].x + side * passSpacing * 0.7 * taper, y: points[i].y });
    }
    lines.push({ points: bead, layer: 'gesture' });
  }

  if (rng() < 0.5) {
    const tip = points[points.length - 1];
    const r = passSpacing * 0.8;
    lines.push({
      points: [
        { x: tip.x, y: tip.y },
        { x: tip.x + r, y: tip.y + r },
        { x: tip.x, y: tip.y + 2 * r },
        { x: tip.x - r, y: tip.y + r },
        { x: tip.x, y: tip.y },
      ],
      layer: 'gesture',
    });
  }
  return lines;
}

/** Build a whip spine launched near a source point along a heading. */
export function makeWhipSpine(
  start: Point,
  heading: number,
  length: number,
  sweep: number,
  energy: number,
  track: number,
  noise: SimplexNoise
): Spine {
  return makeSpine(
    {
      start,
      heading,
      length,
      curvature: sweep / Math.max(length, 1),
      energy,
      reverseAt: -1,
      track,
    },
    noise
  );
}
