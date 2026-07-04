import { FlowLine, Point } from '../flow-lines.js';
import { SimplexNoise } from '../noise.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { pushRun } from '../landscape/hatching.js';
import { occludeBehind } from '../landscape/features.js';
import type { Morph } from './morph.js';
import type { BuildingSpec, TierSpec } from './layout.js';
import { bodyPoint, makeSpine, roofWave, tierFaces, tierSilhouette, type Proj, type Spine } from './project.js';
import { drawWindows, hatchFace, emitRing, inflatePoly, type FaceCraft } from './facade.js';
import { STYLES } from './styles.js';

/**
 * The isometric city: buildings drawn back-to-front, each tier box first
 * erasing everything behind its silhouette (`occludeBehind` — the landscape
 * generator's painter's algorithm), then emitting its own marks in the ink
 * order hatch → windows → structural edges → bold silhouette contour, so a
 * building's outline always sits on top of its own tone.
 */

export interface IsoDrawOptions {
  lightSide: 'left' | 'right';
  windows: number;
  windowPitch: number;
  shadeStrength: number;
  hatchSpacing: number;
  penWidth: number;
  heightMean: number;
  /** Occlusion margin: at least the finish pass's peak displacement, so the
   *  wobble can never bend an erased stroke back into view. */
  inflatePx: number;
}

export function drawIsoCity(
  specs: BuildingSpec[],
  pr: Proj,
  morph: Morph,
  noise: SimplexNoise,
  o: IsoDrawOptions,
  budget: { left: number }
): FlowLine[] {
  let lines: FlowLine[] = [];

  for (const b of specs) {
    const def = STYLES[b.style];
    const rng = makeRandom(subSeed(b.seed, 2));
    const craft: FaceCraft = { rng, taper: morph.taper, jitter: morph.jitterAng };
    const spine = makeSpine(b, morph, def.leanMul, def.bendMul);
    // Hatch angle wanders off exact 45° per building at the flow end, keyed
    // on the genome (not the craft stream) so it never re-rolls.
    const hatchAng = 45 + (b.wavePhase * 2 - 1) * morph.hatchWanderDeg;
    const tall = b.h > 5 * b.storey;

    for (let ti = 0; ti < b.tiers.length; ti++) {
      const tier = b.tiers[ti];
      const isTop = ti === b.tiers.length - 1;
      // Lower tiers keep a calmer parapet — their roofs are ledges, not crowns.
      const waveA = morph.waveAmp * def.waveMul * (isTop ? 1 : 0.45);

      // 1. This box hides everything already drawn behind it.
      const sil = tierSilhouette(pr, b, spine, tier, noise, waveA);
      lines = occludeBehind(lines, inflatePoly(sil.ring, o.inflatePx));

      const faces = tierFaces(pr, b, spine, tier);
      const lit = o.lightSide === 'left' ? faces.left : faces.right;
      const shadow = o.lightSide === 'left' ? faces.right : faces.left;

      // 2. Shadow-face hatch (tone carries the form; tops stay paper).
      hatchFace(lines, shadow, morph, craft, noise, {
        spacing: o.hatchSpacing,
        tone: o.shadeStrength * b.toneMul * def.toneMul,
        angleDeg: hatchAng,
        cross: o.shadeStrength > def.crossAt,
      });

      // 3. Windows: the lit face gets the full grid; the shadow face only
      //    sparse sill ticks (and only when windows are dense — outlines
      //    inside hatch read as noise).
      if (o.windows > 0 && def.windows.lit === 'grid') {
        drawWindows(lines, lit, morph, craft, noise, {
          pitch: o.windowPitch * def.windows.pitchMul,
          storey: b.storey,
          density: o.windows * def.windows.densityMul,
          phase: b.winPhase,
          style: 'full',
          budget,
          widthFrac: def.windows.widthFrac,
          heightFrac: def.windows.heightFrac,
          jitterMul: def.windows.jitterMul,
        });
      }
      if (o.windows > 0.6 && def.windows.shadow === 'ticks') {
        drawWindows(lines, shadow, morph, craft, noise, {
          pitch: o.windowPitch * def.windows.pitchMul,
          storey: b.storey,
          density: o.windows * def.windows.densityMul * 0.4,
          phase: b.winPhase,
          style: 'ticks',
          budget,
          widthFrac: def.windows.widthFrac,
          heightFrac: def.windows.heightFrac,
          jitterMul: def.windows.jitterMul,
        });
      }

      // 4. Structural edges: the near roof fold (top face meets the two
      //    visible faces) and, for setback tiers, the base ledge line.
      emitNearRoofEdges(lines, pr, b, spine, tier, noise, waveA);
      if (ti > 0) emitBaseEdges(lines, pr, b, spine, tier);
      if (isTop && def.parapet) emitParapet(lines, pr, b, spine, tier, noise, waveA, morph);

      // 5. The bold contour: closed silhouette in offset passes; the shared
      //    near corner vertical is drawn with the same commitment.
      emitRing(lines, sil.ring, 'contour', o.penWidth, tall && ti === 0 ? 2 : 1, sil.corners);
      const nearEdge: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        nearEdge.push(bodyPoint(pr, b, spine, tier.u1, tier.v1, tier.z0 + ((tier.z1 - tier.z0) * i) / 8));
      }
      pushRun(lines, nearEdge, 'edge', 'bold');
    }

    // 6. Style-specific details (colonnades, stoops, chimneys …), emitted
    //    once per building with the full drawing context in hand.
    if (def.extras) {
      const topTier = b.tiers[b.tiers.length - 1];
      const tf = tierFaces(pr, b, spine, topTier);
      def.extras({
        out: lines,
        pr,
        b,
        spine,
        morph,
        craft,
        noise,
        draw: o,
        lit: o.lightSide === 'left' ? tf.left : tf.right,
        shadow: o.lightSide === 'left' ? tf.right : tf.left,
        topTier,
        budget,
        // In-place so ctx.out stays the live array after an occlusion pass.
        occlude: (ring) => {
          const kept = occludeBehind(lines, inflatePoly(ring, o.inflatePx));
          lines.length = 0;
          for (const l of kept) lines.push(l);
        },
      });
    }
  }
  return lines;
}

/** The two near roof edges — where the top face folds over into the visible
 *  faces. Fine lines; they carry the parapet wave. */
function emitNearRoofEdges(
  out: FlowLine[],
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  noise: SimplexNoise,
  waveA: number
): void {
  const { u0, u1, v0, v1, z1 } = tier;
  const top = (u: number, v: number): Point => bodyPoint(pr, b, spine, u, v, z1 + roofWave(noise, b, waveA, u, v));
  const N = 6;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= N; i++) {
    left.push(top(u0 + ((u1 - u0) * i) / N, v1));
    right.push(top(u1, v1 + ((v0 - v1) * i) / N));
  }
  pushRun(out, left, 'roof');
  pushRun(out, right, 'roof');
}

/** Setback ledge: the two visible base edges where an upper tier meets the
 *  roof of the one below. */
function emitBaseEdges(out: FlowLine[], pr: Proj, b: BuildingSpec, spine: Spine, tier: TierSpec): void {
  const { u0, u1, v0, v1, z0 } = tier;
  pushRun(out, [bodyPoint(pr, b, spine, u0, v1, z0), bodyPoint(pr, b, spine, u1, v1, z0)], 'edge');
  pushRun(out, [bodyPoint(pr, b, spine, u1, v1, z0), bodyPoint(pr, b, spine, u1, v0, z0)], 'edge');
}

/** Roof detail on the crown: a crisp inset border at the rigid end, a second
 *  dropped parapet lip at the flow end — the same restraint either way, one
 *  light line. */
function emitParapet(
  out: FlowLine[],
  pr: Proj,
  b: BuildingSpec,
  spine: Spine,
  tier: TierSpec,
  noise: SimplexNoise,
  waveA: number,
  morph: Morph
): void {
  const { u0, u1, v0, v1, z1 } = tier;
  const w = u1 - u0;
  const d = v1 - v0;
  // Restraint: only roomier roofs, and only some of them, get furniture — a
  // detail stamped on every crown reads as a pattern, not a drawing.
  if (Math.min(w, d) < 12 || b.parapetDraw > 0.6) return;
  if (morph.order > 0.35) {
    // Crisp inset border, one edge per stroke — the SVG writer smooths short
    // closed rings into ovals, and a parapet must stay rectangular.
    const ins = 0.13 * Math.min(w, d);
    const corners: [number, number][] = [
      [u0 + ins, v0 + ins],
      [u1 - ins, v0 + ins],
      [u1 - ins, v1 - ins],
      [u0 + ins, v1 - ins],
    ];
    for (let i = 0; i < 4; i++) {
      const [ua, va] = corners[i];
      const [ub, vb] = corners[(i + 1) % 4];
      pushRun(out, [bodyPoint(pr, b, spine, ua, va, z1), bodyPoint(pr, b, spine, ub, vb, z1)], 'roof');
    }
  } else {
    // Flow: the far silhouette roof edges repeat a hair lower — a wavy
    // double parapet line.
    const N = 6;
    const lip: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const v = v1 + ((v0 - v1) * i) / N;
      lip.push(bodyPoint(pr, b, spine, u0, v, z1 - 2 + roofWave(noise, b, waveA, u0, v)));
    }
    for (let i = 1; i <= N; i++) {
      const u = u0 + ((u1 - u0) * i) / N;
      lip.push(bodyPoint(pr, b, spine, u, v0, z1 - 2 + roofWave(noise, b, waveA, u, v0)));
    }
    pushRun(out, lip, 'roof');
  }
}
