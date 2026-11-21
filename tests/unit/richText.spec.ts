import { expect, test } from '@playwright/test';
import { richTextToHtml } from '../../src/lib/richText';

/**
 * CMS rich text reaches visitors via set:html / innerHTML, so we rely on the
 * Lexical HTML converter to escape text and neutralize unsafe link schemes.
 * @payloadcms/richtext-lexical 3.79.0 did neither — this guards against a
 * downgrade or regression.
 */
const link = (url: string) => ({
  type: 'link',
  version: 3,
  fields: { linkType: 'custom', url, newTab: false },
  children: [{ type: 'text', text: 'x', format: 0, version: 1 }],
});

test('rich text output escapes text and neutralizes unsafe links', () => {
  const html = richTextToHtml({
    root: {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            link('javascript:alert(1)'),
            link(' JaVaScRiPt:alert(1)'),
            link('java\tscript:alert(1)'),
            link('data:text/html,<script>alert(1)</script>'),
            link('https://example.org/?a="><b>'),
            { type: 'text', text: '<img src=x onerror=alert(1)>', format: 0, version: 1 },
          ],
        },
      ],
    },
  });

  expect(html).not.toMatch(/javascript:/i);
  expect(html).not.toContain('data:text/html');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('"><b>');
  expect(html).toContain('href="https://example.org/');
});
