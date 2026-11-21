export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);
