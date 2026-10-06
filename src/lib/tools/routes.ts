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

/** Tools that need the risk notice before first use (aceptacion-ux §6). */
export const RISK_TOOLS = new Set(['chalybcrypto', 'chalybpicks', 'chalybtrade']);
