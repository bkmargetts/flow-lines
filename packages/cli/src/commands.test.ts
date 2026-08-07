import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { registerGenerate } from './commands/generate.js';
import { registerGrid } from './commands/grid.js';
import { registerImage } from './commands/image.js';
import { registerConway } from './commands/conway.js';
import { registerBotanical } from './commands/botanical.js';
import { registerPlanet } from './commands/planet.js';
import { registerLandscape } from './commands/landscape.js';
import { registerGesture } from './commands/gesture.js';
import { registerMachine } from './commands/machine.js';
import { registerFracture } from './commands/fracture.js';
import { registerMarbling } from './commands/marbling.js';
import { registerLapidary } from './commands/lapidary.js';
import { registerMeander } from './commands/meander.js';
import { registerTangles } from './commands/tangles.js';
import { registerCoral } from './commands/coral.js';
import { registerWarpGrid } from './commands/warp-grid.js';
import { registerInkField } from './commands/ink-field.js';
import { registerHarmonograph } from './commands/harmonograph.js';
import { registerStack } from './commands/stack.js';

/**
 * The CLI surface had no real coverage: `cli.test.ts` imports
 * `@flow-lines/core` and never touches `cli.ts` or anything in `commands/`,
 * so the flag→options mapping for 14 commands was guarded only by
 * `scripts/hash-baseline.mjs`, which is manual and not run in CI.
 *
 * These tests build the same program `cli.ts` builds and drive it the way a
 * user does — through argv — so a renamed flag, a dropped default or a
 * command that stops writing its output fails here.
 */

const REGISTRARS = [
  registerGenerate,
  registerGrid,
  registerImage,
  registerConway,
  registerBotanical,
  registerPlanet,
  registerLandscape,
  registerGesture,
  registerMachine,
  registerFracture,
  registerMarbling,
  registerLapidary,
  registerMeander,
  registerCoral,
  registerWarpGrid,
  registerTangles,
  registerInkField,
  registerHarmonograph,
];

const EXPECTED_COMMANDS = [
  'generate',
  'grid',
  'image',
  'conway',
  'botanical',
  'planet',
  'landscape',
  'gesture',
  'machine',
  'fracture',
  'marbling',
  'lapidary',
  'meander',
  'coral',
  'warp-grid',
  'tangles',
  'ink-field',
  'harmonograph',
];

function buildProgram(): Command {
  const program = new Command();
  program.name('flow-lines').exitOverride();
  for (const register of REGISTRARS) register(program);
  return program;
}

function commandNamed(program: Command, name: string): Command {
  const cmd = program.commands.find((c) => c.name() === name);
  if (!cmd) throw new Error(`no such command: ${name}`);
  return cmd;
}

/** Long flag names a command accepts, e.g. '--width'. */
function flagsOf(cmd: Command): string[] {
  return cmd.options.map((o) => o.long ?? o.short ?? '').filter(Boolean);
}

describe('command registration', () => {
  const program = buildProgram();

  it('registers every command exactly once', () => {
    expect(program.commands.map((c) => c.name()).sort()).toEqual([...EXPECTED_COMMANDS].sort());
  });

  it('gives every command a description for --help', () => {
    for (const name of EXPECTED_COMMANDS) {
      expect(commandNamed(program, name).description(), `${name} description`).not.toBe('');
    }
  });

  it('gives every command the universal flags', () => {
    for (const name of EXPECTED_COMMANDS) {
      const flags = flagsOf(commandNamed(program, name));
      for (const flag of ['--width', '--height', '--seed', '--output']) {
        expect(flags, `${name} is missing ${flag}`).toContain(flag);
      }
    }
  });

  it('gives every command some way to choose the ink', () => {
    // Most commands take a single `--stroke-color`. The three palette-driven
    // scene generators take `--palette` instead, and ink-field takes an
    // explicit `--ink-colors` list, because they emit multi-pen layer colours
    // rather than one ink — so the invariant is "some way", not "always
    // --stroke-color".
    for (const name of EXPECTED_COMMANDS) {
      const flags = flagsOf(commandNamed(program, name));
      expect(
        flags.includes('--stroke-color') ||
          flags.includes('--palette') ||
          flags.includes('--ink-colors'),
        `${name} offers no ink flag`
      ).toBe(true);
    }
  });

  it('gives every command the hand-sketch finish flags', () => {
    for (const name of EXPECTED_COMMANDS) {
      expect(flagsOf(commandNamed(program, name)), `${name}`).toContain('--hand-sketch');
    }
  });

  it('offers --no-optimize wherever plot ordering applies', () => {
    // Every command draws strokes, so every command should be able to skip
    // pen-travel ordering. This caught `generate`/`grid` having no such flag.
    for (const name of EXPECTED_COMMANDS) {
      expect(flagsOf(commandNamed(program, name)), `${name}`).toContain('--no-optimize');
    }
  });

  it('keeps paper and tiling flags together', () => {
    // A command that can target a physical sheet must also be able to tile it;
    // shipping one without the other is the bug this guards.
    for (const name of EXPECTED_COMMANDS) {
      const flags = flagsOf(commandNamed(program, name));
      if (flags.includes('--paper')) {
        expect(flags, `${name} has --paper but no --tile`).toContain('--tile');
      }
    }
  });
});

describe('running commands end to end', () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'flow-lines-cli-'));
    // The commands report progress on stdout; keep the test output readable.
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  async function run(argv: string[]): Promise<string> {
    const out = join(dir, `${argv[0]}-${Math.random().toString(36).slice(2)}.svg`);
    await buildProgram().parseAsync([...argv, '-o', out], { from: 'user' });
    expect(existsSync(out), `${argv[0]} wrote no output`).toBe(true);
    return readFileSync(out, 'utf-8');
  }

  // Deliberately small canvases: this is about the flag wiring, not the art.
  const SMALL = ['-w', '120', '-h', '160', '-s', '7'];

  it.each([
    ['generate', ['generate', ...SMALL, '-l', '8']],
    ['grid', ['grid', ...SMALL, '-g', '40']],
    ['conway', ['conway', ...SMALL]],
    ['botanical', ['botanical', ...SMALL]],
    ['planet', ['planet', ...SMALL]],
    ['landscape', ['landscape', ...SMALL]],
    ['gesture', ['gesture', ...SMALL]],
    ['fracture', ['fracture', ...SMALL]],
    ['marbling', ['marbling', ...SMALL]],
    ['lapidary', ['lapidary', ...SMALL]],
    ['lapidary breccia', ['lapidary', ...SMALL, '--preset', 'breccia', '--pens', '3']],
    ['lapidary strata', ['lapidary', ...SMALL, '--mode', 'strata', '--textures', 'lines,hatch']],
    ['lapidary facet', ['lapidary', ...SMALL, '--preset', 'facet']],
    ['lapidary angular', ['lapidary', ...SMALL, '--shapes', 'angular', '--no-field']],
    ['meander', ['meander', ...SMALL]],
    ['coral', ['coral', ...SMALL]],
    ['warp-grid', ['warp-grid', ...SMALL]],
    ['ink-field ribbon', ['ink-field', ...SMALL]],
    ['ink-field lattice', ['ink-field', ...SMALL, '--style', 'lattice']],
    ['ink-field stripes', ['ink-field', ...SMALL, '--style', 'stripes', '--blocks']],
    ['harmonograph pendulum', ['harmonograph', ...SMALL]],
    ['harmonograph spiro', ['harmonograph', ...SMALL, '--preset', 'wheelwork', '--ink-groups', '2']],
    ['harmonograph rosette', ['harmonograph', ...SMALL, '--preset', 'engine-turn']],
  ])('%s writes a well-formed SVG', async (_name, argv) => {
    const svg = await run(argv);
    expect(svg).toContain('<svg');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('<path');
    // A plot is stroked paths, never fills — the plottability invariant.
    expect(svg).not.toMatch(/fill="(?!none)[^"]+"/);
  });

  it('image renders a photo to hatched strokes', async () => {
    // `image` is the only command needing an input, so it gets a synthetic
    // one: a diagonal ramp with a dark disk, enough to give the pipeline
    // tone, an edge and a contour to chew on.
    const { PNG } = await import('pngjs');
    const w = 64;
    const h = 64;
    const png = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inDisk = Math.hypot(x - 40, y - 24) < 12;
        const v = inDisk ? 20 : Math.round(40 + (200 * (x + y)) / (w + h));
        const i = (y * w + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = v;
        png.data[i + 3] = 255;
      }
    }
    const src = join(dir, 'probe.png');
    writeFileSync(src, PNG.sync.write(png));

    const svg = await run(['image', '-i', src, '-w', '120', '-s', '5']);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('is deterministic for a given seed and differs across seeds', async () => {
    const a = await run(['generate', ...SMALL, '-l', '8']);
    const b = await run(['generate', ...SMALL, '-l', '8']);
    const c = await run(['generate', '-w', '120', '-h', '160', '-s', '8', '-l', '8']);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it('maps --width and --height onto the canvas', async () => {
    const svg = await run(['generate', '-w', '321', '-h', '123', '-s', '1', '-l', '4']);
    expect(svg).toContain('width="321"');
    expect(svg).toContain('height="123"');
  });

  it('maps --stroke-color onto the ink', async () => {
    const svg = await run(['generate', ...SMALL, '-l', '4', '--stroke-color', '#ff0055']);
    expect(svg.toLowerCase()).toContain('#ff0055');
  });

  it('--background adds a backdrop and is off by default', async () => {
    const plain = await run(['generate', ...SMALL, '-l', '4']);
    const withBg = await run([
      'generate', ...SMALL, '-l', '4', '--background', '--background-color', '#102030',
    ]);
    expect(plain.toLowerCase()).not.toContain('#102030');
    expect(withBg.toLowerCase()).toContain('#102030');
  });

  it('--no-optimize changes the plot order', async () => {
    const optimized = await run(['generate', ...SMALL, '-l', '30']);
    const raw = await run(['generate', ...SMALL, '-l', '30', '--no-optimize']);
    expect(raw).not.toBe(optimized);
  });

  it('--plot-order reorders strokes without changing their count', async () => {
    const travel = await run(['ink-field', ...SMALL, '--style', 'lattice']);
    const sweep = await run(['ink-field', ...SMALL, '--style', 'lattice', '--plot-order', 'sweep']);
    expect(sweep).not.toBe(travel);
    const paths = (svg: string) => (svg.match(/<path/g) ?? []).length;
    expect(paths(sweep)).toBe(paths(travel));
  });

  it('--paper renders to a physical sheet size', async () => {
    const svg = await run(['landscape', '--paper', 'A6', '-s', '3']);
    // Physical output carries mm dimensions rather than raw pixels.
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toMatch(/height="[\d.]+mm"/);
  });
});

describe('stack command', () => {
  // `stack` deliberately sits outside the universal-flag invariants above:
  // its art configuration (inks, seeds, sketch) lives in the recipe file, so
  // it carries only output/sheet flags.
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'flow-lines-stack-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  function buildStackProgram(): Command {
    const program = new Command();
    program.name('flow-lines').exitOverride();
    registerStack(program);
    return program;
  }

  function writeRecipe(name: string, recipe: unknown): string {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(recipe), 'utf-8');
    return path;
  }

  async function runStack(recipePath: string, extra: string[] = []): Promise<string> {
    const out = join(dir, `stack-${Math.random().toString(36).slice(2)}.svg`);
    await buildStackProgram().parseAsync(['stack', recipePath, ...extra, '-o', out], {
      from: 'user',
    });
    expect(existsSync(out), 'stack wrote no output').toBe(true);
    return readFileSync(out, 'utf-8');
  }

  /** A small two-layer recipe: a hatch texture holding off (and clipped
   *  inside) a gestural top layer, both explicitly seeded. */
  const RECIPE = {
    version: 1,
    page: { paper: 'a6', resolution: 2, marginMm: 8 },
    layers: [
      {
        id: 'ground',
        generator: 'texture',
        options: { seed: 5, spacingMm: 4 },
        color: '#c04000',
        holdOffMm: 1.5,
        clip: { source: 'figure', mode: 'inside', growMm: 4 },
      },
      {
        id: 'figure',
        generator: 'gesture',
        options: { seed: 9 },
        color: '#111111',
      },
    ],
  };

  it('composites a recipe into namespaced multi-ink strokes', async () => {
    const svg = await runStack(writeRecipe('basic.json', RECIPE));
    expect(svg).toContain('<svg');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('<path');
    // Both layers' inks are present.
    expect(svg.toLowerCase()).toContain('#c04000');
    expect(svg).toContain('#111111');
    // Physical sheet dimensions.
    expect(svg).toMatch(/width="[\d.]+mm"/);
    // Plottability: stroked paths only.
    expect(svg).not.toMatch(/fill="(?!none)[^"]+"/);
  });

  it('reproduces byte-identically across runs', async () => {
    const path = writeRecipe('det.json', RECIPE);
    expect(await runStack(path)).toBe(await runStack(path));
  });

  it('clips the bottom layer inside the top layer\'s shape', async () => {
    const unclipped = {
      ...RECIPE,
      layers: [{ ...RECIPE.layers[0], clip: undefined }, RECIPE.layers[1]],
    };
    const clipped = await runStack(writeRecipe('clip-on.json', RECIPE));
    const open = await runStack(writeRecipe('clip-off.json', unclipped));
    expect(clipped).not.toBe(open);
    // Clipping strictly removes texture ink.
    const paths = (svg: string) => (svg.match(/<path/g) ?? []).length;
    expect(paths(clipped)).toBeLessThan(paths(open));
  });

  it('echoes and transforms move a layer deterministically', async () => {
    const moved = {
      version: 1,
      page: { paper: 'a6', resolution: 2 },
      layers: [
        {
          generator: 'gesture',
          options: { seed: 9 },
          transform: { dxMm: 5 },
          echo: { copies: 2, dxMm: 3 },
        },
      ],
    };
    const base = {
      version: 1,
      page: { paper: 'a6', resolution: 2 },
      layers: [{ generator: 'gesture', options: { seed: 9 } }],
    };
    const a = await runStack(writeRecipe('moved.json', moved));
    const b = await runStack(writeRecipe('base.json', base));
    expect(a).not.toBe(b);
    const paths = (svg: string) => (svg.match(/<path/g) ?? []).length;
    expect(paths(a)).toBe(paths(b) * 2);
  });

  it('--split-layers writes one file per pen with sanitized names', async () => {
    const out = join(dir, 'split.svg');
    await buildStackProgram().parseAsync(
      ['stack', writeRecipe('split.json', RECIPE), '--split-layers', '-o', out],
      { from: 'user' }
    );
    // Namespaced pens L0/… L1/… land as L0-…, never as directories.
    const texturePen = join(dir, 'split.L0-texture.svg');
    expect(existsSync(texturePen), 'missing per-pen file for L0/texture').toBe(true);
    expect(readFileSync(texturePen, 'utf-8')).toContain('<path');
  });

  it.each([
    [
      'unsupported version',
      { version: 2, page: { paper: 'a6' }, layers: [{ generator: 'gesture' }] },
      /recipe\.version/,
    ],
    [
      'unknown generator',
      { version: 1, page: { paper: 'a6' }, layers: [{ generator: 'sunset' }] },
      /recipe\.layers\[0\]\.generator.*valid:/s,
    ],
    [
      'missing paper',
      { version: 1, page: {}, layers: [{ generator: 'gesture' }] },
      /recipe\.page\.paper/,
    ],
    [
      'unknown clip source',
      {
        version: 1,
        page: { paper: 'a6' },
        layers: [{ generator: 'gesture', clip: { source: 'sky' } }],
      },
      /clip\.source.*no layer with id "sky"/,
    ],
    [
      'self clip',
      {
        version: 1,
        page: { paper: 'a6' },
        layers: [{ id: 'me', generator: 'gesture', clip: { source: 'me' } }],
      },
      /cannot clip to itself/,
    ],
  ])('rejects a recipe with %s', async (_name, recipe, message) => {
    const path = writeRecipe(`bad-${Math.random().toString(36).slice(2)}.json`, recipe);
    await expect(
      buildStackProgram().parseAsync(['stack', path, '-o', join(dir, 'never.svg')], {
        from: 'user',
      })
    ).rejects.toThrow(message);
  });

  it('rejects an unreadable or malformed recipe file', async () => {
    await expect(
      buildStackProgram().parseAsync(['stack', join(dir, 'nope.json'), '-o', join(dir, 'n.svg')], {
        from: 'user',
      })
    ).rejects.toThrow(/could not read recipe/);
    const garbled = join(dir, 'garbled.json');
    writeFileSync(garbled, '{ not json', 'utf-8');
    await expect(
      buildStackProgram().parseAsync(['stack', garbled, '-o', join(dir, 'n2.svg')], {
        from: 'user',
      })
    ).rejects.toThrow(/could not read recipe/);
  });
});
