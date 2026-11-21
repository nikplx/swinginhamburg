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
