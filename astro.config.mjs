import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
          warn(warning);
        },
      },
    },
  },
  integrations: [tailwind()],
  markdown: {
    shikiConfig: {
      theme: 'dracula',
      wrap: true
    }
  },
  site: 'https://til.assahbismark.com',
});
