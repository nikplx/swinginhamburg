import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';

/**
 * Lexical → HTML, memoized per rich-text object. The occurrence cache hands out
 * the same event objects for a while, so each description is converted once
 * instead of once per occurrence and request.
 *
 * The converter escapes text and replaces unsafe link schemes, so its output
 * may be used with `set:html` / `innerHTML`.
 */
const converted = new WeakMap<object, string>();

export function richTextToHtml(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const cached = converted.get(content);
  if (cached !== undefined) return cached;
  const html = convertLexicalToHTML({ data: content as any });
  converted.set(content, html);
  return html;
}
