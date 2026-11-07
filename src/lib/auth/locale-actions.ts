'use server';

// The in-app toggle's save. The cookie is the explicit choice /account follows;
// profiles.preferred_locale can't be trusted alone (pre-0054 rows default 'en').

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { LANG_COOKIE } from '@/lib/tools/routes';

const LOCALES = ['en', 'es'] as const;
type Locale = (typeof LOCALES)[number];

export async function setPreferredLocale(locale: Locale): Promise<{ ok: boolean }> {
  if (!LOCALES.includes(locale)) return { ok: false };
  (await cookies()).set(LANG_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from('profiles')
    .update({ preferred_locale: locale })
    .eq('id', user.id);
  if (error) console.error('[profile] language not saved', error.message);
  return { ok: !error };
}
