// Persisting a cancellation that has come due.
//
// Kept apart from both session.ts and the cancel server action so neither
// has to import the other: session.ts calls this, the action calls this,
// and this imports only the admin client. No cycle.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Write the FREE tier back for a user whose `tier_cancel_at` has passed, and
 * clear the cancellation bookkeeping.
 *
 * Best-effort by design. It runs from the read path (getSessionUser), so a
 * failure must not break the request — the resolver already reported FREE for
 * this session, and the next request will simply try again.
 */
export async function applyElapsedCancellation(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('profiles')
      .update({ tier: 'FREE', tier_cancel_at: null, tier_period_end: null })
      .eq('id', userId)
      // Only if a cancellation really is due. Without this predicate a stale
      // read could downgrade someone who re-subscribed in the meantime.
      .not('tier_cancel_at', 'is', null)
      .lte('tier_cancel_at', new Date().toISOString());
    if (error) {
      console.warn('[billing] could not apply elapsed cancellation:', error.message);
    }
  } catch (err) {
    console.warn('[billing] could not apply elapsed cancellation:', err);
  }
}
