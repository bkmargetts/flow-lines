import {
  applySketch,
  BASE_PX_PER_MM,
  buildCoverageMask,
  clipLinesToMask,
  echoLines,
  holdOffLines,
  limitStrokeDensity,
  morphMask,
  toSVG,
  toSVGLayers,
  traceMaskOutline,
  transformLines,
  type CoverageMask,
  type FlowLine,
  type FlowLinesResult,
  type PageMetrics,
  type SVGOptions,
} from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';
import { DEFAULT_PEN_WIDTH_MM, type LayerOutput, type RenderEnv } from '../modules/types';
import { buildBorder } from './border';
import { registrationCrosses, REGISTRATION_LAYER } from '@flow-lines/core';

/**
 * The compositor's view of a module: just the render dispatch, structurally —
 * a full `Module` satisfies it, and so does a worker-side registry entry
 * (moduleId → render fn), which is how the composite worker feeds the same
 * `composite()` without bundling any React Controls.
 */
export type CompositeModule =
  | { kind: 'live' }
  | {
      kind: 'pure';
      render: (state: unknown, env: RenderEnv) => LayerOutput | null;
      consumesAvoid?: boolean;
    };

/** Page-space transform + echo applied to a layer's finished lines (mm and
 *  degrees, about the page centre). All-identity values are inert. */
export interface LayerTransformState {
  dxMm: number;
  dyMm: number;
  rotateDeg: number;
  scale: number;
  /** Total copies including the original; 1 = no echo. */
  echoCopies: number;
  /** Per-copy compounding deltas (copy k gets k×Δ, scale^k). */
  echoDxMm: number;
  echoDyMm: number;
  echoRotateDeg: number;
  echoScale: number;
}

export const defaultTransformState = (): LayerTransformState => ({
  dxMm: 0,
  dyMm: 0,
  rotateDeg: 0,
  scale: 1,
  echoCopies: 1,
  echoDxMm: 1.5,
  echoDyMm: 1.5,
  echoRotateDeg: 0,
  echoScale: 1,
});

/** Stencil clip: this layer renders only inside (or outside) the shape of
 *  another layer — the source's rendered lines merged into a silhouette. */
export interface LayerClipState {
  /** instanceId of the shape-source layer; null = no clip. */
  sourceId: string | null;
  mode: 'inside' | 'outside';
  /** Silhouette merge radius in mm (how far apart strokes still read as one
   *  mass). */
  growMm: number;
  /** Signed inset/outset of the silhouette, in mm. */
  expandMm: number;
  /** Organic wandering of the cut edge, in mm (0 = crisp). */
  featherMm: number;
}

export const defaultClipState = (): LayerClipState => ({
  sourceId: null,
  mode: 'inside',
  growMm: 2,
  expandMm: 0,
  featherMm: 0,
});

/** One layer's place in the stack, as the compositor sees it. Pure modules are
 *  rendered here; live modules (image-ink) arrive with their `output` already
 *  published from their own worker/effect. */
export interface CompositeLayer {
  instanceId: string;
  module: CompositeModule;
  state: unknown;
  visible: boolean;
  /** Clean-paper sliver this layer reserves around the lines stacked above it,
   *  in mm. 0 = stacks independently (the default). */
  holdOffMm: number;
  /** This layer's ink physically crosses the others: its pens preview with
   *  multiply blend, it never carves hold-off halos in layers beneath it,
   *  and its own `holdOffMm` is ignored. Default false. */
  overprint?: boolean;
  /** Latest published output for live modules; ignored for pure modules. */
  liveOutput?: LayerOutput | null;
  /** Page-space transform/echo of the finished lines. Absent = untouched. */
  transform?: LayerTransformState;
  /** Stencil clip against another layer's shape. Absent = unclipped. */
  clip?: LayerClipState;
  /** Trace the reserved-paper gap's boundary as a light stroke on this
   *  layer's own `halo` pen (active only while holding off). Default false. */
  haloOutline?: boolean;
  /** Excluded from other layers' halos: lower layers never reserve paper
   *  around this one (its own hold-off still applies). Default false. */
  haloExempt?: boolean;
}

export interface CompositeResult {
  /** Clean SVG for download. */
  exportSvg: string;
  /** Plot-window preview — the same clean, as-plotted output. */
  previewSvg: string;
  /** Final composited result, for per-layer (multi-pen) export. */
  result: FlowLinesResult;
  svgOptions: SVGOptions;
  width: number;
  height: number;
  /** True when the composite splits into more than one pen layer. */
  hasLayers: boolean;
}

const BORDER_COLOR = '#111111';

/**
 * Composite a stack of layers (bottom→top) into one plottable sheet — the
 * multi-layer generalisation of the old `finishPlot`. Pure modules are rendered
 * here (top→bottom so each can hold a halo off the lines above it); live
 * modules contribute their already-published lines. Every layer's pen-layer
 * keys are namespaced per stack slot (`L{i}/…`) so two instances of the same
 * module never collide, the page border is laid on top, density protection runs
 * once over the whole composite, and the result is serialised honouring the
 * explicit stack order.
 */
export function composite(
  frame: FrameSettings,
  page: PageMetrics,
  layers: CompositeLayer[]
): CompositeResult {
  const width = page.widthPx;
  const height = page.heightPx;
  const marginPx = frame.marginMm * page.pxPerMm;
  const stack = layers.filter((l) => l.visible);

  const border = buildBorder(frame, page);

  // ---- 0. Stencil pre-pass: masks for layers clipped to another's shape ----
  // A clip source's shape is its *base lines* — its own render plus its own
  // transform/echo, ignoring hold-off and clipping. That makes "a layer's
  // shape is what it draws" order-independent and structurally cycle-free.
  const clipMasks = new Map<string, CoverageMask>();
  {
    const byId = new Map(stack.map((l) => [l.instanceId, l]));
    const baseCache = new Map<string, FlowLine[]>();
    const baseLinesOf = (src: CompositeLayer): FlowLine[] => {
      const cached = baseCache.get(src.instanceId);
      if (cached) return cached;
      let lines: FlowLine[];
      if (src.module.kind === 'live') {
        lines = src.liveOutput?.lines ?? [];
      } else {
        lines = src.module.render(src.state, { page, frame, marginPx })?.lines ?? [];
      }
      if (src.transform) lines = applyLayerTransform(lines, src.transform, page);
      baseCache.set(src.instanceId, lines);
      return lines;
    };
    for (const layer of stack) {
      const clip = layer.clip;
      if (!clip?.sourceId || clip.sourceId === layer.instanceId) continue;
      const src = byId.get(clip.sourceId);
      // Lenient: a hidden or removed source leaves the layer unclipped —
      // silently rendering nothing would look like a bug.
      if (!src) continue;
      const base = baseLinesOf(src);
      if (!base.length) continue;
      let mask = buildCoverageMask(base, width, height, {
        radiusPx: Math.max(0.5, clip.growMm * page.pxPerMm),
      });
      if (clip.expandMm) mask = morphMask(mask, clip.expandMm * page.pxPerMm);
      clipMasks.set(layer.instanceId, mask);
    }
  }

  // ---- 1. Resolve each layer's output, top→bottom, accumulating hold-off ----
  // `avoidAccum` is the union of everything stacked above the layer being
  // resolved (border included), so a holding-off layer reserves paper around
  // the foreground.
  const outputs: (LayerOutput | null)[] = new Array(stack.length).fill(null);
  let avoidAccum: FlowLine[] = border.slice();

  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    // An overprinting ink crosses what's above it — trimming it against the
    // foreground would contradict the toggle, so its own halo is ignored.
    const holdOff = layer.holdOffMm > 0 && !layer.overprint;
    const haloPx = holdOff ? layer.holdOffMm * page.pxPerMm : undefined;
    const moving = transformActive(layer.transform);
    let out: LayerOutput | null;
    // True when the module has already reserved the halo in its own render.
    let heldNatively = false;

    if (layer.module.kind === 'live') {
      // Live layers never *re-render* against what's above them (their worker is
      // too expensive to re-run on stack churn) — take their published lines.
      // Hold-off is still honoured cheaply by trimming those lines (no re-render).
      out = layer.liveOutput ?? null;
    } else {
      // A transformed layer renders in place and is then moved, so a native
      // avoid reservation would be computed in pre-transform space — wrong
      // once shifted. Drop `avoid` and let the generic post-transform trim
      // take over (behaviour only changes when a transform is active).
      const env: RenderEnv = {
        page,
        frame,
        marginPx,
        avoid: holdOff && !moving ? avoidAccum : undefined,
        haloPx: holdOff && !moving ? haloPx : undefined,
      };
      out = layer.module.render(layer.state, env);
      heldNatively = !!(out && holdOff && !moving && layer.module.consumesAvoid);
    }

    if (out && layer.transform && moving) {
      out = { ...out, lines: applyLayerTransform(out.lines, layer.transform, page) };
    }

    const mask = clipMasks.get(layer.instanceId);
    if (out && mask && layer.clip) {
      out = {
        ...out,
        lines: clipLinesToMask(out.lines, mask, {
          mode: layer.clip.mode,
          featherPx:
            layer.clip.featherMm > 0 ? layer.clip.featherMm * page.pxPerMm : undefined,
          featherSeed: 0,
        }),
      };
    }

    // The layer's ink before the hold-off trim — the halo outline is kept
    // only where this layer actually abuts the gap.
    const preHoldLines = out && holdOff && layer.haloOutline ? out.lines : null;

    if (out && holdOff && haloPx != null && !heldNatively) {
      out = { ...out, lines: holdOffLines(out.lines, avoidAccum, haloPx) };
    }

    if (out && holdOff && haloPx != null && layer.haloOutline && preHoldLines?.length && avoidAccum.length) {
      out = { ...out, lines: out.lines.concat(haloOutlineLines(avoidAccum, preHoldLines, haloPx, width, height, page)) };
    }

    outputs[i] = out;
    // Overprint layers never join the avoid union: layers beneath must not
    // reserve paper around an ink that's meant to cross them. Halo-exempt
    // layers opt out the same way, without the multiply-blend preview.
    if (out && out.lines.length && !layer.overprint && !layer.haloExempt) {
      avoidAccum = avoidAccum.concat(out.lines);
    }
  }

  // ---- 2. Assemble bottom→top, namespacing pen-layer keys per stack slot ----
  const finalLines: FlowLine[] = [];
  const layerColors: Record<string, string> = {};
  const layerWidths: Record<string, number> = {};
  const layerBlend: Record<string, string> = {};

  for (let i = 0; i < stack.length; i++) {
    const out = outputs[i];
    if (!out || !out.lines.length) continue;
    const prefix = `L${i}/`;
    for (const line of out.lines) {
      const key = line.layer ?? line.pen ?? 'default';
      const nsKey = prefix + key;
      finalLines.push({ ...line, layer: nsKey });
      if (!(nsKey in layerColors)) {
        layerColors[nsKey] = out.layerColors?.[key] ?? out.strokeColor;
        layerWidths[nsKey] = out.strokeWidthPx;
        // Overprint forces multiply on every pen of the layer (crossing inks
        // physically mix); otherwise the module's own blend declaration wins.
        // Density protection needs no overprint handling: coverage grids are
        // per namespaced pen layer, so one layer can never thin another.
        const blend = stack[i].overprint ? 'multiply' : out.layerBlend?.[key];
        if (blend) layerBlend[nsKey] = blend;
      }
    }
  }

  // Page border on top, on its own pen.
  if (border.length) {
    for (const line of border) finalLines.push(line);
    layerColors.border = BORDER_COLOR;
    layerWidths.border = DEFAULT_PEN_WIDTH_MM * page.pxPerMm;
  }

  // Corner registration crosses on their own pen, for re-registering the
  // paper between pen swaps. When splitting is on, the tiler draws per-sheet
  // crosses instead — skipping them here keeps them from doubling up on the
  // sliced sheets (the un-split master export goes without, which is fine:
  // it isn't the artifact that gets plotted in that workflow).
  if (frame.crossesEnabled && !frame.tileEnabled) {
    const crosses = registrationCrosses(
      width,
      height,
      frame.marginMm * page.pxPerMm,
      Math.max(0, frame.crossOffsetMm) * page.pxPerMm,
      page.pxPerMm
    );
    if (crosses.length) {
      for (const line of crosses) finalLines.push(line);
      layerColors[REGISTRATION_LAYER] = BORDER_COLOR;
      layerWidths[REGISTRATION_LAYER] = DEFAULT_PEN_WIDTH_MM * page.pxPerMm;
    }
  }

  // ---- 2.5 Global hand-sketch finish, then clip back to the sheet ----
  // After namespacing so `pen` metadata still gates the steady bold treatment,
  // and before density protection so overdraw can be clawed back by it. The
  // border sketches as a steady layer (wobble only — no double rules), and the
  // clip is to the page rect, not the margin box: the wobbled border sits at
  // the margin and must not be sliced, and overshoot spill into the margin is
  // small and plotter-safe.
  let outLines = finalLines;
  if (frame.sketchEnabled && outLines.length) {
    outLines = applySketch(
      { width, height, seed: frame.sketchSeed, lines: outLines },
      {
        style: frame.sketchStyle,
        intensity: frame.sketchIntensity,
        overshoot: frame.sketchOvershoot,
        breaks: frame.sketchBreaks,
        seed: frame.sketchSeed,
        scale: page.pxPerMm / BASE_PX_PER_MM,
        steadyLayers: ['border'],
        maxLines: 60000,
        clipRect: { x0: 0, y0: 0, x1: width, y1: height },
      }
    ).lines;
  }

  // ---- 3. Density protection across the whole composite ----
  if (frame.densityEnabled && outLines.length) {
    // One coverage grid per (namespaced) pen layer, so an unrelated layer can't
    // thin another. Cell size tracks the heaviest pen in the stack.
    const widths = Object.values(layerWidths);
    const cellPx = Math.max(1, ...(widths.length ? widths : [1]));
    // Bold offset passes are deliberate; border is a separate deliberate pen.
    const skipLayers = Object.keys(layerColors).filter((k) => k.endsWith('/bold'));
    skipLayers.push('border');
    const trimmed = limitStrokeDensity(
      { width, height, seed: 0, lines: outLines },
      {
        maxPasses: frame.densityMaxPasses,
        cellPx,
        minOverlapPx: frame.densityMinOverlapMm * page.pxPerMm,
        skipLayers,
      }
    );
    outLines = trimmed.result.lines;
  }

  // ---- 4. Serialise honouring the explicit stack order ----
  const result: FlowLinesResult = { width, height, seed: 0, lines: outLines };
  const hasMulti = Object.keys(layerColors).length > 0;
  const svgOptions: SVGOptions = {
    strokeColor: BORDER_COLOR,
    strokeWidth: DEFAULT_PEN_WIDTH_MM * page.pxPerMm,
    physicalWidth: `${page.widthMm}mm`,
    physicalHeight: `${page.heightMm}mm`,
    preserveLayerOrder: true,
    ...(hasMulti ? { layerColors, layerWidths } : {}),
    ...(Object.keys(layerBlend).length ? { layerBlend } : {}),
  };

  const exportSvg = toSVG(result, svgOptions);
  return {
    exportSvg,
    previewSvg: exportSvg,
    result,
    svgOptions,
    width,
    height,
    hasLayers: distinctLayers(outLines) > 1,
  };
}

/** One SVG per pen layer for multi-pen plotting, from a composited result. */
export function compositeLayers(result: CompositeResult): { layer: string; svg: string }[] {
  return toSVGLayers(result.result, result.svgOptions);
}

function distinctLayers(lines: FlowLine[]): number {
  const keys = new Set<string>();
  for (const l of lines) keys.add(l.layer ?? l.pen ?? 'default');
  return keys.size;
}

/** Whether a layer's transform/echo actually moves anything. */
function transformActive(t: LayerTransformState | undefined): boolean {
  if (!t) return false;
  const base = t.dxMm !== 0 || t.dyMm !== 0 || t.rotateDeg !== 0 || t.scale !== 1;
  const echo =
    t.echoCopies > 1 &&
    (t.echoDxMm !== 0 || t.echoDyMm !== 0 || t.echoRotateDeg !== 0 || t.echoScale !== 1);
  return base || echo;
}

/** Echo first (copies fan out), then the base transform moves the whole
 *  group. mm → px via the page metrics; origin = page centre. */
function applyLayerTransform(
  lines: FlowLine[],
  t: LayerTransformState,
  page: PageMetrics
): FlowLine[] {
  const originX = page.widthPx / 2;
  const originY = page.heightPx / 2;
  const mm = page.pxPerMm;
  let out = lines;
  if (t.echoCopies > 1) {
    out = echoLines(out, {
      copies: t.echoCopies,
      translateXPx: t.echoDxMm * mm,
      translateYPx: t.echoDyMm * mm,
      rotateDeg: t.echoRotateDeg,
      scale: t.echoScale,
      originX,
      originY,
    });
  }
  return transformLines(out, {
    translateXPx: t.dxMm * mm,
    translateYPx: t.dyMm * mm,
    rotateDeg: t.rotateDeg,
    scale: t.scale,
    originX,
    originY,
  });
}

/**
 * The halo-outline stroke: trace the boundary of the reserved-paper gap and
 * keep it only where this layer's own ink abuts the gap. The gap boundary is
 * traced at 0.6× the halo radius from the foreground — the generic trim
 * guarantees surviving ink sits at least ~1 halo away, so the outline always
 * lands inside the cleared sliver, tracing the foreground's silhouette the
 * way the sky module inks carved cloud edges. Emitted on the layer's own
 * `halo` pen (namespaced per slot at assembly, colour = the layer's ink).
 */
function haloOutlineLines(
  avoid: FlowLine[],
  ownLines: FlowLine[],
  haloPx: number,
  width: number,
  height: number,
  page: PageMetrics
): FlowLine[] {
  const gapMask = buildCoverageMask(avoid, width, height, { radiusPx: haloPx * 0.6 });
  const loops = traceMaskOutline(gapMask);
  if (!loops.length) return [];
  // Own coverage is generous (bridges the trimmed sliver and hatch spacing)
  // so the outline follows the gap wherever this layer holds tone nearby.
  const own = buildCoverageMask(ownLines, width, height, {
    radiusPx: Math.max(2 * page.pxPerMm, 2.5 * haloPx),
  });
  return clipLinesToMask(
    loops.map((points) => ({ points, layer: 'halo' })),
    own,
    { mode: 'inside' }
  );
}
