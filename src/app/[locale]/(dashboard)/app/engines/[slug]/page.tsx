import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { Link, redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { isAdminRole } from '@/lib/billing/tiers';
import { getEntitlements } from '@/lib/billing/entitlement';
import { isCustomerVisible } from '@/lib/billing/entitlement-core';
import { trialFlowEnabled } from '@/lib/config/flags';
import { engineDisplayName } from '@/lib/engines/display-names';
import { ensureAdminEngineAccess, getEngineAccess } from '@/lib/engines/subscriptions';
import { EngineLaunchButton } from '@/components/workspace/engine-launch-button';
import { EngineGlyph } from '@/components/workspace/engines/engine-glyph';
import { EngineDiagnostics } from '@/components/dashboard/engine-diagnostics';
import { SetupState } from '@/components/ui/setup-state';

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
// Admins additionally get a collapsed diagnostics block (P0-5).

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
  if (!isCustomerVisible(engine)) return redirect({ href: '/app/engines', locale });

  const isAdmin = isAdminRole(session.role);
  if (isAdmin) await ensureAdminEngineAccess(session.user.id, engine.id);

  const entitlements = await getEntitlements(session);
  const access = entitlements.tools[engine.slug] ?? { state: 'trial_offer' as const };
  const name = engine.name;
  const tagline = tEngines.has(`marketing.${engine.slug}.tagline`)
    ? tEngines(`marketing.${engine.slug}.tagline`)
    : null;
  const trialFlow = trialFlowEnabled();
  // TODO(P2): /app/prueba (SCR-14) once TRIAL_FLOW_ENABLED is on.
  const planHref = trialFlow ? '/app/prueba' : '/app/subscription';
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
    <div className="cc-scroll">
      <div style={{ marginBottom: 18 }}>
        <Link
          href={'/app/engines' as Route}
          style={{
            color: 'var(--cc-txt-3)',
            fontSize: 15,
            textDecoration: 'none',
            minHeight: 48,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          ← {t('back')}
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <span
          aria-hidden="true"
          className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--cc-line-2)] bg-[var(--cc-panel)] text-[var(--cc-green)]"
        >
          <EngineGlyph slug={engine.slug} size={30} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: 'var(--cc-disp), sans-serif',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: 6,
            }}
          >
            {name}
          </h1>
          <span
            className={`cc-mod-badge ${access.state === 'included' ? 'gr' : 'cy'}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            {badge}
          </span>
        </div>
      </div>

      {tagline && (
        <p
          style={{
            color: 'var(--cc-txt-2)',
            fontSize: 17,
            lineHeight: 1.5,
            maxWidth: '60ch',
            marginBottom: 28,
          }}
        >
          {tagline}
        </p>
      )}

      {access.state === 'setup_needed' ? (
        <SetupState
          step={access.missing}
          alternativeHref={engine.slug === 'chalybclip' ? '/app/clips' : undefined}
        />
      ) : (
        <section
          style={{
            padding: '24px 26px',
            border: `1px solid ${access.state === 'included' ? 'var(--cc-green)' : 'var(--cc-line-2)'}`,
            background: access.state === 'included' ? 'var(--cc-green-g)' : 'var(--cc-panel)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 28,
          }}
        >
          {access.state === 'included' ? (
            <>
              <p style={panelText}>{t('ready.body', { tool: name })}</p>
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
              <h2 style={panelTitle}>{t('switch.title')}</h2>
              <p style={panelText}>{t('switch.body', { tool: name })}</p>
              <Link href={'/app/engines' as Route} style={primaryLink}>
                {t('switch.cta')}
              </Link>
            </>
          ) : (
            <>
              <h2 style={panelTitle}>{t('offer.title')}</h2>
              <p style={panelText}>{t('offer.body', { tool: name })}</p>
              <Link href={planHref as Route} style={primaryLink}>
                {trialFlow ? t('offer.trialCta') : t('offer.plansCta')}
              </Link>
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

const panelTitle = { fontSize: 20, fontWeight: 600, marginBottom: 6 } as const;
const panelText = {
  fontSize: 16,
  color: 'var(--cc-txt-2)',
  lineHeight: 1.5,
  marginBottom: 16,
  maxWidth: '60ch',
} as const;
const primaryLink = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 52,
  padding: '12px 24px',
  borderRadius: 12,
  background: 'var(--cc-green)',
  color: '#070809',
  fontWeight: 600,
  textDecoration: 'none',
} as const;
