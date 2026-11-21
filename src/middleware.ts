import { defineMiddleware } from 'astro:middleware';
import { isLocale } from './i18n';

/**
 * The site is server-rendered, so `getStaticPaths` does not restrict the
 * `[locale]` segment. Reject unknown locales here once instead of letting every
 * page and component fall back on its own.
 */
export const onRequest = defineMiddleware((context, next) => {
  const { locale } = context.params;
  if (locale !== undefined && !isLocale(locale)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return next();
});
