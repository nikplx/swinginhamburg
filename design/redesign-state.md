# Redesign state — Swing in Hamburg

Handoff/compaction note. Everything below reflects the working tree at commit
`89aae75 new design` + one uncommitted revert (see “Working tree” at the end).

## Goal & constraints

Adapt the existing Astro site to the new Figma design. **Visual only** (fonts,
sizes, spacing, layout, colours). Behaviour/flow changes (default tab, filter
logic, dismissible cards, accordion semantics) are explicitly out of scope for
now. Pages not in the Figma file get the same treatment via global CSS.

## Design source of truth

- Figma file key: `nZot4A5nMqOEEmMW3dgOrN`, page `Final Design` = node `558:125`
- Desktop 1440 frames: landing `558:499`, Tanzschulen `558:958`,
  Über uns `558:1095`, plus `558:589/713/832` variants
- Mobile 393 frames: `558:126/197/258/301/378/456`
  (`558:258` = menu open on cream, `558:456` = menu open on accent)
- Canvas annotations (interaction specs, not implemented): `558:953–957`, `558:1159`
- Access: `.env` → `FIGMA_TOKEN`, `FIGMA_FILE_KEY` (line 3 holds the full share
  URL, parse the key out of it; `source .env` breaks on it)
- Useful endpoints:
  `GET /v1/files/{key}/nodes?ids=558:125&geometry=paths` (specs)
  `GET /v1/images/{key}?ids=…&format=png&scale=2` (renders)
- Rendered frames: `/tmp/opencode/figma/png/*.png` (2× scale)
- Screenshots of the implementation: `/tmp/opencode/shots/*.png`
  taken with `firefox --headless --profile <dir> --window-size=W,H --screenshot`

## Design tokens (in `src/styles/global.css` `:root`)

| token | value |
|---|---|
| `--bg-main` | `#f7f3e9` |
| `--text-main` | `#28466e` |
| `--text-muted` | `rgba(40,70,110,.66)` |
| `--accent` | `#8a4ae4` |
| `--accent-contrast` | `#f7f3e9` |
| `--accent-soft` | `rgba(138,74,228,.1)` |
| `--surface` | `#ffffff` |
| `--rule-color` / `--rule-width` | `#28466e` / `2px` |
| `--warning` | `#fd1010` |

Type scale: `--fs-mega` 60 · `--fs-h1` 34 · `--fs-row` 28 · `--fs-h2` 26 ·
`--fs-h3` 24 · `--fs-body` 18 · `--fs-small` 16 · `--fs-tiny` 14.
Legacy aliases (`--font-title`, `--font-emph`, `--font-desc`, `--font-tag`,
`--font-xxs`) still exist so untouched components keep working.

Layout: `--shell-max` 1440 · `--shell-pad` `clamp(1.25rem,4vw,3.5rem)` ·
`--sidebar-width` `clamp(15rem,30vw,27.1875rem)` ·
`--column-gap` `clamp(2rem,6.5vw,5.8125rem)`.

## Fonts

- **Inter** (variable, optical-size axis) → `--font-body`, self-hosted
  `public/fonts/inter-*.woff2`, preloaded in `layout.astro`.
- **Archivo** (variable) → `--font-display`, stand-in for **Maple Bold**
  (Process Type Foundry, Eric Olson — commercial, self-hosting is a paid tier).
  Swap = drop `maple-bold.woff2` into `public/fonts/`, add `@font-face`, change
  `--font-display`.

## Structure

- `src/components/layout.astro` — sticky header (wordmark + `Nav`), shell grid,
  `sidebar` slot framed by two `<Wave />`s, optional `wide` main column.
- `src/components/wave.astro` — squiggle divider, SVG `<pattern>`,
  tile 48×11, path `M0 5.5 Q12 -3.5 24 5.5 T48 5.5`, `currentColor`.
- `src/components/nav.astro` — sentence-case labels, `DE / EN` switch,
  hamburger + full-screen accent menu on ≤1023px, `<Wave />` inside the menu.
- `src/components/responsiveList(.Item).astro` — single-column list, 2px rules,
  collapsible content (`max-height`), optional circled ± (`indicator="plus"`).
- `src/components/class.astro` — name 28 / address 24 / pills / warning.
- `src/components/event.astro` — date pill, title 28, tags, price.
- `src/components/map.astro` — contained map block, filter card, restyled
  controls; page renders `<Layout wide>`.
- Pages: `index` (sidebar: intro, rule, poll) · `schools`, `swing` (sidebar copy
  only) · `about`, `conduct` (no sidebar) · `map` (wide).

## Working tree

`89aae75` accidentally shipped the landing page with the **Classes** tab as
default (that is why the classes list suddenly looked “styled”). The uncommitted
4-line change in `src/pages/[locale]/index.astro` reverts it to the **Events**
default. Deep links `#events` / `#classes` are supported by the tab script.

## Commands

- `npm run build` (SSR, no CMS needed at build time)
- Dev server: user’s on `:4321`; I used `npm run dev -- --port 4322`
- CMS: `PAYLOAD_URL` in `.env` already ends in `/api` (do not append `/api`
  again); `PAYLOAD_API_KEY` is set
