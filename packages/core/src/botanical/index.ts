/**
 * Botanical generator — procedurally grown, plottable pen-and-ink plants aimed at a
 * botanical-illustration look. Pure, ML-free, DOM-free, deterministic per seed.
 *
 * Two growth models, switchable:
 *   - `growth`        — recursive tip-growth steered by a simplex curl field
 *                       (optionally along a composed master gesture) with an
 *                       upward gravitropism bias and stochastic side-branches.
 *   - `colonization`  — Runions-style space colonization: attractor points pull
 *                       branches toward them and are consumed as they're reached.
 *
 * Rendering follows the toolbox's "hatching follows form" house style rather
 * than flat fills. Every drawn thing is an *element* with a closed silhouette
 * and a depth order; a final pass models form with light-directional hatching
 * and removes hidden lines so overlaps read as real depth:
 *   - Stems are rounded tubes: tapered outline + along-axis hatching on the
 *     shadow side.
 *   - Leaves are curved blades with a species shape, branching veins, optional
 *     foreshortening, and shadow hatching.
 *   - The page is composed (a master gesture to a focal point, with negative
 *     space) for the `specimen` composition.
 *
 * Lines are tagged with a `layer` (`stem` / `leaf` / `vein` / `tendril` /
 * `flower`) so a caller can plot each element with its own pen.
 */
import { FlowLine, FlowLinesResult, Point } from '../flow-lines.js';
import { createNoise } from '../noise.js';
import { applyHandDrawnStyle } from '../hand-drawn.js';
import { getSketchStyleConfig } from '../sketch-styles.js';
import { makeRandom, randomSeed, subSeed } from '../lib/rng.js';
import { smoothPolyline, pointInPolygon, clipPolylineToRect } from '../lib/polyline.js';
import { traceIsoContours } from '../iso-contours.js';
import { FillShape, Root, Stem, BotanicalComposition, BotanicalMode, BotanicalSeeding, BotanicalOptions, BotanicalSupport, BotanicalVessel } from './types.js';
import { LINE_CAP, ProximityGrid, ZBuffer, polylineLength, smoothstep } from '../lib/spatial.js';
import { colonize, growStems } from './growth.js';
import { VESSEL_SPECS, buildGround, buildStem, buildSupport, buildVessel, supportClimbPaths } from './structures.js';
import { decorate, makeThorns } from './decoration.js';

export type {
  BotanicalOptions, BotanicalMode, BotanicalSeeding, BotanicalFill, LeafStyle, BotanicalComposition, LeafType, StemShade,
  BotanicalFlower, FillShape, SketchStyle, BotanicalVessel, LeafArrangement, Phyllotaxis, Inflorescence,
  FruitType, BotanicalSupport, StemTexture,
} from './types.js';

/** A drawable element: its marks and a closed silhouette for occlusion. Draw
 *  order is plain creation order (stems first, then foliage in front); each
 *  element's index is its z, so every element occludes its neighbours cleanly. */
interface Element {
  lines: FlowLine[];
  silhouette: Point[][];
}

/** Contact shadows: where a nearer element sits between a surface and the light,
 *  lay short hatch strokes on that surface (the away-from-light side of the
 *  occluder), so overlapping elements read as casting shadows onto each other. */
function castShadows(
  zbuf: ZBuffer,
  light: Point,
  width: number,
  height: number,
  penPx: number,
  strength: number,
  cap: number
): FlowLine[] {
  const lines: FlowLine[] = [];
  const ang = Math.atan2(light.y, light.x) + Math.PI / 2; // strokes run along the shadow edge
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const dist = penPx * (2.5 + strength * 6); // how far an occluder's shadow reaches
  const spacing = penPx * (1.4 + (1 - strength) * 2.4);
  const cx = width / 2;
  const cy = height / 2;
  const half = Math.hypot(width, height) / 2 + spacing;
  for (let v = -half; v <= half && lines.length < cap; v += spacing) {
    let run: Point[] = [];
    for (let u = -half; u <= half; u += penPx) {
      const x = cx + dx * u + nx * v;
      const y = cy + dy * u + ny * v;
      const zp = zbuf.zAt(x, y);
      const shadowed = zp >= 0 && zbuf.zAt(x + light.x * dist, y + light.y * dist) > zp + 0.5;
      if (shadowed) {
        run.push({ x, y });
      } else if (run.length >= 2) {
        lines.push({ points: run, layer: 'shadow' });
        run = [];
      } else {
        run = [];
      }
    }
    if (run.length >= 2) lines.push({ points: run, layer: 'shadow' });
  }
  return lines;
}

export function generateBotanical(options: BotanicalOptions): FlowLinesResult {
  const {
    width,
    height,
    margin = 20,
    seed = randomSeed(),
    mode = 'growth',
    composition = 'specimen',
    fillShape = 'circle',
    fillOutline = true,
    seeding = 'scatter',
    startPoints = [],
    seedCount = 6,
    stepLength = 6,
    // Growth and organ sizes default relative to the page, so an A3 sheet grows
    // an A3-sized plant instead of an A6 plant floating in blank paper. The
    // factors reproduce the old fixed defaults (320 / 8 / 26 / 30 / 18) at the
    // classic 800×1000 canvas. Explicit caller values always win.
    maxLength = Math.min(width, height) * 0.4,
    curl = 0.5,
    noiseScale = 0.004,
    gravitropism = 0.4,
    branchProb = 0.04,
    maxDepth = 4,
    attractorCount = 600,
    attractorRadius = 90,
    killRadius = 16,
    stemWidth = Math.max(5, Math.min(width, height) * 0.01),
    penWidth = 1,
    taper = 0.85,
    stemFill = 'shaded',
    avoidOverlap = true,
    lightAngle = -135,
    shadeDensity = 0.5,
    stemShade = 'along',
    stemTexture = 'none',
    occlude = true,
    sketch = 0,
    sketchStyle = 'loose',
    castShadow = 0.35,
    density = 0.45,
    leaves = true,
    leafStyle = 'shaded',
    leafType = 'ovate',
    veins = true,
    leafSize = Math.min(width, height) * 0.033,
    leafWidthRatio = 0.5,
    leafSpacing = leafSize * 1.15,
    leafArrangement = 'simple',
    leafletCount = 5,
    phyllotaxis = 'alternate',
    whorlCount = 3,
    tendrils = true,
    tendrilProb = 0.12,
    flowers = true,
    flowerType = 'rose',
    flowerProb = 0.2,
    flowerSize = Math.min(width, height) * 0.023,
    inflorescence = 'none',
    floretCount = 8,
    thorns = false,
    thornProb = 0.15,
    fruitType = 'none',
    fruitProb = 0.2,
    dewdrops = false,
    dewdropProb = 0.15,
    wobble = 0.6,
    vessel = 'none',
    groundLine = false,
    negativeSpace = 0,
    tonalMassing = 0,
    valueBands = 0,
    guidePaths,
    support = 'none',
  } = options;

  const penPx = Math.max(0.6, penWidth);
  const baseHalf = Math.max(penPx, stemWidth / 2);
  const spacing = options.spacing ?? stemWidth + penPx * 2;
  const lr = (lightAngle * Math.PI) / 180;
  const light: Point = { x: Math.cos(lr), y: Math.sin(lr) };

  // Reserve a decoration border: leaves/flowers are placed *at* stem points and
  // reach outward from them, so the skeleton (roots, guides, growth bounds) is
  // composed inside `growMargin` — far enough from the true margin that the
  // foliage hung off it lands inside the page rather than being clipped at the
  // edge on every plot. Sized for the typical leaf / single bloom (compound
  // leaves reach further); capped so small pages aren't over-inset. Rare large
  // inflorescences / focal-boosted blooms may still touch and get clipped by the
  // final margin clip — the accepted edge case. Deterministic (no rng).
  const leafReach = leaves ? leafSize * (leafArrangement === 'simple' ? 1.5 : 2.0) : 0;
  const flowerReach = flowers ? flowerSize * 1.6 : 0;
  const decorReserve = Math.min(Math.max(leafReach, flowerReach), Math.min(width, height) * 0.15);
  const growMargin = margin + decorReserve;

  const rng = makeRandom(seed);
  const noise = createNoise(seed);

  const growthGrid = new ProximityGrid(width, height, Math.max(1, spacing));

  // The scene value field: one scalar mass-weight over the page (1 = full mass /
  // dense / dark, →0 = thin / open / lit). It folds together deliberate negative
  // space (notan: hold a third clear) and light-driven tonal massing (swell the
  // shadow side, open the lit side, commit a few value masses). Null when both
  // are off, so the rng sequence — and every existing render — is byte-identical
  // unless one is dialled up.
  const weightAt = makeValueField(width, height, margin, seed, light, negativeSpace, tonalMassing, valueBands);
  // Growth and root placement follow *only* the notan component, not the light
  // gradient: tonal massing concentrates foliage and tone, but the architecture
  // (stem length, branching, where roots start) stays even — as in real
  // botanical drawing, where the canopy masses tonally while the branches don't
  // retreat from the lit side. A broad light gradient driving the growth
  // early-stop would otherwise truncate the whole gesture on its lit half. Null
  // when negative space is off, so this is byte-identical to a non-notan render.
  const growthWeightAt = makeMassWeight(width, height, margin, seed, negativeSpace);

  // A drawn vessel the arrangement rises out of (bouquet/specimen): the stems
  // are based at its mouth, and it occludes their lower ends.
  const vesselSpec = vessel !== 'none' ? VESSEL_SPECS[vessel as Exclude<BotanicalVessel, 'none'>] : undefined;
  const wantsVessel = !!vesselSpec && (composition === 'bouquet' || composition === 'specimen');
  let baseOverride: Point | undefined;
  let vesselBuilt: { lines: FlowLine[]; silhouette: Point[][] } | null = null;
  let vesselShadow: FlowLine[] = [];
  let vesselBottomY = height - margin;
  if (wantsVessel) {
    const spec = vesselSpec!;
    vesselBottomY = height - margin;
    // Sized to anchor the arrangement; per-vessel factors keep proportions
    // (a bowl is wide and low, an amphora tall and narrow).
    const vesselH = Math.min(height * 0.26, (height - 2 * margin) * 0.34) * spec.h;
    const topY = vesselBottomY - vesselH;
    const cx = startPoints[0]?.x ?? width / 2;
    const mouthHalf = Math.max(20, (width - 2 * margin) * 0.13) * spec.w;
    baseOverride = { x: cx, y: topY };
    const v = buildVessel(cx, topY, vesselBottomY, mouthHalf, vessel, light, penPx, shadeDensity, castShadow, seed);
    vesselBuilt = { lines: v.lines, silhouette: v.silhouette };
    vesselShadow = v.shadow;
  }

  // Composition routes the growth: `fill` colonizes a region; `free` respects
  // the mode/seeding; everything else grows along composed guide curves.
  let rawStems: Stem[];
  const focals: Point[] = [];
  let fillRegion: { inside: (x: number, y: number) => boolean; boundary: Point[][] } | null = null;
  if (composition === 'fill') {
    const region = buildRegion(fillShape, startPoints, width, height, growMargin);
    fillRegion = region;
    const fillRoots: Root[] = region.seeds.map((p) => ({ x: p.x, y: p.y, angle: -Math.PI / 2, half: baseHalf, maxLength }));
    rawStems = colonize(fillRoots, { width, height, margin: growMargin, stepLength, attractorCount: Math.max(attractorCount, 700), attractorRadius, killRadius }, rng, baseHalf, penPx, maxLength, region.inside, region.boundary);
  } else if (composition === 'free' && mode === 'colonization') {
    const roots = makeRoots({ width, height, margin: growMargin, mode, composition, seeding, startPoints, seedCount, baseHalf, maxLength, weightAt: growthWeightAt }, rng);
    rawStems = colonize(roots, { width, height, margin: growMargin, stepLength, attractorCount, attractorRadius, killRadius }, rng, baseHalf, penPx, maxLength, undefined);
  } else {
    const roots = makeRoots({ width, height, margin: growMargin, mode, composition, seeding, startPoints, seedCount, baseHalf, maxLength, weightAt: growthWeightAt, baseOverride, guidePaths, support }, rng);
    // The specimen's focal point is the end of its master gesture.
    if (composition === 'specimen' && roots[0]?.guide) focals.push(roots[0].guide[roots[0].guide.length - 1]);
    // A wreath gets 2–3 deliberate bloom clusters spread around the ring at
    // golden-angle offsets — real wreaths mass their flowers in a few designed
    // groups, not evenly (nor wherever per-tip dice happen to land).
    if (composition === 'wreath') {
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width - 2 * growMargin, height - 2 * growMargin) * 0.42;
      const clusters = 2 + (rng() < 0.5 ? 1 : 0);
      const a0 = rng() * Math.PI * 2;
      for (let c = 0; c < clusters; c++) {
        const a = a0 + c * 2.39996323;
        focals.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      }
    }
    // A wreath's arcs — and a 'guide' composition's traced paths — are *designed*
    // to overlap (a closed ring, a self-crossing letterform), so the proximity
    // break (which would stop each stem as it nears another and tear the shape)
    // is disabled for them.
    const useGrid = avoidOverlap && composition !== 'wreath' && composition !== 'guide' ? growthGrid : null;
    rawStems = growStems(roots, { width, height, margin: growMargin, stepLength, curl, noiseScale, gravitropism, branchProb, maxDepth }, rng, noise, useGrid, spacing, growthWeightAt);
  }

  // Smooth (heavily, for flowing curves) then add a touch of wobble.
  const centerlines = rawStems.map((s) => smoothPolyline(s.points, 3));
  const wobbled = applyHandDrawnStyle(
    { lines: centerlines.map((points) => ({ points })), width, height, seed },
    { amplitude: wobble, wavelength: 90, seed }
  ).lines.map((l) => l.points);

  const elements: Element[] = [];
  const add = (lines: FlowLine[], silhouette: Point[][]): void => {
    elements.push({ lines, silhouette });
  };

  // Page furniture sits behind everything: a trellis support (no silhouette, so
  // the climbers draw over it), the ground line, then the vessel, then the
  // stems and foliage in front.
  // The fill region's rim, inked as a light broken outline behind the growth:
  // the pen lifts and resumes so it reads as a suggestion, not a coloring-book
  // border — but it's what lets the shape read at arm's length.
  if (fillRegion && fillOutline) {
    const dashes: FlowLine[] = [];
    for (const loop of fillRegion.boundary) {
      let run: Point[] = [];
      let acc = 0;
      let target = 30 + rng() * 40; // current dash length
      let gap = 0; // remaining pen-up arc; > 0 = travelling, not drawing
      for (let i = 1; i < loop.length; i++) {
        const seg = Math.hypot(loop[i].x - loop[i - 1].x, loop[i].y - loop[i - 1].y);
        if (gap > 0) {
          gap -= seg;
          if (gap <= 0) {
            acc = 0;
            target = 30 + rng() * 40;
          }
          continue;
        }
        if (run.length === 0) run.push(loop[i - 1]);
        run.push(loop[i]);
        acc += seg;
        if (acc >= target) {
          if (run.length >= 2) dashes.push({ points: smoothPolyline(run, 1), layer: 'stem' });
          run = [];
          gap = 8 + rng() * 16;
        }
      }
      if (run.length >= 2) dashes.push({ points: smoothPolyline(run, 1), layer: 'stem' });
    }
    const outl = applyHandDrawnStyle(
      { lines: dashes, width, height, seed: seed + 137 },
      { amplitude: Math.max(wobble, 0.5), wavelength: 60, seed: seed + 137 }
    ).lines;
    add(outl, []);
  }

  let supportLines: FlowLine[] = [];
  if (composition === 'trellis' && support !== 'none') {
    supportLines = applyHandDrawnStyle(
      { lines: buildSupport(support, width, height, margin, penPx), width, height, seed: seed + 333 },
      { amplitude: Math.max(wobble, 0.4), wavelength: 80, seed: seed + 333 }
    ).lines;
    add(supportLines, []);
  }
  if (groundLine) {
    const g = applyHandDrawnStyle(
      { lines: [buildGround(width, height, margin, wantsVessel ? vesselBottomY : undefined, wobble)], width, height, seed: seed + 511 },
      { amplitude: wobble, wavelength: 120, seed: seed + 511 }
    ).lines;
    add(g, []);
  }
  // The vessel's cast shadow lies on the ground behind it (no silhouette, so the
  // vessel occludes the part beneath its foot) — this grounds the whole
  // arrangement in space, which is what stops the arrangement reading as flat.
  if (vesselShadow.length > 0) {
    const sl = applyHandDrawnStyle(
      { lines: vesselShadow, width, height, seed: seed + 911 },
      { amplitude: Math.max(wobble * 0.5, 0.3), wavelength: 70, seed: seed + 911 }
    ).lines;
    add(sl, []);
  }
  if (vesselBuilt) {
    // Run the vessel through the same hand-drawn wobble the stem centerlines
    // get, so its outline and cross-contour hatching share the stems' line
    // quality instead of reading as a clean, pasted-in object.
    const wl = applyHandDrawnStyle(
      { lines: vesselBuilt.lines, width, height, seed: seed + 701 },
      { amplitude: Math.max(wobble, 0.5), wavelength: 44, seed: seed + 701 }
    ).lines;
    add(wl, vesselBuilt.silhouette);
  }

  // Stems (created first, so they sit behind the foliage). Thorns ride on the
  // stem element so they share the cane's depth (and only draw when enabled, so
  // the rng sequence is otherwise byte-identical to a thornless render).
  wobbled.forEach((center, i) => {
    const st = rawStems[i];
    const built = buildStem(center, st.baseHalf, { penPx, taper, stemFill, light, shadeDensity, stemShade, stemTexture, branch: st.branch });
    const thornLines = thorns ? makeThorns(center, st.baseHalf, thornProb, penPx, rng) : [];
    add([...built.lines, ...thornLines], built.silhouette);
  });

  const focalR = Math.min(width, height) * 0.24;

  // Decorations, created after their stem so they draw (and occlude) in front.
  decorate(
    wobbled.map((points) => ({ points })),
    {
      leaves, leafStyle, leafType, veins, leafSize, leafWidthRatio, leafSpacing,
      leafArrangement, leafletCount, phyllotaxis, whorlCount,
      tendrils, tendrilProb, flowers, flowerType, flowerProb, flowerSize, penPx, light, shadeDensity,
      inflorescence, floretCount, fruitType, fruitProb, dewdrops, dewdropProb,
      // A fill composition floors the foliage density (a sparse fill never
      // reads as its shape) and clips decorations to the region so leaves
      // don't fuzz the silhouette they're supposed to define.
      focals, focalR, density: fillRegion ? Math.max(density, 0.6) : density, weightAt, shadeMass: tonalMassing,
      insideRegion: fillRegion?.inside,
    },
    rng,
    add
  );

  // Over/under weave: where a climber crosses a support member, every other
  // crossing redraws a short strip of that member ON TOP with a slim occluding
  // silhouette, so the cane reads as ducking behind the lattice there — trained
  // through the structure, not taped onto its front. Near-parallel touches
  // (a cane running *along* a diagonal it follows) don't count as crossings.
  if (occlude && composition === 'trellis' && support !== 'none' && supportLines.length > 0) {
    const overLines: FlowLine[] = [];
    const overSils: Point[][] = [];
    const stripHalf = Math.max(penPx * 1.6, stemWidth * 0.35);
    const stripLen = stemWidth * 1.6 + penPx * 4;
    for (const center of wobbled) {
      let parity = 0;
      let lastX = Infinity;
      let lastY = Infinity;
      for (let i = 1; i < center.length; i++) {
        const a0 = center[i - 1];
        const a1 = center[i];
        for (const ml of supportLines) {
          const mp = ml.points;
          for (let j = 1; j < mp.length; j++) {
            const b0 = mp[j - 1];
            const b1 = mp[j];
            // Cheap reject, then segment intersection.
            if (Math.max(a0.x, a1.x) < Math.min(b0.x, b1.x) - 1 || Math.min(a0.x, a1.x) > Math.max(b0.x, b1.x) + 1) continue;
            if (Math.max(a0.y, a1.y) < Math.min(b0.y, b1.y) - 1 || Math.min(a0.y, a1.y) > Math.max(b0.y, b1.y) + 1) continue;
            const d1x = a1.x - a0.x;
            const d1y = a1.y - a0.y;
            const d2x = b1.x - b0.x;
            const d2y = b1.y - b0.y;
            const den = d1x * d2y - d1y * d2x;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((b0.x - a0.x) * d2y - (b0.y - a0.y) * d2x) / den;
            const s = ((b0.x - a0.x) * d1y - (b0.y - a0.y) * d1x) / den;
            if (t < 0 || t > 1 || s < 0 || s > 1) continue;
            // Skip near-parallel touches (following, not crossing).
            const cosang = Math.abs(d1x * d2x + d1y * d2y) / ((Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y)) || 1);
            if (cosang > 0.94) continue;
            const qx = a0.x + d1x * t;
            const qy = a0.y + d1y * t;
            // One crossing per neighbourhood, so wobble can't double-count.
            if (Math.hypot(qx - lastX, qy - lastY) < stripLen) continue;
            lastX = qx;
            lastY = qy;
            parity++;
            if (parity % 2 === 1) continue; // cane passes in front here
            const ux = d2x / (Math.hypot(d2x, d2y) || 1);
            const uy = d2y / (Math.hypot(d2x, d2y) || 1);
            overLines.push({ points: [{ x: qx - ux * stripLen, y: qy - uy * stripLen }, { x: qx + ux * stripLen, y: qy + uy * stripLen }], layer: 'stem' });
            overSils.push([
              { x: qx - ux * stripLen - uy * stripHalf, y: qy - uy * stripLen + ux * stripHalf },
              { x: qx + ux * stripLen - uy * stripHalf, y: qy + uy * stripLen + ux * stripHalf },
              { x: qx + ux * stripLen + uy * stripHalf, y: qy + uy * stripLen - ux * stripHalf },
              { x: qx - ux * stripLen + uy * stripHalf, y: qy - uy * stripLen - ux * stripHalf },
            ]);
          }
        }
      }
    }
    if (overLines.length > 0) add(overLines, overSils);
  }

  // Hidden-line removal: treat every element as a solid object — rasterize its
  // silhouette into a z-buffer in creation order (each element's index is its
  // z, distinct integers so neighbours occlude cleanly) and drop any line
  // beneath a covered area, so things in front cleanly hide what's behind.
  let outLines: FlowLine[];
  if (occlude) {
    const zbuf = new ZBuffer(width, height, Math.max(1, penPx * 0.75));
    for (let id = 0; id < elements.length; id++) for (const poly of elements[id].silhouette) zbuf.fill(poly, id);
    outLines = [];
    for (let id = 0; id < elements.length; id++) {
      const el = elements[id];
      for (const ln of el.lines) {
        for (const run of clipHidden(ln.points, id, zbuf, penPx * 2.5)) {
          outLines.push({ ...ln, points: run });
          if (outLines.length >= LINE_CAP) break;
        }
      }
    }
    // Contact shadows from overlapping elements, drawn on top of the surfaces
    // they fall on (they're not themselves occluded).
    if (castShadow > 0.01 && outLines.length < LINE_CAP) {
      for (const s of castShadows(zbuf, light, width, height, penPx, castShadow, LINE_CAP - outLines.length)) {
        outLines.push(s);
      }
    }
  } else {
    outLines = elements.flatMap((el) => el.lines);
  }

  // Sketchy overdraw: redraw every line a few times with low-frequency wobble.
  // The style sets the character (passes / wobble wavelength / amplitude /
  // jitter); `sketch` is the intensity.
  if (sketch > 0.01) {
    const { passes, wavelength, amplitude, jitter } = getSketchStyleConfig(sketchStyle, sketch);
    if (outLines.length * passes < LINE_CAP) {
      const acc: FlowLine[] = [];
      for (let p = 0; p < passes; p++) {
        const styled = applyHandDrawnStyle(
          { lines: outLines, width, height, seed: subSeed(seed, p) },
          { amplitude, wavelength, jitter, seed: subSeed(seed, p) }
        ).lines;
        for (const l of styled) acc.push(l);
      }
      outLines = acc;
    }
  }

  // Keep the margin clear: clip every line to the inner box so foliage, blooms
  // and wobble that overhang the stems' growth bounds don't spill into the
  // plotter's clear border. Done last, after wobble/sketch have moved points.
  if (margin > 0) {
    const x0 = margin;
    const y0 = margin;
    const x1 = width - margin;
    const y1 = height - margin;
    const clipped: FlowLine[] = [];
    for (const ln of outLines) {
      for (const run of clipPolylineToRect(ln.points, x0, y0, x1, y1)) {
        clipped.push({ ...ln, points: run });
      }
    }
    outLines = clipped;
  }

  return { lines: outLines, width, height, seed };
}

/** Split a polyline into the runs whose points are not hidden by nearer ones. */
function clipHidden(points: Point[], z: number, zbuf: ZBuffer, minLen = 0): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (zbuf.hidden(p.x, p.y, z)) {
      if (run.length >= 2) runs.push(run);
      run = [];
    } else {
      run.push(p);
    }
  }
  if (run.length >= 2) runs.push(run);
  // A stroke that only pokes out of cover for a couple of px reads as an
  // orphaned, disconnected fleck — drop those slivers. Lines that were short
  // to begin with (stipple ticks, stamen strokes) are kept whole.
  if (minLen > 0) {
    const srcLen = polylineLength(points);
    if (srcLen > minLen) return runs.filter((r) => polylineLength(r) >= minLen);
  }
  return runs;
}

// ——— composition & seeding ———

/** An inside-test + interior seed points for a `fill` composition's region:
 *  a centred built-in shape, or the painted polygon (auto-closed). */
function buildRegion(
  shape: FillShape,
  startPoints: Point[],
  width: number,
  height: number,
  margin: number
): { inside: (x: number, y: number) => boolean; seeds: Point[]; boundary: Point[][] } {
  const cx = width / 2;
  const cy = height / 2;
  const rx = (width - 2 * margin) * 0.46;
  const ry = (height - 2 * margin) * 0.46;

  let inside: (x: number, y: number) => boolean;
  if (shape === 'painted' && startPoints.length >= 3) {
    // Smooth the drawn outline; the even-odd test closes it implicitly.
    const poly = smoothPolyline(startPoints, 2);
    inside = (x, y) => pointInPolygon(poly, x, y);
  } else if (shape === 'circle' || shape === 'oval') {
    const ax = shape === 'circle' ? Math.min(rx, ry) : rx;
    const ay = shape === 'circle' ? Math.min(rx, ry) : ry;
    inside = (x, y) => ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2 <= 1;
  } else if (shape === 'diamond') {
    inside = (x, y) => Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
  } else {
    // Heart curve: (x²+y²−1)³ − x²y³ ≤ 0 in normalised, y-up coordinates.
    inside = (x, y) => {
      const nx = (x - cx) / (rx * 1.1);
      const ny = -(y - cy) / (ry * 1.1) + 0.25;
      const a = nx * nx + ny * ny - 1;
      return a * a * a - nx * nx * ny * ny * ny <= 0;
    };
  }

  // Seed points inside the region (centre + interior samples for a stable start).
  const seeds: Point[] = [];
  if (inside(cx, cy)) seeds.push({ x: cx, y: cy });
  let s = 12345;
  for (let i = 0; i < 400 && seeds.length < 4; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = margin + (s / 0x7fffffff) * (width - 2 * margin);
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const y = margin + (s / 0x7fffffff) * (height - 2 * margin);
    if (inside(x, y)) seeds.push({ x, y });
  }
  // Also seed the region's extremities so colonization grows *into* its lobes
  // and points — a heart's two top lobes and bottom tip, a diamond's corners —
  // instead of radiating from a central cluster and rounding the silhouette off
  // into a blob. A coarse grid scan finds the topmost point of each half plus
  // the four cardinal extremes. (Deterministic; no shared rng touched.)
  const GRID = 48;
  let top: Point | null = null, bottom: Point | null = null, leftP: Point | null = null, rightP: Point | null = null, lobeL: Point | null = null, lobeR: Point | null = null;
  for (let iy = 0; iy <= GRID; iy++) {
    const y = margin + (iy / GRID) * (height - 2 * margin);
    for (let ix = 0; ix <= GRID; ix++) {
      const x = margin + (ix / GRID) * (width - 2 * margin);
      if (!inside(x, y)) continue;
      if (!top || y < top.y) top = { x, y };
      if (!bottom || y > bottom.y) bottom = { x, y };
      if (!leftP || x < leftP.x) leftP = { x, y };
      if (!rightP || x > rightP.x) rightP = { x, y };
      if (x < cx && (!lobeL || y < lobeL.y)) lobeL = { x, y };
      if (x > cx && (!lobeR || y < lobeR.y)) lobeR = { x, y };
    }
  }
  for (const e of [top, bottom, leftP, rightP, lobeL, lobeR]) if (e) seeds.push(e);

  // Trace the region's rim (marching squares over a coarse raster of the
  // inside-test) — used three ways: growth is seeded along it, attractors are
  // biased toward it, and it can be inked as a light broken outline. All of
  // which is what makes the *shape* read; colonization radiating from interior
  // seeds alone rounds every silhouette off into a blob.
  const cell = Math.max(4, Math.min(width, height) / 120);
  const gw = Math.max(2, Math.ceil(width / cell) + 1);
  const gh = Math.max(2, Math.ceil(height / cell) + 1);
  const data = new Float32Array(gw * gh);
  for (let iy = 0; iy < gh; iy++) for (let ix = 0; ix < gw; ix++) data[iy * gw + ix] = inside(ix * cell, iy * cell) ? 1 : 0;
  const boundary = traceIsoContours({ width: gw, height: gh, data }, 0.5)
    .map((poly) => poly.map((p) => ({ x: p.x * cell, y: p.y * cell })))
    .filter((poly) => poly.length >= 8);
  // Rim seeds: one every ~70px of boundary, inset a step toward the centroid
  // so the root itself starts inside and grows along the rim.
  const inset = cell * 2.5;
  for (const loop of boundary) {
    let lcx = 0;
    let lcy = 0;
    for (const p of loop) { lcx += p.x; lcy += p.y; }
    lcx /= loop.length;
    lcy /= loop.length;
    let acc = 0;
    for (let i = 1; i < loop.length; i++) {
      acc += Math.hypot(loop[i].x - loop[i - 1].x, loop[i].y - loop[i - 1].y);
      if (acc < 70) continue;
      acc = 0;
      const p = loop[i];
      const dl = Math.hypot(lcx - p.x, lcy - p.y) || 1;
      const q = { x: p.x + ((lcx - p.x) / dl) * inset, y: p.y + ((lcy - p.y) / dl) * inset };
      if (inside(q.x, q.y)) seeds.push(q);
    }
  }

  if (seeds.length === 0) seeds.push({ x: cx, y: cy });
  return { inside, seeds, boundary };
}

interface RootOpts {
  width: number;
  height: number;
  margin: number;
  mode: BotanicalMode;
  composition: BotanicalComposition;
  seeding: BotanicalSeeding;
  startPoints: Point[];
  seedCount: number;
  baseHalf: number;
  maxLength: number;
  /** Negative-space mass weight (1 everywhere when off); biases roots away from
   *  the held-clear region. */
  weightAt?: ((x: number, y: number) => number) | null;
  /** When a vessel is drawn, the arrangement is based at its mouth. */
  baseOverride?: Point;
  /** Guide polylines the stems follow ('guide' composition). */
  guidePaths?: Point[][];
  /** Drawn support the climbers are trained along ('trellis' composition). */
  support?: BotanicalSupport;
}

/** Build the negative-space mass weight: 1 everywhere when off, else low inside
 *  a deterministically-chosen clear third of the page and 1 well away from it.
 *  Returns null when off so callers can keep their rng sequence byte-identical. */
function makeMassWeight(
  width: number,
  height: number,
  margin: number,
  seed: number,
  ns: number
): ((x: number, y: number) => number) | null {
  if (ns <= 0.001) return null;
  // A rule-of-thirds intersection, picked from the seed, is held clear.
  const thirds = [
    { fx: 1 / 3, fy: 1 / 3 }, { fx: 2 / 3, fy: 1 / 3 },
    { fx: 1 / 3, fy: 2 / 3 }, { fx: 2 / 3, fy: 2 / 3 },
  ];
  const ci = (Math.imul(seed >>> 0, 2654435761) >>> 0) % 4;
  const cc = {
    x: margin + thirds[ci].fx * (width - 2 * margin),
    y: margin + thirds[ci].fy * (height - 2 * margin),
  };
  const clearR = 0.5 * Math.min(width, height);
  const strength = Math.min(1, ns);
  return (x, y) => {
    const reduce = smoothstep(1 - Math.hypot(x - cc.x, y - cc.y) / clearR);
    return 1 - strength * reduce;
  };
}

/** The lit side never goes fully bald — it keeps this fraction of the mass so
 *  airy passages still carry a few marks. */
const LIT_FLOOR = 0.15;

/**
 * The scene value field: one scalar mass-weight closure (1 = full mass / dense /
 * dark, →`LIT_FLOOR` = thin / open / lit) that every density, size and
 * shade-intensity site reads from. It folds two illustrator controls into one
 * field so they compose without doubling the rng-gated plumbing:
 *
 *  - **Negative space** (notan) — hold a deterministically-chosen third clear.
 *  - **Tonal massing** — a light-driven gradient (swell the shadow side away
 *    from `light`, open the lit side), then a contrast-commit + optional
 *    posterize borrowed in spirit from the image pipeline's `composeMassPlan`,
 *    so the canopy reads as a few decisive value masses instead of an even veil.
 *
 * Returns null when both are off, so the rng sequence stays byte-identical to a
 * render that never asked for either. When only negative space is on it returns
 * the *exact* legacy notan closure (`makeMassWeight`), so existing notan seeds
 * reproduce. Pure analytic closures — no per-pixel raster/blur — so it's O(1)
 * per query and cheap to rebuild on every render.
 */
function makeValueField(
  width: number,
  height: number,
  margin: number,
  seed: number,
  light: Point,
  negativeSpace: number,
  tonalMassing: number,
  valueBands: number
): ((x: number, y: number) => number) | null {
  const notan = makeMassWeight(width, height, margin, seed, negativeSpace);
  // Massing off → the field is exactly the legacy notan closure (or null). This
  // is what guarantees every existing render is byte-identical.
  if (tonalMassing <= 0.001) return notan;

  const tm = Math.min(1, tonalMassing);
  const cx = width / 2;
  const cy = height / 2;
  // Project page position onto the light axis, normalized by the page half-span,
  // so the centre is tonally neutral and the corners commit. dot > 0 is the lit
  // side (toward `light`), dot < 0 the shadow side.
  const halfSpan = 0.5 * Math.hypot(width - 2 * margin, height - 2 * margin) || 1;
  const bands = Math.round(valueBands);
  const posterize = bands >= 2;

  return (x, y) => {
    const proj = Math.max(-1, Math.min(1, ((x - cx) * light.x + (y - cy) * light.y) / halfSpan));
    // 1 deep in shadow, 0 in full light.
    const shadowBias = smoothstep(0.5 - proj * 0.5);
    // Open the lit side toward the floor; the shadow side stays at full mass.
    let w = 1 - tm * (1 - shadowBias) * (1 - LIT_FLOOR);
    // Commit values: push apart from the mid so a few decisive masses read,
    // rather than a continuous gradation (mirrors composeMassPlan).
    w = 0.5 + (w - 0.5) * (1 + 0.45 * tm);
    if (posterize) {
      const band = Math.max(0, Math.min(bands - 1, Math.floor(w * bands)));
      w = band / (bands - 1);
    }
    w = Math.max(LIT_FLOOR, Math.min(1, w));
    // A held-clear notan region still clears, even under massing.
    if (notan) w *= notan(x, y);
    return w;
  };
}

function makeRoots(o: RootOpts, rng: () => number): Root[] {
  const { width, height, margin, baseHalf, maxLength } = o;
  const up = -Math.PI / 2;
  const jitter = () => (rng() - 0.5) * 0.5;

  // A designed single specimen: a master gesture from a base in the lower third
  // sweeping to a focal point on a rule-of-thirds intersection, leaving the
  // opposite side as negative space.
  if (o.composition === 'specimen' && o.mode === 'growth') {
    // The coin is always drawn (stable rng sequence); when negative space holds
    // a region clear, the focal side flips to whichever candidate carries more
    // mass, so the gesture is composed *away* from the held-clear third instead
    // of being culled step-by-step inside it.
    const coin = rng() < 0.5;
    let leftFocal = coin;
    if (o.weightAt) {
      const cy = margin + 0.3 * (height - 2 * margin);
      const wl = o.weightAt(margin + (1 / 3) * (width - 2 * margin), cy);
      const wr = o.weightAt(margin + (2 / 3) * (width - 2 * margin), cy);
      if (Math.abs(wl - wr) > 0.05) leftFocal = wl > wr;
    }
    const fx = margin + (leftFocal ? 1 / 3 : 2 / 3) * (width - 2 * margin);
    const fy = margin + (0.16 + rng() * 0.14) * (height - 2 * margin);
    const baseFromPaint = o.seeding === 'painted' || o.seeding === 'point' ? o.startPoints[0] : undefined;
    const bx = o.baseOverride?.x ?? baseFromPaint?.x ?? margin + (leftFocal ? 0.62 : 0.38) * (width - 2 * margin);
    const by = o.baseOverride?.y ?? baseFromPaint?.y ?? height - margin * 1.3;
    // A bowed guide curve base → focal (control point pushed to one side).
    const mx = (bx + fx) / 2 + (leftFocal ? 1 : -1) * (width * 0.12);
    const my = (by + fy) / 2;
    const guide = smoothPolyline([
      { x: bx, y: by },
      { x: (bx + mx) / 2, y: (by + my) / 2 },
      { x: mx, y: my },
      { x: (mx + fx) / 2, y: (my + fy) / 2 },
      { x: fx, y: fy },
    ], 1);
    const startAngle = Math.atan2(guide[1].y - by, guide[1].x - bx);
    // A woody trunk that tapers up the gesture. Its growth budget comes from
    // the guide's actual length (like every other guided composition), not the
    // free-growth maxLength — a fixed budget truncated the master gesture
    // two-thirds of the way up the page. Side branches are capped so the
    // silhouette stays a designed gesture rather than bushing into a thicket.
    const guideLen = polylineLength(guide);
    const roots: Root[] = [{ x: bx, y: by, angle: startAngle, half: baseHalf * 1.5, maxLength: guideLen * 1.3, guide, branchMaxLen: Math.max(maxLength * 0.4, guideLen * 0.3) }];
    // A shorter subordinate cane from the same base sweeping into the opposite
    // (weak) quadrant, so the frame reads as a balanced specimen rather than one
    // gesture beside a bare void. Capped shorter and thinner so it stays
    // subordinate to the master gesture, and held back from the focal side.
    const sfx = margin + (leftFocal ? 0.74 : 0.26) * (width - 2 * margin);
    const sfy = margin + (0.5 + rng() * 0.16) * (height - 2 * margin);
    const smx = (bx + sfx) / 2 + (leftFocal ? -1 : 1) * width * 0.06;
    const smy = (by + sfy) / 2;
    const subGuide = smoothPolyline([{ x: bx, y: by }, { x: smx, y: smy }, { x: sfx, y: sfy }], 1);
    const subAngle = Math.atan2(subGuide[1].y - by, subGuide[1].x - bx);
    const subLen = polylineLength(subGuide);
    roots.push({ x: bx, y: by, angle: subAngle, half: baseHalf * 1.05, maxLength: subLen * 1.25, guide: subGuide, branchMaxLen: Math.max(maxLength * 0.35, subLen * 0.3) });
    return roots;
  }

  // Build a guided root: a stem that follows a smoothed guide curve. An
  // optional branch cap keeps its foliage from shooting off the guide.
  const guided = (guide: Point[], half: number, branchMaxLen?: number): Root => {
    const g = smoothPolyline(guide, 1);
    return { x: g[0].x, y: g[0].y, angle: Math.atan2(g[1].y - g[0].y, g[1].x - g[0].x), half, maxLength: polylineLength(g) * 1.3, guide: g, branchMaxLen };
  };

  if (o.composition === 'wreath') {
    // Stems run around a ring, each covering an arc that overlaps its
    // neighbour's start so the ring always closes (no angular jitter — gaps
    // read as a broken wreath); side branches are kept short so the foliage
    // hugs the ring. Radius still wobbles slightly for a hand-drawn ring.
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width - 2 * margin, height - 2 * margin) * 0.42;
    const n = Math.max(3, o.seedCount);
    const step = (2 * Math.PI) / n;
    const span = step * 1.34; // each arc reaches ~34% into the next, so they meet with even overlap
    const roots: Root[] = [];
    for (let k = 0; k < n; k++) {
      const a0 = k * step;
      const guide: Point[] = [];
      // Sample the arc finely enough that the ring reads as a curve, not a
      // polygon of chords — one guide point per ~20px of arc.
      const steps = Math.max(14, Math.ceil((span * R) / 20));
      for (let s = 0; s <= steps; s++) {
        const a = a0 + span * (s / steps);
        const rr = R * (1 + 0.02 * Math.sin(a * 3));
        guide.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
      }
      roots.push(guided(guide, baseHalf, maxLength * 0.4));
    }
    return roots;
  }

  if (o.composition === 'border') {
    // One stem per edge, running just inside the margin (corners meet). Inset a
    // little extra so the guide stays clear of the in-bounds edge.
    const pad = margin + baseHalf * 2 + 6;
    const x0 = pad;
    const y0 = pad;
    const x1 = width - pad;
    const y1 = height - pad;
    const corners = [
      [{ x: x0, y: y1 }, { x: x0, y: y0 }],
      [{ x: x0, y: y0 }, { x: x1, y: y0 }],
      [{ x: x1, y: y0 }, { x: x1, y: y1 }],
      [{ x: x1, y: y1 }, { x: x0, y: y1 }],
    ];
    // Side branches are capped short so the garland hugs the frame instead of
    // flopping into the interior, and each edge overshoots its end corner a
    // little way along the next edge so the corners read as a continuous
    // wrapped garland rather than four stems that happen to end nearby.
    return corners.map(([a, b], i) => {
      const guide: Point[] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) guide.push({ x: a.x + (b.x - a.x) * (s / steps), y: a.y + (b.y - a.y) * (s / steps) });
      const [na, nb] = corners[(i + 1) % 4];
      const nLen = Math.hypot(nb.x - na.x, nb.y - na.y) || 1;
      const over = Math.min(60, nLen * 0.1);
      for (let s = 1; s <= 3; s++) {
        const t = (over * s) / 3 / nLen;
        guide.push({ x: na.x + (nb.x - na.x) * t, y: na.y + (nb.y - na.y) * t });
      }
      return guided(guide, baseHalf, maxLength * 0.3);
    });
  }

  if (o.composition === 'bouquet') {
    // A fan of stems from one low base point (the vessel mouth when present).
    const bx = o.baseOverride?.x ?? o.startPoints[0]?.x ?? width / 2;
    const by = o.baseOverride?.y ?? o.startPoints[0]?.y ?? height - margin * 1.2;
    const n = Math.max(2, o.seedCount);
    const roots: Root[] = [];
    for (let k = 0; k < n; k++) {
      const fx = margin + ((k + 0.5) / n) * (width - 2 * margin);
      const fy = margin + (0.15 + rng() * 0.25) * (height - 2 * margin);
      const mx = (bx + fx) / 2 + (rng() - 0.5) * width * 0.1;
      const my = (by + fy) / 2;
      const guide = smoothPolyline([{ x: bx, y: by }, { x: mx, y: my }, { x: fx, y: fy }], 1);
      roots.push(guided(guide, baseHalf * (1.2 - 0.3 * Math.abs(k - (n - 1) / 2) / n)));
    }
    return roots;
  }

  if (o.composition === 'trellis') {
    const n = Math.max(2, o.seedCount);
    const roots: Root[] = [];
    // With a drawn support, climbers are trained along its actual members —
    // zigzagging up the lattice diagonals, riding the arch up and over —
    // instead of floating in front of it on their own vertical grid.
    if (o.support && o.support !== 'none') {
      for (const path of supportClimbPaths(o.support, width, height, margin, n, rng)) {
        roots.push(guided(path, baseHalf, o.maxLength * 0.3));
      }
      return roots;
    }
    // No support: several vertical climbers on a soft grid.
    for (let k = 0; k < n; k++) {
      const x = margin + ((k + 0.5) / n) * (width - 2 * margin);
      const guide: Point[] = [];
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        guide.push({ x: x + Math.sin(t * Math.PI * 2 + k) * width * 0.03, y: (height - margin) + ((margin) - (height - margin)) * t });
      }
      // Cap branch wander so the climbers read as trained up the support
      // rather than sprawling sideways between columns.
      roots.push(guided(guide, baseHalf, maxLength * 0.35));
    }
    return roots;
  }

  if (o.composition === 'guide') {
    // Grow a stem along each supplied guide polyline (a traced SVG path, a
    // letterform, or the freehand painted stroke). Falls back to the painted
    // points as one path so the paint tool "just works".
    const paths = (o.guidePaths && o.guidePaths.length > 0)
      ? o.guidePaths
      : o.startPoints.length >= 2
        ? [o.startPoints]
        : [];
    const roots: Root[] = [];
    for (const path of paths) {
      if (path.length < 2) continue;
      // Short side-branches so the foliage hugs the traced shape and the
      // silhouette stays legible rather than bushing out into a thicket.
      roots.push(guided(path, baseHalf, maxLength * 0.22));
    }
    return roots;
  }

  const base = (x: number, y: number, angle: number): Root => ({ x, y, angle: angle + jitter(), half: baseHalf, maxLength });

  if (o.seeding === 'painted') return o.startPoints.map((p) => base(p.x, p.y, up));
  if (o.seeding === 'point') {
    const p = o.startPoints[0] ?? { x: width / 2, y: height - margin };
    return [base(p.x, p.y, up)];
  }
  // Rejection-accept a candidate against the negative-space weight (1 when off,
  // so the loop below stays byte-identical). A few tries, then take what we got.
  const accept = (x: number, y: number): boolean =>
    !o.weightAt || rng() <= o.weightAt(x, y);
  if (o.seeding === 'edges') {
    const roots: Root[] = [];
    for (let i = 0; i < o.seedCount; i++) {
      for (let t = 0; t < 6; t++) {
        const edge = Math.floor(rng() * 4);
        let x: number, y: number, ang: number;
        if (edge === 0) { x = margin + rng() * (width - 2 * margin); y = height - margin; ang = up; }
        else if (edge === 1) { x = margin + rng() * (width - 2 * margin); y = margin; ang = Math.PI / 2; }
        else if (edge === 2) { x = margin; y = margin + rng() * (height - 2 * margin); ang = 0; }
        else { x = width - margin; y = margin + rng() * (height - 2 * margin); ang = Math.PI; }
        if (t === 5 || accept(x, y)) { roots.push(base(x, y, ang)); break; }
      }
    }
    return roots;
  }
  const roots: Root[] = [];
  for (let i = 0; i < o.seedCount; i++) {
    for (let t = 0; t < 6; t++) {
      const x = margin + rng() * (width - 2 * margin);
      const y = margin + rng() * (height - 2 * margin);
      if (t === 5 || accept(x, y)) { roots.push(base(x, y, up)); break; }
    }
  }
  return roots;
}
