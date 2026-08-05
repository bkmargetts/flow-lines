import { MAX_LAYERS, type Layer } from '../LayerStore';
import { getModule } from '../modules/registry';
import type { ModuleCategory } from '../modules/types';
import { ARTWORK_POOL, type ArtworkEntry } from '../modules/genome-registry';
import { PALETTES, CUSTOM_PALETTE_ID } from './palette';
import { defaultClipState } from './composite';

/**
 * The stack-level "generate artwork" roller: replaces the whole layer stack
 * with a random number of randomised layers. Pure — all randomness comes from
 * the injected `rng` and all instanceIds from the injected `mintId`, so tests
 * can pin every invariant deterministically. The caller (LayerStackPanel)
 * swaps the result in via the store's `restoreLayers`, which makes the roll a
 * single undo step; the page frame (paper/orientation/margin) is never
 * touched — the roller doesn't even see it.
 *
 * Per-module genomes stay ink-free (the genomes.test.ts contract); this
 * roller is the one place allowed to roll pen/ink at random, per each pool
 * entry's `InkPlan`. It must keep the layer count within MAX_LAYERS itself —
 * `restoreLayers` trusts its callers and does not clamp.
 */

// ---- Taste knobs (tune here, the tests only pin the hard invariants) ----

/** Relative weight of rolling 1..MAX_LAYERS layers — a hump at 3–5 so most
 *  artworks are a composed handful, but every count stays reachable. */
const COUNT_WEIGHTS = [4, 12, 20, 20, 17, 12, 9, 6];
/** Chance a multi-layer roll is anchored on one scene-category module. */
const ANCHOR_CHANCE = 0.75;
/** Acceptance rate for a second scene module (never more than two). */
const SECOND_SCENE_CHANCE = 0.15;
const MAX_SCENES = 2;
/** Most heavy simulations allowed to share one stack. */
const MAX_HEAVY = 2;
/** Most instances of any single module (duplicates are a real plotting
 *  idiom — misregistration stacks — but three of a kind reads as a bug). */
const MAX_DUPLICATES = 2;
/** Chance each non-top layer reserves a clean-paper halo around the layers
 *  above it, and the mm range it rolls in (0.5 steps). */
const HOLD_OFF_CHANCE = 0.35;
const HOLD_OFF_MIN_MM = 1;
const HOLD_OFF_MAX_MM = 6;
/** Chance the top layer of a multi-layer stack overprints instead. */
const OVERPRINT_CHANCE = 0.15;
/** Chance a flow/texture layer is stencil-clipped inside (usually) a
 *  dense-silhouette layer's shape, when the stack has both. */
const CLIP_CHANCE = 0.4;
const CLIP_INSIDE_CHANCE = 0.75;
/** Chance a stroke-ink module with multi-ink support actually gets it. */
const MULTI_INK_CHANCE = 0.25;
/** Chance a palette module rolls a custom random ramp vs a named palette. */
const CUSTOM_RAMP_CHANCE = 0.25;
/** Pen width roll, mm (0.05 steps) — inside every module's slider range. */
const PEN_WIDTH_MIN_MM = 0.15;
const PEN_WIDTH_MAX_MM = 0.8;

/** Post-genome clamps for the heavy simulations, so a full random stack still
 *  paints promptly — the genome bounds are the sliders' (generous) ranges. */
const HEAVY_CAPS: Record<string, Record<string, number>> = {
  physarum: { steps: 600, agentCount: 16000, gridCols: 200 },
  'reaction-diffusion': { steps: 4000, gridCols: 200 },
  lenia: { steps: 400, gridCols: 150 },
};

/** Bottom→top stacking order by category: backgrounds under fields under the
 *  scene, matching how the compositor's top→bottom hold-off reads. */
const CATEGORY_BAND: Record<ModuleCategory, number> = {
  image: 0, // never rolled (image-ink is live and needs a photo)
  textures: 0,
  flow: 1,
  simulations: 2,
  scenes: 3,
};

export interface RolledArtwork {
  layers: Layer[];
  selectedId: string;
}

const pick = <T,>(rng: () => number, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)];

/** Plotter-ink random hex: any hue, lightness clamped well under paper-white
 *  so the ink never vanishes on the sheet. */
export function randomInkHex(rng: () => number): string {
  const h = rng() * 360;
  const s = 0.35 + rng() * 0.55;
  const l = 0.12 + rng() * 0.48;
  // Standard HSL→RGB.
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const rollPenWidth = (rng: () => number): number => {
  const steps = Math.round((PEN_WIDTH_MAX_MM - PEN_WIDTH_MIN_MM) / 0.05);
  return Number((PEN_WIDTH_MIN_MM + 0.05 * Math.floor(rng() * (steps + 1))).toFixed(2));
};

/** The stack-level ink roll — the fully-random-colour counterpart of the
 *  deliberately ink-free per-module genomes. Works by key introspection over
 *  the module's defaults so it can never invent a field the state lacks. */
function rollInk(
  entry: ArtworkEntry,
  defaults: Record<string, unknown>,
  rng: () => number
): Record<string, unknown> {
  if (entry.ink === 'self') return {}; // genome already rolled a named palette
  const patch: Record<string, unknown> = {};
  if (typeof defaults.penWidthMm === 'number') patch.penWidthMm = rollPenWidth(rng);
  if (entry.ink === 'palette') {
    if (rng() < CUSTOM_RAMP_CHANCE) {
      const n = 2 + Math.floor(rng() * 3);
      patch.palette = CUSTOM_PALETTE_ID;
      patch.customRamp = Array.from({ length: n }, () => randomInkHex(rng));
      if (typeof defaults.colorCount === 'number') patch.colorCount = n;
    } else {
      patch.palette = pick(rng, PALETTES.filter((p) => p.id !== CUSTOM_PALETTE_ID)).id;
      if (typeof defaults.colorCount === 'number') patch.colorCount = 2 + Math.floor(rng() * 3);
    }
    return patch;
  }
  // 'stroke': every colour-named string field gets a fresh ink.
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value === 'string' && /color$/i.test(key)) patch[key] = randomInkHex(rng);
  }
  if (typeof defaults.multiInk === 'boolean' && rng() < MULTI_INK_CHANCE) patch.multiInk = true;
  if (typeof defaults.inkGroups === 'number' && rng() < MULTI_INK_CHANCE)
    patch.inkGroups = 2 + Math.floor(rng() * 2);
  return patch;
}

function rollLayerCount(rng: () => number): number {
  const total = COUNT_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < COUNT_WEIGHTS.length; i++) {
    roll -= COUNT_WEIGHTS[i];
    if (roll < 0) return i + 1;
  }
  return COUNT_WEIGHTS.length;
}

/** Pick `count` module ids: usually one scene anchor, the rest from the whole
 *  pool under the scene/heavy/duplicate caps, stacked background→subject. */
function rollModuleIds(rng: () => number, count: number): string[] {
  const poolIds = Object.keys(ARTWORK_POOL);
  const isScene = (id: string) => getModule(id).category === 'scenes';
  const picks: string[] = [];
  const countOf = (id: string) => picks.filter((p) => p === id).length;
  const scenes = () => picks.filter(isScene).length;
  const heavies = () => picks.filter((p) => ARTWORK_POOL[p].heavy).length;

  if (count >= 2 && rng() < ANCHOR_CHANCE) picks.push(pick(rng, poolIds.filter(isScene)));

  for (let attempts = 0; picks.length < count && attempts < 1000; attempts++) {
    const id = pick(rng, poolIds);
    if (countOf(id) >= MAX_DUPLICATES) continue;
    if (ARTWORK_POOL[id].heavy && heavies() >= MAX_HEAVY) continue;
    if (isScene(id)) {
      if (scenes() >= MAX_SCENES) continue;
      if (scenes() >= 1 && rng() >= SECOND_SCENE_CHANCE) continue;
    }
    picks.push(id);
  }

  // Shuffle, then stable-sort into category bands (bottom→top).
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks.sort(
    (a, b) => CATEGORY_BAND[getModule(a).category] - CATEGORY_BAND[getModule(b).category]
  );
}

export function rollRandomArtwork(
  rng: () => number,
  mintId: (moduleId: string) => string
): RolledArtwork {
  const count = Math.min(rollLayerCount(rng), MAX_LAYERS);
  const moduleIds = rollModuleIds(rng, count);

  const layers: Layer[] = moduleIds.map((moduleId) => {
    const entry = ARTWORK_POOL[moduleId];
    const defaults = getModule(moduleId).defaultState() as Record<string, unknown>;
    const state: Record<string, unknown> = {
      ...defaults,
      ...entry.genome(rng),
      ...rollInk(entry, defaults, rng),
    };
    if (typeof defaults.seed === 'number') state.seed = Math.floor(rng() * 1_000_000);
    for (const [key, max] of Object.entries(HEAVY_CAPS[moduleId] ?? {})) {
      if (typeof state[key] === 'number' && (state[key] as number) > max) state[key] = max;
    }
    return {
      instanceId: mintId(moduleId),
      moduleId,
      state,
      visible: true,
      holdOffMm: 0,
      overprint: false,
    };
  });

  // ---- Tasteful combos: hold-off, an occasional overprint accent, and an
  // occasional stencil clip into a dense layer's silhouette. Never
  // transforms/echo or the halo extras — those stay hand-driven.
  const top = layers.length - 1;
  if (layers.length >= 2 && rng() < OVERPRINT_CHANCE) layers[top].overprint = true;
  for (let i = 0; i < top; i++) {
    if (rng() < HOLD_OFF_CHANCE) {
      const steps = Math.round((HOLD_OFF_MAX_MM - HOLD_OFF_MIN_MM) / 0.5);
      layers[i].holdOffMm = HOLD_OFF_MIN_MM + 0.5 * Math.floor(rng() * (steps + 1));
    }
  }

  const anchors = layers.filter((l) => ARTWORK_POOL[l.moduleId].clipAnchor);
  const anchor = anchors.length ? anchors[anchors.length - 1] : undefined;
  const clippable = layers.filter(
    (l) =>
      l !== anchor &&
      (getModule(l.moduleId).category === 'flow' || getModule(l.moduleId).category === 'textures')
  );
  if (anchor && clippable.length && rng() < CLIP_CHANCE) {
    pick(rng, clippable).clip = {
      ...defaultClipState(),
      sourceId: anchor.instanceId,
      mode: rng() < CLIP_INSIDE_CHANCE ? 'inside' : 'outside',
      growMm: Number((1 + rng() * 3).toFixed(1)),
      featherMm: rng() < 0.5 ? 0 : Number((rng() * 2).toFixed(1)),
    };
  }

  return { layers, selectedId: layers[top].instanceId };
}
