/**
 * Data access for `GET /api/occurrences` (cms/src/endpoints/occurrences.ts)
 * plus the small helpers every view needs. The response types are imported
 * from the CMS so a backend change becomes a type error here.
 */
import type {
  EventType,
  Occurrence,
  OccurrencesResponse,
  PublicEventSummary,
} from '../../cms/src/lib/occurrences/types';
import type { Locale } from '../i18n';
import { payloadApiURL } from '../utils';

export type { EventType, Occurrence, PublicEventSummary };

/** An occurrence joined with its event, as views consume it. */
export interface OccurrenceView extends Occurrence {
  event: PublicEventSummary;
}

export interface OccurrenceQuery {
  from: string;
  to: string;
  locale: Locale;
  type?: EventType;
  danceStyle?: string;
  organization?: string;
}

export interface OccurrenceResult {
  occurrences: OccurrenceView[];
  /** True when the CMS could not be reached; views show a notice instead. */
  unavailable: boolean;
}

/**
 * Responses are reused briefly so a burst of page views does not hit the CMS
 * for every request. Editors see changes after at most this delay.
 */
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 50;
const cache = new Map<string, { expiresAt: number; value: OccurrenceView[] }>();

function join(response: OccurrencesResponse): OccurrenceView[] {
  return response.occurrences.flatMap((occurrence) => {
    const event = response.events[String(occurrence.eventId)];
    return event ? [{ ...occurrence, event }] : [];
  });
}

export async function fetchOccurrences(query: OccurrenceQuery): Promise<OccurrenceResult> {
  const url = new URL(`${payloadApiURL}/occurrences`);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return { occurrences: hit.value, unavailable: false };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const occurrences = join((await response.json()) as OccurrencesResponse);

    if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: occurrences });
    return { occurrences, unavailable: false };
  } catch (error) {
    console.error(`[occurrences] ${key} failed:`, error);
    // Serve stale data if we have any; otherwise let the page degrade.
    if (hit) return { occurrences: hit.value, unavailable: false };
    return { occurrences: [], unavailable: true };
  }
}

// ---------------------------------------------------------------------------
// Dance styles
// ---------------------------------------------------------------------------

type DanceStyle = PublicEventSummary['danceStyles'][number];

/** Stable key for filters, anchors and data attributes. */
export const danceKey = (style: DanceStyle): string =>
  (style.slug ?? style.shortName ?? '').toLowerCase();

export const danceKeys = (event: PublicEventSummary): string[] =>
  event.danceStyles.map(danceKey).filter(Boolean);

/** Unique dance styles across occurrences, for filter panels. */
export function danceFilters(occurrences: OccurrenceView[]): { slug: string; name: string }[] {
  const styles = new Map<string, string>();
  for (const { event } of occurrences) {
    for (const style of event.danceStyles) {
      const key = danceKey(style);
      if (key && !styles.has(key)) styles.set(key, style.name ?? style.shortName ?? key);
    }
  }
  return [...styles].map(([slug, name]) => ({ slug, name }));
}

// ---------------------------------------------------------------------------
// Dates and times (Europe/Berlin)
// ---------------------------------------------------------------------------

const TIME_ZONE = 'Europe/Berlin';

const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayKeyFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'long',
});

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Today's date (YYYY-MM-DD) in Berlin. */
export const todayInBerlin = (now: Date = new Date()): string => dateKeyFormat.format(now);

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** First day of the month `months` after the month of `date`. */
export function addMonths(date: string, months: number): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
}

/** Berlin weekday of an instant, as a stable English key. */
export const berlinWeekday = (iso: string): Weekday =>
  weekdayKeyFormat.format(new Date(iso)).toLowerCase() as Weekday;

export const formatTime = (iso: string): string => timeFormat.format(new Date(iso));

/**
 * "20:00–22:00", "20:00" when no end time is set, or null for events without a
 * start time (the endpoint then only carries placeholder instants).
 */
export function timeRange(occurrence: Occurrence): string | null {
  if (occurrence.allDay) return null;
  const start = formatTime(occurrence.start);
  return occurrence.end === occurrence.start ? start : `${start}–${formatTime(occurrence.end)}`;
}
