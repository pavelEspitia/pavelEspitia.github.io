import { resolve } from 'node:path';
import { defineConfig } from 'vite';

import { copyStaticRoutes } from './scripts/copy-static.mjs';

export default defineConfig({
  base: '/',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  plugins: [{
    name: 'copy-static-routes',
    async closeBundle() {
      await copyStaticRoutes(process.cwd(), resolve(process.cwd(), 'dist'));
    },
  }],
});
