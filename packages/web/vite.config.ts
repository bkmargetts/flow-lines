import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/flow-lines/',
  // Workers import code-split dependencies (transformers.js), which the
  // default IIFE worker format can't express
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
