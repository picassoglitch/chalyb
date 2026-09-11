// RSC helpers for reading message threads + partner inquiries.
// Server-only — these all use the admin client to read across users
// (intentional: the admin inbox aggregates every thread). Subscriber-side
// reads also go through here but scope to their own thread via the
// thread_user_id param.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface MessageRow {
  id: string;
  thread_user_id: string;
  sender_user_id: string | null;
  sender_role: 'USER' | 'ADMIN';
  body: string;
  read_at_user: string | null;
  read_at_admin: string | null;
  created_at: string;
}

export interface ThreadSummary {
  threadUserId: string;
  userEmail: string | null;
  userFullName: string | null;
  userTier: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderRole: 'USER' | 'ADMIN';
  unreadForAdmin: number;
}

export interface PartnerInquiryRow {
  id: string;
  name: string;
  email: string;
  message: string;
  pane: 'client' | 'partner' | 'earn';
  ip_addr: string | null;
  user_agent: string | null;
  promoted_user_id: string | null;
  read_at_admin: string | null;
  created_at: string;
}

/** Load every message in one subscriber's thread, oldest first. */
export async function listThreadMessages(threadUserId: string): Promise<MessageRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('messages')
    .select(
      'id, thread_user_id, sender_user_id, sender_role, body, read_at_user, read_at_admin, created_at',
    )
    .eq('thread_user_id', threadUserId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[messages] listThreadMessages failed:', error.message);
    return [];
  }
  return (data ?? []) as MessageRow[];
}

/** Aggregate every thread (one row per subscriber with any message). */
export async function listAdminThreads(): Promise<ThreadSummary[]> {
  const admin = createAdminClient();

  // Pull every message — at our scale this is tractable (a few thousand rows
  // total even at meaningful adoption). We aggregate in JS to avoid pg
  // window-function gymnastics for the v1 inbox.
  const { data: msgs, error } = await admin
    .from('messages')
    .select('thread_user_id, sender_role, body, read_at_admin, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[messages] listAdminThreads failed:', error.message);
    return [];
  }

  const byThread = new Map<
    string,
    {
      lastMessage: string;
      lastMessageAt: string;
      lastSenderRole: 'USER' | 'ADMIN';
      unreadForAdmin: number;
    }
  >();
  for (const m of msgs ?? []) {
    const tid = m.thread_user_id as string;
    const existing = byThread.get(tid);
    if (!existing) {
      byThread.set(tid, {
        lastMessage: m.body as string,
        lastMessageAt: m.created_at as string,
        lastSenderRole: m.sender_role as 'USER' | 'ADMIN',
        unreadForAdmin:
          m.sender_role === 'USER' && !m.read_at_admin ? 1 : 0,
      });
    } else {
      // Already saw a newer row (we ordered DESC). Just bump unread.
      if (m.sender_role === 'USER' && !m.read_at_admin) {
        existing.unreadForAdmin += 1;
      }
    }
  }

  if (byThread.size === 0) return [];

  // Hydrate user metadata (email + name + tier). One round-trip.
  const userIds = Array.from(byThread.keys());
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, tier')
    .in('id', userIds);

  const profileById = new Map<string, { email: string | null; full_name: string | null; tier: string }>(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        email: (p.email as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
        tier: (p.tier as string) ?? 'FREE',
      },
    ]),
  );

  const summaries: ThreadSummary[] = userIds.map((tid) => {
    const t = byThread.get(tid)!;
    const p = profileById.get(tid);
    return {
      threadUserId: tid,
      userEmail: p?.email ?? null,
      userFullName: p?.full_name ?? null,
      userTier: p?.tier ?? 'FREE',
      lastMessage: t.lastMessage,
      lastMessageAt: t.lastMessageAt,
      lastSenderRole: t.lastSenderRole,
      unreadForAdmin: t.unreadForAdmin,
    };
  });

  // Sort by lastMessageAt desc — most recent activity first.
  summaries.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return summaries;
}

/** Mark every ADMIN-sent message in this user's thread as read. Pure data
 *  write — deliberately does NOT call revalidatePath, so it's safe to invoke
 *  during an RSC render (the /app/messages page auto-marks on load). The
 *  server-action variant in messages-actions.ts adds revalidation for
 *  client-triggered calls. Best-effort: logs + swallows so a transient DB
 *  hiccup never crashes the page. */
export async function markThreadReadForUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('messages')
    .update({ read_at_user: new Date().toISOString() })
    .eq('thread_user_id', userId)
    .eq('sender_role', 'ADMIN')
    .is('read_at_user', null);
  if (error) console.error('[messages] markThreadReadForUser failed:', error.message);
}

/** Sidebar badge — quick total of unread messages for the signed-in user. */
export async function countUnreadForUser(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_user_id', userId)
    .eq('sender_role', 'ADMIN')
    .is('read_at_user', null);
  if (error) {
    console.error('[messages] countUnreadForUser failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

/** Admin nav badge — total inbound messages awaiting reply across all threads. */
export async function countUnreadForAdmin(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_role', 'USER')
    .is('read_at_admin', null);
  if (error) return 0;
  return count ?? 0;
}

/** List recent partner inquiries (the landing-form leads). Unread first. */
export async function listPartnerInquiries(limit = 50): Promise<PartnerInquiryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('partner_inquiries')
    .select(
      'id, name, email, message, pane, ip_addr, user_agent, promoted_user_id, read_at_admin, created_at',
    )
    .order('read_at_admin', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[messages] listPartnerInquiries failed:', error.message);
    return [];
  }
  return (data ?? []) as PartnerInquiryRow[];
}

export async function countUnreadInquiriesForAdmin(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('partner_inquiries')
    .select('id', { count: 'exact', head: true })
    .is('read_at_admin', null);
  if (error) return 0;
  return count ?? 0;
}
