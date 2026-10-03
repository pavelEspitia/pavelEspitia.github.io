import { resolve } from 'node:path';
import { defineConfig } from 'vite';

import { copyStaticRoutes } from './scripts/copy-static.mjs';
import { siteContent } from './src/content/portfolio.ts';
import { validateSiteContent } from './src/content/schema.ts';
import { renderHomePage } from './src/templates/page.ts';

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
    name: 'render-semantic-portfolio',
    transformIndexHtml(html) {
      const validation = validateSiteContent(siteContent);
      if (!validation.valid) throw new Error(`Portfolio content validation failed:\n${validation.errors.join('\n')}`);
      const marker = '<!-- portfolio-content -->';
      if (!html.includes(marker)) throw new Error('Portfolio content marker is missing from index.html.');
      return html.replace(marker, renderHomePage(siteContent));
    },
  }, {
    name: 'copy-static-routes',
    async closeBundle() {
      await copyStaticRoutes(process.cwd(), resolve(process.cwd(), 'dist'));
    },
  }],
});
