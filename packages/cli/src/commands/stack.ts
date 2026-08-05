import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import {
  applySketch,
  BASE_PX_PER_MM,
  buildCoverageMask,
  clipLinesToMask,
  echoLines,
  holdOffLines,
  limitStrokeDensity,
  morphMask,
  pageBorder,
  traceMaskOutline,
  transformLines,
  type FlowLine,
  type FlowLinesResult,
  type PageMetrics,
  type SketchStyle,
  type SVGOptions,
} from '@flow-lines/core';
import { addTileOptions, resolvePageFrame, writePlotOutput, PAPER_SPEC_HELP } from '../page.js';
import {
  parseStackRecipe,
  resolveClipSources,
  StackRecipeError,
  type StackRecipeLayer,
} from '../stack-recipe.js';
import { STACK_GENERATORS, STACK_GENERATOR_NAMES } from '../stack-generators.js';

/** Recipe defaults (mirroring the web frame's defaults where one exists). */
const DEFAULTS = {
  orientation: 'portrait',
  resolution: 3,
  marginMm: 10,
  penWidthMm: 0.3,
  layerColor: '#000000',
  borderColor: '#111111',
  growMm: 2,
  /** A missing layer seed defaults to this + the layer index, so recipes are
   *  reproducible without forcing every layer to declare one. */
  seedBase: 42,
};

export function registerStack(program: Command) {
  addTileOptions(program.command('stack'))
    .description(
      'Composite a stack of generator layers from a JSON recipe — the CLI ' +
        'counterpart of the web layer stack: per-layer inks and pens, ' +
        'hold-off halos, overprint, stencil clips, transforms/echoes, halo ' +
        'outlines. Layers are listed bottom → top; the page block picks the ' +
        `physical sheet (${PAPER_SPEC_HELP.slice(0, 60)}…)`
    )
    .argument('<recipe>', 'Recipe JSON file (see README for the schema and a worked example)')
    .option(
      '--split-layers',
      'Write one SVG per pen layer for multi-pen plotting, named <output>.<layer>.svg'
    )
    .option('-o, --output <file>', 'Output file path', 'stack.svg')
    .action((recipePath: string, options) => {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(resolve(process.cwd(), recipePath), 'utf-8'));
      } catch (err) {
        throw new StackRecipeError(
          `could not read recipe ${recipePath}: ${(err as Error).message}`
        );
      }
      const recipe = parseStackRecipe(raw, STACK_GENERATOR_NAMES);
      const clipSources = resolveClipSources(recipe);

      const page = recipe.page;
      const frame = resolvePageFrame({
        paper: page.paper,
        orientation: page.orientation ?? DEFAULTS.orientation,
        resolution: String(page.resolution ?? DEFAULTS.resolution),
        marginMm: String(page.marginMm ?? DEFAULTS.marginMm),
        penWidthMm: String(page.penWidthMm ?? DEFAULTS.penWidthMm),
        width: '0',
        height: '0',
        margin: '0',
      });
      const metrics = frame.page as PageMetrics;
      const { width, height, marginPx } = frame;
      const pxPerMm = metrics.pxPerMm;
      const penWidthMm = page.penWidthMm ?? DEFAULTS.penWidthMm;

      // Hidden layers drop out entirely; a clip pointing at one is an error
      // (the CLI is strict where the interactive web is lenient).
      const hidden = new Set<number>();
      recipe.layers.forEach((l, i) => {
        if (l.visible === false) hidden.add(i);
      });
      for (const [layerIndex, sourceIndex] of clipSources) {
        if (hidden.has(sourceIndex) && !hidden.has(layerIndex)) {
          throw new StackRecipeError(
            `recipe.layers[${layerIndex}].clip.source: source layer ${sourceIndex} is hidden (visible: false)`
          );
        }
      }

      console.log('Rendering layer stack...');
      console.log(`  Sheet: ${page.paper} at ${page.resolution ?? DEFAULTS.resolution} px/mm (${width}x${height}px)`);

      // ---- Render every visible layer once, in its own space, then apply
      // its echo/transform — these are each layer's *base lines*, which
      // double as the shape source for stencil clips.
      const ctx = { width, height, marginPx, pxPerMm };
      const baseLines = new Map<number, FlowLine[]>();
      recipe.layers.forEach((layer, i) => {
        if (hidden.has(i)) return;
        const generate = STACK_GENERATORS[layer.generator];
        const lines = generate({ seed: DEFAULTS.seedBase + i, ...(layer.options ?? {}) }, ctx);
        baseLines.set(i, applyEchoTransform(lines, layer, width, height, pxPerMm));
        console.log(`  L${i} ${layer.generator}: ${lines.length} strokes`);
      });

      // ---- Stencil masks from the source layers' base lines.
      const clipMasks = new Map<number, ReturnType<typeof buildCoverageMask>>();
      for (const [layerIndex, sourceIndex] of clipSources) {
        if (hidden.has(layerIndex)) continue;
        const clip = recipe.layers[layerIndex].clip;
        if (!clip) continue;
        const source = baseLines.get(sourceIndex) ?? [];
        if (!source.length) continue;
        let mask = buildCoverageMask(source, width, height, {
          radiusPx: Math.max(0.5, (clip.growMm ?? DEFAULTS.growMm) * pxPerMm),
        });
        if (clip.expandMm) mask = morphMask(mask, clip.expandMm * pxPerMm);
        clipMasks.set(layerIndex, mask);
      }

      // ---- Top → bottom: clip, then hold off against everything above.
      const border = recipe.border
        ? pageBorder({
            width,
            height,
            marginPx,
            insetPx: (recipe.border.insetMm ?? 0) * pxPerMm,
            cornerRadiusPx: (recipe.border.cornerRadiusMm ?? 0) * pxPerMm,
          })
        : [];
      const visibleIndices = recipe.layers.map((_, i) => i).filter((i) => !hidden.has(i));
      const finalLines = new Map<number, FlowLine[]>();
      let avoidAccum: FlowLine[] = border.slice();
      for (let vi = visibleIndices.length - 1; vi >= 0; vi--) {
        const i = visibleIndices[vi];
        const layer = recipe.layers[i];
        let lines = baseLines.get(i) ?? [];

        const mask = clipMasks.get(i);
        if (mask && layer.clip) {
          lines = clipLinesToMask(lines, mask, {
            mode: layer.clip.mode ?? 'inside',
            featherPx:
              layer.clip.featherMm && layer.clip.featherMm > 0
                ? layer.clip.featherMm * pxPerMm
                : undefined,
            featherSeed: 0,
          });
        }

        const holdOff = (layer.holdOffMm ?? 0) > 0 && !layer.overprint;
        if (holdOff) {
          const haloPx = (layer.holdOffMm as number) * pxPerMm;
          const preHold = lines;
          lines = holdOffLines(lines, avoidAccum, haloPx);
          if (layer.haloOutline && preHold.length && avoidAccum.length) {
            lines = lines.concat(
              haloOutline(avoidAccum, preHold, haloPx, width, height, pxPerMm)
            );
          }
        }

        finalLines.set(i, lines);
        if (lines.length && !layer.overprint && !layer.haloExempt) {
          avoidAccum = avoidAccum.concat(lines);
        }
      }

      // ---- Assemble bottom → top with per-slot pen namespacing (the web
      // compositor's L{i}/ convention, keyed by recipe index).
      const outLines: FlowLine[] = [];
      const layerColors: Record<string, string> = {};
      const layerWidths: Record<string, number> = {};
      const layerBlend: Record<string, string> = {};
      for (const i of visibleIndices) {
        const layer = recipe.layers[i];
        const prefix = `L${i}/`;
        for (const line of finalLines.get(i) ?? []) {
          const key = line.layer ?? line.pen ?? 'default';
          const nsKey = prefix + key;
          outLines.push({ ...line, layer: nsKey });
          if (!(nsKey in layerColors)) {
            layerColors[nsKey] = layer.penColors?.[key] ?? layer.color ?? DEFAULTS.layerColor;
            layerWidths[nsKey] = (layer.penWidthMm ?? penWidthMm) * pxPerMm;
            if (layer.overprint) layerBlend[nsKey] = 'multiply';
          }
        }
      }
      if (border.length) {
        for (const line of border) outLines.push(line);
        layerColors.border = recipe.border?.color ?? DEFAULTS.borderColor;
        layerWidths.border = penWidthMm * pxPerMm;
      }

      let result: FlowLinesResult = { width, height, seed: 0, lines: outLines };

      if (recipe.sketch && recipe.sketch.intensity > 0) {
        const sketchSeed = recipe.sketch.seed ?? 42;
        result = applySketch(result, {
          style: (recipe.sketch.style ?? 'loose') as SketchStyle,
          intensity: recipe.sketch.intensity,
          overshoot: recipe.sketch.overshoot ?? 0.35,
          breaks: recipe.sketch.breaks ?? 0.25,
          seed: sketchSeed,
          scale: (page.resolution ?? DEFAULTS.resolution) / BASE_PX_PER_MM,
          steadyLayers: ['border'],
          maxLines: 60000,
          clipRect: { x0: 0, y0: 0, x1: width, y1: height },
        });
      }

      if (recipe.density) {
        const widths = Object.values(layerWidths);
        const skipLayers = Object.keys(layerColors).filter((k) => k.endsWith('/bold'));
        skipLayers.push('border');
        result = limitStrokeDensity(result, {
          maxPasses: recipe.density.maxPasses ?? 1,
          cellPx: Math.max(1, ...(widths.length ? widths : [1])),
          minOverlapPx: (recipe.density.minOverlapMm ?? 2.5) * pxPerMm,
          skipLayers,
        }).result;
      }

      console.log(`  Composited ${result.lines.length} strokes across ${visibleIndices.length} layers`);

      const svgOptions: SVGOptions = {
        strokeColor: DEFAULTS.layerColor,
        strokeWidth: frame.paperStrokeWidth ?? penWidthMm * pxPerMm,
        preserveLayerOrder: true,
        layerColors,
        layerWidths,
        ...(Object.keys(layerBlend).length ? { layerBlend } : {}),
        ...frame.paperSvg,
      };

      writePlotOutput(result, frame, options, svgOptions);
    });
}

/** Echo first (copies fan out), then the base transform moves the whole
 *  group — the web compositor's order, about the page centre. */
function applyEchoTransform(
  lines: FlowLine[],
  layer: StackRecipeLayer,
  width: number,
  height: number,
  pxPerMm: number
): FlowLine[] {
  const originX = width / 2;
  const originY = height / 2;
  let out = lines;
  if (layer.echo && layer.echo.copies > 1) {
    out = echoLines(out, {
      copies: layer.echo.copies,
      translateXPx: (layer.echo.dxMm ?? 0) * pxPerMm,
      translateYPx: (layer.echo.dyMm ?? 0) * pxPerMm,
      rotateDeg: layer.echo.rotateDeg ?? 0,
      scale: layer.echo.scale ?? 1,
      originX,
      originY,
    });
  }
  if (layer.transform) {
    out = transformLines(out, {
      translateXPx: (layer.transform.dxMm ?? 0) * pxPerMm,
      translateYPx: (layer.transform.dyMm ?? 0) * pxPerMm,
      rotateDeg: layer.transform.rotateDeg ?? 0,
      scale: layer.transform.scale ?? 1,
      originX,
      originY,
    });
  }
  return out;
}

/**
 * The halo-outline stroke, mirroring the web compositor: trace the reserved-
 * paper gap boundary at 0.6× the halo radius (inside the cleared sliver) and
 * keep it only where this layer's own ink abuts the gap. Lands on the
 * layer's `halo` pen.
 */
function haloOutline(
  avoid: FlowLine[],
  ownLines: FlowLine[],
  haloPx: number,
  width: number,
  height: number,
  pxPerMm: number
): FlowLine[] {
  const gapMask = buildCoverageMask(avoid, width, height, { radiusPx: haloPx * 0.6 });
  const loops = traceMaskOutline(gapMask);
  if (!loops.length) return [];
  const own = buildCoverageMask(ownLines, width, height, {
    radiusPx: Math.max(2 * pxPerMm, 2.5 * haloPx),
  });
  return clipLinesToMask(
    loops.map((points) => ({ points, layer: 'halo' })),
    own,
    { mode: 'inside' }
  );
}
