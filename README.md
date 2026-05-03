# Repack Library Discovery Prototype

Phase 1 builds a modern, mobile-first discovery homepage inspired by the official FitGirl Repacks site, with a safer browsing warning, visual Top 10 cards, fast filters, smart search, and a locally stored official A-Z index.

Official reference used: <https://fitgirl-repacks.site/>

## Run locally

Open `index.html` directly, or serve the folder with any static server.

With Node available:

```powershell
node server.js
```

Then visit <http://localhost:4173>.

## Phase 1 scope

- Homepage discovery layout
- Top 10 visual game cards
- Dedicated `/catalog` page for deep search, filters, sorting, and pagination
- Quick search command palette from the header
- Quick preview drawer for rich game cards
- Full official A-Z catalog index in `data/catalog-index.json`
- Genre, system, storage, and hypervisor filters
- Smart search examples such as `elden`, `zombie coop under 30gb`, and `low end racing`
- Strong official-source warning for `https://fitgirl-repacks.site/`

Future phases can add detail pages, update timelines, local library states, and community notes.

## Refresh the official A-Z index

```powershell
node scripts/import-official-catalog.mjs
```

The importer reads only `https://fitgirl-repacks.site/all-my-repacks-a-z/` and writes `data/catalog-index.json`.
