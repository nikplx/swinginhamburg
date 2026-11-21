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
