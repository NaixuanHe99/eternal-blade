import { defineConfig } from 'vite';
// base './' => relative asset paths, works under any subpath (e.g. GitHub Pages /eternal-blade/)
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1200 },
});
