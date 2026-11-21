# New Events branch — what changed and how to adapt the frontend

Scope: the `new-events` work in the `cms/` submodule plus the Astro frontend in this repository.
The CMS branch replaces the old `classes` / `schools` / `teachers` model with unified
`events` / `organizations` / `dances` collections, adds a server-side occurrence expander and a
public `/api/occurrences` endpoint, and reworks access control, admin UX and i18n.

> **Branch note:** both this repository and the CMS submodule are on `new-events`. Migrations are
> the source of truth (`push: false`); production runs them on start, locally use
> `npm run payload migrate`.

---

## 1. TL;DR — breaking changes for a frontend

| Old | New |
| --- | --- |
| `classes` collection, `Class` type, `/api/classes` | `events` collection, `Event` type, `/api/events` |
| `schools` collection, `School` type, `/api/schools` | `organizations` collection, `Organization` type, `/api/organizations` |
| `teachers` collection | removed |
| `event.type`: `class, social, workshop, talk, walk, festival, other` | **`social, event, class`** (default `event`; workshops are events) |
| `organizations.description`: plain string (textarea) | **Lexical rich-text JSON** |
| `school.address`, point `location` tuple | `event.location` group with `name`, address parts, `address`, `lat`, `lng`, `directionsNote` |
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
| `location` | group | `name`, `street`, `houseNumber`, `postcode`, `district` (Stadtteil), `city`, `lat`, `lng`, `directionsNote`, plus `address` (one line, derived on save from the parts: "Schulterblatt 73, 20357 Hamburg"). Filled by the address search; parts stay editable. Any address requires coordinates |
| `schedule` | blocks | always an **array** (max 1 row), see §2.2 |
| `exceptions` | json | per-date overrides, see §2.3 |
| `firstDate` / `lastDate` | date | derived; `lastDate` is `null` for open-ended series |
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

Each event is sent once in `events` (keyed by `String(id)`); occurrences reference it by
`eventId`. Types: `OccurrencesResponse` in `cms/src/lib/occurrences/types.ts` (Payload-free, so the
frontend imports them directly).

```json
{
  "events": {
    "12": {
      "id": 12,
      "title": "Wednesday Social",
      "type": "social",
      "level": null,
      "descriptionHtml": "<div class=\"payload-richtext\"><p>…</p></div>",
      "organizers": [{ "id": 3, "name": "Swing in Hamburg", "slug": "swing-in-hamburg" }],
      "danceStyles": [{ "id": 1, "name": "Lindy Hop", "shortName": "Lindy", "slug": "lindy-hop" }],
      "location": {
        "name": "Haus73", "street": "Schulterblatt", "houseNumber": "73", "postcode": "20357",
        "district": "Sternschanze", "city": "Hamburg", "address": "Schulterblatt 73, 20357 Hamburg",
        "lat": 53.56, "lng": 9.96, "directionsNote": null
      },
      "firstDate": "2026-11-18T00:00:00.000Z",
      "lastDate": null
    }
  },
  "occurrences": [
    {
      "eventId": 12,
      "date": "2026-11-18",
      "start": "2026-11-18T19:00:00.000Z",
      "end": "2026-11-18T22:00:00.000Z",
      "cancelled": false,
      "allDay": false,
      "note": "Silvester special"
    }
  ]
}
```

Semantics:

- Sorted by `start` (UTC), then `eventId`.
- `date` is the **local start date** in Europe/Berlin; `start`/`end` are UTC ISO strings.
- An end time earlier than the start time means the occurrence runs past midnight; `end` is on the
  following day while `date` stays on the start day.
- `allDay: true` means no start time is configured; `start`/`end` are then midnight placeholders
  and must not be displayed. `end === start` means no end time is configured.
- `cancelled` occurrences are still returned (render them struck-through / with a badge).
- `note`, time overrides and cancellations from `exceptions` are already applied — do not recompute
  times from the event schedule on the client. A start-only override keeps the regular duration.
- Only `published` events are included.
- Ranges longer than 400 days return `400`; `locale` falls back to `de` unless it is `de`/`en`;
  an unknown `danceStyle`/`organization` slug returns an empty result (not an unfiltered one).
- Server-side in-process cache (max. 200 parameter sets) until the next midnight in Europe/Berlin,
  cleared whenever events/organizations/dances change in that process.

### Frontend client

`src/lib/occurrences.ts` (`fetchOccurrences`) joins events into occurrences (`OccurrenceView`),
caches responses for 60 s, serves stale data if the CMS fails and otherwise returns
`{ occurrences: [], unavailable: true }` so pages can show a notice instead of failing.
`PAYLOAD_URL` is the REST base **including** `/api` (default `http://localhost:3000/api`).

### Rendering rich text

Every rich-text field has a read-only `<name>Html` sibling (e.g. `descriptionHtml`, `introHtml`,
`faqHtml`) rendered by the CMS on read, in the requested locale, and sanitized (text escaped,
`javascript:`/`data:` links replaced by `#`). Insert it as is; the frontend does not depend on
Lexical. The occurrences endpoint returns only `descriptionHtml`, not the Lexical state.
Implementation: `cms/src/fields/richTextHtml.ts` (virtual field, no database column).

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

Roles: `admin`, `writer`, `school`, `guest`.

| Who | Organizations | Events | Users / Media / Dances / Globals |
| --- | --- | --- | --- |
| anonymous | read all (public fields) | read **published** only; no writes | media/dances/globals public read |
| admin | full CRUD | full CRUD | users full; everything else full |
| writer | full CRUD | full CRUD | users read-only; everything else full |
| school / guest | read all; update **description** of their own | read/update/delete **only events of their organizations** (drafts included) | hidden from admin nav; dances read-only |

Additional rules:

- A user can be linked to any number of organizations via `organizations.members` (optional).
- Only writers/admins can assign members, create/delete organizations or change dance styles.
- Members cannot reassign an event to another organization, and cannot create events without an
  organizer or for organizations they do not belong to (also enforced for drafts).
- Co-hosted events (an organizer the member is not linked to) can only be deleted by writers.

---

## 5. Admin panel changes (for editors)

- **Schedule editor** replaces the default blocks UI: type selector (once / specific dates /
  recurring / course block) plus a live preview of the next occurrences.
- **Preview table**: cancel a single occurrence, add a note, or override its start/end time.
  Pausing a date range marks all occurrences in it as cancelled.
- **Address search** (events and organizations): type an address, press Enter, pick a result.
  Street, house number, postcode, district, city and coordinates are filled automatically (and the
  venue name, if empty and the result is a named place). The parts can be corrected by hand; the
  one-line address is rebuilt on save. An address without coordinates is rejected on save.
- **Existing addresses** saved before the parts existed are converted with
  `npm run backfill:addresses` in `cms/` (`--dry-run` first); see the script header.
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
7. `20261121_135132_remove_system_role_last_confirmed` — removes the `system` user role (remaining
   system users become `guest`) and the `events.lastConfirmed` field.

These are meant to be squashed into one migration before the first production deploy.

Deploy the CMS and the frontend **together**: the occurrences response format changed, and
neither side reads the other's old format.

---

## 7. Frontend implementation

| Area | Files |
| --- | --- |
| Data access, date/dance helpers | `src/lib/occurrences.ts` |
| Homepage view model (panels, calendar data, filters) | `src/lib/homepage.ts`, `src/lib/tabs.ts` |
| Rich text (CMS-rendered `*Html` fields) | `src/components/richtText.astro` |
| Homepage UI | `src/pages/[locale]/index.astro`, `src/components/home/{HomeToolbar,ListingPanels,SurveyBox}.astro`, `src/components/calendar.astro` |
| Client state shared by those components | `src/scripts/homeState.ts` |
| Event card | `src/components/event.astro` |
| Map | `src/components/map.astro` |
| Locale validation (404 for unknown locales) | `src/middleware.ts`, `src/i18n.ts` |
| Typed CMS client, JSON embedding | `src/utils.ts` |

The homepage makes one occurrences request (the calendar's 12 months) and derives the lists from
it: socials 14 days, events 30 days, classes 90 days (one entry per class and weekday). Map popups
link to `/?event=<id>`, which narrows the list to that event and includes its dates even beyond the
tab's horizon.

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

Removed in the frontend: `src/components/class.astro`, `src/pages/[locale]/schools.astro`.

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
