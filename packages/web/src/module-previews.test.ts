import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPaperSize, pageMetrics } from '@flow-lines/core';

import { MODULES } from './modules/registry';
import type { Module, PureModule } from './modules/types';
import { composite, type CompositeLayer } from './lib/composite';
import { defaultFrame, type FrameSettings } from './FrameContext';

/**
 * Picker thumbnails — the browse-all layer picker shows a real render of every
 * module. Regenerate with `pnpm previews` (repo root): `UPDATE_PREVIEWS=1`
 * makes this file render each pure module at the pinned seed into
 * `.preview-svgs/` (gitignored), then `scripts/render-module-previews.mjs`
 * rasterizes those into `src/modules/previews/<id>.png` (committed — eyeball
 * before committing, like the goldens).
 *
 * Without the env var this file is the guardrail: every registered module must
 * have a committed PNG, no orphans, none too heavy for the picker grid.
 */

const PREVIEWS_DIR = fileURLToPath(new URL('./modules/previews/', import.meta.url));
const SVG_OUT = fileURLToPath(new URL('../.preview-svgs/', import.meta.url));

// image-ink (live — needs a photo and ML) and blank (renders nothing) have
// hand-produced committed thumbnails; see scripts/render-module-previews.mjs
// for how each was made.
const STATIC_IDS = new Set(['image-ink', 'blank']);

// Same cheap frame as module-goldens: A4 portrait at low density — the heavy
// sims don't get cheaper on smaller pages, and the sparser line spacing reads
// better at thumbnail size anyway.
const frame: FrameSettings = { ...defaultFrame, resolution: 1.5 };
const page = pageMetrics(getPaperSize(frame.paper), frame.orientation, frame.resolution);

// Per-module state patches where the plain default isn't the module's best
// face — mostly the goldens' preset variants, curated by eyeballing the PNGs.
const PREVIEW_STATES: Record<string, Record<string, unknown>> = {
  'impact-grid': {
    shatter: 0.9,
    crush: 1,
    paneStress: 1,
    fill: 0.4,
    fillStyle: 'concentric',
    maskPath: [
      { x: 150, y: 80 },
      { x: 220, y: 200 },
      { x: 180, y: 340 },
    ],
  },
  'reaction-diffusion': { preset: 'coral' },
  lenia: { preset: 'cells', seedPattern: 'soup', seedSpots: 9, style: 'dual' },
  physarum: { preset: 'veins' },
  marbling: { preset: 'feather', drops: 75, swirl: 0.6 },
  meander: { preset: 'young', iterations: 150, migration: 0.5, traces: 7, flowLines: 3 },
  coral: { preset: 'bloom', seedShape: 'polygon', iterations: 300, rings: 26 },
  gesture: { preset: 'kline' },
  // The grating shares its renderer with noise-texture — at plain defaults the
  // two previews would be byte-identical. The blob mask is the grating's own
  // showcase (same variant the goldens pin).
  grating: { maskMode: 'blob', maskIrregularity: 0.6 },
};

function stateFor(mod: PureModule<Record<string, unknown>>) {
  const state = { ...mod.defaultState(), ...(PREVIEW_STATES[mod.id] ?? {}) };
  // Defaults roll a random seed per page load — pin for reproducible previews.
  if ('seed' in state) state.seed = 42;
  return state;
}

const pureModules = MODULES.filter(
  (m): m is PureModule<Record<string, unknown>> => m.kind === 'pure' && !STATIC_IDS.has(m.id)
);

describe('module preview thumbnails', () => {
  if (process.env.UPDATE_PREVIEWS) {
    it('renders preview SVGs for every pure module', () => {
      mkdirSync(SVG_OUT, { recursive: true });
      for (const mod of pureModules) {
        // Through the compositor (not bare render) so multi-ink modules show
        // their real layer colours on the white sheet.
        const layers: CompositeLayer[] = [
          {
            instanceId: 'preview',
            module: mod as Module,
            state: stateFor(mod),
            visible: true,
            holdOffMm: 0,
          },
        ];
        writeFileSync(`${SVG_OUT}${mod.id}.svg`, composite(frame, page, layers).exportSvg);
      }
      expect(pureModules.length).toBeGreaterThan(20);
    });
    return;
  }

  it('every module has a committed preview PNG and no orphans exist', () => {
    const have = new Set(readdirSync(PREVIEWS_DIR).filter((f) => f.endsWith('.png')));
    for (const mod of MODULES) {
      expect(have.has(`${mod.id}.png`), `missing preview for ${mod.id} — run \`pnpm previews\``).toBe(
        true
      );
      have.delete(`${mod.id}.png`);
    }
    expect([...have], 'orphan preview PNGs for modules no longer registered').toEqual([]);
  });

  it('previews stay small enough for the picker grid', () => {
    for (const mod of MODULES) {
      expect(
        statSync(`${PREVIEWS_DIR}${mod.id}.png`).size,
        `${mod.id}.png too heavy for a thumbnail`
        // PNG weight tracks inked-pixel entropy, not stroke count — the dense
        // multi-ink fields (colour field ~195KB) legitimately sit near the cap.
      ).toBeLessThan(250_000);
    }
  });
});
