'use server';

// Avisos: mark everything read, delete one (never a billing notice before
// its charge date — checked here and by the table's delete policy).

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { canDeleteNotice } from './core';

export async function markAllNoticesRead(): Promise<void> {
  const session = await getSessionUser();
  if (!session) return;
  await createAdminClient()
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .is('read_at', null);
  revalidatePath('/app', 'layout');
}

export async function deleteNotice(formData: FormData): Promise<void> {
  const session = await getSessionUser();
  if (!session) return;
  const id = String(formData.get('id') ?? '');
  const admin = createAdminClient();
  const { data } = await admin
    .from('user_notifications')
    .select('id, keep_until')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!data || !canDeleteNotice(data as { keep_until: string | null }, Date.now())) return;
  await admin.from('user_notifications').delete().eq('id', id).eq('user_id', session.user.id);
  revalidatePath('/app', 'layout');
}
