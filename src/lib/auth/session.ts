import { createClient } from '@/lib/supabase/server';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requestedDestination } from '@/lib/auth/pathname';
import { tierAfterExpiry } from '@/lib/billing/subscription-period';
import type { User } from '@supabase/supabase-js';

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
  /** When the paid tier lapses to FREE, or null for no scheduled end. Set by
   *  cancelling: the plan runs to the end of the period already paid for.
   *  Backed by profiles.tier_ends_at (migration 0035). */
  tierEndsAt: string | null;
}

/** Write a lapse back to the row. Service-role because tier is a privileged
 *  column (migration 0032), and fire-and-forget because the caller has already
 *  decided the tier for this request — a failure here just means the next read
 *  tries again. */
async function expirePaidTier(userId: string): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    await admin
      .from('profiles')
      .update({ tier: 'FREE', tier_ends_at: null })
      .eq('id', userId)
      // Only if it is still the lapsed state we read — never stomp on a
      // payment that landed in between.
      .lte('tier_ends_at', new Date().toISOString());
  } catch (err) {
    console.warn('[session] could not converge a lapsed tier:', err);
  }
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
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'role, tier, tier_ends_at, org_id, selected_engine_id, chalybclip_trial_started_at, welcome_gift_claimed_at',
    )
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    // The defaults below (VIEWER / FREE) are the right fail-closed answer, but
    // a failing read here demotes EVERY user at once — a missing column from
    // an unapplied migration did exactly that, silently. Say so in the logs.
    console.error(
      `[session] profiles read failed for ${user.id}; treating as VIEWER/FREE:`,
      profileError.message,
    );
  }
  const storedRole = (profile?.role as UserRole | undefined) ?? 'VIEWER';
  const role: UserRole = isSuperAdminEmail(user.email) ? 'SUPER_ADMIN' : storedRole;
  const storedTier = (profile?.tier as SubscriptionTier | undefined) ?? 'FREE';
  const tierEndsAt = (profile?.tier_ends_at as string | null) ?? null;

  // A cancelled plan keeps working until the period the user paid for runs
  // out, and stops the moment it does. Deciding that HERE, on every session
  // read, is what makes the lapse real: there is no scheduled job that could
  // fail and quietly leave someone on a paid plan forever.
  const tier = tierAfterExpiry(storedTier, tierEndsAt);
  if (tier !== storedTier) {
    // Converge the row so the admin team page and the billing history agree
    // with what the user actually has. Best-effort: the value above already
    // governs this request either way.
    void expirePaidTier(user.id);
  }

  return {
    user,
    role,
    tier,
    tierEndsAt,
    orgId: (profile?.org_id as string | null) ?? null,
    selectedEngineId: (profile?.selected_engine_id as string | null) ?? null,
    chalybclipTrialStartedAt: (profile?.chalybclip_trial_started_at as string | null) ?? null,
    welcomeGiftClaimedAt: (profile?.welcome_gift_claimed_at as string | null) ?? null,
  };
}

/**
 * Sends an unauthenticated visitor to /sign-in with `?next=` pointing at the
 * page they actually asked for, so signing in returns them there.
 *
 * `fallback` is only used when the proxy header is absent (see
 * `requestedDestination`) — pass the section root so a missing header degrades
 * to the old behavior instead of dropping the user on /account.
 *
 * Uses next-intl's `redirect` rather than `next/navigation`'s so an English
 * visitor on /en/app/billing lands on /en/sign-in, not the Spanish default.
 */
async function redirectToSignIn(fallback: string): Promise<never> {
  const next = await requestedDestination(fallback);
  const locale = await getLocale();
  return redirect({ href: { pathname: '/sign-in', query: { next } }, locale });
}

export async function requireUser(fallbackPath = '/app'): Promise<User> {
  const user = await getCurrentUser();
  if (user) return user;
  return redirectToSignIn(fallbackPath);
}

export async function requireRole(min: UserRole, fallbackPath = '/app'): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) return redirectToSignIn(fallbackPath);
  if (ROLE_TIER[session.role] < ROLE_TIER[min]) {
    redirect({
      href: { pathname: '/account', query: { error: 'insufficient_role' } },
      locale: await getLocale(),
    });
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
