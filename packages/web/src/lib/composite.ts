import {
  applySketch,
  BASE_PX_PER_MM,
  limitStrokeDensity,
  toSVG,
  toSVGLayers,
  type FlowLine,
  type FlowLinesResult,
  type PageMetrics,
  type Point,
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
  /** Latest published output for live modules; ignored for pure modules. */
  liveOutput?: LayerOutput | null;
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

  // ---- 1. Resolve each layer's output, top→bottom, accumulating hold-off ----
  // `avoidAccum` is the union of everything stacked above the layer being
  // resolved (border included), so a holding-off layer reserves paper around
  // the foreground.
  const outputs: (LayerOutput | null)[] = new Array(stack.length).fill(null);
  let avoidAccum: FlowLine[] = border.slice();

  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    const holdOff = layer.holdOffMm > 0;
    const haloPx = holdOff ? layer.holdOffMm * page.pxPerMm : undefined;
    let out: LayerOutput | null;

    if (layer.module.kind === 'live') {
      // Live layers never *re-render* against what's above them (their worker is
      // too expensive to re-run on stack churn) — take their published lines.
      // Hold-off is still honoured cheaply by trimming those lines (no re-render).
      out = layer.liveOutput ?? null;
      if (out && holdOff && haloPx != null) {
        out = { ...out, lines: holdOffAgainst(out.lines, avoidAccum, haloPx) };
      }
    } else {
      const env: RenderEnv = {
        page,
        frame,
        marginPx,
        avoid: holdOff ? avoidAccum : undefined,
        haloPx,
      };
      out = layer.module.render(layer.state, env);
      // Modules that don't natively reserve paper get a generic trim fallback.
      if (out && holdOff && haloPx != null && !layer.module.consumesAvoid) {
        out = { ...out, lines: holdOffAgainst(out.lines, avoidAccum, haloPx) };
      }
    }

    outputs[i] = out;
    if (out && out.lines.length) avoidAccum = avoidAccum.concat(out.lines);
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
        const blend = out.layerBlend?.[key];
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

/**
 * Generic hold-off: trim any portion of `lines` running within `haloPx` of the
 * `avoid` set, leaving clean paper around the foreground. A coverage grid of
 * the avoid samples (cell = haloPx) is tested with a 3×3 neighbourhood, so a
 * sample is dropped when it sits within roughly one halo of avoided ink. The
 * crossing/coalescence niceties of density protection aren't needed here —
 * this is a deliberate margin, not pile-up. Fragments shorter than a couple of
 * cells are discarded as dust.
 */
function holdOffAgainst(lines: FlowLine[], avoid: FlowLine[], haloPx: number): FlowLine[] {
  if (!avoid.length || haloPx <= 0) return lines;
  const cell = Math.max(0.5, haloPx);
  const step = cell * 0.5;
  const blocked = new Set<string>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const stamp = (p: Point) => blocked.add(key(Math.floor(p.x / cell), Math.floor(p.y / cell)));

  for (const line of avoid) {
    const pts = line.points;
    for (let i = 0; i < pts.length; i++) {
      stamp(pts[i]);
      if (i > 0) {
        const a = pts[i - 1];
        const b = pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
        for (let s = 1; s < n; s++) {
          const t = s / n;
          stamp({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
    }
  }

  const near = (p: Point): boolean => {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (blocked.has(key(cx + dx, cy + dy))) return true;
      }
    }
    return false;
  };

  const minKeep = cell * 2;
  const out: FlowLine[] = [];
  for (const line of lines) {
    if (line.points.length < 2) {
      if (line.points.length && !near(line.points[0])) out.push(line);
      continue;
    }
    // Walk the densified samples, emitting maximal runs that clear the halo.
    let run: Point[] = [];
    const flush = () => {
      if (run.length >= 2 && pathLength(run) >= minKeep) out.push({ ...line, points: run });
      run = [];
    };
    const pts = line.points;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) {
        const a = pts[i - 1];
        const b = pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
        for (let s = 1; s <= n; s++) {
          const t = s / n;
          const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          if (near(p)) flush();
          else run.push(p);
        }
      } else {
        if (near(pts[0])) flush();
        else run.push(pts[0]);
      }
    }
    flush();
  }
  return out;
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}
