import { FlowLine, Point } from '../flow-lines.js';
import { hatchPolygon } from '../hearts/heart.js';
import {
  clipLineToPolygon,
  emitStroke,
  sweepHatch,
  type BreakFn,
  type Craft,
  type ToneFn,
} from '../landscape/hatching.js';
import { pointInPolygon, trimPolyline } from '../lib/polyline.js';
import { createNoise } from '../noise.js';
import { generateOverlappedLines, bandLayerName } from '../overlapped-lines.js';
import { makeRandom, subSeed } from '../lib/rng.js';
import { clamp } from '../lib/math.js';
import { ProximityGrid } from '../lib/spatial.js';
import { Region, type LapidaryTexture } from './layout.js';
import { regionTone, TONE_REF } from './tone.js';

/** Safety valve per region — a hostile spacing knob must not hang the page. */
const REGION_LINE_CAP = 40000;

/** Per-stroke angle jitter in radians, by texture kind. Not every mark is made
 *  with the same control: a ruled field is a drafted datum, a druzy ray-burst
 *  is a flick of the wrist. `lines` stays low deliberately — `emitStroke`
 *  rotates by up to ±jitter, and the ruled band has to hold its base angle. */
const KIND_JITTER: Partial<Record<LapidaryTexture, number>> = {
  lines: 0.006,
  hatch: 0.01,
  cross: 0.016,
  patchy: 0.018,
  crystal: 0.024,
};

/** Uncapped densify: background lines span the whole sheet, and the
 *  hand-drawn pass needs samples every few px along them (the landscape
 *  `densifySegment` caps at 40 points, which starves wobble on long runs). */
function densify(a: Point, b: Point, step: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(len / step));
  const pts: Point[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts[i] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return pts;
}

function push(out: FlowLine[], points: Point[]): void {
  if (out.length >= REGION_LINE_CAP) return;
  if (points.length >= 2) out.push({ points });
}

/** Fill result: `ink` is drawn; `phantom` only joins the avoid union so a
 *  'blank' band still reserves its paper against deeper layers. */
export interface RegionFill {
  ink: FlowLine[];
  phantom: FlowLine[];
}

/**
 * Seed points across a polygon by dart-throwing against a proximity grid —
 * blue noise rather than a jittered lattice.
 *
 * A pitch grid with ±0.4-pitch jitter keeps its rows and columns visible at
 * plot scale: the eye finds the lattice through the jitter, and a stipple
 * field that betrays a grid is not stipple. Rejection sampling has no
 * preferred direction, and taking the rejection radius from the tone field
 * gives the band its gradation for free — dots crowd where the band is dark.
 */
function blueNoiseSeeds(
  poly: Point[],
  pitch: number,
  tone: ToneFn,
  rng: () => number
): Array<[number, number]> {
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const p of poly) {
    if (p.x < bx0) bx0 = p.x;
    if (p.y < by0) by0 = p.y;
    if (p.x > bx1) bx1 = p.x;
    if (p.y > by1) by1 = p.y;
  }
  const w = bx1 - bx0;
  const h = by1 - by0;
  if (!(w > 0 && h > 0)) return [];
  const grid = new ProximityGrid(w, h, Math.max(1, pitch));
  const out: Array<[number, number]> = [];
  // Enough darts to saturate the area; the grid does the thinning.
  const darts = Math.min(200000, Math.ceil(((w * h) / (pitch * pitch)) * 8));
  for (let i = 0; i < darts && out.length < REGION_LINE_CAP; i++) {
    const x = bx0 + rng() * w;
    const y = by0 + rng() * h;
    if (!pointInPolygon(poly, x, y)) continue;
    // Dark passages pack tighter; light ones open out.
    const r = pitch * Math.sqrt(TONE_REF / Math.max(0.18, tone(x, y))) * 0.78;
    if (grid.hasNear(x - bx0, y - by0, r)) continue;
    grid.add({ x: x - bx0, y: y - by0 });
    out.push([x, y]);
  }
  return out;
}

/**
 * Fill one region's polygon with its resolved texture. Strokes come back
 * with no layer tag — the carve pass assigns pens after clipping, so the
 * interleave counter only counts strokes that survive — except mottle,
 * whose strokes carry transient `fam-K` family markers the carve maps to
 * dedicated pens (the two-ink weave).
 */
export function fillRegion(region: Region): RegionFill {
  const t = region.tex;
  const poly = region.poly;
  const rng = makeRandom(t.seed);
  const noise = createNoise(subSeed(t.seed, 1));
  const ink: FlowLine[] = [];
  // Detail steps ride the feature scale so wobble samples stay a fixed
  // physical distance apart on any sheet (floored — micro pages must not
  // explode point counts).
  const step = Math.max(1, 6 * t.featureScale);
  const fineStep = Math.max(1, 4 * t.featureScale);
  // The pen-lift gap between hand-fed dashes — a physical distance like every
  // other detail step here. It used to be a raw 1.8-3.8px while the dashes
  // themselves scale with the sheet, so at high render density the lifts shrank
  // to a hairline and the dashing closed back up into ruled lines (at 6 px/mm
  // the gap measured half its A3-tuned width).
  const liftGap = (): number => Math.max(1, (1.8 + rng() * 2) * t.featureScale);

  // The patchy gate: hand-sized low-frequency holes (the landscape
  // makePatchMask idiom). The floor keeps them hand-sized at very tight pitch,
  // where they would otherwise shrink to stroke-sized flecks reading as
  // dropout rather than mottling — and the ceiling does the same job at the
  // other end. A light band has a wide pitch, and 16 pitches of a wide one is
  // 40mm of hole: on a full-frame ground that stops reading as mottling and
  // starts reading as rectangular blocks punched out of the field.
  const patchScale = clamp(t.spacing * 16, 24, 55 * t.featureScale);
  const patchCut = -1 + t.patchiness * 1.6;
  const patchKeep = (x: number, y: number): boolean =>
    noise.noise2D(x / patchScale, y / patchScale) > patchCut;

  // Per-kind steadiness. A ruled datum field is the most controlled thing on
  // the sheet and a druzy ray-burst the least; one flat jitter for all of them
  // made the whole drawing move at one speed. `lines` must also stay under
  // ~0.010 rad — `emitStroke` rotates each stroke by up to ±jitter, and a
  // ruled band is asserted to hold its base angle.
  const craft: Craft = {
    rng,
    taper: 0.45,
    jitter: KIND_JITTER[t.kind] ?? 0.012,
    subStep: step,
    // The taper and the mid-stroke lift are physical distances like every
    // other detail step here, so they ride the sheet's feature scale.
    scale: t.featureScale,
  };
  const emitTapered = (a: Point, b: Point): void => {
    if (ink.length >= REGION_LINE_CAP) return;
    emitStroke(ink, a, b, '', craft);
  };

  // The curve analogue of `emitStroke`'s craft. These runs follow a silhouette
  // or a shared comb field, so they must NOT be rotated the way a straight
  // hatch stroke is — rotating a contour loop breaks the concentricity it
  // exists to show. What they can have is the rest of it: a seeded end trim,
  // because a pen lands and lifts rather than starting and stopping square,
  // and the occasional dropped mark.
  const pushCrafted = (pts: Point[], trim: number, drop: number): void => {
    if (ink.length >= REGION_LINE_CAP) return;
    if (drop > 0 && rng() < drop) return;
    const f = trim * (0.5 + rng());
    push(ink, f > 0 ? trimPolyline(pts, f) : pts);
  };

  // The band's tone field: its planned value, graduated across its own width.
  // `sweepHatch` reads baseSpacing as the pitch at full darkness and opens the
  // family as tone falls, so the value-derived pitch is handed over scaled by
  // TONE_REF and the field then swings either side of it.
  const tone: ToneFn = regionTone(region, createNoise(subSeed(t.seed, 6)));
  const sweep = (
    angleRad: number,
    pitch: number,
    gate: (x: number, y: number, tv: number) => boolean,
    edgeKeepPx: number,
    breakFn?: BreakFn,
    maxLen = 0,
    pieceLenPx?: number
  ): void => {
    if (ink.length >= REGION_LINE_CAP) return;
    sweepHatch(
      ink,
      poly,
      (angleRad * 180) / Math.PI,
      pitch * TONE_REF,
      tone,
      gate,
      '',
      craft,
      breakFn,
      maxLen,
      { edgeKeepPx, phase01: t.phase, pieceLenPx }
    );
  };
  const openGate = (): boolean => true;

  // Long ruled lines break into hand-fed dashes with small pen-lift gaps
  // at irregular heights (the reference's airy background field); short
  // runs — a core band, sliver spans — stay whole. Shared by 'lines' and
  // the contour fallback on regions with no silhouette geometry.
  // The hand-fed dash rhythm as a `sweepHatch` break function: walk the run,
  // draw for a stretch, lift briefly, resume. Short runs — a core band, a
  // sliver span — stay whole.
  const dashBreak: BreakFn = (t0, t1, _O, _D, r) => {
    const len = t1 - t0;
    if (len <= t.spacing * 22) return [[t0, t1]];
    const out: [number, number][] = [];
    let at = t0;
    let guard = 0;
    while (at < t1 - 2 && guard++ < 200) {
      const e = Math.min(t1, at + t.spacing * (14 + 18 * r()));
      out.push([at, e]);
      at = e + Math.max(1, (1.8 + r() * 2) * t.featureScale);
    }
    return out;
  };
  const fillLines = (): void => {
    sweep(t.angleRad, t.spacing, openGate, 0, dashBreak);
  };

  // The 'lines' hand-fed dashing applied to an arbitrary polyline: walk the
  // arc length, lift the pen briefly at irregular intervals. Closed loops
  // start at a seeded phase so the lift gaps don't stack radially across
  // nested contour loops.
  const dashPolyline = (pts: Point[], closed: boolean): void => {
    if (pts.length < 2) return;
    const cum: number[] = new Array(pts.length);
    cum[0] = 0;
    for (let i = 1; i < pts.length; i++) {
      cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    const total = cum[pts.length - 1];
    if (total <= t.spacing * 22) {
      pushCrafted(pts, 0.03, 0.05);
      return;
    }
    // Slice the arc-length window [sa, sb] out of the polyline.
    const at = (s: number): Point => {
      let i = 1;
      while (i < pts.length - 1 && cum[i] < s) i++;
      const span = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / span;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
      };
    };
    const slice = (sa: number, sb: number): Point[] => {
      const out: Point[] = [at(sa)];
      for (let i = 0; i < pts.length; i++) {
        if (cum[i] > sa && cum[i] < sb) out.push(pts[i]);
      }
      out.push(at(sb));
      return out;
    };
    const phase = closed ? total * rng() : 0;
    let s = 0;
    let guard = 0;
    while (s < total - 2 && guard++ < 200) {
      const e = Math.min(total, s + t.spacing * (14 + 18 * rng()));
      const sa = (s + phase) % total;
      const sb = (e + phase) % total;
      if (sa < sb) {
        pushCrafted(slice(sa, sb), 0.03, 0.05);
      } else {
        // The phase-shifted dash wraps the loop seam: emit both halves.
        if (total - sa > 2) pushCrafted(slice(sa, total), 0.03, 0);
        if (sb > 2) pushCrafted(slice(0, sb), 0.03, 0);
      }
      s = e + liftGap();
    }
  };

  switch (t.kind) {
    case 'blank': {
      // Coarse phantom coverage: sampled tighter than the halo radius so the
      // disc-stamped mask is solid across the whole band.
      const phantom = hatchPolygon(poly, t.angleRad, Math.max(2, t.spacing), 0.5).map(
        (run): FlowLine => ({ points: run })
      );
      return { ink: [], phantom };
    }

    case 'lines': {
      fillLines();
      break;
    }

    case 'contour': {
      // Concentric banding: loops that follow the region's own silhouette —
      // the fortification-agate mark. Offsets happen in table space, where an
      // inward offset of these star-shaped blobs can never self-intersect;
      // near the core, partially collapsed loops surface as open crescents,
      // exactly how real agate banding closes out. Regions without silhouette
      // geometry (the background field) fall back to ruled lines.
      const pitch = t.spacing;
      // Inter-loop pitch follows the tone field, so a graded band's banding
      // crowds toward its dark edge instead of marching at one interval. The
      // floor stops a light passage opening a gap wide enough to read as a
      // missing loop.
      const pitchAt = (x: number, y: number): number =>
        Math.max(pitch * 0.55, (pitch * TONE_REF) / Math.max(0.18, tone(x, y)));
      const lambda = Math.max(36, pitch * 16);
      // Waviness cap stays below half the pitch so neighbouring loops never
      // touch; one shared page-space field keeps them undulating together.
      const amp = t.waviness * Math.min(pitch * 0.35, lambda * 0.1);
      const wave = (pts: Point[], dir: (p: Point) => Point): Point[] =>
        amp <= 0
          ? pts
          : pts.map((p) => {
              const d = amp * noise.fbm(p.x / lambda, p.y / lambda, 2, 0.5, 2);
              const u = dir(p);
              return { x: p.x + u.x * d, y: p.y + u.y * d };
            });
      const densifyRun = (pts: Point[]): Point[] => {
        const out: Point[] = [];
        for (let i = 1; i < pts.length; i++) {
          const seg = densify(pts[i - 1], pts[i], fineStep);
          if (out.length > 0) seg.shift();
          out.push(...seg);
        }
        return out;
      };

      if (region.radial) {
        const { cx, cy, rx, ry, table } = region.radial;
        const n = table.length;
        const baseLen = new Float64Array(n);
        let maxR = 0;
        for (let j = 0; j < n; j++) {
          const theta = (j / n) * Math.PI * 2;
          baseLen[j] = Math.hypot(Math.cos(theta) * rx, Math.sin(theta) * ry) || 1e-6;
          maxR = Math.max(maxR, table[j] * baseLen[j]);
        }
        const radialDir = (p: Point): Point => {
          const len = Math.hypot(p.x - cx, p.y - cy) || 1;
          return { x: (p.x - cx) / len, y: (p.y - cy) / len };
        };
        const pointAt = (j: number, inset: number): Point => {
          const theta = (j / n) * Math.PI * 2;
          const g = table[j] - inset / baseLen[j];
          return { x: cx + Math.cos(theta) * rx * g, y: cy + Math.sin(theta) * ry * g };
        };
        const maxLoops = Math.ceil(maxR / (pitch * 0.55));
        let inset = 0;
        for (let k = 1; k <= maxLoops && ink.length < REGION_LINE_CAP; k++) {
          // Sample the tone where this loop is about to sit, on the +x spoke.
          inset += pitchAt(cx + Math.max(0, rx * table[0] - inset), cy);
          const alive: boolean[] = new Array(n);
          let anyAlive = false;
          let allAlive = true;
          for (let j = 0; j < n; j++) {
            alive[j] = table[j] * baseLen[j] - inset >= pitch * 0.5;
            anyAlive ||= alive[j];
            allAlive &&= alive[j];
          }
          if (!anyAlive) break;
          if (allAlive) {
            const pts: Point[] = [];
            for (let j = 0; j < n; j++) pts.push(pointAt(j, inset));
            pts.push({ ...pts[0] });
            dashPolyline(wave(densifyRun(pts), radialDir), true);
            continue;
          }
          // Contiguous alive arcs (circular): each surfaces as an open run.
          for (let j = 0; j < n; j++) {
            if (!alive[j] || alive[(j - 1 + n) % n]) continue;
            const arc: Point[] = [];
            for (let m = j; alive[m % n] && arc.length < n; m++) {
              arc.push(pointAt(m % n, inset));
            }
            if (arc.length >= 3) dashPolyline(wave(densifyRun(arc), radialDir), false);
          }
        }
        break;
      }

      if (region.ribbon) {
        // Lamination between a spiral cell's edges — the strata onion-skin
        // bent along the coil: interior curves interpolate both coordinates
        // between the index-aligned edges, and the wave pushes across the
        // ribbon so neighbouring laminae undulate together without ever
        // crossing. Edge samples are already a few px apart, so waving
        // before the densify pass loses nothing.
        const { outer, inner } = region.ribbon;
        const m = Math.min(outer.length, inner.length);
        let gap = 0;
        for (let i = 0; i < m; i++) {
          gap += Math.hypot(inner[i].x - outer[i].x, inner[i].y - outer[i].y);
        }
        gap /= Math.max(1, m);
        const mid = Math.floor(m / 2);
        const rows = Math.max(
          1,
          Math.round(gap / pitchAt((outer[mid].x + inner[mid].x) / 2, (outer[mid].y + inner[mid].y) / 2))
        );
        for (let r = 1; r < rows && ink.length < REGION_LINE_CAP; r++) {
          const f = r / rows;
          const pts: Point[] = new Array(m);
          for (let i = 0; i < m; i++) {
            const ax = inner[i].x - outer[i].x;
            const ay = inner[i].y - outer[i].y;
            const p = { x: outer[i].x + ax * f, y: outer[i].y + ay * f };
            if (amp > 0) {
              const al = Math.hypot(ax, ay) || 1;
              const d = amp * noise.fbm(p.x / lambda, p.y / lambda, 2, 0.5, 2);
              p.x += (ax / al) * d;
              p.y += (ay / al) * d;
            }
            pts[i] = p;
          }
          dashPolyline(densifyRun(pts), false);
        }
        break;
      }

      if (region.strataBand) {
        // Onion-skin lamination between the band's bounding curves: interior
        // curves only — the boundaries themselves are the seam edges.
        const { top, bottom } = region.strataBand;
        let gap = 0;
        for (let i = 0; i < top.length; i++) gap += bottom[i].y - top[i].y;
        gap /= top.length;
        const midX = top[Math.floor(top.length / 2)].x;
        const midY = (top[Math.floor(top.length / 2)].y + bottom[Math.floor(top.length / 2)].y) / 2;
        const rows = Math.max(1, Math.round(gap / pitchAt(midX, midY)));
        const down = (): Point => ({ x: 0, y: 1 });
        for (let r = 1; r < rows && ink.length < REGION_LINE_CAP; r++) {
          const f = r / rows;
          const pts = top.map((p, i) => ({
            x: p.x,
            y: p.y + (bottom[i].y - p.y) * f,
          }));
          dashPolyline(wave(densifyRun(pts), down), false);
        }
        break;
      }

      fillLines();
      break;
    }

    case 'crystal': {
      // Druzy lining: tapered rays radiating from the region centre toward
      // the silhouette, with jittered reach — the length scatter is the
      // sparkle. On a non-innermost band the carve clips the fan's middle
      // out, leaving spikes fringing the annulus wall for free. Regions
      // without silhouette geometry (the background field, spiral ribbon
      // cells) fall back to ruled lines.
      if (!region.radial) {
        fillLines();
        break;
      }
      const { cx, cy, rx, ry, table } = region.radial;
      const n = table.length;
      let rAvg = 0;
      for (let j = 0; j < n; j++) {
        const theta = (j / n) * Math.PI * 2;
        rAvg += table[j] * Math.hypot(Math.cos(theta) * rx, Math.sin(theta) * ry);
      }
      rAvg /= n;
      const tableAt = (theta: number): number => {
        const f = ((theta / (Math.PI * 2)) * n + n) % n;
        const j = Math.floor(f);
        return table[j] + (table[(j + 1) % n] - table[j]) * (f - j);
      };
      const rays = Math.round(
        Math.min(600, Math.max(16, (Math.PI * 2 * rAvg) / (t.spacing * 1.15)))
      );
      for (let i = 0; i < rays && ink.length < REGION_LINE_CAP; i++) {
        const theta = ((i + (rng() - 0.5) * 0.6) / rays) * Math.PI * 2;
        const g = tableAt(theta);
        const ex = Math.cos(theta) * rx;
        const ey = Math.sin(theta) * ry;
        const s0 = g * (0.06 + 0.3 * rng());
        // Every ~4th ray reaches the wall so the band edge reads lined.
        const s1 = g * (i % 4 === 0 ? 0.97 : 0.55 + 0.4 * rng());
        if (s1 <= s0) continue;
        const tip = { x: cx + ex * s1, y: cy + ey * s1 };
        emitTapered({ x: cx + ex * s0, y: cy + ey * s0 }, tip);
        // Occasional chevron tip: the angular termination of a crystal face.
        if (rng() < 0.3) {
          const len = Math.hypot(ex, ey) * (s1 - s0) || 1;
          const ux = (ex * (s1 - s0)) / len;
          const uy = (ey * (s1 - s0)) / len;
          const wing = t.spacing * 0.8;
          const spreadA = (20 * Math.PI) / 180;
          const back = (a: number): Point => ({
            x: tip.x - (ux * Math.cos(a) - uy * Math.sin(a)) * wing,
            y: tip.y - (ux * Math.sin(a) + uy * Math.cos(a)) * wing,
          });
          push(ink, [back(spreadA), tip, back(-spreadA)]);
        }
      }
      break;
    }

    case 'hatch': {
      // Chopped into short marks rather than band-long rules: real hatching is
      // built from strokes the hand can make in one go.
      sweep(t.angleRad, t.spacing, openGate, 0, undefined, t.spacing * 30);
      break;
    }

    case 'patchy': {
      // The edge band is load-bearing: holes eating into the run ends would
      // shred the crisp seam edge the whole layered look depends on.
      // Sampled well under the hole size — at the default piece length the
      // organic patch mask came out as blocky rectangular steps.
      sweep(
        t.angleRad,
        t.spacing,
        patchKeep,
        t.spacing * 2.5,
        undefined,
        t.spacing * 30,
        Math.min(8, patchScale / 4)
      );
      break;
    }

    case 'cross': {
      sweep(t.angleRad, t.spacing, openGate, 0, undefined, t.spacing * 30);
      // Second family at a shallow offset (a woven 90° grid reads mechanical),
      // lightly gated so the weave builds up in worked patches.
      const ang2 = t.angleRad + (32 * Math.PI) / 180;
      const gate = (x: number, y: number): boolean =>
        noise.noise2D(x / patchScale + 41.7, y / patchScale) >
        -1 + Math.max(0.25, t.patchiness) * 1.2;
      sweepHatch(
        ink,
        poly,
        (ang2 * 180) / Math.PI,
        t.spacing * 1.25 * TONE_REF,
        tone,
        gate,
        '',
        craft,
        undefined,
        t.spacing * 30,
        { edgeKeepPx: 0, phase01: 1 - t.phase, pieceLenPx: Math.min(8, patchScale / 4) }
      );
      break;
    }

    case 'mottle': {
      // The noise-texture module's interleaved grating, verbatim: two
      // same-pitch line families whose inter-family offset drifts across
      // the block, along each line, and by noise, so the families weave
      // between sitting on top of one another (paper shows through) and
      // spreading into an even fill — generateOverlappedLines IS the
      // mechanism, run over the region bbox and clipped to the band.
      // Patchiness scales the whole deviation budget (0 = clean even
      // interleave); at 0.55 the module's default-look ratios reproduce
      // exactly. Families keep their identity as fam-K markers so the
      // carve can plot each in its own ink (the module's riso weave).
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (const p of poly) {
        if (p.x < bx0) bx0 = p.x;
        if (p.y < by0) by0 = p.y;
        if (p.x > bx1) bx1 = p.x;
        if (p.y > by1) by1 = p.y;
      }
      // Module spacing is the per-ink pitch; two interleaved inks put the
      // overall pitch back at t.spacing, so band tone matches the table.
      const s = t.spacing * 2;
      const rngM = makeRandom(subSeed(t.seed, 2));
      const woven = generateOverlappedLines({
        width: bx1 - bx0,
        height: by1 - by0,
        margin: 0,
        // Module 0° = vertical (dx=sin,dy=cos); lapidary 90° = vertical.
        angleDeg: 90 - (t.angleRad * 180) / Math.PI,
        spacingPx: s,
        colorCount: 2,
        // Hotter than the module's default ratios (across 0.75·s, noise
        // 0.3·s): band pitches are roughly half the module's default and
        // the sheet-wide wobble pass runs on top, so the deviation budget
        // must clear both for the weave to read. At 0.55 the across ramp
        // sweeps ±1·s (two full pitches of crossing per band width).
        phaseDriftAcrossPx: s * 1.8 * t.patchiness,
        phaseNoiseAmpPx: s * 0.8 * t.patchiness,
        phaseNoiseScale: 1 / Math.max(64, s * 16),
        // Seeded down-line weave, direction dealt per band.
        phaseDriftAlongPx: s * (rngM() * 2 - 1) * 0.8 * t.patchiness,
        jitterPx: s * 0.05,
        wobbleAmpPx: 0, // the sheet-wide hand-drawn pass runs downstream
        edgeSmoothPx: 0, // bbox edges are not the silhouette
        seed: subSeed(t.seed, 2),
        optimize: false, // the whole plot is optimized at the end
      });
      const minKeep = t.spacing * 0.8;
      for (const line of woven.lines) {
        if (ink.length >= REGION_LINE_CAP) break;
        const fam = line.layer === bandLayerName(0) ? 'fam-0' : 'fam-1';
        // Re-densify at the wobble step (the module samples at up to 8px)
        // and clip to the band silhouette.
        let kept: Point[] = [];
        const flush = (): void => {
          if (kept.length >= 2) {
            let l = 0;
            for (let i = 1; i < kept.length; i++) {
              l += Math.hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y);
            }
            if (l >= minKeep && ink.length < REGION_LINE_CAP) {
              ink.push({ points: kept, layer: fam });
            }
          }
          kept = [];
        };
        for (let i = 1; i < line.points.length; i++) {
          const a = line.points[i - 1];
          const b = line.points[i];
          const seg = densify(
            { x: a.x + bx0, y: a.y + by0 },
            { x: b.x + bx0, y: b.y + by0 },
            fineStep
          );
          for (let j = i === 1 ? 0 : 1; j < seg.length; j++) {
            const q = seg[j];
            if (pointInPolygon(poly, q.x, q.y)) kept.push(q);
            else flush();
          }
        }
        flush();
      }
      break;
    }

    case 'grain': {
      // Stone grain: short curved dashes combed along one shared noise flow
      // field, lengths stretched by a decorrelated fBm — reads as worked
      // material, distinct from stipple's isotropic ticks and wavy's
      // unbroken combing. Waviness is the bend knob.
      const grainNoise = createNoise(subSeed(t.seed, 3));
      const flowScale = Math.max(36, t.spacing * 16);
      const bend = 0.7 * (0.4 + 0.6 * t.waviness);
      const dir = (x: number, y: number): number =>
        t.angleRad + bend * grainNoise.fbm(x / flowScale, y / flowScale, 3, 0.5, 2);
      // Seed pitch and dash lengths tuned together: at 1.4× pitch with
      // longer dashes the overlap reads near-solid fur, not grain.
      const pitch = t.spacing * 1.7;
      const minKeep = t.spacing * 1.2;
      {
        for (const [sx, sy] of blueNoiseSeeds(poly, pitch, tone, rng)) {
          // The +41.7 domain offset decorrelates length from direction
          // (the cross-gate idiom).
          const v =
            0.5 +
            0.5 * grainNoise.fbm(sx / (flowScale * 0.6) + 41.7, sy / (flowScale * 0.6), 2, 0.5, 2);
          const half = t.spacing * (2.2 + 3.8 * v) * 0.5;
          // Walk the streamline both ways from the seed, re-sampling the
          // flow each step (curved dashes); raw polylines — the wobble
          // pass supplies the hand feel.
          const pts: Point[] = [{ x: sx, y: sy }];
          for (const sgn of [1, -1] as const) {
            let x = sx;
            let y = sy;
            let s = 0;
            while (s < half) {
              const a = dir(x, y);
              x += Math.cos(a) * fineStep * sgn;
              y += Math.sin(a) * fineStep * sgn;
              s += fineStep;
              if (!pointInPolygon(poly, x, y)) break;
              if (sgn === 1) pts.push({ x, y });
              else pts.unshift({ x, y });
            }
          }
          let l = 0;
          for (let i = 1; i < pts.length; i++) {
            l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          }
          if (l >= minKeep) pushCrafted(pts, 0.07, 0.05);
        }
      }
      break;
    }

    case 'wavy': {
      // Deform first, clip after: the family is generated across the
      // polygon's bounding box, bent by ONE page-space fBm field (adjacent
      // lines wave coherently, like combed hair), and only then cut to the
      // silhouette — deforming clipped runs would fuzz the blob edge, and
      // the crisp silhouette is the whole point of the halo seam.
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (const p of poly) {
        if (p.x < bx0) bx0 = p.x;
        if (p.y < by0) by0 = p.y;
        if (p.x > bx1) bx1 = p.x;
        if (p.y > by1) by1 = p.y;
      }
      const box: Point[] = [
        { x: bx0, y: by0 },
        { x: bx1, y: by0 },
        { x: bx1, y: by1 },
        { x: bx0, y: by1 },
      ];
      // Amplitude rides the wavelength, not the pitch: tightly pitched wavy
      // lines still need visible waves (the reference's combed ring swings
      // several pitches wide), and one shared page-space field keeps
      // neighbours combing together.
      const lambda = Math.max(36, t.spacing * 16);
      const amp = t.waviness * lambda * 0.16;
      const minKeep = t.spacing * 0.8;
      // The family is marched by hand rather than via `hatchPolygon` so the
      // pitch can follow the tone field — combed hair crowds where the form
      // turns away. Deform-then-clip is unchanged and load-bearing.
      const dirx = Math.cos(t.angleRad);
      const diry = Math.sin(t.angleRad);
      const nx0 = -diry;
      const ny0 = dirx;
      let sMin = Infinity;
      let sMax = -Infinity;
      for (const p of box) {
        const u = p.x * nx0 + p.y * ny0;
        if (u < sMin) sMin = u;
        if (u > sMax) sMax = u;
      }
      const rows: Array<[Point, Point]> = [];
      let u = sMin + t.phase * t.spacing;
      let guard = 0;
      while (u <= sMax && guard++ < 4000) {
        const O = { x: nx0 * u, y: ny0 * u };
        const spans = clipLineToPolygon(box, O, { x: dirx, y: diry });
        let mid = 0.5;
        for (const [a, b] of spans) {
          rows.push([
            { x: O.x + dirx * a, y: O.y + diry * a },
            { x: O.x + dirx * b, y: O.y + diry * b },
          ]);
          mid = (a + b) / 2;
        }
        const mx = O.x + dirx * mid;
        const my = O.y + diry * mid;
        u += Math.max(t.spacing * 0.55, (t.spacing * TONE_REF) / Math.max(0.18, tone(mx, my)));
      }
      for (const run of rows) {
        const base = densify(run[0], run[1], fineStep);
        const dx = run[1].x - run[0].x;
        const dy = run[1].y - run[0].y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        let kept: Point[] = [];
        const flush = (): void => {
          if (kept.length >= 2) {
            let l = 0;
            for (let i = 1; i < kept.length; i++) {
              l += Math.hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y);
            }
            if (l >= minKeep) pushCrafted(kept, 0.04, 0.04);
          }
          kept = [];
        };
        for (const p of base) {
          const d = amp * noise.fbm(p.x / lambda, p.y / lambda, 2, 0.5, 2);
          const q = { x: p.x + nx * d, y: p.y + ny * d };
          if (pointInPolygon(poly, q.x, q.y)) kept.push(q);
          else flush();
        }
        flush();
      }
      break;
    }

    case 'stipple': {
      const pitch = t.spacing;
      for (const [x, y] of blueNoiseSeeds(poly, pitch, tone, rng)) {
        const ang = rng() * Math.PI * 2;
        // Tick half-length rides the pitch (≈0.35-0.65 px at the default
        // stipple pitch) so dots keep their weight on big sheets instead of
        // staying sub-pixel while everything else scales.
        const l = pitch * (0.045 + rng() * 0.04);
        push(ink, [
          { x: x - Math.cos(ang) * l, y: y - Math.sin(ang) * l },
          { x: x + Math.cos(ang) * l, y: y + Math.sin(ang) * l },
        ]);
      }
      break;
    }
  }

  return { ink, phantom: [] };
}
