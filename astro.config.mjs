import { defineConfig } from 'astro/config';

// Served as a GitHub Pages project site; App Store Connect points at these URLs, keep them stable.
export default defineConfig({
  site: 'https://davidedgmunoz.github.io',
  base: '/anqui-site',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
