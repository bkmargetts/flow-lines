// Copy the MediaPipe WASM runtime out of node_modules so it is served from
// our own origin (no CDN dependency, version always matches the package).
// Runs before dev and build; the target directory is gitignored.
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const wasmDir = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mediapipe-wasm');

mkdirSync(target, { recursive: true });
cpSync(wasmDir, target, { recursive: true });
console.log(`Copied MediaPipe WASM runtime to ${target}`);
