import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { isAdminRole } from '@/lib/billing/tiers';
import { getEntitlements } from '@/lib/billing/entitlement';
import { isCustomerVisible } from '@/lib/billing/entitlement-core';
import { paidCheckoutEnabled, trialFlowEnabled } from '@/lib/config/flags';
import { hubRunsTool } from '@/lib/tools/registry';
import { TOOL_ROUTES } from '@/lib/tools/routes';
import { engineDisplayName } from '@/lib/engines/display-names';
import { ensureAdminEngineAccess, getEngineAccess } from '@/lib/engines/subscriptions';
import { EngineLaunchButton } from '@/components/workspace/engine-launch-button';
import { EngineDiagnostics } from '@/components/dashboard/engine-diagnostics';
import { SetupState } from '@/components/ui/setup-state';
import { ButtonLink, Pill } from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: engineDisplayName(slug) || undefined };
}

// One tool, one decision. What this page shows comes from getEntitlements and
// nothing else, so it can never disagree with the card that led here (B1):
//
//   included      → "Abrir"
//   trial_offer   → "Incluido en Pro · Pruébalo gratis" (Free) or "change your
//                   tool" (Pro, whose plan runs one tool at a time until P2)
//   setup_needed  → SetupState for the named missing step
//   not visible   → this URL redirects to the tools list
//
// Admins additionally get a collapsed diagnostics block (P0-5). P3 replaces
// each tool's own screens for included tools the hub runs (redirect below).

export default async function ToolPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tool');
  const tEngines = await getTranslations('engines');

  const session = await getSessionUser();
  if (!session) return redirect({ href: `/sign-in?next=/app/engines/${slug}`, locale });

  const engine = (await listEngines()).find((e) => e.slug === slug);
  if (!engine) notFound();
  if (!isCustomerVisible(engine)) return redirect({ href: '/app/herramientas', locale });

  const isAdmin = isAdminRole(session.role);
  if (isAdmin) await ensureAdminEngineAccess(session.user.id, engine.id);

  const entitlements = await getEntitlements(session);
  const access = entitlements.tools[engine.slug] ?? { state: 'trial_offer' as const };
  // P3: a tool the hub runs has its own screens. Admins stay here for the
  // diagnostics block.
  if (access.state === 'included' && !isAdmin && TOOL_ROUTES[slug] && hubRunsTool(slug))
    return redirect({ href: TOOL_ROUTES[slug]!, locale });
  const name = engine.name;
  const tagline = tEngines.has(`marketing.${engine.slug}.tagline`)
    ? tEngines(`marketing.${engine.slug}.tagline`)
    : null;
  // The trial offer only while it can be honoured: the flow is on and this
  // account hasn't used its trial (K-7).
  const trialFlow = trialFlowEnabled() && !entitlements.trialUsed;
  // TODO(P2): /app/prueba (SCR-14) once TRIAL_FLOW_ENABLED is on.
  const planHref = trialFlow
    ? '/app/prueba'
    : paidCheckoutEnabled()
      ? '/app/planes'
      : '/app/subscription';
  // Pro without PRO_INCLUDES_ALL_TOOLS runs one tool at a time: a "trial
  // offer" for them means "switch your tool", not "try Pro".
  const isSwitch = access.state === 'trial_offer' && entitlements.plan !== 'FREE';

  const badge =
    access.state === 'included'
      ? t('badge.included')
      : access.state === 'setup_needed'
        ? t('badge.setup')
        : isSwitch
          ? t('badge.otherTool')
          : t('badge.trialOffer');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}>
      <Link href={'/app' as Route} className="ch-back" style={{ alignSelf: 'flex-start' }}>
        <ChevronLeft aria-hidden="true" />
        <span>{t('back')}</span>
      </Link>

      <header style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToolIcon slug={engine.slug} filled={access.state === 'included'} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <h1 className="ch-h1">{name}</h1>
          <Pill
            kind={access.state === 'included' ? 'ok' : 'acc'}
            check={access.state === 'included'}
          >
            {badge}
          </Pill>
        </div>
      </header>

      {tagline && <p className="ch-sub">{tagline}</p>}

      {access.state === 'setup_needed' ? (
        <SetupState
          step={access.missing}
          alternativeHref={engine.slug === 'chalybclip' ? '/app/clips' : undefined}
        />
      ) : (
        <section
          className="ch-card"
          style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {access.state === 'included' ? (
            <>
              <p className="ch-muted">{t('ready.body', { tool: name })}</p>
              <EngineLaunchButton
                engineId={engine.id}
                slug={engine.slug}
                toolName={name}
                planHref={planHref}
                trialFlow={trialFlow}
              />
            </>
          ) : isSwitch ? (
            <>
              <h2 className="ch-h2">{t('switch.title')}</h2>
              <p className="ch-muted">{t('switch.body', { tool: name })}</p>
              <ButtonLink href="/app/herramientas" size="xl">
                {t('switch.cta')}
              </ButtonLink>
            </>
          ) : (
            <>
              <h2 className="ch-h2">{t('offer.title')}</h2>
              <p className="ch-muted">{t('offer.body', { tool: name })}</p>
              <ButtonLink href={planHref} size="xl">
                {trialFlow ? t('offer.trialCta') : t('offer.plansCta')}
              </ButtonLink>
            </>
          )}
        </section>
      )}

      {isAdmin && (
        <EngineDiagnostics
          engineId={engine.id}
          slug={engine.slug}
          requiresProvisioning={engine.requiresProvisioning}
          access={await getEngineAccess(session.user.id, engine.id)}
        />
      )}
    </div>
  );
}
