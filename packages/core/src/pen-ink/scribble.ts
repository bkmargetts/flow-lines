import { FlowLine, Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';

export interface ScribbleOptions {
  /** Canvas size in px */
  width: number;
  height: number;
  /** Margin from canvas edges, px */
  margin: number;
  /** Carrier direction in radians (the hatch angle) */
  angle: number;
  /** Scribble aggressiveness 0-1: loop gain and shadow double-cover */
  amount: number;
  /** Distance between carrier paths, px (~maxSpacing) */
  carrierGap: number;
  /** Integration step along the carrier, px */
  stepLength: number;
  /** Physical length scale */
  scale: number;
  /** Random seed */
  seed: number;
  /** Tone→spacing curve — the same mapping hatch uses */
  spacingAt: (x: number, y: number) => number;
  /** Halo/fill/white-cutoff gate — pen lifts where this is false */
  isDrawable: (x: number, y: number) => boolean;
  /** Tone at canvas coordinates */
  darknessAt: (x: number, y: number) => number;
}

/**
 * Continuous scribble as the tone engine — what ballpoint shading actually
 * is: one long meandering line whose local loop density carries the tone.
 *
 * The model is a noisy cycloid. Long carrier paths sweep the drawable area
 * at the hatch angle; along each carrier the pen oscillates perpendicular
 * AND tangential to it. Where tone asks for more ink than a straight pass
 * deposits, the oscillation frequency rises until the tangential component
 * outruns the carrier and the path curls into loops — the ink laid per
 * canvas inch exactly tracks the same tone→spacing curve the hatch engine
 * uses. In the lights the wave flattens out, and where tone asks for less
 * ink than even a straight carrier, the pen lifts in noise-stretched runs.
 * Deep shadow earns a second carrier direction a shallow angle off the
 * first — layered scribble, still one continuous habit of hand.
 *
 * Deliberately not Jobard–Lefer: streamline spacing rejection forbids the
 * self-overlap scribble lives on. Tone comes from loop frequency, not
 * stroke separation.
 */
export function scribblePass(options: ScribbleOptions): FlowLine[] {
  const {
    width,
    height,
    margin,
    angle,
    amount,
    carrierGap,
    stepLength,
    scale,
    seed,
    spacingAt,
    isDrawable,
    darknessAt,
  } = options;

  const noise = createNoise(seed);
  const lines: FlowLine[] = [];
  const h = stepLength;
  const minPoints = Math.max(4, Math.round((6 * scale) / h));

  // Loop gain: how hard the darks curl. Scales with amount so a gentle
  // setting reads as wavy shading, a high one as committed scribble
  const gain = 0.7 + 0.6 * amount;

  // Second carrier direction in deep shadow only — layered scribble the
  // way a hand works back over the darkest passages
  const passes: { passAngle: number; gate: ((x: number, y: number) => boolean) | null }[] = [
    { passAngle: angle, gate: null },
    {
      passAngle: angle + Math.PI / 6,
      gate: (x: number, y: number): boolean => darknessAt(x, y) > 0.7,
    },
  ];

  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  let track = 0;
  for (const { passAngle, gate } of passes) {
    const ux = Math.cos(passAngle);
    const uy = Math.sin(passAngle);
    const vx = -uy;
    const vy = ux;

    let tMin = Infinity;
    let tMax = -Infinity;
    let sMin = Infinity;
    let sMax = -Infinity;
    for (const c of [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x0, y: y1 },
      { x: x1, y: y1 },
    ]) {
      const t = c.x * ux + c.y * uy;
      const s = c.x * vx + c.y * vy;
      tMin = Math.min(tMin, t);
      tMax = Math.max(tMax, t);
      sMin = Math.min(sMin, s);
      sMax = Math.max(sMax, s);
    }

    for (let s = sMin + carrierGap * 0.5; s <= sMax; s += carrierGap, track++) {
      let run: Point[] = [];
      // Per-carrier random phase so neighbouring bands never sync, and a
      // per-carrier curl direction — a hand's loops don't all garland the
      // same way row after row
      let phase = noise.noise2D(track * 0.731 + 0.5, -13.7) * Math.PI * 2;
      const curl = noise.noise2D(track * 1.37, 29.3) >= 0 ? 1 : -1;

      const flush = (): void => {
        if (run.length >= minPoints) {
          lines.push({ points: run });
        }
        run = [];
      };

      for (let t = tMin; t <= tMax + 1e-9; t += h) {
        const cx = ux * t + vx * s;
        const cy = uy * t + vy * s;
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1) {
          flush();
          continue;
        }
        if (!isDrawable(cx, cy) || (gate && !gate(cx, cy))) {
          flush();
          continue;
        }

        const spacing = Math.max(0.6 * scale, spacingAt(cx, cy));

        // Pen-up in the light: where tone asks for less ink than even a
        // straight carrier deposits, lift in noise-stretched runs (the
        // noise is elongated along the carrier so gaps arrive as passages,
        // not pepper)
        if (spacing > carrierGap) {
          const keep = carrierGap / spacing;
          const g =
            (noise.noise2D(t / (carrierGap * 6), track * 7.13) + 1) / 2;
          if (g > keep) {
            flush();
            continue;
          }
        }

        // Loop frequency carries the tone: target ink multiple vs a
        // straight pass is carrierGap/spacing; the cycloid's arc-length
        // multiplier is ~sqrt(1 + (A·dφ/h)²), solved for dφ. Curls also
        // tighten in size through the shadows, the way a shading hand
        // shrinks its loops as it bears down
        const d = darknessAt(cx, cy);
        const target = Math.max(1, (carrierGap / spacing) * gain);
        const An = carrierGap * 0.55 * (1.05 - 0.3 * d);
        const At = An * 0.7;
        const k = Math.sqrt(target * target - 1);
        const dPhase = Math.min(1.1, (k * h) / An);

        // Amplitude breathing + phase drift keep it from reading as a sine
        const breathe =
          1 + 0.3 * noise.noise2D(cx / (carrierGap * 4), cy / (carrierGap * 4));
        phase +=
          curl *
          (dPhase + 0.1 * noise.noise2D(t / (carrierGap * 2.3), track * 3.31 + 17.9));

        run.push({
          x: cx + (vx * Math.sin(phase) * An + ux * Math.cos(phase) * At) * breathe,
          y: cy + (vy * Math.sin(phase) * An + uy * Math.cos(phase) * At) * breathe,
        });
      }
      flush();
    }
  }

  return lines;
}
