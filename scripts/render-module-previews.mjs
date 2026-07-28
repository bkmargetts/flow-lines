// Rasterizes the picker thumbnails for the web app's browse-all layer picker.
//
// Pipeline (run from the repo root as `pnpm previews`):
//   1. UPDATE_PREVIEWS=1 vitest renders every pure module at seed 42 into
//      packages/web/.preview-svgs/*.svg (see packages/web/src/module-previews.test.ts)
//   2. this script rasterizes those SVGs into
//      packages/web/src/modules/previews/<id>.png (committed, imported by the app)
//
// The renders use the low-density A4 test frame (~315px wide at 0.45px pen),
// so strokes are scaled up before rasterizing or they vanish at thumbnail size.
//
// Static thumbnails this script does NOT produce (committed once, regenerate
// only deliberately, `module-previews.test.ts` still requires them to exist):
//   image-ink — the live module needs a photo + ML; rendered via the built CLI:
//     node packages/cli/dist/cli.js image -i test-images/<photo>.jpg \
//       -o /tmp/image-ink-preview.svg --seed 42
//     then rasterized here by dropping the SVG into packages/web/.preview-svgs/.
//   blank — a hand-authored empty-sheet card (it renders nothing by design).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const IN = 'packages/web/.preview-svgs';
const OUT = 'packages/web/src/modules/previews';
const WIDTH = 320;
const STROKE_SCALE = 2.5;

mkdirSync(OUT, { recursive: true });

const svgs = readdirSync(IN).filter((f) => f.endsWith('.svg'));
if (svgs.length === 0) {
  console.error(`no SVGs in ${IN} — run the UPDATE_PREVIEWS=1 vitest step first`);
  process.exit(1);
}

for (const f of svgs) {
  const svg = readFileSync(join(IN, f), 'utf8').replace(
    /stroke-width="([\d.]+)"/g,
    (_, w) => `stroke-width="${Number(w) * STROKE_SCALE}"`
  );
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    background: '#ffffff',
  })
    .render()
    .asPng();
  const out = join(OUT, f.replace(/\.svg$/, '.png'));
  writeFileSync(out, png);
  console.log(`wrote ${out} (${(png.length / 1024).toFixed(1)} KB)`);
}
