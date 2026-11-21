import { PayloadSDK } from '@payloadcms/sdk';

export const payloadURL =
  process.env.PAYLOAD_URL || import.meta.env.PAYLOAD_URL || 'http://localhost:3000';

export const payload = new PayloadSDK({
  baseURL: payloadURL,
});

export interface OccurrenceView {
  eventId: number | string;
  date: string;
  start: string;
  end: string;
  cancelled: boolean;
  note?: string;
  event: {
    id: number | string;
    title: string;
    type: string;
    level?: string | null;
    description?: unknown;
    organizers: { id: number | string; name?: string; slug?: string }[];
    danceStyles: {
      id: number | string;
      name?: string;
      shortName?: string;
      slug?: string;
    }[];
    location?: {
      name?: string | null;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      directionsNote?: string | null;
    } | null;
  };
}

export interface OccurrenceQuery {
  from?: string;
  to?: string;
  locale?: string;
  type?: string;
  danceStyle?: string;
  organization?: string;
}

/** Fetch expanded occurrences from the Payload custom endpoint. */
export async function fetchOccurrences(
  params: OccurrenceQuery,
): Promise<OccurrenceView[]> {
  const url = new URL('/api/occurrences', payloadURL);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Occurrences request failed: ${response.status}`);
  }
  const data = (await response.json()) as { occurrences: OccurrenceView[] };
  return data.occurrences ?? [];
}

/**
 * Serialize data for a `<script type="application/json">` block rendered with
 * `set:html`. Escaping `<` keeps CMS text such as `</script>` from closing the
 * block; U+2028/2029 are escaped for older JS parsers.
 */
export function toJsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function todayInBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatLocalDate(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    ...options,
  }).format(new Date(iso));
}

export function formatLocalTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

interface Doc<T> {
  docs: Array<T>;
}

export function collect<T>(keyer: (arg: T) => string) {
  return function (acc: Record<string, T[]>, curr: T): Record<string, T[]> {
    const key = keyer(curr);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(curr);
    return acc;
  };
}

/**
 * Simple Seeded Random Number Generator (LCG)
 * Returns a function that mimics Math.random() but is deterministic.
 */
function createSeededRandom(seed: number) {
  return function () {
    // Standard LCG parameters (Numerical Recipes)
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Shuffles an array deterministically using a daily numeric seed.
 */
export function shuffleByDay<T>(array: T[]): T[] {
  const shuffled = [...array];

  // 1. Generate a stable seed based on Year, Month, and Day (YYYYMMDD)
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1; // 0-11 to 1-12
  const day = today.getUTCDate();

  const dailySeed = year * 10000 + month * 100 + day; // e.g., 20260607

  // 2. Initialize our seeded random number stream
  const seededRandom = createSeededRandom(dailySeed);

  // 3. Perform Fisher-Yates shuffle using the seeded random function
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export interface DecodedAddress {
  location: string | null;
  num: string;
  street: string;
  quarter: string;
  city: string;
  postal: string;
  country: string;
  rest: string[];
}

export const decodeAddress = (addressStr: string | null | undefined): DecodedAddress => {
  const parts = (addressStr ?? '').split(',').map((p) => p.trim());

  // If the first part doesn't start with a number, assume it's a location
  const hasLocation = parts.length > 0 && parts[0] !== '' && !/^\d/.test(parts[0]);

  const [location, num, street, quarter, city, postal, country, ...rest] = hasLocation
    ? parts
    : [null, ...parts];

  return { location, num, street, quarter, city, postal, country, rest };
};
