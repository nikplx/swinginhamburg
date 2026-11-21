/**
 * Shapes occurrences into what the homepage renders: list panels per tab, the
 * calendar dataset and the dance-style filters. Pure; no fetching, no DOM.
 */
import type { CalendarEntry, CalendarEventDetail } from '../components/calendar.astro';
import type { Locale } from '../i18n';
import {
  addDays,
  berlinWeekday,
  danceFilters,
  danceKeys,
  formatTime,
  timeRange,
  WEEKDAYS,
  type EventType,
  type OccurrenceView,
  type Weekday,
} from './occurrences';
import { richTextToHtml } from './richText';
import { TAB_TYPES, TABS, type Tab } from './tabs';
import { venueLine } from './location';

export interface ListEntry {
  occurrence: OccurrenceView;
  /** Comma-separated dance keys for client-side filtering. */
  tags: string;
  hideDate: boolean;
  /** Beyond the tab's horizon; only listed while this event is focused (`?event=`). */
  focusOnly: boolean;
}

export interface ListGroup {
  id: string;
  title: string;
  /** Short marker at the right edge of the header (e.g. "← HEUTE"). */
  aside?: string;
  isOpen: boolean;
  entries: ListEntry[];
}

export interface ListPanel {
  tab: Tab;
  groups: ListGroup[];
  /** Shown when the panel has no groups at all. */
  emptyText: string;
  /** Shown when filters hide every entry. */
  noMatchText: string;
  /** Shown inside a group without entries (only the always-present today group). */
  groupEmptyText: string;
}

export interface Homepage {
  panels: ListPanel[];
  calendar: {
    min: string;
    max: string;
    entries: CalendarEntry[];
    events: Record<string, CalendarEventDetail>;
  };
  danceFilters: { slug: string; name: string }[];
  /** `?event=` was given but that event has no upcoming dates. */
  focusMissing: boolean;
}

/** Each tab has its own horizon: socials are short-term, classes run for a quarter. */
const HORIZON_DAYS: Record<EventType, number> = { social: 14, event: 30, class: 90 };

const WEEKDAY_LABELS: Record<Weekday, Record<Locale, string>> = {
  monday: { de: 'Montag', en: 'Monday' },
  tuesday: { de: 'Dienstag', en: 'Tuesday' },
  wednesday: { de: 'Mittwoch', en: 'Wednesday' },
  thursday: { de: 'Donnerstag', en: 'Thursday' },
  friday: { de: 'Freitag', en: 'Friday' },
  saturday: { de: 'Samstag', en: 'Saturday' },
  sunday: { de: 'Sonntag', en: 'Sunday' },
};

// Group headers keep the German date convention on both language versions.
const groupWeekday = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long' });
const groupDate = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
});
const dateGroupTitle = (date: string) => {
  const value = new Date(`${date}T12:00:00Z`);
  return `${groupDate.format(value)} ${groupWeekday.format(value)}`;
};

const tagsFor = (occurrence: OccurrenceView) => danceKeys(occurrence.event).join(',');
const byStart = (a: OccurrenceView, b: OccurrenceView) => a.start.localeCompare(b.start);

/**
 * Socials and events: one open group per date. Today's group is always
 * present, even when empty, so visitors see at once whether anything is on.
 */
function dateGroups(
  tab: Tab,
  occurrences: OccurrenceView[],
  today: string,
  todayAside: string,
  horizon: string,
): ListGroup[] {
  const byDate = new Map<string, OccurrenceView[]>([[today, []]]);
  for (const occurrence of occurrences) {
    const bucket = byDate.get(occurrence.date);
    if (bucket) bucket.push(occurrence);
    else byDate.set(occurrence.date, [occurrence]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      id: `${tab}-${date}`,
      title: dateGroupTitle(date),
      aside: date === today ? todayAside : undefined,
      isOpen: true,
      entries: items.sort(byStart).map((occurrence) => ({
        occurrence,
        tags: tagsFor(occurrence),
        hideDate: true,
        focusOnly: occurrence.date > horizon,
      })),
    }));
}

/**
 * Classes: a weekly schedule, one entry per class and weekday using the next
 * upcoming session, so recurring classes do not repeat every week. Today's
 * weekday is open (or the first weekday when nothing is on today).
 */
function weekdayGroups(
  occurrences: OccurrenceView[],
  locale: Locale,
  now: Date,
  horizon: string,
): ListGroup[] {
  const byWeekday = new Map<Weekday, OccurrenceView[]>();
  const seen = new Set<string>();
  for (const occurrence of occurrences) {
    const weekday = berlinWeekday(occurrence.start);
    const slot = `${occurrence.eventId}|${weekday}`;
    if (seen.has(slot)) continue;
    seen.add(slot);
    const bucket = byWeekday.get(weekday);
    if (bucket) bucket.push(occurrence);
    else byWeekday.set(weekday, [occurrence]);
  }

  const today = berlinWeekday(now.toISOString());
  const weekdays = WEEKDAYS.filter((weekday) => byWeekday.has(weekday));
  const openWeekday = byWeekday.has(today) ? today : weekdays[0];

  return weekdays.map((weekday) => ({
    id: weekday,
    title: WEEKDAY_LABELS[weekday][locale],
    isOpen: weekday === openWeekday,
    entries: byWeekday
      .get(weekday)!
      .sort(byStart)
      .map((occurrence) => ({
        occurrence,
        tags: tagsFor(occurrence),
        // The weekly view hides dates unless the next session differs from
        // the regular one (cancelled or annotated): then the date matters.
        hideDate: !(occurrence.cancelled || occurrence.note),
        focusOnly: occurrence.date > horizon,
      })),
  }));
}

function calendarData(occurrences: OccurrenceView[], min: string, max: string): Homepage['calendar'] {
  const entries: CalendarEntry[] = occurrences.map((occurrence) => ({
    date: occurrence.date,
    time: occurrence.allDay ? '' : formatTime(occurrence.start),
    timeRange: timeRange(occurrence) ?? '',
    title: occurrence.event.title,
    type: occurrence.event.type,
    eventId: String(occurrence.eventId),
    tags: tagsFor(occurrence),
    cancelled: occurrence.cancelled,
  }));

  // Details are stored once per event, not repeated for every occurrence.
  const events: Record<string, CalendarEventDetail> = {};
  for (const { eventId, event } of occurrences) {
    const key = String(eventId);
    if (events[key]) continue;
    events[key] = {
      title: event.title,
      type: event.type,
      descriptionHtml: richTextToHtml(event.description),
      organizers: event.organizers
        .map((organizer) => organizer.name)
        .filter(Boolean)
        .join(' · '),
      location: venueLine(event.location),
    };
  }

  return { min: min.slice(0, 7), max: max.slice(0, 7), entries, events };
}

const TEXT = {
  socials: {
    empty: {
      de: 'Keine anstehenden Socials in den nächsten 14 Tagen.',
      en: 'No upcoming socials in the next 14 days.',
    },
    noMatch: {
      de: 'Keine Socials entsprechen den ausgewählten Filtern.',
      en: 'No socials match the selected filters.',
    },
  },
  events: {
    empty: {
      de: 'Keine anstehenden Events in den nächsten 30 Tagen.',
      en: 'No upcoming events in the next 30 days.',
    },
    noMatch: {
      de: 'Keine Events entsprechen den ausgewählten Filtern.',
      en: 'No events match the selected filters.',
    },
  },
  classes: {
    empty: {
      de: 'Keine anstehenden Kurse in den nächsten 90 Tagen.',
      en: 'No upcoming classes in the next 90 days.',
    },
    noMatch: {
      de: 'Keine Kurse entsprechen den ausgewählten Filtern.',
      en: 'No classes match the selected filters.',
    },
  },
  todayEmpty: { de: 'Heute gibt es keine Veranstaltung.', en: 'There is no event today.' },
  todayAside: { de: '← HEUTE', en: '← TODAY' },
} as const;

/**
 * @param occurrences everything in [calendarFrom, calendarTo]; the list
 *   horizons are subsets of that range.
 * @param options.focusEventId `?event=` from a map popup. The map covers a
 *   longer range than the socials/events lists, so the focused event's
 *   upcoming dates are listed even beyond the tab's horizon.
 */
export function buildHomepage(
  occurrences: OccurrenceView[],
  options: {
    locale: Locale;
    today: string;
    calendarFrom: string;
    calendarTo: string;
    focusEventId?: string | null;
    now?: Date;
  },
): Homepage {
  const { locale, today, calendarFrom, calendarTo, focusEventId, now = new Date() } = options;

  const horizonOf = (type: EventType) => addDays(today, HORIZON_DAYS[type]);
  const upcoming = (type: EventType) => {
    const until = horizonOf(type);
    return occurrences.filter(
      (o) =>
        o.event.type === type &&
        o.date >= today &&
        (o.date <= until || String(o.eventId) === focusEventId),
    );
  };

  const panels: ListPanel[] = TABS.map((tab) => {
    const items = upcoming(TAB_TYPES[tab]);
    const horizon = horizonOf(TAB_TYPES[tab]);
    return {
      tab,
      groups:
        tab === 'classes'
          ? weekdayGroups(items, locale, now, horizon)
          : dateGroups(tab, items, today, TEXT.todayAside[locale], horizon),
      emptyText: TEXT[tab].empty[locale],
      noMatchText: TEXT[tab].noMatch[locale],
      groupEmptyText: TEXT.todayEmpty[locale],
    };
  });

  const focusMissing =
    Boolean(focusEventId) &&
    !panels.some((panel) =>
      panel.groups.some((group) =>
        group.entries.some((entry) => String(entry.occurrence.eventId) === focusEventId),
      ),
    );

  return {
    panels,
    calendar: calendarData(occurrences, calendarFrom, calendarTo),
    danceFilters: danceFilters(occurrences),
    focusMissing,
  };
}
