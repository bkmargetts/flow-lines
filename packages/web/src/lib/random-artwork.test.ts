import { describe, it, expect } from 'vitest';
import { getPaperSize, pageMetrics } from '@flow-lines/core';
import { MODULES, getModule } from '../modules/registry';
import type { Module } from '../modules/types';
import { ARTWORK_POOL } from '../modules/genome-registry';
import { MAX_LAYERS, type Layer } from '../LayerStore';
import { PALETTES } from './palette';
import { composite, type CompositeLayer } from './composite';
import { defaultFrame, type FrameSettings } from '../FrameContext';
import { rollRandomArtwork, randomInkHex } from './random-artwork';

/**
 * The stack-level artwork roller: hard invariants only — the taste knobs
 * (weights, probabilities) are deliberately unpinned so tuning them never
 * touches this file. Determinism comes from the injected rng + id factory.
 */

// mulberry32 — a tiny seeded stream; core's LCG is deliberately not exported
// from the package barrel.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mintFactory = () => {
  let n = 0;
  return (moduleId: string) => `${moduleId}-${++n}`;
};

const roll = (seed: number) => rollRandomArtwork(seededRng(seed), mintFactory());

const HEX = /^#[0-9a-f]{6}$/;
const PALETTE_IDS = PALETTES.map((p) => p.id);
/** The modules whose genomes roll their own named palette. */
const SELF_INKED = new Set([
  'botanical-generator',
  'landscape-generator',
  'planet-generator',
  'impact-grid',
  'lapidary',
  'terraces',
]);

describe('rollRandomArtwork', () => {
  it('covers every pure module except the blank template', () => {
    const expected = MODULES.filter((m) => m.kind === 'pure' && m.id !== 'blank')
      .map((m) => m.id)
      .sort();
    expect(Object.keys(ARTWORK_POOL).sort()).toEqual(expected);
  });

  it('is deterministic for a given rng seed', () => {
    expect(roll(1234)).toEqual(roll(1234));
    // And genuinely random across seeds (two rolls agreeing on layer count
    // AND module list AND every seed field would be a broken rng plumb-line).
    expect(JSON.stringify(roll(1))).not.toEqual(JSON.stringify(roll(2)));
  });

  it('holds the hard invariants across many rolls', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { layers, selectedId } = roll(seed);

      expect(layers.length).toBeGreaterThanOrEqual(1);
      expect(layers.length).toBeLessThanOrEqual(MAX_LAYERS);
      expect(selectedId).toBe(layers[layers.length - 1].instanceId);

      const ids = layers.map((l) => l.instanceId);
      expect(new Set(ids).size).toBe(ids.length);

      const counts = new Map<string, number>();
      let scenes = 0;
      let heavies = 0;
      for (const layer of layers) {
        const entry = ARTWORK_POOL[layer.moduleId];
        expect(entry, `unknown module ${layer.moduleId}`).toBeDefined();
        counts.set(layer.moduleId, (counts.get(layer.moduleId) ?? 0) + 1);
        if (getModule(layer.moduleId).category === 'scenes') scenes++;
        if (entry.heavy) heavies++;

        expect(layer.visible).toBe(true);
        expect(layer.transform).toBeUndefined();
        expect(layer.haloOutline).toBeUndefined();
        expect(layer.haloExempt).toBeUndefined();
        if (layer.overprint) expect(layer.holdOffMm).toBe(0);
        expect(layer.holdOffMm).toBeGreaterThanOrEqual(0);
        expect(layer.holdOffMm).toBeLessThanOrEqual(20);

        // Rolled state never invents fields the module lacks, and the seed is
        // rng-derived within the app's usual range.
        const defaults = getModule(layer.moduleId).defaultState() as Record<string, unknown>;
        const state = layer.state as Record<string, unknown>;
        for (const key of Object.keys(state)) {
          expect(defaults, `${layer.moduleId} rolled unknown key ${key}`).toHaveProperty(key);
        }
        if (typeof defaults.seed === 'number') {
          expect(Number.isInteger(state.seed)).toBe(true);
          expect(state.seed as number).toBeGreaterThanOrEqual(0);
          expect(state.seed as number).toBeLessThan(1_000_000);
        }

        // Fully-random ink stays plottable: real hex inks, sane pen widths,
        // real palette ids — and the self-inked modules keep genome-rolled
        // named palettes (this roller must not override them).
        if (!SELF_INKED.has(layer.moduleId)) {
          for (const [key, value] of Object.entries(state)) {
            if (typeof value === 'string' && /color$/i.test(key)) {
              expect(value, `${layer.moduleId}.${key}`).toMatch(HEX);
            }
          }
          if (typeof defaults.penWidthMm === 'number') {
            expect(state.penWidthMm as number).toBeGreaterThanOrEqual(0.15);
            expect(state.penWidthMm as number).toBeLessThanOrEqual(0.8);
          }
          if (typeof defaults.palette === 'string' && typeof defaults.customRamp === 'object') {
            expect(PALETTE_IDS).toContain(state.palette);
            if (state.palette === 'custom') {
              for (const ink of state.customRamp as string[]) expect(ink).toMatch(HEX);
            }
          }
        }

        if (layer.clip) {
          expect(layer.clip.sourceId).not.toBe(layer.instanceId);
          const source = layers.find((l) => l.instanceId === layer.clip!.sourceId);
          expect(source, 'clip source must be in the stack').toBeDefined();
          expect(ARTWORK_POOL[source!.moduleId].clipAnchor).toBe(true);
          expect(['inside', 'outside']).toContain(layer.clip.mode);
          expect(layer.clip.growMm).toBeGreaterThanOrEqual(0.5);
          expect(layer.clip.growMm).toBeLessThanOrEqual(10);
          expect(layer.clip.featherMm).toBeGreaterThanOrEqual(0);
          expect(layer.clip.featherMm).toBeLessThanOrEqual(5);
        }
      }

      expect(scenes).toBeLessThanOrEqual(2);
      expect(heavies).toBeLessThanOrEqual(2);
      for (const [id, n] of counts) {
        expect(n, `${n} copies of ${id}`).toBeLessThanOrEqual(2);
      }

      // The top layer can't hold off (nothing above it) — the roller never
      // sets it, so an overprinting top stays coherent with the UI's
      // exclusivity between the two.
      expect(layers[layers.length - 1].holdOffMm).toBe(0);
    }
  });

  it('reaches every layer count and both combo kinds', () => {
    const seen = { counts: new Set<number>(), holdOff: false, clip: false, overprint: false };
    for (let seed = 0; seed < 400; seed++) {
      const { layers } = roll(seed);
      seen.counts.add(layers.length);
      if (layers.some((l) => l.holdOffMm > 0)) seen.holdOff = true;
      if (layers.some((l) => l.clip)) seen.clip = true;
      if (layers.some((l) => l.overprint)) seen.overprint = true;
    }
    for (let n = 1; n <= MAX_LAYERS; n++) expect(seen.counts, `count ${n} never rolled`).toContain(n);
    expect(seen.holdOff).toBe(true);
    expect(seen.clip).toBe(true);
    expect(seen.overprint).toBe(true);
  });

  it('rolls plottable ink hexes', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 200; i++) {
      const hex = randomInkHex(rng);
      expect(hex).toMatch(HEX);
      // Lightness cap: the ink must never approach paper-white.
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
      expect((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255).toBeLessThanOrEqual(0.62);
    }
  });

  // Rolled stacks must actually render: a few fixed seeds through the real
  // compositor (the goldens' cheap frame) — a crash-catcher, not a hash pin.
  it('rolled stacks survive the compositor', () => {
    const frame: FrameSettings = { ...defaultFrame, resolution: 1.5 };
    const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);
    for (const seed of [11, 42, 99]) {
      const { layers } = roll(seed);
      const compositeLayers: CompositeLayer[] = layers.map((l: Layer) => ({
        instanceId: l.instanceId,
        module: getModule(l.moduleId) as Module,
        state: l.state,
        visible: l.visible,
        holdOffMm: l.holdOffMm,
        overprint: l.overprint,
        clip: l.clip,
      }));
      const result = composite(frame, page, compositeLayers);
      expect(result.result.lines.length).toBeGreaterThan(0);
    }
  });
});
