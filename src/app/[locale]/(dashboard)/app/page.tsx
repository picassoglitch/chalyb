import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getEntitlements } from '@/lib/billing/entitlement';
import { isCustomerVisible } from '@/lib/billing/entitlement-core';
import { WelcomeGiftBanner } from '@/components/workspace/welcome-gift-banner';
import { WELCOME_DISMISSED_COOKIE, isWelcomeDismissedFor } from '@/lib/usage/welcome-dismissal';
import { ChalybclipGraceBanner } from '@/components/workspace/chalybclip-grace-banner';
import { EngineGlyph } from '@/components/workspace/engines/engine-glyph';

export async function generateMetadata() {
  const t = await getTranslations('home');
  return { title: t('title') };
}

// Interim home (P0-7). P1 replaces the whole screen with mockups 01/08; this
// version only makes it truthful: every card and count comes from
// getEntitlements, unfinished tools are not shown, and nothing says "modo
// demo" or "Disponible".

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tTool = await getTranslations('tool');
  const tEngines = await getTranslations('engines');

  const session = await getSessionUser();
  if (!session) return null; // the layout already sent anonymous visitors to sign-in

  const meta = session.user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    session.user.email?.split('@')[0] ||
    '';

  const welcomeClaimed = session.welcomeGiftClaimedAt != null;
  const welcomeDismissed = isWelcomeDismissedFor(
    (await cookies()).get(WELCOME_DISMISSED_COOKIE)?.value,
    session.user.id,
  );

  const [entitlements, engines] = await Promise.all([
    getEntitlements(session),
    listEngines().catch(() => []),
  ]);

  const tools = engines
    .filter(isCustomerVisible)
    .map((engine) => ({ engine, access: entitlements.tools[engine.slug] }))
    .filter((v) => v.access !== undefined)
    // Included tools lead, then the rest, keeping the catalog order otherwise.
    .sort(
      (a, b) => Number(b.access!.state === 'included') - Number(a.access!.state === 'included'),
    );

  const credits = entitlements.credits;
  const nf = (n: number) => n.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');
  const graceCredits =
    entitlements.trial?.grace && credits && !credits.unlimited ? credits.remaining : 0;

  return (
    <div className="cc-scroll">
      <WelcomeGiftBanner
        claimed={welcomeClaimed}
        initiallyDismissed={welcomeDismissed}
        userId={session.user.id}
      />
      {entitlements.trial?.grace && <ChalybclipGraceBanner tokensRemaining={graceCredits} />}

      <div className="cc-mod-section">
        <h1
          style={{
            fontFamily: 'var(--cc-disp), sans-serif',
            fontSize: 'clamp(26px, 3vw, 34px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: 6,
          }}
        >
          {name ? t('greeting', { name: name.split(' ')[0] ?? name }) : t('greetingAnon')}
        </h1>
        <p style={{ color: 'var(--cc-txt-2)', fontSize: 18, maxWidth: '64ch' }}>{t('sub')}</p>
      </div>

      {credits && (
        <div className="cc-mod-statgrid">
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">{t('credits.label')}</div>
            <div className="cc-mod-stat-v cy">
              {credits.unlimited ? '∞' : nf(credits.remaining)}
            </div>
            <div className="cc-mod-stat-sub">
              {credits.unlimited ? t('credits.unlimited') : t('credits.sub')}
            </div>
          </div>
        </div>
      )}

      <div className="cc-mod-section">
        <h2 className="cc-mod-sl">{t('toolsHeading', { count: tools.length })}</h2>
        <div className="cc-mod-grid cc-mod-grid-2">
          {tools.map(({ engine, access }) => {
            const included = access!.state === 'included';
            const badge = included
              ? tTool('badge.included')
              : access!.state === 'setup_needed'
                ? tTool('badge.setup')
                : entitlements.plan !== 'FREE'
                  ? tTool('badge.otherTool')
                  : tTool('badge.trialOffer');
            const tagline = tEngines.has(`marketing.${engine.slug}.tagline`)
              ? tEngines(`marketing.${engine.slug}.tagline`)
              : null;
            return (
              <Link
                key={engine.id}
                href={
                  (engine.slug === 'chalybclip' && included
                    ? '/app/clips'
                    : `/app/engines/${engine.slug}`) as Route
                }
                className="cc-mod-card"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: included ? 'var(--cc-green)' : undefined,
                }}
              >
                <div className="cc-mod-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      aria-hidden="true"
                      className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--cc-green)]/30 bg-[var(--cc-green-g)] text-[var(--cc-green)]"
                    >
                      <EngineGlyph slug={engine.slug} size={22} />
                    </span>
                    <h3 style={{ fontSize: 18 }}>{engine.name}</h3>
                  </div>
                  <span className={`cc-mod-badge ${included ? 'gr' : 'cy'}`}>{badge}</span>
                </div>
                {tagline && <p>{tagline}</p>}
                <div className="cc-mod-meta" style={{ marginTop: 'auto' }}>
                  <span>→ {included ? t('open') : t('see')}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
