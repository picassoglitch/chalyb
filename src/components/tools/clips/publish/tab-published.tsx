'use client';

// Publicados: failed posts (retry / reprocess), drafts (publish, schedule,
// delete) and the history — upcoming scheduled posts first, then the latest
// published ones — with "Republicar" for clips that went out.

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { CalendarPlus, Eye, RefreshCw, RotateCw, Send, Trash2, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { publishApi, usePublishErrorText } from './api';
import {
  ClipThumb,
  InlineMsg,
  PlatformList,
  toLocalInput,
  useConfirm,
  useFormatWhen,
  type Msg,
} from './common';
import type { TabProps } from './publish-center';
import { statusKind, type Draft, type HistoryItem } from './types';

interface FailedPost {
  post_id: string;
  content: string;
  created_at: string | null;
  platforms: { platform?: string; error?: string; hint?: string }[];
}

export function PublishedTab(
  props: TabProps & { failedOpen: boolean; setFailedOpen: (v: boolean) => void },
) {
  const { ov } = props;
  return (
    <div className="ch-pub-stack">
      {props.failedOpen && <FailedPanel {...props} />}
      {ov.drafts.length > 0 && <DraftsPanel {...props} />}
      <HistoryPanel {...props} />
    </div>
  );
}

function FailedPanel({
  refresh,
  setFailedOpen,
}: TabProps & { setFailedOpen: (v: boolean) => void }) {
  const t = useTranslations('clipsPublish.failed');
  const errText = usePublishErrorText();
  const [items, setItems] = useState<FailedPost[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'retried' | 'reprocessed'>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ask, confirmNode] = useConfirm();

  function load() {
    return publishApi<{ ok: boolean; failed: FailedPost[] }>('failed.json').then((r) => {
      setLoadErr(null);
      if (!r.ok) {
        setLoadErr(errText(r.error));
        setItems([]);
        return;
      }
      setItems(r.data.failed ?? []);
    });
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when opened
  }, []);

  return (
    <section
      className="ch-card ch-pub-sec"
      aria-labelledby="pub-failed-h"
      style={{ boxShadow: '0 0 0 2px var(--bad-line), var(--shadow)' }}
    >
      <header>
        <TriangleAlert aria-hidden="true" style={{ color: 'var(--bad)' }} />
        <h2 id="pub-failed-h">{t('title')}</h2>
        <span className="ch-pub__push ch-pub-row">
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--tiny"
            title={t('reprocessAllHint')}
            disabled={busy !== null}
            onClick={() =>
              ask({
                title: t('reprocessAllTitle'),
                body: t('reprocessAllBody'),
                cta: t('reprocessAll'),
                onConfirm: async () => {
                  setBusy('all');
                  const r = await publishApi<{ ok: boolean; reprocessed?: number }>(
                    'reprocess-failed',
                    { method: 'POST' },
                  );
                  setBusy(null);
                  setMsg(
                    r.ok
                      ? { kind: 'ok', text: t('reprocessedN', { n: r.data.reprocessed ?? 0 }) }
                      : { kind: 'bad', text: errText(r.error) },
                  );
                  await load();
                  await refresh();
                },
              })
            }
          >
            <RotateCw aria-hidden="true" />
            {t('reprocessAll')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            title={t('retryAllHint')}
            disabled={busy !== null}
            onClick={() =>
              ask({
                title: t('retryAllTitle'),
                cta: t('retryAll'),
                onConfirm: async () => {
                  setBusy('all');
                  const r = await publishApi<{ ok: boolean; retried?: number }>('retry-all', {
                    method: 'POST',
                  });
                  setBusy(null);
                  setMsg(
                    r.ok
                      ? { kind: 'ok', text: t('retriedN', { n: r.data.retried ?? 0 }) }
                      : { kind: 'bad', text: errText(r.error) },
                  );
                  await load();
                  await refresh();
                },
              })
            }
          >
            <RefreshCw aria-hidden="true" />
            {t('retryAll')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            onClick={() => setFailedOpen(false)}
          >
            {t('hide')}
          </button>
        </span>
      </header>
      <InlineMsg msg={msg} />
      {items === null ? (
        <p className="ch-pub-hint">{t('loading')}</p>
      ) : loadErr ? (
        <p className="ch-pub-err">{loadErr}</p>
      ) : items.length === 0 ? (
        <p className="ch-pub-hint">{t('none')}</p>
      ) : (
        <ul className="ch-pub-list">
          {items.map((p) => (
            <li
              key={p.post_id}
              className={`ch-pub-item${done[p.post_id] ? ' ch-pub-item--dim' : ''}`}
            >
              <span className="ch-pub-item__tx">
                <b>{p.content || t('noCaption')}</b>
                {p.platforms.map((pl, i) => (
                  <span key={i} style={{ whiteSpace: 'normal' }}>
                    <PlatformList ids={pl.platform ? [pl.platform] : []} />{' '}
                    <span className="ch-pub-err">{pl.error || t('error')}</span>
                    {pl.hint && <small> · {pl.hint}</small>}
                  </span>
                ))}
              </span>
              <span className="ch-pub-row">
                <button
                  type="button"
                  className="ch-btn ch-btn--primary ch-btn--tiny"
                  title={t('reprocessHint')}
                  disabled={!!done[p.post_id] || busy !== null}
                  onClick={async () => {
                    setBusy(p.post_id);
                    const r = await publishApi<{
                      ok: boolean;
                      results?: { ok: boolean; error?: string }[];
                    }>(`reprocess/${encodeURIComponent(p.post_id)}`, { method: 'POST' });
                    setBusy(null);
                    const first = r.ok ? r.data.results?.[0] : undefined;
                    if (!r.ok || (first && !first.ok)) {
                      setMsg({
                        kind: 'bad',
                        text: r.ok ? first?.error || t('error') : errText(r.error),
                      });
                      return;
                    }
                    setDone((d) => ({ ...d, [p.post_id]: 'reprocessed' }));
                  }}
                >
                  <RotateCw aria-hidden="true" />
                  {done[p.post_id] === 'reprocessed' ? t('reprocessed') : t('reprocess')}
                </button>
                <button
                  type="button"
                  className="ch-btn ch-btn--gray ch-btn--tiny"
                  disabled={!!done[p.post_id] || busy !== null}
                  onClick={async () => {
                    setBusy(p.post_id);
                    const r = await publishApi(`retry/${encodeURIComponent(p.post_id)}`, {
                      method: 'POST',
                    });
                    setBusy(null);
                    if (!r.ok) {
                      setMsg({ kind: 'bad', text: errText(r.error) });
                      return;
                    }
                    setDone((d) => ({ ...d, [p.post_id]: 'retried' }));
                  }}
                >
                  <RefreshCw aria-hidden="true" />
                  {done[p.post_id] === 'retried' ? t('retried') : t('retry')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {confirmNode}
    </section>
  );
}

function DraftsPanel({ ov, refresh, setFlash }: TabProps) {
  const t = useTranslations('clipsPublish.drafts');
  const errText = usePublishErrorText();
  const fmt = useFormatWhen();
  const [ask, confirmNode] = useConfirm();
  const [when, setWhen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function publish(d: Draft, scheduled?: string) {
    setBusy(d.post_id);
    const r = await publishApi<{ ok: boolean; queued?: string }>(
      `draft/${encodeURIComponent(d.post_id)}/publish`,
      { body: scheduled ? { scheduled_for: new Date(scheduled).toISOString() } : {} },
    );
    setBusy(null);
    if (!r.ok) {
      setMsg({ kind: 'bad', text: errText(r.error) });
      return;
    }
    if (r.data.queued) setFlash({ kind: 'queued', postId: r.data.queued });
    await refresh();
  }

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-drafts-h">
      <header>
        <h2 id="pub-drafts-h">{t('title', { n: ov.drafts.length })}</h2>
      </header>
      <InlineMsg msg={msg} />
      <ul className="ch-pub-list">
        {ov.drafts.map((d) => (
          <li key={d.post_id} className="ch-pub-item">
            <ClipThumb clipId={d.clip_id} />
            <span className="ch-pub-item__tx">
              <b title={d.content ?? ''}>{d.content || t('noCaption')}</b>
              <small>
                <PlatformList ids={d.platforms} /> · {fmt(d.created_at)}
              </small>
            </span>
            <span className="ch-pub-row">
              <button
                type="button"
                className="ch-btn ch-btn--primary ch-btn--tiny"
                disabled={busy !== null}
                onClick={() => void publish(d)}
              >
                <Send aria-hidden="true" />
                {t('publishNow')}
              </button>
              <input
                className="ch-input"
                type="datetime-local"
                style={{ width: 'auto', minHeight: 36, fontSize: 14 }}
                onFocus={(e) =>
                  (e.currentTarget.min = toLocalInput(new Date(Date.now() + 5 * 60_000)))
                }
                aria-label={t('when')}
                value={when[d.post_id] ?? ''}
                onChange={(e) => setWhen((w) => ({ ...w, [d.post_id]: e.target.value }))}
              />
              <button
                type="button"
                className="ch-btn ch-btn--gray ch-btn--tiny"
                disabled={busy !== null}
                onClick={() => {
                  const v = when[d.post_id];
                  if (!v) {
                    setMsg({ kind: 'bad', text: t('needWhen') });
                    return;
                  }
                  void publish(d, v);
                }}
              >
                <CalendarPlus aria-hidden="true" />
                {t('schedule')}
              </button>
              <button
                type="button"
                className="ch-btn ch-btn--danger ch-btn--tiny"
                aria-label={t('delete')}
                disabled={busy !== null}
                onClick={() =>
                  ask({
                    title: t('deleteTitle'),
                    body: t('deleteBody'),
                    cta: t('delete'),
                    danger: true,
                    onConfirm: async () => {
                      const r = await publishApi(`draft/${encodeURIComponent(d.post_id)}/delete`, {
                        method: 'POST',
                      });
                      if (!r.ok) setMsg({ kind: 'bad', text: errText(r.error) });
                      await refresh();
                    },
                  })
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {confirmNode}
    </section>
  );
}

function HistoryPanel({ ov, refresh, setFlash }: TabProps) {
  const t = useTranslations('clipsPublish.history');
  const errText = usePublishErrorText();
  const fmt = useFormatWhen();
  const [ask, confirmNode] = useConfirm();
  const [msg, setMsg] = useState<Msg>(null);
  const published = new Set(ov.published_clip_ids);

  function reopen(h: HistoryItem) {
    ask({
      title: t('reopenTitle'),
      body: t('reopenBody'),
      cta: t('reopen'),
      onConfirm: async () => {
        const r = await publishApi(`clip/${encodeURIComponent(h.clip_id ?? '')}/reopen`, {
          method: 'POST',
        });
        if (!r.ok) setMsg({ kind: 'bad', text: errText(r.error) });
        else setFlash({ kind: 'ok', text: t('reopened', { n: 1 }) });
        await refresh();
      },
    });
  }

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-history-h">
      <header>
        <h2 id="pub-history-h">{t('title')}</h2>
        {ov.published_clip_ids.length > 0 ? (
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny ch-pub__push"
            title={t('reopenAllHint')}
            onClick={() =>
              ask({
                title: t('reopenAllTitle', { n: ov.published_clip_ids.length }),
                body: t('reopenAllBody'),
                cta: t('reopenAll', { n: ov.published_clip_ids.length }),
                onConfirm: async () => {
                  const r = await publishApi<{ ok: boolean; reopened?: string }>('reopen-all', {
                    method: 'POST',
                  });
                  if (!r.ok) setMsg({ kind: 'bad', text: errText(r.error) });
                  else
                    setFlash({
                      kind: 'ok',
                      text: Number(r.data.reopened ?? 0)
                        ? t('reopened', { n: Number(r.data.reopened) })
                        : t('reopenedNone'),
                    });
                  await refresh();
                },
              })
            }
          >
            <RefreshCw aria-hidden="true" />
            {t('reopenAll', { n: ov.published_clip_ids.length })}
          </button>
        ) : (
          <span className="ch-pill ch-pill--gray ch-pub__push">{t('upcomingRecent')}</span>
        )}
      </header>
      <InlineMsg msg={msg} />
      {ov.history.length === 0 ? (
        <div>
          <p>
            <b>{t('empty.title')}</b>
          </p>
          <p className="ch-pub-hint">{t('empty.body')}</p>
        </div>
      ) : (
        <ul className="ch-pub-list">
          {ov.history.map((h) => {
            const scheduled = h.status === 'scheduled' && !!h.scheduled_for;
            const href =
              h.kind === 'manual'
                ? h.clip_id
                  ? `/app/clips/${encodeURIComponent(h.clip_id)}`
                  : null
                : `/app/clips/publicar/trabajo/${encodeURIComponent(h.post_id)}`;
            return (
              <li key={h.post_id} className="ch-pub-item">
                <ClipThumb clipId={h.clip_id} />
                <span className="ch-pub-item__tx">
                  <b>{h.title || (h.clip_id ? `${h.clip_id.slice(0, 14)}…` : '—')}</b>
                  <small>
                    {fmt(scheduled ? h.scheduled_for : h.created_at)}
                    {scheduled && ` · ${t('scheduledTag')}`}
                    {h.content ? ` · ${h.content}` : ''}
                  </small>
                </span>
                {h.kind === 'manual' ? (
                  <span className="ch-pill ch-pill--gray" title={t('manualHint')}>
                    {t('manual')}
                  </span>
                ) : (
                  <PlatformList ids={h.platforms} />
                )}
                <span className={`ch-pill ch-pill--${statusKind(h.status)}`}>
                  {t.has(`status.${h.status.toLowerCase()}`)
                    ? t(`status.${h.status.toLowerCase()}`)
                    : h.status}
                </span>
                <span className="ch-pub-row">
                  {h.clip_id && published.has(h.clip_id) && (
                    <button
                      type="button"
                      className="ch-btn ch-btn--gray ch-btn--tiny"
                      title={t('reopenHint')}
                      onClick={() => reopen(h)}
                    >
                      <RefreshCw aria-hidden="true" />
                      {t('reopen')}
                    </button>
                  )}
                  {href && (
                    <Link className="ch-btn ch-btn--secondary ch-btn--tiny" href={href as Route}>
                      <Eye aria-hidden="true" />
                      {h.kind === 'manual' ? t('openClip') : t('view')}
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {confirmNode}
    </section>
  );
}
