// Render every photo in a directory through every style preset and build
// an HTML contact sheet — the eyeball-regression suite for renderer tuning.
//
//   node scripts/gallery.mjs [inputDir] [outputDir]
//
// For photo.jpg, an optional photo.depth.png (bright = near),
// photo.normal.png (R/G = X/Y direction) and photo.labels.png (semantic
// taxonomy id in the red channel — see scripts/segment-labels.mjs) are
// picked up automatically.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const cli = join(root, 'packages', 'cli', 'dist', 'cli.js');
const inputDir = resolve(process.argv[2] ?? join(root, 'test-images'));
const outputDir = resolve(process.argv[3] ?? join(root, 'gallery'));

// Mirrors the web app's style presets (see packages/web ImageControls)
const PRESETS = {
  classic: [
    '--layers', '3', '--tone-gamma', '1.3', '--texture', '0.6', '--wobble', '0.8',
    '--value-bands', '4', '--massing', '0.5',
  ],
  portrait: [
    '--layers', '3', '--tone-gamma', '1.7', '--texture', '0.4', '--wobble', '0.9',
    '--working-size', '800',
  ],
  pet: [
    '--layers', '2', '--max-spacing', '12', '--tone-gamma', '1.45', '--texture', '1',
    '--wobble', '1', '--working-size', '800', '--value-bands', '4', '--massing', '0.4',
  ],
  landscape: [
    '--layers', '5', '--min-spacing', '1.8', '--max-spacing', '16', '--tone-gamma', '1',
    '--texture', '0.7', '--wobble', '0.9', '--working-size', '800', '--white-cutoff', '0.14',
    '--hatch-angle', '0', '--sky-stipple', '--calm-water', '--max-stroke', '70', '--field-smoothing', '5',
    '--value-bands', '4', '--hatch-patchiness', '0.7', '--facet-hatch', '--massing', '0.4',
  ],
  sketch: [
    '--layers', '1', '--min-spacing', '3.2', '--max-spacing', '24', '--tone-gamma', '1.35',
    '--texture', '0.8', '--texture-style', 'scribble', '--wobble', '2.2', '--value-bands', '3',
    '--hatch-patchiness', '0.6', '--detail', '0.4', '--white-cutoff', '0.1', '--hatch-angle', '-30',
    '--field-smoothing', '3', '--massing', '0.5',
  ],
  etching: [
    '--layers', '2', '--min-spacing', '2.8', '--white-cutoff', '0.15', '--tone-gamma', '1.8',
    '--texture', '0.15', '--wobble', '0.4', '--working-size', '800', '--cross-contour',
    '--max-stroke', '48', '--field-smoothing', '8', '--value-bands', '5',
    '--hatch-patchiness', '0.5', '--facet-hatch', '--massing', '0.5',
  ],
  // Artist styles live in core (PEN_INK_STYLES) — one flag, no mirroring
  comic: ['--style', 'comic'],
  dore: ['--style', 'dore'],
  ballpoint: ['--style', 'ballpoint'],
};

if (!existsSync(cli)) {
  console.error('CLI not built — run `pnpm build` first');
  process.exit(1);
}

const images = readdirSync(inputDir).filter(
  (f) =>
    /\.(png|jpe?g)$/i.test(f) && !/\.(depth|normal|labels)\.(png|jpe?g)$/i.test(f)
);

if (images.length === 0) {
  console.error(`No images found in ${inputDir}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
const cells = [];

for (const image of images) {
  const stem = basename(image, extname(image));
  const sidecar = (suffix) =>
    ['png', 'jpg', 'jpeg']
      .map((ext) => join(inputDir, `${stem}.${suffix}.${ext}`))
      .find(existsSync);

  const depth = sidecar('depth');
  const normal = sidecar('normal');
  const labels = sidecar('labels');
  const row = { image, renders: [] };

  for (const [preset, flags] of Object.entries(PRESETS)) {
    const out = `${stem}-${preset}.svg`;
    const args = [
      cli, 'image',
      '-i', join(inputDir, image),
      '-o', join(outputDir, out),
      '--seed', '42',
      '--width', '900',
      ...flags,
    ];
    if (depth) args.push('--depth-image', depth, '--auto-style');
    if (normal) args.push('--normal-image', normal);
    if (labels) args.push('--label-image', labels);

    process.stdout.write(`${image} × ${preset}… `);
    execFileSync(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('done');
    row.renders.push({ preset, file: out });
  }

  cells.push(row);
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Flow Lines gallery</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f1ea; margin: 24px; }
  h2 { margin: 32px 0 8px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; background: white; padding: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  figure img { width: 300px; display: block; }
  figcaption { font-size: 12px; color: #555; padding-top: 6px; text-align: center; }
</style></head><body>
<h1>Flow Lines gallery</h1>
<p>Seed 42, width 900. Depth/normal sidecars applied where present.</p>
${cells
  .map(
    (row) => `<h2>${row.image}</h2>\n<div class="row">${row.renders
      .map(
        (r) =>
          `<figure><img src="${r.file}" loading="lazy"><figcaption>${r.preset}</figcaption></figure>`
      )
      .join('')}</div>`
  )
  .join('\n')}
</body></html>`;

writeFileSync(join(outputDir, 'index.html'), html);
console.log(`\nGallery written to ${join(outputDir, 'index.html')}`);
