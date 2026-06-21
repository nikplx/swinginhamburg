# Swing in Hamburg

Staging environment links:

CMS: https://cms.swinginhamburg.eins9und30.de/admin
Website: https://swinginhamburg.eins9und30.de/de/

## Local development

The project has two parts: an Astro frontend at the repo root (npm) and a Payload CMS in `/cms` as a git submodule (pnpm, Postgres in Docker).

Requirements: Docker, Node ≥ 22.12, and pnpm (`npm i -g pnpm`).

### One-time setup

```bash
# Check out the CMS submodule
git submodule update --init --recursive

# Install dependencies
npm install
(cd cms && pnpm install)
```

Create `cms/.env` (the bundled `cms/.env.example` is from the upstream template and references MongoDB — ignore it):

```
DATABASE_URL=postgres://postgres:changeme@localhost:5432/postgres
PAYLOAD_SECRET=any-random-string-for-local-dev
```

The credentials match the defaults in `cms/docker-compose.yml`.

### Running it

Two terminals:

```bash
# Terminal 1 — CMS on http://localhost:3000
cd cms
pnpm run setup   # first run: starts Postgres, restores db-fixture.sql, runs next dev
pnpm run dev     # subsequent runs
```

```bash
# Terminal 2 — Astro frontend on http://localhost:4321
npm run dev
```

The frontend reads `PAYLOAD_URL` (default `http://localhost:3000`, see `src/utils.ts`), so no extra config is needed once the CMS is up. Open http://localhost:4321 (redirects to `/en`); the CMS admin is at http://localhost:3000/admin.

If the database gets into a bad state, `pnpm run dev:clean` in `/cms` drops the Docker volume and re-seeds from the fixture.

## Project structure

```text
.
├── src/
│   ├── pages/
│   │   └── [locale]/        # /en and /de routes; / redirects to /en
│   ├── components/          # Astro/React components, incl. RichText
│   ├── styles/
│   └── utils.ts             # PayloadSDK instance pointed at PAYLOAD_URL
├── public/                  # static assets
├── Dockerfile               # production image, served on port 4321
└── cms/                     # Payload CMS (git submodule, separate package)
```

See [`AGENTS.md`](./AGENTS.md) for a fuller architecture overview and `cms/README.md` for CMS-specific details.

## Frontend commands

All commands are run from the repo root with npm. CMS commands live in `/cms` and use pnpm — see `cms/README.md`.

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Start local dev server at `localhost:4321`   |
| `npm run build`   | Build the production site to `./dist/`       |
| `npm run preview` | Preview the build locally before deploying   |
