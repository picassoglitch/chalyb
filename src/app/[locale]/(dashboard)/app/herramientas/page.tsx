import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getEntitlements } from '@/lib/billing/entitlement';
import { isCustomerVisible } from '@/lib/billing/entitlement-core';
import { engineDisplayName } from '@/lib/engines/display-names';
import { proIncludesAllTools, trialFlowEnabled } from '@/lib/config/flags';
import { toolHref } from '@/lib/tools/routes';
import { toolCardAction } from '@/lib/tools/matrix';
import { Banner, ButtonLink, Pill } from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tools');
  return { title: t('metaTitle') };
}

// Más herramientas (SCR-23, P3-7). One card per visible tool, and the card's
// button follows getEntitlements only (the same decision as the tool page):
//   included     → Abrir (its own screens, or its launch page)
//   trial_offer  → Incluido en Pro · Pruébalo gratis / Volver a Pro / Ver planes
//   setup_needed → Te falta un paso · Conectar ahora

export default async function HerramientasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tools');
  const session = await getSessionUser();
  if (!session) return null;
  const [entitlements, engines] = await Promise.all([getEntitlements(session), listEngines().catch(() => [])]);
  const visible = engines.filter((e) => isCustomerVisible(e) && entitlements.tools[e.slug]);
  const ctx = {
    plan: entitlements.plan,
    trialUsed: entitlements.trialUsed,
    trialFlow: trialFlowEnabled(),
    proIncludesAllTools: proIncludesAllTools(),
  };
  const offer = ctx.plan === 'FREE' && ctx.trialFlow && ctx.proIncludesAllTools;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
      </header>
      {offer && !entitlements.trialUsed && <Banner kind="trial" action={{ href: '/app/prueba', label: t('try') }}>{t('strip')}</Banner>}
      <ul className="ch-tools">
        {visible.map((e) => {
          const action = toolCardAction(entitlements.tools[e.slug]!.state, ctx);
          const name = engineDisplayName(e.slug, e.name);
          return (
            <li key={e.slug} className="ch-card ch-tool" data-pill={action.pill}>
              <ToolIcon slug={e.slug} />
              <div className="ch-tool__tx">
                <h2 className="ch-tool__name">{name}</h2>
                <p className="ch-muted">{t.has(`tagline.${e.slug}`) ? t(`tagline.${e.slug}`) : e.description}</p>
                {action.pill === 'included' && <Pill kind="ok" check>{t('included')}</Pill>}
                {action.pill === 'inPro' && <Pill kind="acc">{t('inPro')}</Pill>}
                {action.pill === 'setup' && <Pill kind="warn">{t('setup')}</Pill>}
              </div>
              {action.pill === 'included' && (
                <ButtonLink href={toolHref(e.slug)} size="compact" aria-label={`${t('open')} ${name}`}>
                  {t('open')}
                </ButtonLink>
              )}
              {action.pill === 'inPro' && (
                <ButtonLink href={action.href} variant="secondary" size="compact">{t(action.button)}</ButtonLink>
              )}
              {action.pill === 'setup' && (
                <ButtonLink href={`/app/engines/${e.slug}`} variant="secondary" size="compact">{t('connect')}</ButtonLink>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
