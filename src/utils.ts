import { PayloadSDK } from '@payloadcms/sdk';
import type { Config } from '../cms/src/payload-types';

/**
 * Base URL of the Payload REST API, including `/api`
 * (e.g. `http://localhost:3000/api`). Trailing slashes are ignored.
 */
export const payloadApiURL = (
  process.env.PAYLOAD_URL ||
  import.meta.env.PAYLOAD_URL ||
  'http://localhost:3000/api'
).replace(/\/+$/, '');

export const payload = new PayloadSDK<Config>({
  baseURL: payloadApiURL,
});

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

  const location = hasLocation ? parts[0] : null;
  const fields = hasLocation ? parts.slice(1) : parts;
  const [num = '', street = '', quarter = '', city = '', postal = '', country = '', ...rest] =
    fields;

  return { location, num, street, quarter, city, postal, country, rest };
};
