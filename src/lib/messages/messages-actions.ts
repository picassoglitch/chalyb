'use server';

// Bidirectional message threads between subscribers and the admin team.
//
// MODEL:
//   - Each subscriber has at most one thread with the admin team. The
//     thread is keyed by `thread_user_id` = subscriber's auth.users.id.
//   - Every row carries `sender_role` ∈ {USER, ADMIN} so we can render
//     bubbles on either side without a join.
//   - Each side maintains its own read marker (read_at_user / read_at_admin)
//     so unread badges are accurate from either perspective.
//
// WRITE PATHS:
//   - sendMessageFromUser → INSERT row with sender_role='USER'. Subscriber
//     RLS policy permits this when thread_user_id = auth.uid().
//   - sendReplyFromAdmin → INSERT row with sender_role='ADMIN'. Uses the
//     admin client so RLS isn't in the way (auth happens in the action body).
//   - markThreadReadAsUser → UPDATE read_at_user on every ADMIN row in
//     this thread. Subscriber-facing.
//   - markThreadReadAsAdmin → UPDATE read_at_admin on every USER row in
//     this thread. Admin-inbox-facing.
//
// READS: see messages-data.ts (RSC helpers).

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';

interface ActionResult {
  ok: boolean;
  error?: string;
}

const MIN_BODY = 1;
const MAX_BODY = 4000;

/** Send a message from the currently-authed subscriber to the admin team. */
export async function sendMessageFromUser(body: string): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };

  const trimmed = (body ?? '').trim();
  if (trimmed.length < MIN_BODY) return { ok: false, error: 'El mensaje está vacío' };
  if (trimmed.length > MAX_BODY) {
    return { ok: false, error: `El mensaje excede ${MAX_BODY} caracteres` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('messages').insert({
    thread_user_id: session.user.id,
    sender_user_id: session.user.id,
    sender_role: 'USER',
    body: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  // Both surfaces revalidate — subscriber sees their own message instantly,
  // admin inbox picks it up on its next render. Realtime channel below would
  // be the live path; revalidatePath is the post-action fallback.
  revalidatePath('/[locale]/app/messages', 'page');
  revalidatePath('/[locale]/dashboard/messages', 'page');
  return { ok: true };
}

/** Admin reply into a specific subscriber's thread. */
export async function sendReplyFromAdmin(
  threadUserId: string,
  body: string,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins pueden responder' };
  }
  if (!threadUserId) return { ok: false, error: 'Thread inválido' };

  const trimmed = (body ?? '').trim();
  if (trimmed.length < MIN_BODY) return { ok: false, error: 'La respuesta está vacía' };
  if (trimmed.length > MAX_BODY) {
    return { ok: false, error: `La respuesta excede ${MAX_BODY} caracteres` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('messages').insert({
    thread_user_id: threadUserId,
    sender_user_id: session.user.id,
    sender_role: 'ADMIN',
    body: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/dashboard/messages', 'page');
  // Also revalidate the subscriber's messages page so realtime + cache
  // both surface the new reply. We don't know their locale here so
  // revalidate the layout subtree.
  revalidatePath('/[locale]/app/messages', 'page');
  return { ok: true };
}

/** Mark every ADMIN-sent message in the current user's thread as read. */
export async function markThreadReadAsUser(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('messages')
    .update({ read_at_user: new Date().toISOString() })
    .eq('thread_user_id', session.user.id)
    .eq('sender_role', 'ADMIN')
    .is('read_at_user', null);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/app/messages', 'page');
  // Sidebar pulls the badge — invalidate the workspace layout too.
  revalidatePath('/[locale]/app', 'layout');
  return { ok: true };
}

/** Admin marks every USER-sent message in a thread as read. */
export async function markThreadReadAsAdmin(threadUserId: string): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins' };
  }
  if (!threadUserId) return { ok: false, error: 'Thread inválido' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('messages')
    .update({ read_at_admin: new Date().toISOString() })
    .eq('thread_user_id', threadUserId)
    .eq('sender_role', 'USER')
    .is('read_at_admin', null);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/dashboard/messages', 'page');
  return { ok: true };
}

/** Admin marks an anon partner-inquiry as read. */
export async function markInquiryReadAsAdmin(inquiryId: string): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins' };
  }
  if (!inquiryId) return { ok: false, error: 'ID inválido' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('partner_inquiries')
    .update({ read_at_admin: new Date().toISOString() })
    .eq('id', inquiryId)
    .is('read_at_admin', null);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/dashboard/messages', 'page');
  return { ok: true };
}
