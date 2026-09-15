'use server';

// Self-serve profile edits from /app/settings.
//
// Deliberately uses the USER-scoped Supabase client, not the service-role one:
// display name and locale are exactly the columns migration 0032 left writable
// by `authenticated`, so RLS and the column GRANTs are the enforcement here
// rather than a trust-me check in this file. If this action is ever made to
// write something privileged, the database rejects it.

import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';

export type Locale = 'en' | 'es';

const LOCALES: Locale[] = ['en', 'es'];
const MAX_NAME_LENGTH = 120;

export interface SaveProfileResult {
  ok: boolean;
  error?: string;
}

/**
 * Saves the display name and preferred language, then sends the browser to the
 * settings page in the language just chosen (/en/app/settings or /app/settings).
 *
 * The redirect is the whole point of the return type being `Promise<SaveProfileResult>`
 * only on the failure path: on success this never returns, the client follows
 * the redirect as a normal soft navigation and lands on a freshly rendered page.
 *
 * One Supabase client for the whole action, on purpose. This is a server
 * action, the one place the server-side client can actually write cookies (in
 * a Server Component the write is swallowed). The old version verified the
 * user on one client and wrote on a second, then asked Next to re-render every
 * layout under /[locale] inside the same POST. Each of those was a fresh
 * cookie read, and the layout re-render put `requireUser()` on the hot path
 * of a request whose session cookies were being rewritten underneath it. The
 * symptom was a save that bounced the user to /sign-in?next=/app/settings.
 * Now: read once, write once, redirect; the next request carries whatever
 * cookies the action set and the layouts render on a settled session.
 */
export async function saveProfileSettings(input: {
  fullName: string;
  locale: Locale;
}): Promise<SaveProfileResult> {
  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `El nombre debe tener entre 2 y ${MAX_NAME_LENGTH} caracteres.` };
  }
  if (!LOCALES.includes(input.locale)) {
    return { ok: false, error: 'Idioma no válido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Inicia sesión para continuar.' };

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, preferred_locale: input.locale })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  // next-intl's redirect adds the prefix for the chosen language ('es' is the
  // default and stays unprefixed). `saved=1` lets the page confirm the save
  // once, since this action never returns to the form on success.
  redirect({ href: { pathname: '/app/settings', query: { saved: '1' } }, locale: input.locale });
  // redirect() throws; this only satisfies the return type.
  return { ok: true };
}
