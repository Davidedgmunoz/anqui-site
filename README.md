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
