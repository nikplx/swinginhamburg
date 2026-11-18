# New Events branch — what changed and how to adapt the frontend

Scope: the `new-events` work in the `cms/` submodule plus the Astro frontend in this repository.
The CMS branch replaces the old `classes` / `schools` / `teachers` model with unified
`events` / `organizations` / `dances` collections, adds a server-side occurrence expander and a
public `/api/occurrences` endpoint, and reworks access control, admin UX and i18n.

> **Branch/commit note:** the CMS submodule is on `new-events`; the frontend changes are in the
> working tree of this repository. Migrations are the source of truth (`push: false`), so deploy
> the CMS with `pnpm payload migrate`.

---

## 1. TL;DR — breaking changes for a frontend

| Old | New |
| --- | --- |
| `classes` collection, `Class` type, `/api/classes` | `events` collection, `Event` type, `/api/events` |
| `schools` collection, `School` type, `/api/schools` | `organizations` collection, `Organization` type, `/api/organizations` |
| `teachers` collection | removed |
| `event.type`: `class, social, workshop, talk, walk, festival, other` | **`social, event, class`** (default `event`; workshops are events) |
| `organizations.description`: plain string (textarea) | **Lexical rich-text JSON** |
| `school.address`, point `location` tuple | `event.location` group with `address`, `name`, `lat`, `lng`, `directionsNote` |
| `/schools` page | `/organizations` page |
| Weekly class rows with `weekday` + times | `schedule` blocks + expanded occurrences (see §2) |

The public content endpoints are still plain Payload REST (`/api/...`). For calendars, use the new
`/api/occurrences` endpoint instead of expanding schedules on the client.

---

## 2. Data model

### 2.1 `events` (`/api/events`)

| Field | Type | Notes |
| --- | --- | --- |
| `title` | text | required, **not localized** |
| `type` | select | `social` \| `event` \| `class`; default `event` |
| `description` | richText | localized (`de`, `en`), Lexical JSON; no headings/uploads in the editor |
| `organizers` | relationship → `organizations` | required, `hasMany` (co-hosted events) |
| `danceStyles` | relationship → `dances` | `hasMany`; required for `class` |
| `level` | select | `all` \| `beginner` \| `intermediate` \| `advanced` \| `open`; only shown for classes |
| `location` | group | `address`, `name`, `lat`, `lng`, `directionsNote`; `address` is read-only in the admin and always has coordinates |
| `schedule` | blocks | always an **array** (max 1 row), see §2.2 |
| `exceptions` | json | per-date overrides, see §2.3 |
| `firstDate` / `lastDate` | date | derived; `lastDate` is `null` for open-ended series |
| `lastConfirmed` | date | for open-ended series, when the organizer last checked the schedule |
| `_status` | `draft` \| `published` | drafts are enabled; public reads only see `published` |

API example:

```json
{
  "id": 12,
  "title": "Wednesday Social",
  "type": "social",
  "organizers": [{ "id": 3, "name": "Swing in Hamburg", "slug": "swing-in-hamburg" }],
  "danceStyles": [{ "id": 1, "name": "Lindy Hop", "shortName": "Lindy", "slug": "lindy-hop" }],
  "level": null,
  "location": { "name": "Café", "address": "Straße 1, 20095 Hamburg", "lat": 53.55, "lng": 10.0, "directionsNote": null },
  "schedule": [ { "blockType": "recurring", "frequency": "weekly", "interval": 1, "weekdays": ["WE"], "startDate": "2026-11-18", "startTime": "20:00", "endTime": "23:00", "endMode": "never" } ],
  "exceptions": {},
  "firstDate": "2026-11-18T00:00:00.000Z",
  "lastDate": null,
  "_status": "published"
}
```

### 2.2 `schedule` blocks (exactly one block per event)

- `once`: `{ blockType: 'once', date, startTime, endTime }`
- `dates`: `{ blockType: 'dates', dates: [{ date, startTime, endTime }] }`
- `recurring`:
  `{ blockType: 'recurring', frequency: 'weekly' | 'monthly', interval, startDate, startTime, endTime, endMode: 'never' | 'until' | 'count', until?, count? }`
  - weekly: `weekdays: ['MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU']`
  - monthly: `monthlyMode: 'dayOfMonth' | 'nthWeekday'`, `dayOfMonth`, or `nthWeekday` (`1|2|3|4|-1`) + `weekday`
- `course`: `{ blockType: 'course', startDate, weekday, startTime, endTime, sessions, skipDates: [{ date }] }`
  - `startDate` is a *from* date: the first session is the next matching weekday
  - skipped dates do not reduce the number of sessions

All times are `HH:mm` wall-clock times in **Europe/Berlin**. You do not need to interpret the
schedule in the frontend for calendars — use the occurrences endpoint.

### 2.3 `exceptions`

Keyed by local date (`YYYY-MM-DD`, Europe/Berlin), hidden in the admin (edited through the schedule
preview table):

```json
{
  "2026-12-24": { "cancelled": true },
  "2026-12-31": { "startTime": "21:00", "endTime": "01:00", "note": "Silvester special" }
}
```

The expander applies these overrides; the occurrences endpoint already returns the final values.

### 2.4 `organizations` (`/api/organizations`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | text | not localized |
| `slug` | text | unique; used for links and filters |
| `kind` | select | `school`, `association`, `individual`, `other` |
| `description` | richText | localized, Lexical JSON (**was a plain string**) |
| `links` | array | `{ label, url }` |
| `defaultLocation` | group | same shape as event location; used to prefill new events |
| `members` | relationship → `users` | **not exposed publicly** (restricted read); grants description editing |

### 2.5 `dances` (`/api/dances`)

`name` (localized), `shortName` (stable filter key), `slug`, `description` (localized rich text).
Public read.

### 2.6 Globals

Slugs unchanged: `index`, `about`, `swing`, `schools-global` (the copy for the organizations page).
All content fields are localized.

---

## 3. Occurrences API — the main frontend integration point

**`GET /api/occurrences`**

### Query parameters

| Param | Default | Notes |
| --- | --- | --- |
| `from` | today (Europe/Berlin) | `YYYY-MM-DD` |
| `to` | `from + 60 days` | `YYYY-MM-DD`; must be `>= from` (otherwise `400`) |
| `locale` | `de` | `de` or `en`; affects localized relationship fields |
| `type` | – | `social` \| `event` \| `class` |
| `danceStyle` (`danceStyleId`) | – | slug or numeric ID; also keeps events **without** a dance style |
| `organization` (`organizationId`) | – | slug or numeric ID |

### Response

```json
{
  "occurrences": [
    {
      "eventId": 12,
      "date": "2026-11-18",
      "start": "2026-11-18T19:00:00.000Z",
      "end": "2026-11-18T22:00:00.000Z",
      "cancelled": false,
      "note": "Silvester special",
      "event": {
        "id": 12,
        "title": "Wednesday Social",
        "type": "social",
        "level": null,
        "description": { "root": { "...": "Lexical JSON" } },
        "organizers": [{ "id": 3, "name": "Swing in Hamburg", "slug": "swing-in-hamburg" }],
        "danceStyles": [{ "id": 1, "name": "Lindy Hop", "shortName": "Lindy", "slug": "lindy-hop" }],
        "location": { "name": "Café", "address": "...", "lat": 53.55, "lng": 10.0, "directionsNote": null },
        "firstDate": "2026-11-18T00:00:00.000Z",
        "lastDate": null
      }
    }
  ]
}
```

Semantics:

- Sorted by `start` (UTC), then `eventId`.
- `date` is the **local start date** in Europe/Berlin; `start`/`end` are UTC ISO strings.
- An end time earlier than the start time means the occurrence runs past midnight; `end` is on the
  following day while `date` stays on the start day.
- `cancelled` occurrences are still returned (render them struck-through / with a badge).
- `note`, time overrides and cancellations from `exceptions` are already applied — do not recompute
  times from the event schedule on the client.
- Only `published` events are included.
- Server-side in-process cache: responses are cached per parameter set until the next midnight in
  Europe/Berlin, and cleared whenever events/organizations/dances change. No client cache-busting
  parameter is needed, but long-lived CDN/proxy caching is not recommended.
- No pagination: request a bounded range (e.g. 90 days) rather than “all time”.

### Minimal frontend client

```ts
const base = process.env.PAYLOAD_URL ?? 'http://localhost:3000'; // may include /api

export async function fetchOccurrences(params: {
  from: string;
  to: string;
  locale: 'de' | 'en';
  type?: string;
  danceStyle?: string;
  organization?: string;
}) {
  const url = new URL('/api/occurrences', base);
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`occurrences: ${res.status}`);
  return (await res.json()).occurrences as Occurrence[];
}
```

### Rendering rich text

`event.description` and `organization.description` are Lexical JSON. With Astro/Payload:

```ts
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';
const html = convertLexicalToHTML({ data: event.description });
```

or with the React `RichText` component from `@payloadcms/richtext-lexical/react`.

### Direct REST access (filters, detail pages)

```http
GET /api/organizations?locale=de&limit=200&sort=name&depth=0
GET /api/dances?locale=de&limit=100&sort=shortName
GET /api/events?locale=de&where[_status][equals]=published&depth=1&limit=100
GET /api/events?where[organizers][in]=3
```

Notes:

- `organizations.members` is not returned publicly (field-level read access).
- For calendars prefer `/api/occurrences`; direct `events` reads require you to expand `schedule`
  yourself.
- If you query events directly, use `firstDate` / `lastDate` as a coarse range prefilter
  (`lastDate` is `null` for open-ended series).

---

## 4. Access model (affects API results)

Roles: `admin`, `writer`, `school`, `guest` (`system` exists as a legacy value).

| Who | Organizations | Events | Users / Media / Dances / Globals |
| --- | --- | --- | --- |
| anonymous | read all (public fields) | read **published** only | media/dances public read |
| admin | full CRUD | full CRUD | users full; globals full |
| writer | full CRUD | full CRUD | users read-only; globals full |
| school / guest | read **only organizations they are members of** | read/update **only events of those organizations** | hidden from admin nav |
| linked member | may update **organization description only** | may create events for their orgs; may edit events of their orgs | – |

Additional rules:

- A user can be linked to any number of organizations via `organizations.members` (optional).
- Only writers/admins can assign members or create/delete organizations.
- Members cannot reassign an event to another organization.
- Creating an event as a lower role is validated server-side: all selected organizers must be
  organizations the user belongs to.

---

## 5. Admin panel changes (for editors)

- **Schedule editor** replaces the default blocks UI: type selector (once / specific dates /
  recurring / course block) plus a live preview of the next occurrences.
- **Preview table**: cancel a single occurrence, add a note, or override its start/end time.
  Pausing a date range marks all occurrences in it as cancelled.
- **Address search** (events and organizations): type an address, press Enter, pick a result.
  Coordinates are written automatically; an address without coordinates is rejected on save.
- **Organization members**: Organizations → “Zugeordnete Benutzer”. Linked users see only their
  organizations/events and can edit the organization description.
- **Event types** limited to Social / Event / Class, default **Event** (workshops are entered as events).
- **Rich text restrictions**: no headings and no image uploads in event descriptions, organization
  descriptions and the organizations page copy (`schools-global.howToLearn`).
- **Time pickers** use 24-hour time (`HH:mm`) in both languages.
- **i18n**: every field has German/English labels; custom components follow the admin language.
  Language switcher is in the account menu.

---

## 6. Database migrations

Applied in order (CMS `src/migrations`):

1. `20261117_224917_unified_events` — creates `events`, `organizations`, `dances` and drops the old
   `classes` / `schools` tables.
2. `20261118_124847_remove_teachers` — drops the `teachers` collection.
3. `20261118_161637_organization_members` — adds `organizations_rels` for `members`.
4. `20261118_190455_organization_description_richtext` — converts organization descriptions from
   plain text to Lexical JSON (wraps existing text in one paragraph).
5. `20261118_190937_event_type_options` — rebuilds the event type enums; existing
   `talk` / `walk` / `festival` / `other` values become `event`, default set to `event`.
6. `20261118_212710_remove_workshop_type` — removes `workshop` from the enum; existing
   `workshop` values become `event`.

Deploy the CMS first (and run migrations), then the frontend.

---

## 7. Frontend adaptation checklist

1. **Replace collection names**: `classes` → `events`, `schools` → `organizations`; drop `teachers`.
2. **Replace the calendar data source** with `/api/occurrences` (fetch by date range, group by
   `occurrence.date`). Do not expand `schedule` client-side.
3. **Update the type filter** to `social`, `event`, `class`; default filtering can use
   `event` as the generic bucket. Unknown/removed type values are silently ignored by the endpoint,
   so old links like `?type=festival` simply show unfiltered results.
4. **Render descriptions as rich text** (`convertLexicalToHTML` / `RichText`); applies to event and
   organization descriptions.
5. **Use `location.lat` / `location.lng`** for maps, `location.address` / `name` for display,
   `location.directionsNote` for extra hints.
6. **Handle cancellations and notes**: `occurrence.cancelled`, `occurrence.note`; times in
   `start`/`end` already include per-date overrides.
7. **Support multiple organizers and dance styles** (arrays); use `slug` for links/filters.
8. **Timezone**: format `start`/`end` with `timeZone: 'Europe/Berlin'` (or use `date` + local time).
9. **Route rename**: `/schools` → `/organizations` (add a redirect if old URLs are shared).
10. **Draft/publish**: the public endpoint only returns published events; direct event queries must
    filter `_status`.

### Example: grouping and rendering

```ts
const occurrences = await fetchOccurrences({ from, to, locale });

const byDate = new Map<string, Occurrence[]>();
for (const occurrence of occurrences) {
  const list = byDate.get(occurrence.date) ?? [];
  list.push(occurrence);
  byDate.set(occurrence.date, list);
}

const time = (iso: string) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
```

---

## 8. File map (CMS)

| Area | Files |
| --- | --- |
| Collections | `cms/src/collections/{Events,Organizations,Dances,Users,Media}.ts` |
| Access | `cms/src/access.ts` |
| Schedule/occurrence engine | `cms/src/lib/occurrences/{types,schedule,expand,prune,time,cache}.ts` |
| Public endpoint | `cms/src/endpoints/occurrences.ts` (`/api/occurrences`) |
| Admin components | `cms/src/components/{ScheduleField,LocationPicker,DanceStylesLabel}.tsx`, `useAdminText.ts` |
| Fields | `cms/src/fields/{location,editors}.ts` |
| Event hooks | `cms/src/hooks/events/prepare.ts` |
| Migrations | `cms/src/migrations/` |

Frontend files changed in this repo: `src/utils.ts`, `src/pages/[locale]/index.astro`,
`src/pages/[locale]/organizations.astro` (new), `src/components/{event,map,nav}.astro`;
`src/components/class.astro` and `src/pages/[locale]/schools.astro` were removed.

---

## 9. Gotchas

- `schedule` is always an array with one block, even for a single event.
- `firstDate` / `lastDate` are stored as UTC midnight-shaped dates; compare them as dates, not as
  local instants.
- `lastDate` is `null` for open-ended recurring series.
- An event whose end time is before its start time crosses midnight (a Saturday 23:00–02:00 event
  has `date` = Saturday and `end` = Sunday).
- Organization `description` changed shape (string → Lexical JSON); old string handling will break.
- `members` is not public — do not expect it in `/api/organizations` responses.
- The admin requires addresses to be picked through the geocoder so that `lat`/`lng` exist; API
  clients must send all three.
- `event.type` is required; the API default is `event`, but clients should send it explicitly.
- Lower-role admin users see only their own organizations and events; public API results are
  unaffected.
