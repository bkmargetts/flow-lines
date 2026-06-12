// Generate semantic label sidecars for the gallery / CLI.
//
//   node scripts/segment-labels.mjs [images...]
//
// With no arguments, processes every photo in test-images/ that doesn't
// already have a labels sidecar. For photo.jpg it writes photo.labels.png:
// the red channel carries the core taxonomy id (0 unknown, 1 sky, 2 water,
// 3 foliage, 4 ground, 5 building, 6 person, 7 object); green/blue carry
// id*36 so the raster is eyeballable in an image viewer.
//
// Runs SegFormer-b0 (ADE20K, quantized) via transformers.js — downloads
// model weights from huggingface.co on first run, so this runs on a dev
// machine or CI, not in sandboxes that block the HF CDN. The renderer
// treats missing sidecars gracefully; labels only ever improve dispatch.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { decode as decodeJpeg } from 'jpeg-js';
import { pipeline, RawImage } from '@huggingface/transformers';
import { adeNameToSemantic, labelsFromAdeMasks } from '../packages/core/dist/index.js';

const MODEL = 'Xenova/segformer-b0-finetuned-ade-512-512';
const root = resolve(fileURLToPath(import.meta.url), '..', '..');

const args = process.argv.slice(2);
const inputs =
  args.length > 0
    ? args.map((p) => resolve(p))
    : readdirSync(join(root, 'test-images'))
        .filter(
          (f) =>
            /\.(png|jpe?g)$/i.test(f) &&
            !/\.(depth|normal|labels)\.(png|jpe?g)$/i.test(f)
        )
        .map((f) => join(root, 'test-images', f));

const pending = inputs.filter((file) => {
  const out = labelPath(file);
  if (existsSync(out)) {
    console.log(`skip ${basename(file)} — ${basename(out)} exists`);
    return false;
  }
  return true;
});

if (pending.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

function labelPath(file) {
  const stem = basename(file, extname(file));
  return join(dirname(file), `${stem}.labels.png`);
}

// Decode via pngjs/jpeg-js and hand transformers a RawImage directly —
// RawImage.read() in Node wants sharp, which we don't depend on
function loadRawImage(file) {
  const buffer = readFileSync(file);
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    const png = PNG.sync.read(buffer);
    return new RawImage(Uint8ClampedArray.from(png.data), png.width, png.height, 4);
  }
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpeg = decodeJpeg(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return new RawImage(Uint8ClampedArray.from(jpeg.data), jpeg.width, jpeg.height, 4);
  }
  throw new Error(`Unsupported image format: ${file}`);
}

console.log(`Loading ${MODEL}…`);
const segment = await pipeline('image-segmentation', MODEL, { dtype: 'q8' });

for (const file of pending) {
  process.stdout.write(`${basename(file)}… `);
  const image = loadRawImage(file);

  // Semantic segmentation returns one binary mask per detected class,
  // disjoint, at the input resolution
  const results = await segment(image);
  const { width, height, data: ids } = labelsFromAdeMasks(results);

  const png = new PNG({ width, height });
  for (let i = 0; i < ids.length; i++) {
    png.data[i * 4] = ids[i];
    png.data[i * 4 + 1] = ids[i] * 36;
    png.data[i * 4 + 2] = ids[i] * 36;
    png.data[i * 4 + 3] = 255;
  }
  writeFileSync(labelPath(file), PNG.sync.write(png));

  const counts = new Map();
  for (const { label, mask } of results) {
    const sem = adeNameToSemantic(label);
    if (sem === 'unknown') continue;
    let n = 0;
    for (let i = 0; i < mask.data.length; i++) if (mask.data[i] > 127) n++;
    if (n > 0) counts.set(sem, (counts.get(sem) ?? 0) + n / ids.length);
  }
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, frac]) => `${label} ${(frac * 100).toFixed(0)}%`)
    .join(', ');
  console.log(`done (${summary || 'nothing recognized'})`);
}
