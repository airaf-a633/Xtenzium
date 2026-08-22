// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.xtenzium.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/crm') && !page.includes('/admin'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Inline small assets so the first paint needs fewer round-trips.
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
