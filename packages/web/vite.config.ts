import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/flow-lines/',
  // Which build am I looking at? Pages deploys lag and browsers cache the
  // bundle hard — the stamp in the controls drawer settles it at a glance.
  define: {
    __BUILD_STAMP__: JSON.stringify(
      (process.env.GITHUB_SHA ?? 'dev').slice(0, 7) + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z'
    ),
  },
  // Workers import code-split dependencies (transformers.js), which the
  // default IIFE worker format can't express
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
