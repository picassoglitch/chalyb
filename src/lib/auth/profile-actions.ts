'use server';

// Self-serve profile edits from /app/settings.
//
// Deliberately uses the USER-scoped Supabase client, not the service-role one:
// display name and locale are exactly the columns migration 0032 left writable
// by `authenticated`, so RLS and the column GRANTs are the enforcement here
// rather than a trust-me check in this file. If this action is ever made to
// write something privileged, the database rejects it.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from './session';

export type Locale = 'en' | 'es';

const LOCALES: Locale[] = ['en', 'es'];
const MAX_NAME_LENGTH = 120;

export interface SaveProfileResult {
  ok: boolean;
  error?: string;
}

export async function saveProfileSettings(input: {
  fullName: string;
  locale: Locale;
}): Promise<SaveProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Inicia sesión para continuar.' };

  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `El nombre debe tener entre 2 y ${MAX_NAME_LENGTH} caracteres.` };
  }
  if (!LOCALES.includes(input.locale)) {
    return { ok: false, error: 'Idioma no válido.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, preferred_locale: input.locale })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
