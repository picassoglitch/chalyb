import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Scissors, Search } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { loadTool } from '@/lib/tools/access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { withoutHiddenJobs } from '@/lib/legal/removals';
import { CLIP_FILTERS, filterClips, parseClipFilter } from '@/lib/tools/clips-home';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { ClipCard } from '@/components/tools/clips/clip-card';
import { ButtonLink } from '@/components/ui/primitives';
import { SetupState } from '@/components/ui/setup-state';
import '@/styles/tools-clips.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsTool');
  return { title: t('metaMine') };
}

// Mis clips (TOOLS-SPEC §2): every finished clip, with a search box and
// Todos / Vertical / Horizontal / Cuadrado. Plain links and a GET form, so
// it works without JavaScript and every filter has its own URL.

export default async function MisClipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybclip', '/app/clips/mis-clips', getClipsAdapter);
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
      <ToolShell slug="chalybclip" tab="history">
        {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
        {gate.kind === 'setup' && (
          <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />
        )}
      </ToolShell>
    );

  const t = await getTranslations('clipsTool');
  const { q = '', f } = await searchParams;
  const filter = parseClipFilter(f);
  const query = q.slice(0, 100);
  const all = await withoutHiddenJobs(
    gate.session.user.id,
    await gate.adapter.listClips(gate.session.user.id),
    (c) => c.jobId,
  );
  const shown = filterClips(all, filter, query);
  const now = new Date();
  const href = (next: string) =>
    `/app/clips/mis-clips?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(next !== 'all' ? { f: next } : {}) })}`;

  return (
    <ToolShell slug="chalybclip" tab="history">
      {all.length === 0 ? (
        <section className="ch-card ch-state" aria-labelledby="mine-empty">
          <span className="ch-state__ic" aria-hidden="true">
            <Scissors />
          </span>
          <h2 id="mine-empty" className="ch-h2">
            {t('mine.empty.title')}
          </h2>
          <p className="ch-muted">{t('mine.empty.body')}</p>
          <ButtonLink href="/app/clips/nuevo" size="xl">
            {t('home.hero.cta')}
          </ButtonLink>
        </section>
      ) : (
        <>
          <div className="ch-minebar">
            <form
              action="/app/clips/mis-clips"
              method="get"
              role="search"
              className="ch-minesearch"
            >
              <Search aria-hidden="true" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                maxLength={100}
                className="ch-input"
                aria-label={t('mine.search')}
                placeholder={t('mine.search')}
              />
              {filter !== 'all' && <input type="hidden" name="f" value={filter} />}
            </form>
            <nav className="ch-chips" aria-label={t('mine.filters')}>
              {CLIP_FILTERS.map((x) => (
                <Link
                  key={x}
                  href={href(x) as Route}
                  className={`ch-chip${filter === x ? ' ch-chip--on' : ''}`}
                  aria-current={filter === x ? 'true' : undefined}
                >
                  {x === 'all' ? t('mine.all') : t(`format.${x}`)}
                </Link>
              ))}
            </nav>
          </div>
          <p className="ch-muted" aria-live="polite">
            {t('mine.count', { n: shown.length })}
          </p>
          {shown.length === 0 ? (
            <p className="ch-muted">{t('mine.none')}</p>
          ) : (
            <ul className="ch-clipgrid">
              {shown.map((c) => (
                <ClipCard key={c.id} clip={c} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </ToolShell>
  );
}
