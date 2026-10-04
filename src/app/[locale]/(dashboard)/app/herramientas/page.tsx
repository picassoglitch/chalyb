import type { Metadata } from 'next';
import type { Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getEntitlements } from '@/lib/billing/entitlement';
import { isCustomerVisible } from '@/lib/billing/entitlement-core';
import { proIncludesAllTools, trialFlowEnabled } from '@/lib/config/flags';
import { TOOLS, toolBySlug } from '@/config/tools';
import { toolHref } from '@/lib/tools/routes';
import { toolCardAction } from '@/lib/tools/matrix';
import { planKeyFor } from '@/lib/tools/access';
import { toolStatusLines, type ToolStatusLine } from '@/lib/tools/status-lines';
import { Banner, ButtonLink, Pill } from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tools');
  return { title: t('metaTitle') };
}

// Tus herramientas (TOOLS-SPEC §7.2, mockup 61; Gratis keeps SCR-23's
// offer). The 3 tools as big cards: color icon, plan pill, what it does, a
// real status line and [Abrir], which navigates inside the app. Each card's
// button follows getEntitlements only:
//   included     → Abrir (the tool's own screens)
//   trial_offer  → Incluido en Pro · Pruébalo gratis / Volver a Pro / Ver planes
//   setup_needed → Te falta un paso · Conectar ahora (inside the tool)
// "También incluido" lists only other `live` tools: none today (Q9), so the
// section doesn't render.

export default async function HerramientasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tools');
  const session = await getSessionUser();
  if (!session) return null;
  const [entitlements, engines] = await Promise.all([getEntitlements(session), listEngines().catch(() => [])]);
  const visibleSlugs = new Set(
    engines.filter((e) => isCustomerVisible(e) && entitlements.tools[e.slug]).map((e) => e.slug),
  );
  const main = TOOLS.filter((x) => visibleSlugs.has(x.slug));
  const extra = engines.filter(
    (e) => visibleSlugs.has(e.slug) && !main.some((m) => m.slug === e.slug) && toolBySlug(e.slug)?.live,
  );
  const ctx = {
    plan: entitlements.plan,
    trialUsed: entitlements.trialUsed,
    trialFlow: trialFlowEnabled(),
    proIncludesAllTools: proIncludesAllTools(),
  };
  const offer = ctx.plan === 'FREE' && ctx.trialFlow && ctx.proIncludesAllTools;
  const allIncluded = main.length > 0 && main.every((x) => entitlements.tools[x.slug]?.state === 'included');
  const lines = await toolStatusLines(
    session.user.id,
    planKeyFor(entitlements.plan),
    main.filter((x) => entitlements.tools[x.slug]?.state === 'included').map((x) => x.slug),
    locale,
  );

  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <header>
        <Link href={'/app' as Route} className="ch-crumb">
          {t('crumb')}
          <ChevronRight aria-hidden="true" />
        </Link>
        <h1 className="ch-h1">{t('yours')}</h1>
        {allIncluded && entitlements.plan !== 'FREE' && (
          <p className="ch-sub">{t('sub', { plan: entitlements.plan === 'VIP' ? 'VIP' : 'Pro' })}</p>
        )}
      </header>
      {offer && !entitlements.trialUsed && (
        <Banner kind="trial" action={{ href: '/app/prueba', label: t('try') }}>
          {t('strip')}
        </Banner>
      )}
      <ul className="ch-tools ch-tools--big">
        {main.map((tool) => {
          const access = entitlements.tools[tool.slug]!;
          const action = toolCardAction(access.state, ctx);
          return (
            <li key={tool.slug} className="ch-card ch-tool ch-tool--big" data-pill={action.pill}>
              <div className="ch-tool__top">
                <ToolIcon slug={tool.slug} filled />
                {action.pill === 'included' && (
                  <Pill kind="ok" check>
                    {t('included')}
                  </Pill>
                )}
                {action.pill === 'inPro' && <Pill kind="acc">{t('inPro')}</Pill>}
                {action.pill === 'setup' && <Pill kind="warn">{t('setup')}</Pill>}
              </div>
              <div className="ch-tool__tx">
                <h2 className="ch-tool__name">{tool.name}</h2>
                <p className="ch-muted">{t(`tagline.${tool.slug}`)}</p>
                {lines[tool.slug] && <StatusLine line={lines[tool.slug]!} />}
              </div>
              {action.pill === 'included' && (
                <ButtonLink href={toolHref(tool.slug)} aria-label={`${t('open')} ${tool.name}`}>
                  {t('open')}
                </ButtonLink>
              )}
              {action.pill === 'inPro' && (
                <ButtonLink href={action.href} variant="secondary">
                  {t(action.button)}
                </ButtonLink>
              )}
              {action.pill === 'setup' && (
                <ButtonLink href={toolHref(tool.slug)} variant="secondary">
                  {t('connect')}
                </ButtonLink>
              )}
            </li>
          );
        })}
      </ul>
      {extra.length > 0 && (
        <section aria-labelledby="also-title" style={{ display: 'grid', gap: 14 }}>
          <h2 id="also-title" className="ch-h2">
            {t('also')}
          </h2>
          <ul className="ch-tools ch-tools--light">
            {extra.map((e) => (
              <li key={e.slug}>
                <Link href={toolHref(e.slug) as Route} className="ch-card ch-tool ch-tool--light">
                  <ToolIcon slug={e.slug} size="sm" />
                  <b>{toolBySlug(e.slug)?.name ?? e.name}</b>
                  <span className="ch-lnk">{t('openArrow')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function StatusLine({ line }: { line: ToolStatusLine }) {
  const t = await getTranslations('tools.status');
  return (
    <p className={`ch-tool__status${line.warn ? ' ch-tool__status--warn' : ''}`}>
      <span className="ch-tool__dot" aria-hidden="true" />
      {t(line.key, line.values)}
    </p>
  );
}
