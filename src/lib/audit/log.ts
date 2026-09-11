// Audit log writer — single entry point for recording billing/account events.
//
// Always uses the service-role admin client because:
//   - RLS denies writes from anon/auth contexts on purpose
//   - The MP webhook has no session at all (system actor)
//
// Failure mode: if the audit insert errors, we LOG IT but DON'T throw —
// audit failure should never break the user-facing flow (e.g. an admin's
// tier change must succeed even if the audit DB is having a bad day).
// In a production setup you'd alert on these, not retry.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  | 'tier.change' // admin changed a subscriber's tier via /dashboard/team
  | 'tier.payment' // MP webhook activated tier after approved payment
  | 'tier.downgrade' // subscriber self-downgraded
  | 'role.change' // admin changed a subscriber's role
  | 'selected_bot.change' // PRO subscriber swapped their live bot
  | 'partner.engine_assign' // admin set / cleared which engine a partner owns
  | 'tokens.grant' // admin manually granted bonus tokens (vs. MP payment / promo)
  | 'tokens.revoke' // admin removed bonus tokens (subtracted from balance)
  | 'promo.welcome_claim' // user accepted the first-time welcome banner
  | 'promo.welcome_reset' // admin reset a user's welcome banner so it shows again
  | 'promo.trial_grant' // trial started/extended (self-claim or admin grant)
  | 'promo.trial_revoke'; // admin ended a user's ChalybClip trial early

export interface AuditPayload {
  action: AuditAction;
  /** User id of the human who triggered the action. NULL when the actor is the
   *  system (e.g. MP webhook firing on a successful payment — no logged-in user). */
  actorId?: string | null;
  actorEmail?: string | null;
  /** The user whose row was changed. Always required. */
  targetUserId: string;
  targetEmail?: string | null;
  /** Subset of fields BEFORE the change. e.g. { tier: 'FREE' }. */
  before?: Record<string, unknown> | null;
  /** Subset of fields AFTER the change. e.g. { tier: 'PRO' }. */
  after?: Record<string, unknown> | null;
  /** Freeform context: MP payment id, reason string, IP, etc. */
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('audit_events').insert({
      action: payload.action,
      actor_id: payload.actorId ?? null,
      actor_email: payload.actorEmail ?? null,
      target_user_id: payload.targetUserId,
      target_email: payload.targetEmail ?? null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      metadata: payload.metadata ?? null,
    });
    if (error) {
      console.error('[audit] insert failed', payload.action, error.message);
    }
  } catch (err) {
    // Don't let audit failures bubble — caller's action should still succeed.
    console.error('[audit] threw', payload.action, err);
  }
}
