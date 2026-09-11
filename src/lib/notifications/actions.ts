'use server';

// "Mark all as read" for /dashboard/notifications. Role-gated server
// action using the admin client — the notifications table has no UPDATE
// policy (writes are service-role only, migration 0027), same pattern as
// token grants in token-grant-actions.ts.

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function markAllNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    return { ok: false, error: 'No autorizado' };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/[locale]/(dashboard)/dashboard/notifications', 'page');
  return { ok: true };
}
