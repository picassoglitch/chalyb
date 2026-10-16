'use client';
// Mis clips' search and format chips (TOOLS-SPEC §4.2), filtered in the
// browser: the page already holds every clip, so a chip or a search only
// changes the URL (?f=…&q=…, same shape as before, so links, reloads and
// the back button keep working) and shows the matching cards at once,
// instead of asking the server and the engine for the whole list again.
// Without JavaScript the chips are plain links and the search a GET form,
// which the server filters exactly the same way (filterClips).

import type { Route } from 'next';
import { Fragment, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { ClipFormat } from '@/lib/tools/adapters/types';
import {
  CLIP_FILTERS,
  CLIP_QUERY_MAX,
  filterClips,
  mineSearch,
  parseClipFilter,
} from '@/lib/tools/clips-home';
import { isPlainClick } from '@/components/ui/optimistic-nav';

export type MineCard = { id: string; format: ClipFormat; title: string; card: ReactNode };

export function MineBrowser({ action, items }: { action: string; items: MineCard[] }) {
  const t = useTranslations('clipsTool');
  const params = useSearchParams();
  const filter = parseClipFilter(params.get('f') ?? undefined);
  const query = (params.get('q') ?? '').slice(0, CLIP_QUERY_MAX);
  const shown = filterClips(items, filter, query);

  // pushState keeps the URL and the back button in step; Next's router
  // syncs useSearchParams with it, so this re-renders without a request.
  // Same path (with its locale prefix, if any), new query.
  const go = (search: string) =>
    window.history.pushState(null, '', `${window.location.pathname}${search}`);
  const onChip = (search: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    go(search);
  };
  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '').slice(0, CLIP_QUERY_MAX);
    go(mineSearch(filter, q));
  };

  return (
    <>
      <div className="ch-minebar">
        <form
          action={action}
          method="get"
          role="search"
          className="ch-minesearch"
          onSubmit={onSearch}
        >
          <Search aria-hidden="true" />
          <input
            // Remounts when the URL's query changes (back button), so the box
            // always shows the search that's applied.
            key={query}
            type="search"
            name="q"
            defaultValue={query}
            maxLength={CLIP_QUERY_MAX}
            className="ch-input"
            aria-label={t('mine.search')}
            placeholder={t('mine.search')}
          />
          {filter !== 'all' && <input type="hidden" name="f" value={filter} />}
        </form>
        <nav className="ch-chips" aria-label={t('mine.filters')}>
          {CLIP_FILTERS.map((x) => {
            const search = mineSearch(x, query);
            return (
              <Link
                key={x}
                href={`${action}${search}` as Route}
                className={`ch-chip${filter === x ? ' ch-chip--on' : ''}`}
                aria-current={filter === x ? 'true' : undefined}
                onClick={onChip(search)}
              >
                {x === 'all' ? t('mine.all') : t(`format.${x}`)}
              </Link>
            );
          })}
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
            // The card (its <li>) is rendered on the server: ClipCard.
            <Fragment key={c.id}>{c.card}</Fragment>
          ))}
        </ul>
      )}
    </>
  );
}
