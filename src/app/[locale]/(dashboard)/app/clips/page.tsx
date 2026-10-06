import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Scissors } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { loadTool } from '@/lib/tools/access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { listClipJobs } from '@/lib/tools/clips-jobs';
import { processingRows } from '@/lib/tools/clips-home';
import { creditsRenewDate } from '@/lib/tools/clips-copy';
import { getTokenBalance } from '@/lib/usage/tokens';
import { socialsAllowed } from '@/lib/tools/clips-bff';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { ClipCard } from '@/components/tools/clips/clip-card';
import { JobProgressRow } from '@/components/tools/clips/job-progress-row';
import { AccountsList, accountRows } from '@/components/tools/clips/accounts-list';
import { AutoRefresh } from '@/components/app/clips/auto-refresh';
import { ButtonLink } from '@/components/ui/primitives';
import { SetupState } from '@/components/ui/setup-state';
import '@/styles/tools-clips.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsTool');
  return { title: t('metaTitle') };
}

// Inicio de Clips (TOOLS-SPEC §4.1, mockup 50). One primary action: "Hacer
// clips nuevos" (or "Ver mi plan" when the month's credits ran out). Jobs
// re-run the job policy on every read; the page re-reads itself every few
// seconds while something is in progress (polling fallback, §1.2).

const LATEST = 6;

export default async function ClipsHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybclip', '/app/clips', getClipsAdapter);
  if (gate.kind === 'locked')
    return (
      <ToolShell
        slug="chalybclip"
        tab={null}
        plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
      >
        <ToolLockedState slug="chalybclip" entitlements={gate.entitlements} />
      </ToolShell>
    );
  if (gate.kind !== 'ready')
    return (
      <ToolShell slug="chalybclip" tab="main">
        {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
        {gate.kind === 'setup' && (
          <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />
        )}
      </ToolShell>
    );

  const { adapter, session } = gate;
  const userId = session.user.id;
  const caps = adapter.capabilities();
  const [jobs, clips, accounts, balance] = await Promise.all([
    listClipJobs(userId),
    adapter.listClips(userId),
    adapter.accounts(userId),
    // Display only: an unknown balance never blocks the hero (the job
    // submit enforces credits on the server either way).
    getTokenBalance(userId).catch(() => null),
  ]);
  const noCredits = !!balance && !balance.unlimited && balance.remaining <= 0;
  const t = await getTranslations('clipsTool');
  const list = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' });
  const { rows, more } = processingRows(jobs);
  const working = rows.some((j) => j.state !== 'failed');
  const acctRows = accountRows(
    accounts,
    ['youtube', 'twitch', 'tiktok'],
    caps.supportsConnect && socialsAllowed(gate.entitlements.plan),
  );
  const firstTime = jobs.length === 0 && clips.length === 0;
  const now = new Date();

  return (
    <ToolShell slug="chalybclip" tab="main">
      {working && <AutoRefresh everyMs={5000} />}
      <div className={`ch-clipshome${acctRows.length ? '' : ' ch-clipshome--solo'}`}>
        <section className="ch-card ch-cliphero" aria-labelledby="clips-hero">
          <div className="ch-cliphero__tx">
            <h2 id="clips-hero" className="ch-h2">
              {noCredits
                ? t('home.noCredits.title', { fecha: creditsRenewDate(now, locale) })
                : t('home.hero.title')}
            </h2>
            {!noCredits && <p className="ch-sub">{t('home.hero.body')}</p>}
            {noCredits ? (
              <ButtonLink href="/app/billing" size="xl">
                {t('home.noCredits.cta')}
              </ButtonLink>
            ) : (
              <ButtonLink href="/app/clips/nuevo" size="xl">
                <Scissors aria-hidden="true" />
                {t('home.hero.cta')}
              </ButtonLink>
            )}
            {!noCredits && (
              <p className="ch-muted ch-cliphero__hint">
                {t('home.hero.hint', { plataformas: list.format(caps.sources) })}
              </p>
            )}
          </div>
          <div className="ch-cliphero__art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        {acctRows.length > 0 && (
          <section className="ch-card ch-clipaccts" aria-labelledby="clips-accts">
            <header>
              <h2 id="clips-accts" className="ch-h3">
                {t('home.accounts')}
              </h2>
              <Link href={'/app/clips/ajustes' as Route} className="ch-lnk">
                {t('home.accountsSettings')}
              </Link>
            </header>
            <AccountsList rows={acctRows} returnTo="/app/clips" />
          </section>
        )}
      </div>

      {rows.length > 0 && (
        <section aria-labelledby="clips-proc" className="ch-clipsec">
          <header>
            <h2 id="clips-proc" className="ch-h2">
              {t('home.processing')}
            </h2>
            <span className="ch-muted">{t('home.processingHint')}</span>
          </header>
          <ul className="ch-jobrows">
            {rows.map((job) => (
              <JobProgressRow key={job.id} job={job} noCharge={caps.confirmsNoChargeOnFailure} />
            ))}
          </ul>
          {more > 0 && (
            <Link href={'/app/history' as Route} className="ch-lnk">
              {t('home.more', { n: more })}
            </Link>
          )}
        </section>
      )}

      {clips.length > 0 && (
        <section aria-labelledby="clips-latest" className="ch-clipsec">
          <header>
            <h2 id="clips-latest" className="ch-h2">
              {t('home.latest')}
            </h2>
            <Link href={'/app/clips/mis-clips' as Route} className="ch-lnk">
              {t('home.latestAll', { n: clips.length })}
            </Link>
          </header>
          <ul className="ch-clipgrid">
            {clips.slice(0, LATEST).map((c) => (
              <ClipCard key={c.id} clip={c} now={now} />
            ))}
          </ul>
        </section>
      )}

      {firstTime && (
        <section className="ch-card ch-state" aria-labelledby="clips-empty">
          <span className="ch-state__ic" aria-hidden="true">
            <Scissors />
          </span>
          <h2 id="clips-empty" className="ch-h2">
            {t('home.empty.title')}
          </h2>
          <p className="ch-muted">{t('home.empty.body')}</p>
        </section>
      )}
    </ToolShell>
  );
}
