// The hub screen's language for server-to-server engine calls: next-intl's locale on
// pages, the calling page (Referer) on /api routes (outside the locale tree); else es.

import 'server-only';
import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/locales';
import { launchLocale, refererLocale } from './routes';

/** next-intl's proxy stamps this on every page request it routes. */
const INTL_LOCALE_HEADER = 'x-next-intl-locale';

export async function engineLang(): Promise<AppLocale> {
  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch (e) {
    unstable_rethrow(e); // Next's own signals (prerender bail-out) are not "no request"
    return DEFAULT_LOCALE; // outside a request (scripts, tests)
  }
  if (h.has(INTL_LOCALE_HEADER)) return launchLocale(await getLocale()) ?? DEFAULT_LOCALE;
  return refererLocale(h.get('referer'), h.get('host')) ?? DEFAULT_LOCALE;
}
