'use client';

// Mis resultados list: chips (Todos, Listos, per tool), search, cards.

import { useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { chipsFor, filterResults, type ResultChip, type ResultItem } from '@/lib/results/core';
import { Chip, Pill } from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';

export function ResultsList({ items, toolNames }: { items: ResultItem[]; toolNames: Record<string, string> }) {
  const t = useTranslations('results');
  const locale = useLocale();
  const [chip, setChip] = useState<ResultChip>('all');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const shown = filterResults(items, chip, q);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  async function share(url: string, id: string) {
    const abs = new URL(url, window.location.origin).href;
    if (navigator.share) {
      await navigator.share({ url: abs }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(abs).catch(() => {});
    setCopied(id);
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="ch-search">
        <Search aria-hidden="true" />
        <label htmlFor="rq" className="ch-sr">{t('search')}</label>
        <input id="rq" type="search" className="ch-input" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div role="group" aria-label={t('filters')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {chipsFor(items).map((c) => (
          <button key={c} type="button" className="ch-chipbtn" aria-pressed={chip === c} onClick={() => setChip(c)}>
            <Chip on={chip === c}>{c === 'all' ? t('all') : c === 'ready' ? t('ready') : (toolNames[c] ?? c)}</Chip>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="ch-card" style={{ padding: 20 }} role="status">{q ? t('noMatch', { busqueda: q }) : t('empty')}</p>
      ) : (
        <ul className="ch-results">
          {shown.map((i) => (
            <li key={`${i.kind}:${i.id}`} className="ch-card ch-result">
              <ToolIcon slug={i.slug} size="sm" />
              <div className="ch-result__tx">
                {i.kind === 'clips' ? (
                  <>
                    <b>{i.state === 'working' ? t('creating', { pct: i.pct }) : t('clipsTitle', { n: i.count })}</b>
                    <small className="ch-muted" style={{ overflowWrap: 'anywhere' }}>{i.source}</small>
                    {i.state === 'working' && (
                      <span className="ch-progress" role="progressbar" aria-valuenow={i.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('creating', { pct: i.pct })}>
                        <span style={{ width: `${i.pct}%` }} />
                      </span>
                    )}
                    {i.state === 'failed' && <Pill kind="bad">{t('failed')}</Pill>}
                  </>
                ) : (
                  <b>{t('propertyTitle', { titulo: i.title })}</b>
                )}
                <small className="ch-muted">{date(i.at)}</small>
              </div>
              {i.kind === 'clips' ? (
                <Link href={i.href as Route} className="ch-btn ch-btn--secondary ch-btn--compact">
                  {i.state === 'ready' ? t('viewClips') : i.state === 'failed' ? t('seeWhy') : t('open')}
                </Link>
              ) : (
                <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => share(i.shareUrl, i.id)}>
                  {t('share')}
                </button>
              )}
              {copied === i.id && <p role="status" className="ch-muted" style={{ width: '100%' }}>{t('copied')}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
