'use server';

// Saving the /app/settings form.
//
// The form used to show "Perfil actualizado" and write nothing — the handler
// popped a toast and left a `// TODO: persist to profiles.full_name` behind.
// Language and timezone lived in localStorage only, so they were per-browser
// and invisible to the server that renders the locale.
//
// Both now land in `profiles`. The columns involved (full_name,
// preferred_locale) are the self-writable ones: migration 0032 leaves those
// alone and locks only the columns that grant access or money, so this uses
// the ordinary user-scoped client and RLS confirms the row is the caller's.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';

export type ProfileLocale = 'en' | 'es';

export interface SaveProfileResult {
  ok: boolean;
  error?: string;
  /** The name as stored, after trimming. */
  fullName?: string;
}

const MAX_NAME_LENGTH = 80;

export async function saveProfileSettings(input: {
  fullName: string;
  locale: ProfileLocale;
}): Promise<SaveProfileResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: 'El nombre no puede quedar vacío.' };
  if (fullName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `El nombre no puede pasar de ${MAX_NAME_LENGTH} caracteres.` };
  }
  if (input.locale !== 'en' && input.locale !== 'es') {
    return { ok: false, error: 'Ese idioma no está disponible.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, preferred_locale: input.locale })
    .eq('id', session.user.id);

  if (error) return { ok: false, error: error.message };

  // Keep auth.users.user_metadata in step: the settings page and the sidebar
  // read the name from there, so writing only `profiles` would show the old
  // name until the next sign-in.
  const { error: metaError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (metaError) {
    // The profile row is the source of truth and it is already saved; a
    // metadata failure is worth logging, not worth failing the save.
    console.warn('[settings] user_metadata update failed:', metaError.message);
  }

  revalidatePath('/[locale]', 'layout');
  return { ok: true, fullName };
}
