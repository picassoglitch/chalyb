import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check, Scissors } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getEntitlements } from '@/lib/billing/entitlement';
import { proIncludesAllTools, trialFlowEnabled } from '@/lib/config/flags';
import { hubRunsTool } from '@/lib/tools/registry';
import { collectResults } from '@/lib/results/collect';
import { ToolIcon } from '@/components/ui/tool-icon';
import { selectPlanStrip, selectTaskCards } from '@/components/app/home-model';
import { ButtonLink, Chip, StateBlock, TaskCard } from '@/components/ui/primitives';

export async function generateMetadata() {
  const t = await getTranslations('home');
  return { title: t('metaTitle') };
}

// Inicio (SCR-01 desktop, SCR-08 mobile). Every card, chip and line comes
// from getEntitlements and the active catalog; nothing is sample data.

export default async function InicioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  const session = await getSessionUser();
  if (!session) return null; // the layout already sent anonymous visitors to sign-in

  const meta = session.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    '';
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';

  const [entitlements, engines] = await Promise.all([
    getEntitlements(session),
    listEngines().catch(() => []),
  ]);
  const visible = engines.filter((e) => entitlements.tools[e.slug]).map((e) => e.slug);
  const names = Object.fromEntries(engines.map((e) => [e.slug, e.name]));
  const { cards, extraSlugs } = selectTaskCards(visible, hubRunsTool);
  const strip = selectPlanStrip(entitlements, names, {
    proIncludesAllTools: proIncludesAllTools(),
    trialFlow: trialFlowEnabled(),
  });
  const list = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' });
  const extraNames = extraSlugs.map((s) => names[s] ?? s);
  const clipsHref = cards.find((c) => c.key === 'clips')?.href;

  // "Lo último": the newest real result, from the same source as Mis resultados.
  const latest = (await collectResults(session.user.id, entitlements, 1))[0] ?? null;
  const tr = await getTranslations('results');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header>
        <p className="ch-eyebrow">
          {firstName ? t('greeting', { nombre: firstName }) : t('greetingAnon')}
        </p>
        <h1 className="ch-h1">{t('title')}</h1>
      </header>

      <div className="ch-tasks">
        {cards.map((card, i) => (
          <TaskCard
            key={card.key}
            href={card.href}
            slug={card.slug}
            first={i === 0}
            label={card.key === 'mas' ? t('task.mas.label') : (names[card.slug] ?? '')}
            title={t(`task.${card.key}.title`)}
            body={card.key === 'mas' ? `${list.format(extraNames)}.` : t(`task.${card.key}.body`)}
            shortBody={
              card.key === 'mas'
                ? extraNames.length > 2
                  ? t('task.mas.short', { tools: extraNames.slice(0, 2).join(', ') })
                  : `${list.format(extraNames)}.`
                : t(`task.${card.key}.short`)
            }
          />
        ))}
      </div>

      <section className="ch-strip" aria-label={t('included.aria')}>
        {strip.kind === 'offer' ? (
          <>
            <p className="ch-strip__tx">
              <b>{strip.cta === 'plans' ? t('included.gratisPlans') : t('included.gratis')}</b>
            </p>
            <ButtonLink
              href={strip.cta === 'plans' ? '/app/subscription' : '/app/prueba'}
              size="compact"
            >
              {t(`included.cta.${strip.cta}`)}
            </ButtonLink>
          </>
        ) : (
          <>
            <span className="ch-strip__ic" aria-hidden="true">
              <Check />
            </span>
            <p className="ch-strip__tx">
              {strip.kind === 'included' ? (
                <>
                  <b>{t('included.all', { plan: strip.plan })}</b> {t('included.noExtra')}
                </>
              ) : (
                <b>{t('included.single', { tools: list.format(strip.tools) })}</b>
              )}
            </p>
            {strip.kind === 'included' && (
              <ul className="ch-strip__chips" aria-label={t('included.toolsAria')}>
                {strip.chips.map((c) => (
                  <li key={c}>
                    <Chip small>{c}</Chip>
                  </li>
                ))}
                {strip.more > 0 && (
                  <li>
                    <Chip small>{t('included.more', { n: strip.more })}</Chip>
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </section>

      {latest && (
        <section aria-labelledby="latest-title" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h2 id="latest-title" className="ch-h2">
              {t('latest.title')}
            </h2>
            <ButtonLink href="/app/history" variant="secondary" size="compact">
              {tr('seeAll')}
            </ButtonLink>
          </div>
          <div className="ch-card ch-result">
            <ToolIcon slug={latest.slug} size="sm" />
            <div className="ch-result__tx">
              <b>
                {latest.kind === 'property'
                  ? tr('propertyTitle', { titulo: latest.title })
                  : latest.state === 'working'
                    ? tr('creating', { pct: latest.pct })
                    : latest.state === 'failed'
                      ? tr('failed')
                      : tr('clipsTitle', { n: latest.count })}
              </b>
            </div>
            {latest.kind === 'clips' && (
              <ButtonLink href={latest.href} variant="secondary" size="compact">
                {latest.state === 'ready' ? tr('viewClips') : tr('open')}
              </ButtonLink>
            )}
          </div>
        </section>
      )}

      {latest === null && clipsHref && (
        <section
          aria-labelledby="latest-title"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <h2 id="latest-title" className="ch-h2">
            {t('latest.title')}
          </h2>
          <StateBlock
            icon={<Scissors />}
            title={t('empty.title')}
            body={t('empty.body')}
            action={{ href: clipsHref, label: t('empty.cta') }}
          />
        </section>
      )}
    </div>
  );
}
