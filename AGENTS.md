# Project Overview

Swing in Hamburg: bilingual (EN/DE) Astro site listing Lindy Hop classes, backed by Payload CMS.

- **Frontend** (`/`): Astro 6 SSR (`output: 'server'`) with the Node adapter. Pages live under `src/pages/[locale]/`; `/` redirects to `/en`. Uses **npm**.
- **CMS** (`/cms`): Payload 3.x (git submodule `nikplx/swinginhamburg-cms`), Postgres, Next.js admin UI. Uses **npm**. See `cms/AGENTS.md` for Payload conventions and the full command list.

## Data flow

`src/utils.ts` exports a `PayloadSDK` instance pointed at `PAYLOAD_URL` (default `http://localhost:3000`), typed against `cms/src/payload-types.ts`. Main collections: `events`, `organizations`, `dances`. Event dates are read through the custom `GET /api/occurrences` endpoint (`fetchOccurrences` in `src/utils.ts`; implemented in `cms/src/endpoints/occurrences.ts`). Global: `index` (homepage content, richtext rendered via the `RichText` component).

## Commands

- Frontend: `npm run dev` (port 4321), `npm run build`, `npm run preview`.
- CMS: `npm run setup` (docker DB + fixture + migrations + dev), `npm run dev`. After schema changes run `npm run payload migrate:create <name>` and `npm run generate:types` (dev uses `push: false`, so migrations are the only way the schema changes); after admin component changes run `npm run generate:importmap`.

## Deployment

GitHub Actions builds a Docker image on push to `main` and publishes to `ghcr.io/nikplx/swinginhamburg` (standalone Node server on port 4321).
