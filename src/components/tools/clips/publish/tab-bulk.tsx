'use client';

// Publicar varios: per clip, toggle the networks; one button sends them all.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { ButtonLink } from '@/components/ui/primitives';
import { publishApi, usePublishErrorText } from './api';
import { ClipThumb, InlineMsg, PlatformTile, type Msg } from './common';
import type { TabProps } from './publish-center';

interface BulkResult {
  results: { clip_id: string; ok: boolean; post_id?: string; error?: string }[];
}

export function BulkTab({ ov, refresh, setFlash }: TabProps) {
  const t = useTranslations('clipsPublish.bulk');
  const errText = usePublishErrorText();
  const connected = new Set(ov.accounts.map((a) => a.platform));
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [failures, setFailures] = useState<BulkResult['results']>([]);

  if (ov.publishable.length === 0)
    return (
      <div className="ch-card ch-state">
        <h2 className="ch-h2">{t('empty')}</h2>
        <ButtonLink href="/app/clips/nuevo">{t('emptyCta')}</ButtonLink>
      </div>
    );

  const pending = Object.entries(picks)
    .filter(([, ps]) => ps.length > 0)
    .map(([clip_id, platforms]) => ({ clip_id, platforms }));
  const titles = new Map(ov.publishable.map((c) => [c.id, c.title]));

  function toggle(clipId: string, p: string) {
    setPicks((s) => {
      const cur = s[clipId] ?? [];
      return { ...s, [clipId]: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] };
    });
  }

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-bulk-h">
      <header>
        <h2 id="pub-bulk-h">{t('title')}</h2>
      </header>
      <p className="ch-muted">
        {t('hint')}
        {ov.publishable_total > ov.publishable.length &&
          ` ${t('showing', { n: ov.publishable.length, total: ov.publishable_total })}`}
      </p>
      <ul className="ch-pub-list">
        {ov.publishable.map((c) => (
          <li key={c.id} className="ch-pub-item">
            <ClipThumb clipId={c.id} durationS={c.duration_s} />
            <span className="ch-pub-item__tx">
              <b>{c.title}</b>
              <small>{t('duration', { s: Math.round(c.duration_s) })}</small>
            </span>
            <span
              className="ch-pub-chips"
              role="group"
              aria-label={t('platformsFor', { clip: c.title })}
            >
              {ov.platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="ch-pub-chip ch-pub-chip--icon"
                  aria-pressed={(picks[c.id] ?? []).includes(p.id)}
                  aria-label={p.label}
                  title={p.label}
                  disabled={!connected.has(p.id)}
                  onClick={() => toggle(c.id, p.id)}
                >
                  <PlatformTile id={p.id} small />
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="ch-pub-row">
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--compact"
          disabled={busy || pending.length === 0}
          onClick={async () => {
            setBusy(true);
            setFailures([]);
            setMsg({ kind: 'info', text: t('sending') });
            const r = await publishApi<BulkResult>('bulk-post', { body: { clips: pending } });
            setBusy(false);
            if (!r.ok) {
              setMsg({ kind: 'bad', text: errText(r.error) });
              return;
            }
            const ok = r.data.results.filter((x) => x.ok).length;
            const bad = r.data.results.filter((x) => !x.ok);
            setFailures(bad);
            setPicks({});
            setMsg(null);
            setFlash({
              kind: bad.length ? 'warn' : 'ok',
              text: t('done', { ok, total: pending.length }),
            });
            await refresh();
          }}
        >
          <Send aria-hidden="true" />
          {t('publish', { n: pending.length })}
        </button>
        <span className="ch-pub-hint">
          {pending.length ? t('readyN', { n: pending.length }) : t('pickOne')}
        </span>
        <InlineMsg msg={msg} />
      </div>
      {failures.length > 0 && (
        <ul className="ch-pub-list" aria-label={t('failedAria')}>
          {failures.map((f) => (
            <li key={f.clip_id} className="ch-pub-item">
              <span className="ch-pub-item__tx">
                <b>{titles.get(f.clip_id) ?? f.clip_id}</b>
                <span className="ch-pub-err">{f.error}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
