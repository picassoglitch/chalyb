import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { resolveSubscription } from '@/lib/billing/subscription-state';
import { applyElapsedCancellation } from '@/lib/billing/subscription-sync';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'EDITOR' | 'VIEWER' | 'CLIENT';
// PARTNER landed in migration 0014 as a 4th tier. Same access as PRO plus
// one always-on owned engine — see TIER_CAPS.PARTNER in src/lib/billing/tiers.ts
// and the engines.owner_user_id column for the ownership pointer.
export type SubscriptionTier = 'FREE' | 'PRO' | 'PARTNER' | 'VIP';

const ROLE_TIER: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  OPERATOR: 60,
  EDITOR: 40,
  VIEWER: 20,
  CLIENT: 10,
};

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface SessionUser {
  user: User;
  role: UserRole;
  tier: SubscriptionTier;
  orgId: string | null;
  /** Which engine the user has chosen to run LIVE (PRO tier only).
   *  Backed by profiles.selected_engine_id (was selected_bot_id pre-migration 0010). */
  selectedEngineId: string | null;
  /** Start of the ChalybClip 7-day live trial, or null. Backed by
   *  profiles.chalybclip_trial_started_at (migration 0025). Read by the
   *  live-execution gating — see isChalybclipTrialActive in lib/billing/tiers. */
  chalybclipTrialStartedAt: string | null;
  /** When the user accepted the first-time welcome banner, or null (banner
   *  still pending). Backed by profiles.welcome_gift_claimed_at (migration 0025). */
  welcomeGiftClaimedAt: string | null;
  /** End of the period the user has already paid for, or null. */
  tierPeriodEnd: string | null;
  /** A cancellation that has been requested but has not taken effect yet.
   *  `tier` above still reports the paid plan until this date passes. */
  pendingCancelAt: string | null;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Reads the authenticated user + their stored role/tier/org/selected-bot from `profiles`.
 * SUPER_ADMIN_EMAILS allowlist forces role to SUPER_ADMIN regardless of stored value
 * — this is the durable backstop documented in the build spec.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'role, tier, org_id, selected_engine_id, chalybclip_trial_started_at, welcome_gift_claimed_at, tier_period_end, tier_cancel_at',
    )
    .eq('id', user.id)
    .maybeSingle();
  const storedRole = (profile?.role as UserRole | undefined) ?? 'VIEWER';
  const role: UserRole = isSuperAdminEmail(user.email) ? 'SUPER_ADMIN' : storedRole;

  // A cancellation is applied lazily, here, rather than by a scheduled job:
  // the user keeps the plan they paid for until tier_cancel_at, and the first
  // read after that date reports FREE and writes it back. See
  // lib/billing/subscription-state.ts for why there is no cron.
  const subscription = resolveSubscription({
    storedTier: (profile?.tier as SubscriptionTier | undefined) ?? 'FREE',
    periodEnd: (profile?.tier_period_end as string | null) ?? null,
    cancelAt: (profile?.tier_cancel_at as string | null) ?? null,
  });
  if (subscription.elapsed) {
    // Fire-and-forget: this session already reports FREE, so the write is
    // only about making the stored row agree.
    void applyElapsedCancellation(user.id);
  }
  const tier = subscription.tier;

  return {
    user,
    role,
    tier,
    tierPeriodEnd: subscription.periodEnd,
    pendingCancelAt: subscription.pendingCancelAt,
    orgId: (profile?.org_id as string | null) ?? null,
    selectedEngineId: (profile?.selected_engine_id as string | null) ?? null,
    chalybclipTrialStartedAt: (profile?.chalybclip_trial_started_at as string | null) ?? null,
    welcomeGiftClaimedAt: (profile?.welcome_gift_claimed_at as string | null) ?? null,
  };
}

export async function requireUser(currentPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const next = currentPath ? `?next=${encodeURIComponent(currentPath)}` : '';
    redirect(`/sign-in${next}`);
  }
  return user;
}

export async function requireRole(min: UserRole, currentPath?: string): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    const next = currentPath ? `?next=${encodeURIComponent(currentPath)}` : '';
    redirect(`/sign-in${next}`);
  }
  if (ROLE_TIER[session.role] < ROLE_TIER[min]) {
    redirect('/account?error=insufficient_role');
  }
  return session;
}

export function can(role: UserRole, action: string): boolean {
  const tier = ROLE_TIER[role] ?? 0;
  switch (action) {
    case 'view':
      return tier >= ROLE_TIER.VIEWER;
    case 'edit':
      return tier >= ROLE_TIER.EDITOR;
    case 'operate':
    case 'restart_worker':
    case 'open_console':
      return tier >= ROLE_TIER.OPERATOR;
    case 'manage_team':
    case 'invite':
      return tier >= ROLE_TIER.ADMIN;
    case 'org_root':
    case 'destroy':
      return tier >= ROLE_TIER.SUPER_ADMIN;
    default:
      return tier >= ROLE_TIER.VIEWER;
  }
}
