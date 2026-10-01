// The locale list as plain data, so modules that run outside Next (unit tests,
// robots, sitemap) can read it without importing next-intl's navigation.
// routing.ts builds the next-intl routing from these.

export const LOCALES = ['en', 'es'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'es';

/** hreflang value per locale. Spanish is Mexican Spanish (BUILD-SPEC §0.10). */
export const HREFLANG: Record<AppLocale, string> = { es: 'es-MX', en: 'en' };
