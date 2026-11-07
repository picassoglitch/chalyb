// Where each tool lives in the hub, and where its card leads. Pure.

import { DEFAULT_LOCALE, LOCALES, type AppLocale } from '@/i18n/locales';

export const TOOL_ROUTES: Record<string, string> = {
  chalybclip: '/app/clips',
  chalybcrypto: '/app/senales',
  chalybobs: '/app/en-vivo',
  chalito: '/app/chalito',
  chalybbot: '/app/herramientas/asistente',
  chalybpicks: '/app/herramientas/pronosticos',
  chalybrealtor: '/app/herramientas/inmuebles',
  chalybtrade: '/app/herramientas/inversiones',
};

/** The tool's own screens: every tool opens inside the app (TOOLS-SPEC
 *  §0.1). A tool with no screen of its own lands on Tus herramientas. */
export function toolHref(slug: string): string {
  return TOOL_ROUTES[slug] ?? '/app/herramientas';
}

/** A locale from a query param, or null when it's missing or unknown. */
export function launchLocale(raw: string | null | undefined): AppLocale | null {
  return LOCALES.find((l) => l === raw) ?? null;
}

/** `path` in `locale`: the URL decides the language (localePrefix
 *  'as-needed', no detection), so English needs the /en prefix. */
export function localizedPath(path: string, locale: string | null | undefined): string {
  const l = launchLocale(locale);
  return l && l !== DEFAULT_LOCALE ? `/${l}${path}` : path;
}

/** The SSO hand-off from a hub tool screen. /auth/launch sits outside the
 *  locale prefix, so the screen's locale rides along as `lang` for any
 *  redirect back into the app. */
export function hubLaunchHref(slug: string, locale: string): string {
  const l = launchLocale(locale);
  const lang = l && l !== DEFAULT_LOCALE ? `&lang=${l}` : '';
  return `/auth/launch/${slug}?via=hub${lang}`;
}

/** An engine's SSO launch URL with the hub screen's language as `lang`, so an
 *  engine UI that reads it opens in the same language. Unknown values are dropped. */
export function engineUrlWithLang(url: string, lang: string | null | undefined): string {
  const l = launchLocale(lang);
  if (!l) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('lang', l);
    return u.toString();
  } catch {
    return url;
  }
}

/** The explicit language choice the in-app toggle stores (locale-actions.ts). */
export const LANG_COOKIE = 'chalyb_lang';

/** /account's language: the unprefixed URL follows the saved choice; /en wins. */
export function accountLocale(urlLocale: string, preferred: string | null | undefined): AppLocale {
  const url = launchLocale(urlLocale) ?? DEFAULT_LOCALE;
  return url === DEFAULT_LOCALE ? (launchLocale(preferred) ?? url) : url;
}

/** Tools that need the risk notice before first use (aceptacion-ux §6). */
export const RISK_TOOLS = new Set(['chalybcrypto', 'chalybpicks', 'chalybtrade']);
