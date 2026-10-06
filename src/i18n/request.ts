import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: {
      ...(await import(`../../messages/${locale}.json`)).default,
      // Chalito's screens (/app/chalito): its own catalog, under `chalito`.
      chalito: (await import(`../lib/chalito/messages/${locale}.json`)).default,
    },
  };
});
