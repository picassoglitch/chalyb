// GET /auth/launch/<slug>
//
// Cross-app SSO launcher. Lets one engine link to another while keeping the
// session: the user is already authenticated at Chalyb (cookie on this
// domain), so this route mints the engine's signed SSO token and 302s
// straight into its dashboard — no landing/login bounce.
//
// Used by ChalyClip's "Transmitir con ChalyOBS" button (→ /auth/launch/chalybobs)
// and ChalyOBS's "Get Clips" button (→ /auth/launch/chalybclip). Also the
// registration funnel target for chalybclip.chalyb.com's landing CTAs
// (/sign-in?next=/auth/launch/chalybclip) — sign-up flows straight back into
// ChalyClip with trial + provisioning handled here in the background.
//
// Cross-tool launches need the target tool in the user's plan.
// ChalyClip itself is open to every signed-in user: first-timers get the
// welcome gift / 7-day trial claimed silently, and ChalyClip enforces its
// own tier perks once inside.
//
// Under /auth/* so it's excluded from the i18n proxy matcher (no locale
// prefix rewriting on a redirect-only endpoint).

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectiveTier, CHALYBCLIP_TRIAL_SLUG } from '@/lib/billing/tiers';
import { provisionEngineAccess } from '@/lib/engines/subscriptions';
import { getEngineLaunchUrl } from '@/lib/engines/launch-actions';
import { getEntitlements } from '@/lib/billing/entitlement';
import { trialFlowEnabled } from '@/lib/config/flags';
import { claimWelcomeGift } from '@/lib/usage/welcome-actions';

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await ctx.params;
  const origin = request.nextUrl.origin;

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/sign-in?next=${encodeURIComponent(`/auth/launch/${slug}`)}`, origin),
    );
  }

  // Full-access gate — for cross-engine launches only. ChalyClip is exempt:
  // it's the registration funnel from chalybclip.chalyb.com (the landing
  // links every CTA here via /sign-in?next=/auth/launch/chalybclip), so any
  // signed-in user passes through. The platform onboarding happens silently
  // below (trial claim + provisioning) and ChalyClip enforces its own
  // per-tier perks — the visitor goes straight from sign-up to
  // ChalyClip's /dashboard/start without ever seeing the Chalyb dashboard.
  //
  // The gate is getEntitlements, like every other launch path (P0-3): a tool
  // the user's plan doesn't include goes to its page, which explains the offer.
  const tier = effectiveTier(session.role, session.tier);
  if (slug !== CHALYBCLIP_TRIAL_SLUG) {
    const entitlements = await getEntitlements(session);
    if (entitlements.tools[slug]?.state !== 'included') {
      return NextResponse.redirect(new URL(`/app/engines/${slug}`, origin));
    }
  }

  const admin = createAdminClient();
  const { data: engine } = await admin
    .from('engines')
    .select('id, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!engine) {
    return NextResponse.redirect(new URL('/app/herramientas', origin));
  }

  // Only `active` engines are actually serving. `coming_soon` / `deprecated`
  // means the backend isn't reachable (not launched yet, or offline — see
  // supabase/migrations/0028), and every other surface already honours that:
  // cards render "Próximamente" with the launch button disabled. This route
  // is the one path that bypasses those surfaces — the landing CTAs link
  // /sign-in?next=/auth/launch/chalybclip directly — so without this check a
  // brand-new signup gets 302'd into a dead host and sees a browser
  // connection error instead of a handled state. Send them to the engine
  // page, which renders the real status.
  //
  // Checked BEFORE provisioning on purpose: provisionEngineAccess() POSTs to
  // the engine's admin_api_base, so skipping it also avoids hanging the
  // request on a dead backend until the socket times out.
  if (engine.status !== 'active') {
    return NextResponse.redirect(new URL(`/app/engines/${slug}`, origin));
  }

  const engineId = engine.id as string;

  // Q8: once the Pro trial is live, new accounts no longer get the legacy
  // 7-day Clips trial / welcome gift (Clips is free anyway); active ones are
  // honoured where they are.
  if (slug === CHALYBCLIP_TRIAL_SLUG && !trialFlowEnabled()) {
    // Idempotent: first-timers get the welcome gift + 7-day trial started
    // and a ChalyClip tenant provisioned; returning users no-op. The audit
    // log's `via: chalybclip_landing_launch` marks the user as having
    // registered through the ChalyClip funnel. Never blocks the launch.
    try {
      await claimWelcomeGift('chalybclip_landing_launch');
    } catch (err) {
      console.warn('[launch] chalybclip welcome claim failed (non-fatal):', err);
    }
  }

  // Ensure the user is provisioned on the target engine (idempotent) so the
  // launch has an external_user_id to sign into the SSO token. ChalyClip
  // funnel users are 'manual' (any tier); cross-engine launches keep the
  // VIP seed source.
  try {
    await provisionEngineAccess(
      session.user.id,
      engineId,
      slug === CHALYBCLIP_TRIAL_SLUG
        ? 'manual'
        : tier === 'VIP'
          ? 'all_access_seed'
          : 'pro_selection',
    );
  } catch {
    // Non-fatal — getEngineLaunchUrl will report if access is still missing.
  }

  const result = await getEngineLaunchUrl(engineId);
  if (result.ok && result.url) {
    return NextResponse.redirect(result.url);
  }
  // Couldn't build the launch URL (engine not configured / provisioning
  // failed) — drop the user on the engine page where the error surfaces.
  return NextResponse.redirect(new URL(`/app/engines/${slug}`, origin));
}
