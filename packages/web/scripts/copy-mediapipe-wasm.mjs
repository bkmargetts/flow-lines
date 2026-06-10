// Copy WASM runtimes out of node_modules so they are served from our own
// origin (no CDN dependency, versions always match the packages).
// Runs before dev and build; target directories are gitignored.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// MediaPipe vision tasks (segmentation, face landmarks)
const mediapipeWasm = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
const mediapipeTarget = join(publicDir, 'mediapipe-wasm');
mkdirSync(mediapipeTarget, { recursive: true });
cpSync(mediapipeWasm, mediapipeTarget, { recursive: true });
console.log(`Copied MediaPipe WASM runtime to ${mediapipeTarget}`);

// ONNX runtime used by transformers.js (depth estimation). It is a
// transitive dependency, so resolve it from the transformers package.
const transformersRequire = createRequire(require.resolve('@huggingface/transformers'));
const ortDist = dirname(transformersRequire.resolve('onnxruntime-web'));
const ortTarget = join(publicDir, 'ort-wasm');
mkdirSync(ortTarget, { recursive: true });

let copied = 0;
for (const file of readdirSync(ortDist)) {
  if (file.endsWith('.wasm') || file.endsWith('.mjs')) {
    cpSync(join(ortDist, file), join(ortTarget, file));
    copied++;
  }
}
console.log(`Copied ${copied} ONNX runtime files to ${ortTarget}`);
