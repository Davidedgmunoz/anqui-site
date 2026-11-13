import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Domain lives here only. Defaults to the GitHub Pages project site; App Store Connect points at
// these URLs, keep them stable. For a custom domain set SITE_URL=https://example.com and SITE_BASE=/.
const site = process.env.SITE_URL || 'https://davidedgmunoz.github.io';
const base = process.env.SITE_BASE || '/anqui-site';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // Spanish at the root, English under /en/; emits xhtml:link hreflang alternates.
      i18n: { defaultLocale: 'es', locales: { es: 'es', en: 'en' } },
    }),
  ],
});
