# Anqui site

Public site for Anqui: the landing page plus privacy policy, support and credits, in Spanish (`/`) and
English (`/en/`). Built with Astro; GSAP drives the animations and wanakana the kana typing demo.
No analytics, trackers or external requests: fonts are self-hosted through Fontsource.

App Store Connect points at `/`, `/support/` and `/privacy/` (and their `/en/` versions): keep those URLs stable.

## Commands

- `npm install`: first time.
- `npm run dev`: dev server at `http://localhost:4321/anqui-site/`.
- `npm run build`: static site in `dist/`.

## Where things live

- `src/i18n.ts`: every landing string in both languages, and the App Store link.
- `src/components/Landing.astro`, `src/styles/landing.css`, `src/scripts/landing.ts`: the landing page.
- `src/components/StoreButtons.astro`: App Store button and the Mac "coming soon" placeholder.
- `src/legal/<lang>/<page>.html`: privacy, support and credits copy, as HTML fragments.
- `src/assets/`: mascot poses, medals, icon and screenshots, copied from the app repo.
- `src/styles/global.css`: palettes, mirroring the app's themes.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
In the repository settings, Pages → Source must be "GitHub Actions".

The contact address lives in every `support` and `privacy` fragment.
Update the privacy policy before shipping any change that collects data (e.g. analytics).

## Custom domain

The domain is configured in one place: `SITE_URL` and `SITE_BASE` (read in `astro.config.mjs`, defaulting to
`https://davidedgmunoz.github.io` and `/anqui-site`). To move to a custom domain:

1. At the registrar, point DNS at GitHub Pages (an `A`/`AAAA` apex record or a `CNAME` for a subdomain), and set the
   custom domain in the repository settings (Pages).
2. Add `public/CNAME` containing the bare domain (e.g. `anqui.example.com`).
3. In `.github/workflows/deploy.yml`, uncomment the `env` block of the build step and set `SITE_URL` to the new
   origin and `SITE_BASE: /`. Check locally with `SITE_URL=https://example.com SITE_BASE=/ npm run build`.
4. In the app repo, update the three URLs in `fastlane/metadata/*/{marketing,support,privacy}_url.txt` and run
   `make metadata`.

Notes:

- `robots.txt` is generated at build time and points at the sitemap index. Crawlers only honor it at a domain root, so
  on the github.io project path it has no effect until a custom domain is set.
- After the switch, submit `sitemap-index.xml` in Google Search Console.
