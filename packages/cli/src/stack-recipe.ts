/**
 * The `flow-lines stack` recipe: a JSON description of a layer stack — the
 * CLI counterpart of the web app's layer panel. Versioned and hand-validated
 * (no schema dependency); every error is prefixed with its JSON path so a
 * broken recipe points straight at the offending field.
 */

export interface StackRecipePage {
  /** Physical sheet: a6…2a0, letter, legal, tabloid, arch-d, or WxH in mm. */
  paper: string;
  orientation?: 'portrait' | 'landscape';
  /** Render density in px per mm. Default 3. */
  resolution?: number;
  /** Clear paper border in mm. Default 10. */
  marginMm?: number;
  /** Default plotted pen width in mm (per-layer overridable). Default 0.3. */
  penWidthMm?: number;
}

export interface StackRecipeBorder {
  insetMm?: number;
  cornerRadiusMm?: number;
  color?: string;
}

export interface StackRecipeSketch {
  /** 0-1; presence of the block with intensity > 0 turns the finish on. */
  intensity: number;
  style?: 'loose' | 'fine' | 'gestural' | 'scratchy';
  overshoot?: number;
  breaks?: number;
  seed?: number;
}

export interface StackRecipeDensity {
  maxPasses?: number;
  minOverlapMm?: number;
}

export interface StackRecipeTransform {
  dxMm?: number;
  dyMm?: number;
  rotateDeg?: number;
  scale?: number;
}

export interface StackRecipeEcho {
  /** Total copies including the original. */
  copies: number;
  dxMm?: number;
  dyMm?: number;
  rotateDeg?: number;
  scale?: number;
}

export interface StackRecipeClip {
  /** Layer `id` string or 0-based layer index. */
  source: string | number;
  mode?: 'inside' | 'outside';
  growMm?: number;
  expandMm?: number;
  featherMm?: number;
}

export interface StackRecipeLayer {
  /** Optional handle other layers' `clip.source` can point at. */
  id?: string;
  /** Core generator name — see `STACK_GENERATORS` / the command's error list. */
  generator: string;
  /** The generator's own core options. `width`/`height` always come from the
   *  page; `margin` defaults to the page margin; a missing `seed` defaults to
   *  a stable per-layer value so recipes reproduce byte-identically. */
  options?: Record<string, unknown>;
  /** Default ink for every pen this layer emits. Default #000000. */
  color?: string;
  /** Per-pen ink overrides keyed by the generator's own layer names. */
  penColors?: Record<string, string>;
  /** Pen width override in mm. */
  penWidthMm?: number;
  visible?: boolean;
  holdOffMm?: number;
  overprint?: boolean;
  haloExempt?: boolean;
  haloOutline?: boolean;
  transform?: StackRecipeTransform;
  echo?: StackRecipeEcho;
  clip?: StackRecipeClip;
}

export interface StackRecipe {
  version: 1;
  page: StackRecipePage;
  border?: StackRecipeBorder;
  sketch?: StackRecipeSketch;
  density?: StackRecipeDensity;
  /** Bottom → top, like the web stack. */
  layers: StackRecipeLayer[];
}

export class StackRecipeError extends Error {}

const fail = (path: string, message: string): never => {
  throw new StackRecipeError(`${path}: ${message}`);
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function expectRecord(v: unknown, path: string): Record<string, unknown> {
  if (!isRecord(v)) fail(path, `expected an object, got ${Array.isArray(v) ? 'an array' : typeof v}`);
  return v as Record<string, unknown>;
}

function optNumber(v: unknown, path: string): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, `expected a number, got ${JSON.stringify(v)}`);
  return v as number;
}

function optString(v: unknown, path: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') fail(path, `expected a string, got ${JSON.stringify(v)}`);
  return v as string;
}

function optBoolean(v: unknown, path: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') fail(path, `expected true or false, got ${JSON.stringify(v)}`);
  return v as boolean;
}

function optEnum<T extends string>(v: unknown, path: string, values: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) {
    fail(path, `expected one of ${values.join(' | ')}, got ${JSON.stringify(v)}`);
  }
  return v as T;
}

/**
 * Validate a parsed JSON value into a `StackRecipe`. `validGenerators` is the
 * command's generator table — unknown names error with the full list so a
 * typo is a one-glance fix.
 */
export function parseStackRecipe(raw: unknown, validGenerators: ReadonlySet<string>): StackRecipe {
  const root = expectRecord(raw, 'recipe');

  if (root.version !== 1) {
    fail(
      'recipe.version',
      root.version === undefined
        ? 'missing — set "version": 1'
        : `unsupported version ${JSON.stringify(root.version)} — this flow-lines understands version 1 (a newer recipe? update flow-lines)`
    );
  }

  const pageRaw = expectRecord(root.page, 'recipe.page');
  const paper = optString(pageRaw.paper, 'recipe.page.paper');
  if (!paper) fail('recipe.page.paper', 'missing — the stack needs a physical sheet (e.g. "a4")');
  const page: StackRecipePage = {
    paper: paper as string,
    orientation: optEnum(pageRaw.orientation, 'recipe.page.orientation', ['portrait', 'landscape'] as const),
    resolution: optNumber(pageRaw.resolution, 'recipe.page.resolution'),
    marginMm: optNumber(pageRaw.marginMm, 'recipe.page.marginMm'),
    penWidthMm: optNumber(pageRaw.penWidthMm, 'recipe.page.penWidthMm'),
  };

  let border: StackRecipeBorder | undefined;
  if (root.border !== undefined) {
    const b = expectRecord(root.border, 'recipe.border');
    border = {
      insetMm: optNumber(b.insetMm, 'recipe.border.insetMm'),
      cornerRadiusMm: optNumber(b.cornerRadiusMm, 'recipe.border.cornerRadiusMm'),
      color: optString(b.color, 'recipe.border.color'),
    };
  }

  let sketch: StackRecipeSketch | undefined;
  if (root.sketch !== undefined) {
    const s = expectRecord(root.sketch, 'recipe.sketch');
    const intensity = optNumber(s.intensity, 'recipe.sketch.intensity');
    if (intensity === undefined) fail('recipe.sketch.intensity', 'missing — 0-1');
    sketch = {
      intensity: intensity as number,
      style: optEnum(s.style, 'recipe.sketch.style', ['loose', 'fine', 'gestural', 'scratchy'] as const),
      overshoot: optNumber(s.overshoot, 'recipe.sketch.overshoot'),
      breaks: optNumber(s.breaks, 'recipe.sketch.breaks'),
      seed: optNumber(s.seed, 'recipe.sketch.seed'),
    };
  }

  let density: StackRecipeDensity | undefined;
  if (root.density !== undefined) {
    const d = expectRecord(root.density, 'recipe.density');
    density = {
      maxPasses: optNumber(d.maxPasses, 'recipe.density.maxPasses'),
      minOverlapMm: optNumber(d.minOverlapMm, 'recipe.density.minOverlapMm'),
    };
  }

  if (!Array.isArray(root.layers) || root.layers.length === 0) {
    fail('recipe.layers', 'expected a non-empty array of layers (bottom → top)');
  }
  const layersRaw = root.layers as unknown[];
  const layers = layersRaw.map((entry, i) => parseLayer(entry, i, validGenerators));

  // Layer ids must be unique to be addressable.
  const seen = new Map<string, number>();
  layers.forEach((l, i) => {
    if (!l.id) return;
    const first = seen.get(l.id);
    if (first !== undefined) {
      fail(`recipe.layers[${i}].id`, `duplicate id "${l.id}" (also layers[${first}])`);
    }
    seen.set(l.id, i);
  });

  return { version: 1, page, border, sketch, density, layers };
}

function parseLayer(
  entry: unknown,
  index: number,
  validGenerators: ReadonlySet<string>
): StackRecipeLayer {
  const path = `recipe.layers[${index}]`;
  const l = expectRecord(entry, path);

  const generator = optString(l.generator, `${path}.generator`);
  if (!generator) fail(`${path}.generator`, 'missing');
  if (!validGenerators.has(generator as string)) {
    fail(
      `${path}.generator`,
      `unknown generator "${generator}" — valid: ${[...validGenerators].sort().join(', ')}`
    );
  }

  let options: Record<string, unknown> | undefined;
  if (l.options !== undefined) options = expectRecord(l.options, `${path}.options`);

  let penColors: Record<string, string> | undefined;
  if (l.penColors !== undefined) {
    const pc = expectRecord(l.penColors, `${path}.penColors`);
    for (const [k, v] of Object.entries(pc)) {
      if (typeof v !== 'string') fail(`${path}.penColors.${k}`, `expected a colour string`);
    }
    penColors = pc as Record<string, string>;
  }

  let transform: StackRecipeTransform | undefined;
  if (l.transform !== undefined) {
    const t = expectRecord(l.transform, `${path}.transform`);
    transform = {
      dxMm: optNumber(t.dxMm, `${path}.transform.dxMm`),
      dyMm: optNumber(t.dyMm, `${path}.transform.dyMm`),
      rotateDeg: optNumber(t.rotateDeg, `${path}.transform.rotateDeg`),
      scale: optNumber(t.scale, `${path}.transform.scale`),
    };
  }

  let echo: StackRecipeEcho | undefined;
  if (l.echo !== undefined) {
    const e = expectRecord(l.echo, `${path}.echo`);
    const copies = optNumber(e.copies, `${path}.echo.copies`);
    if (copies === undefined || copies < 1 || !Number.isInteger(copies)) {
      fail(`${path}.echo.copies`, 'expected an integer ≥ 1 (total copies including the original)');
    }
    echo = {
      copies: copies as number,
      dxMm: optNumber(e.dxMm, `${path}.echo.dxMm`),
      dyMm: optNumber(e.dyMm, `${path}.echo.dyMm`),
      rotateDeg: optNumber(e.rotateDeg, `${path}.echo.rotateDeg`),
      scale: optNumber(e.scale, `${path}.echo.scale`),
    };
  }

  let clip: StackRecipeClip | undefined;
  if (l.clip !== undefined) {
    const c = expectRecord(l.clip, `${path}.clip`);
    const source = c.source;
    if (typeof source !== 'string' && !(typeof source === 'number' && Number.isInteger(source))) {
      fail(`${path}.clip.source`, 'expected a layer id string or 0-based layer index');
    }
    clip = {
      source: source as string | number,
      mode: optEnum(c.mode, `${path}.clip.mode`, ['inside', 'outside'] as const),
      growMm: optNumber(c.growMm, `${path}.clip.growMm`),
      expandMm: optNumber(c.expandMm, `${path}.clip.expandMm`),
      featherMm: optNumber(c.featherMm, `${path}.clip.featherMm`),
    };
  }

  return {
    id: optString(l.id, `${path}.id`),
    generator: generator as string,
    options,
    color: optString(l.color, `${path}.color`),
    penColors,
    penWidthMm: optNumber(l.penWidthMm, `${path}.penWidthMm`),
    visible: optBoolean(l.visible, `${path}.visible`),
    holdOffMm: optNumber(l.holdOffMm, `${path}.holdOffMm`),
    overprint: optBoolean(l.overprint, `${path}.overprint`),
    haloExempt: optBoolean(l.haloExempt, `${path}.haloExempt`),
    haloOutline: optBoolean(l.haloOutline, `${path}.haloOutline`),
    transform,
    echo,
    clip,
  };
}

/**
 * Resolve every layer's `clip.source` (id string or index) to a layer index.
 * The CLI is strict where the interactive web is lenient: an unknown or
 * self-referencing source is a hard error, not a silent no-clip.
 */
export function resolveClipSources(recipe: StackRecipe): Map<number, number> {
  const byId = new Map<string, number>();
  recipe.layers.forEach((l, i) => {
    if (l.id) byId.set(l.id, i);
  });
  const out = new Map<number, number>();
  recipe.layers.forEach((l, i) => {
    if (!l.clip) return;
    const path = `recipe.layers[${i}].clip.source`;
    const src = l.clip.source;
    let index: number | undefined;
    if (typeof src === 'number') {
      if (src < 0 || src >= recipe.layers.length) {
        fail(path, `layer index ${src} out of range (0-${recipe.layers.length - 1})`);
      }
      index = src;
    } else {
      index = byId.get(src);
      if (index === undefined) {
        const have = [...byId.keys()];
        fail(path, `no layer with id "${src}"${have.length ? ` (have: ${have.map((h) => `"${h}"`).join(', ')})` : ' (no layer declares an id)'}`);
      }
    }
    if (index === i) fail(path, 'a layer cannot clip to itself');
    out.set(i, index as number);
  });
  return out;
}
