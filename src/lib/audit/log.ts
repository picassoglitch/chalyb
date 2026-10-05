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
  | 'team.invite' // admin invited someone from /dashboard/team (Supabase Auth invite email)
  | 'selected_bot.change' // PRO subscriber swapped their live bot
  | 'partner.engine_assign' // admin set / cleared which engine a partner owns
  | 'tokens.grant' // admin manually granted bonus tokens (vs. MP payment / promo)
  | 'tokens.revoke' // admin removed bonus tokens (subtracted from balance)
  | 'promo.welcome_claim' // user accepted the first-time welcome banner
  | 'promo.welcome_reset' // admin reset a user's welcome banner so it shows again
  | 'promo.trial_grant' // trial started/extended (self-claim or admin grant)
  | 'promo.trial_revoke' // admin ended a user's ChalyClip trial early
  | 'engine.launch' // "Abrir" refused by entitlement (P0-3)
  | 'engine.provision' // account created (or failed) at an engine on launch (P0-2)
  | 'clips.job_failed' // a Clips job ended in failed(reason) (P0-16)
  | 'clips.job_retry' // the person pressed "Intentar otra vez" on a failed job (capped at 3)
  | 'tool.incident' // the owner opened or closed a tool incident from /dashboard/herramientas
  | 'tool.key_reauth' // a password check before revealing an En vivo stream key; metadata {ok}
  | 'tool.key_reveal' // an En vivo stream key was shown; metadata {platform, via}
  | 'tool.error' // a tool screen showed ToolErrorState (WS-11, TOOLS-SPEC §7.1); metadata {tool, reason, supportCode}
  // Owner panel (P5). Engine and settings actions have no subscriber: the
  // admin is both actor and target, like engine.status before them.
  | 'admin.gift_month' // a month of Pro with no charge
  | 'admin.plan_offer' // emailed the user a plan change to accept (no charge until they do)
  | 'admin.access_email' // resent the sign-in link
  | 'admin.refund' // refunded the last charge through Mercado Pago
  | 'admin.dispute' // a step of a chargeback case (WS-8, aceptacion-ux §10.5)
  | 'admin.cancel' // cancelled the user's subscription (access kept to period end)
  | 'engine.visibility' // showed or hid a tool for customers
  | 'settings.billing_toggle' // Mensual/Anual offered or not
  | 'settings.usage_margin' // margin charged on top of provider cost
  | 'settings.pack_prices' // credit-pack prices and how IVA applies
  // Old P6-7/P6-8 (legal): ARCO requests, copyright takedowns, retention.
  | 'legal.arco' // an ARCO request received or answered (Aviso de privacidad §5)
  | 'legal.takedown' // a step of a copyright notice (Uso aceptable §5)
  | 'legal.repeat_infringer' // an account reached the repeat-infringer threshold (§5.4)
  | 'legal.retention'; // the 72-month purge of non-compliance marks (Aviso §9.1)

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
