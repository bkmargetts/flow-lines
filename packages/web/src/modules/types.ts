import type { ComponentType } from 'react';
import type { FlowLine, PageMetrics } from '@flow-lines/core';
import type { FrameSettings } from '../FrameContext';

/**
 * A module is the one unit of art in the app: photos→ink, a generative field, a
 * background texture — all the same kind of thing. A plot is a *stack* of layer
 * instances, each an instance of some module, composited bottom→top into one
 * sheet. This replaces the old project/texture split: ProjectModule (a
 * session-mounted provider shown one at a time) and TextureModule (a pure
 * function layered behind it) collapse into `Module`.
 *
 * Two kinds, because one signature can't honestly cover both a synchronous
 * texture and image-ink's worker+ML pipeline:
 *   - `pure`  — `state + env → lines`, fast enough to run synchronously on the
 *               main thread (textures and the generative fields).
 *   - `live`  — owns its own effects/workers (image-ink: depth/labels/mask, a
 *               debounced worker render) and *publishes* its lines when ready.
 * The compositor treats every layer uniformly as "a current LayerOutput | null"
 * and never cares how that output was produced.
 */

/** The pen width every built-in module defaults to (mm) — a fine plotter nib. */
export const DEFAULT_PEN_WIDTH_MM = 0.3;

/** Everything a module needs to turn its per-instance state into lines. */
export interface RenderEnv {
  page: PageMetrics;
  frame: FrameSettings;
  /** The page margin in px (page.pxPerMm * frame.marginMm), precomputed. */
  marginPx: number;
  /**
   * Union of the lines from every layer stacked *above* this one (plus the page
   * border), supplied only when this layer holds off. A module that natively
   * reserves clean paper (textures, via `generateTexture`'s `avoid`/`haloMm`)
   * should consume it and set `consumesAvoid`; otherwise the compositor trims
   * the layer's output against it as a fallback.
   */
  avoid?: FlowLine[];
  /** Clean-paper sliver to reserve around `avoid`, in px. 0 when not holding off. */
  haloPx?: number;
}

/** A layer's contribution: its drawing lines plus the inks and pen weight it
 *  wants. Layer keys in `layerColors` are the module's own un-namespaced names
 *  (`present`/`bold`/`texture`/…); the compositor namespaces them per stack
 *  slot so two instances of the same module never collide. */
export interface LayerOutput {
  lines: FlowLine[];
  /** Default ink for this layer's lines whose pen-layer isn't in `layerColors`. */
  strokeColor: string;
  /** Pen width for this layer, in px at the page's density. */
  strokeWidthPx: number;
  /** Per-pen-layer ink overrides (multi-ink layers), keyed by the module's own
   *  layer names. Absent keys fall back to `strokeColor`. */
  layerColors?: Record<string, string>;
  /** Per-pen-layer SVG blend mode (e.g. 'multiply'), keyed by the module's own
   *  layer names. Lets a layer overprint so overlapping inks show the blended
   *  colour (physical pen overprint). Absent keys render normally. */
  layerBlend?: Record<string, string>;
}

/** A state patch — a partial value or a function of the current state (so
 *  appenders like mask-path points don't drop rapid updates). */
export type StateUpdate<S> = Partial<S> | ((current: S) => Partial<S>);

/** Merge a patch into a layer's module state. Mirrors the old
 *  updateSettings / updateTextureParams. */
export type Updater<S> = (updates: StateUpdate<S>) => void;

export interface ControlsProps<S> {
  state: S;
  update: Updater<S>;
  /** This layer's stable instance id — live modules use it to look up their
   *  per-instance image/ML state from the instance store. */
  instanceId: string;
  /** Whether this layer is the one currently selected for editing — lets a
   *  module gate canvas-interaction affordances (focus taps, mask paint). */
  selected: boolean;
}

interface ModuleBase<S> {
  id: string;
  label: string;
  /** Fresh per-instance state — a function, not a value, because N independent
   *  layer instances each need their own copy. */
  defaultState: () => S;
  Controls: ComponentType<ControlsProps<S>>;
}

export interface PureModule<S = unknown> extends ModuleBase<S> {
  kind: 'pure';
  /** Synchronous, worker-safe: produce this layer's lines, or null for nothing. */
  render: (state: S, env: RenderEnv) => LayerOutput | null;
  /**
   * The module natively reserves clean paper around `env.avoid` (e.g. textures
   * skip strokes there), so the compositor must NOT also trim its output. When
   * absent/false, the compositor applies a generic hold-off trim instead.
   */
  consumesAvoid?: boolean;
}

/** What a live module's instance hook receives. It must obey the rules of hooks
 *  (called once, unconditionally, per mounted instance). */
export interface LiveInstanceArgs<S> {
  instanceId: string;
  state: S;
  env: RenderEnv;
  selected: boolean;
  /** Update this layer's own module state (settings), like a pure layer's. */
  update: Updater<S>;
  /** Publish this instance's latest lines (or null while it has none) and
   *  whether it's mid-render, so the stack can show a busy badge. */
  publish: (output: LayerOutput | null, busy: boolean) => void;
}

export interface LiveModule<S = unknown> extends ModuleBase<S> {
  kind: 'live';
  /** Owns the instance's effects/workers and publishes its output. */
  useInstance: (args: LiveInstanceArgs<S>) => void;
}

export type Module<S = unknown> = PureModule<S> | LiveModule<S>;
