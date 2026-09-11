'use client';

// ProfileSubscriber — listens to live UPDATEs on the current user's
// profiles row and re-fetches the server components when one arrives.
//
// Without this hook, an admin changing a subscriber's tier from
// /dashboard/team has no way to push the change into the subscriber's open
// browser tab. revalidatePath flushes the server cache, but the browser
// keeps showing whatever HTML it last rendered. Now: server action writes
// to profiles → Supabase Realtime broadcasts the row UPDATE over websocket
// → this hook fires router.refresh() → React Server Components re-render
// with the new tier/role, sidebar pill flips, paywall banners reflow, etc.
//
// RLS rules from migration 0001 ensure the subscriber only receives events
// for their OWN row — broadcast is filtered server-side by SELECT policy.
//
// Mounted at /app/layout.tsx and /dashboard/layout.tsx so every authed
// surface gets live-sync for free.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Shape of the profile row payload (subset we care about). REPLICA IDENTITY
 *  FULL in migration 0007 ensures both NEW and OLD include these columns. */
export interface ProfileChangePayload {
  id?: string;
  tier?: string;
  role?: string;
  selected_bot_id?: string | null;
}

interface Props {
  userId: string;
  /** Optional hook fired BEFORE router.refresh() with the new + old rows.
   *  Wrappers use this to show user-facing toasts diffing tier/role. */
  onChange?: (next: ProfileChangePayload, prev: ProfileChangePayload | null) => void;
}

export function ProfileSubscriber({ userId, onChange }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    // Unique channel name per user — prevents collision if the hook ever
    // gets remounted alongside another (e.g. layout transition).
    const channel = supabase
      .channel(`profile-self:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as ProfileChangePayload;
          const prev = (payload.old ?? null) as ProfileChangePayload | null;
          // Fire diff callback first so the toast appears before the page
          // re-renders (refresh() can blank state for a beat in dev mode).
          onChange?.(next, prev);
          // RSC re-fetch — server reads fresh profile, all dependent UI
          // (sidebar pill, /app/subscription, /app/usage, /app/bots, etc.)
          // re-renders in one pass. No reload, no flash.
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router, onChange]);

  return null;
}
