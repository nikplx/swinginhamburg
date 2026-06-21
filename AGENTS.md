# Project Overview

Swing in Hamburg is a bilingual (EN/DE) website listing Lindy Hop dance classes in Hamburg. It consists of two parts:

- **Frontend** (`/`): An Astro 6 site running in SSR mode (`output: 'server'`) with the Node adapter. Fetches content from the CMS at build/request time via `@payloadcms/sdk`.
- **CMS** (`/cms`): A Payload CMS 3.x app (git submodule from `nikplx/swinginhamburg-cms`), backed by PostgreSQL, using Next.js as the admin UI framework.

The root `/` redirects to `/en`. All pages live under `src/pages/[locale]/` with `getStaticPaths` returning `["en", "de"]`.

# Commands

## Frontend (root directory)

```bash
npm run dev          # Dev server at localhost:4321
npm run build        # Production build to ./dist/
npm run preview      # Preview production build
```

## CMS (`cd cms`)

The CMS uses **pnpm** (not npm):

```bash
pnpm run dev             # Dev server (Next.js)
pnpm run build           # Production build
pnpm run generate:types  # Regenerate payload-types.ts after schema changes
pnpm run generate:importmap  # Regenerate import map after creating/modifying components
pnpm run test:int        # Integration tests (vitest)
pnpm run test:e2e        # E2E tests (playwright)
pnpm run setup           # Start docker DB, restore fixture, start dev
pnpm run db:dump         # Dump DB to db-fixture.sql
pnpm run db:restore      # Restore DB from db-fixture.sql
```

TypeScript check in CMS: `tsc --noEmit`

# Architecture

## Data Flow

The frontend uses `PayloadSDK` (initialized in `src/utils.ts`) to call the CMS REST API at `PAYLOAD_URL` (default `http://localhost:3000/api`). The SDK is typed against `cms/src/payload-types.ts` (auto-generated, committed via the submodule).

## Key Collections

- **classes**: Dance class listings with weekday, title, address, location (geo coordinates), school (relationship)
- **schools**: Dance schools
- **index** (global): Homepage content (subtitle, intro, donation box, disclaimer, learn header/description) — all richtext fields rendered via `RichText` component

## Frontend Pages (`src/pages/[locale]/`)

- `index.astro` — Main listings page: classes grouped by weekday
- `map.astro` — Leaflet map with class locations
- `about.astro` — About page
- `home.astro` — Alternate landing page design (not linked in nav)

## Shared Utilities (`src/utils.ts`)

- `payload` — SDK instance
- `sortWeekdays` — Sorts classes by weekday order (Mon→Sun)
- `translateWeekday` — EN→DE weekday translation
- `collect` — Generic group-by reducer

## Styling

Global styles in `src/styles/global.css`. Uses CSS custom properties (`--bg-cream`, `--accent-red`, etc.). Font: Jost (Google Fonts). Map uses Leaflet CSS from unpkg CDN.

# Deployment

GitHub Actions builds a Docker image on push to `main` and publishes to `ghcr.io/nikplx/swinginhamburg`. The Dockerfile builds the Astro site and runs the standalone Node server on port 4321.

# CMS Development

The `cms/` directory is a git submodule. Refer to `cms/AGENTS.md` for Payload CMS conventions including:
- Always run `generate:types` after schema changes
- Always run `generate:importmap` after creating/modifying admin components
- Always pass `req` to nested operations in hooks
- Set `overrideAccess: false` when passing `user` to Local API
