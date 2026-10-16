'use client';

// Publicar uno: pick an approved clip, choose networks, write (or
// auto-fill) the post, then publish now, save a draft or schedule it.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarPlus, Check, ChevronDown, Clock, FilePen, Send, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui/primitives';
import { publishApi, usePublishErrorText } from './api';
import { ClipThumb, InlineMsg, PlatformTile, toLocalInput, useConfirm, type Msg } from './common';
import type { TabProps } from './publish-center';
import type { PublishableClip } from './types';

const TIKTOK_PRIVACY = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
] as const;

export function SingleTab(props: TabProps) {
  const t = useTranslations('clipsPublish.single');
  const errText = usePublishErrorText();
  const [open, setOpen] = useState<string | null>(null);
  const [ask, confirmNode] = useConfirm();
  const [listMsg, setListMsg] = useState<Msg>(null);
  const { ov, refresh } = props;

  if (ov.publishable.length === 0)
    return (
      <div className="ch-card ch-state">
        <h2 className="ch-h2">{t('empty.title')}</h2>
        <p className="ch-muted">{t('empty.body')}</p>
        <ButtonLink href="/app/clips/nuevo">{t('empty.cta')}</ButtonLink>
      </div>
    );

  return (
    <div className="ch-pub-clips">
      <InlineMsg msg={listMsg} />
      {ov.publishable.map((c) => (
        <article key={c.id} className={`ch-pub-clip${open === c.id ? ' ch-pub-clip--open' : ''}`}>
          <ClipThumb clipId={c.id} durationS={c.duration_s} />
          <button
            type="button"
            className="ch-pub-clip__tx"
            aria-expanded={open === c.id}
            aria-controls={`pub-panel-clip-${c.id}`}
            onClick={() => setOpen(open === c.id ? null : c.id)}
          >
            <b>{c.title}</b>
            <small>{t('ready')}</small>
          </button>
          <div className="ch-pub-clip__act">
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--tiny"
              title={t('markHint')}
              onClick={() =>
                ask({
                  title: t('markTitle'),
                  body: t('markBody'),
                  cta: t('markCta'),
                  onConfirm: async () => {
                    const r = await publishApi(`clip/${encodeURIComponent(c.id)}/mark-published`, {
                      method: 'POST',
                    });
                    if (!r.ok) setListMsg({ kind: 'bad', text: errText(r.error) });
                    await refresh();
                  },
                })
              }
            >
              <Check aria-hidden="true" />
              {t('mark')}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--secondary ch-btn--tiny"
              aria-expanded={open === c.id}
              aria-controls={`pub-panel-clip-${c.id}`}
              onClick={() => setOpen(open === c.id ? null : c.id)}
            >
              <ChevronDown aria-hidden="true" />
              {t('open')}
            </button>
          </div>
          {open === c.id && (
            <div className="ch-pub-clip__panel" id={`pub-panel-clip-${c.id}`}>
              <PublishPanel clip={c} {...props} />
            </div>
          )}
        </article>
      ))}
      {confirmNode}
    </div>
  );
}

function PublishPanel({ clip, ov, refresh, setFlash }: TabProps & { clip: PublishableClip }) {
  const t = useTranslations('clipsPublish.single');
  const errText = usePublishErrorText();
  const connected = new Set(ov.accounts.map((a) => a.platform));
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState<null | 'now' | 'draft' | 'schedule' | 'fill' | 'best'>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [fillMsg, setFillMsg] = useState<Msg>(null);
  const [bestMsg, setBestMsg] = useState<Msg>(null);

  function toggle(p: string) {
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  async function submit(mode: 'now' | 'draft' | 'schedule') {
    if (selected.length === 0) {
      setMsg({ kind: 'bad', text: t('needPlatform') });
      return;
    }
    let scheduledFor: string | null = null;
    if (mode === 'schedule') {
      if (!when) {
        setMsg({ kind: 'bad', text: t('needWhen') });
        return;
      }
      scheduledFor = new Date(when).toISOString();
    }
    if (selected.includes('youtube') && !title.trim() && !ytTitle.trim()) {
      setMsg({ kind: 'bad', text: t('needYoutubeTitle') });
      return;
    }
    setBusy(mode);
    setMsg({ kind: 'info', text: mode === 'draft' ? t('saving') : t('publishing') });
    const body: Record<string, unknown> = {
      platforms: selected,
      title: title.trim(),
      description: description.trim(),
      mode,
      first_comment: firstComment.trim(),
      tiktok_privacy: privacy,
      yt_title: ytTitle.trim(),
      scheduled_for: scheduledFor,
    };
    for (const [k, v] of Object.entries(captions)) if (v.trim()) body[`caption_${k}`] = v.trim();
    const r = await publishApi<{ ok: boolean; queued?: string; draft?: string }>(
      `post/${encodeURIComponent(clip.id)}`,
      { body },
    );
    setBusy(null);
    if (!r.ok) {
      setMsg({ kind: 'bad', text: errText(r.error) });
      return;
    }
    setMsg(null);
    setFlash(
      r.data.queued
        ? { kind: 'queued', postId: r.data.queued }
        : { kind: 'ok', text: t('draftSaved') },
    );
    await refresh();
  }

  return (
    <div className="ch-pub-stack">
      <div className="ch-pub-field">
        <span id={`pub-plats-${clip.id}`}>{t('platforms')}</span>
        <small>{t('platformsHint')}</small>
        <div className="ch-pub-chips" role="group" aria-labelledby={`pub-plats-${clip.id}`}>
          {ov.platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              className="ch-pub-chip"
              aria-pressed={selected.includes(p.id)}
              disabled={!connected.has(p.id)}
              onClick={() => toggle(p.id)}
            >
              <PlatformTile id={p.id} small />
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <label className="ch-pub-field">
        <span>{t('title')}</span>
        <input
          className="ch-input"
          value={title}
          maxLength={140}
          placeholder={t('titlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="ch-pub-field">
        <span>{t('text')}</span>
        <textarea
          className="ch-input"
          rows={3}
          value={description}
          placeholder={t('textPlaceholder')}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="ch-pub-field">
        <span>{t('firstComment')}</span>
        <small>{t('firstCommentHint')}</small>
        <input
          className="ch-input"
          value={firstComment}
          maxLength={500}
          placeholder={t('firstCommentPlaceholder')}
          onChange={(e) => setFirstComment(e.target.value)}
        />
      </label>
      <details>
        <summary>{t('perPlatform')}</summary>
        <div className="ch-pub-stack">
          <label className="ch-pub-field">
            <span>{t('ytTitle')}</span>
            <small>{t('ytTitleHint')}</small>
            <input
              className="ch-input"
              value={ytTitle}
              maxLength={100}
              onChange={(e) => setYtTitle(e.target.value)}
            />
          </label>
          <label className="ch-pub-field">
            <span>{t('privacy')}</span>
            <select
              className="ch-select"
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
            >
              <option value="">{t('privacyDefault')}</option>
              {TIKTOK_PRIVACY.map((v) => (
                <option key={v} value={v}>
                  {t(`privacyOptions.${v}`)}
                </option>
              ))}
            </select>
          </label>
          {ov.platforms.map((p) => (
            <label key={p.id} className="ch-pub-field">
              <span>{t('captionFor', { plataforma: p.label })}</span>
              <textarea
                className="ch-input"
                rows={2}
                value={captions[p.id] ?? ''}
                placeholder={t('captionForPlaceholder', { plataforma: p.label })}
                onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </details>
      <div className="ch-pub-row">
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          disabled={busy !== null}
          title={t('autofillHint')}
          onClick={async () => {
            setBusy('fill');
            setFillMsg({ kind: 'info', text: t('autofilling') });
            const r = await publishApi<{ title?: string; caption?: string }>(
              `compose/${encodeURIComponent(clip.id)}`,
              { method: 'POST' },
            );
            setBusy(null);
            if (!r.ok) {
              setFillMsg({ kind: 'bad', text: errText(r.error) });
              return;
            }
            if (r.data.title) setTitle(r.data.title);
            if (r.data.caption) setDescription(r.data.caption);
            setFillMsg({ kind: 'ok', text: t('autofilled') });
          }}
        >
          <Sparkles aria-hidden="true" />
          {t('autofill')}
        </button>
        <InlineMsg msg={fillMsg} />
      </div>
      <div className="ch-pub-row">
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--compact"
          disabled={busy !== null}
          onClick={() => void submit('now')}
        >
          <Send aria-hidden="true" />
          {t('publishN', { n: selected.length })}
        </button>
        <button
          type="button"
          className="ch-btn ch-btn--gray ch-btn--compact"
          disabled={busy !== null}
          title={t('draftHint')}
          onClick={() => void submit('draft')}
        >
          <FilePen aria-hidden="true" />
          {t('draft')}
        </button>
      </div>
      <div className="ch-pub-field" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <span>{t('scheduleLabel')}</span>
        <div className="ch-pub-row">
          <input
            className="ch-input"
            type="datetime-local"
            style={{ width: 'auto' }}
            onFocus={(e) => (e.currentTarget.min = toLocalInput(new Date(Date.now() + 5 * 60_000)))}
            value={when}
            aria-label={t('scheduleLabel')}
            onChange={(e) => setWhen(e.target.value)}
          />
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--compact"
            disabled={busy !== null}
            title={t('bestHint')}
            onClick={async () => {
              setBusy('best');
              setBestMsg({ kind: 'info', text: t('bestLooking') });
              const r = await publishApi<{ ok: boolean; iso?: string }>('schedule/next-best.json');
              setBusy(null);
              if (!r.ok || !r.data.iso) {
                setBestMsg({ kind: 'bad', text: t('bestNone') });
                return;
              }
              setWhen(toLocalInput(new Date(r.data.iso)));
              setBestMsg({ kind: 'ok', text: t('bestDone') });
            }}
          >
            <Clock aria-hidden="true" />
            {t('best')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={busy !== null}
            onClick={() => void submit('schedule')}
          >
            <CalendarPlus aria-hidden="true" />
            {t('schedule')}
          </button>
          <InlineMsg msg={bestMsg} />
        </div>
      </div>
      <InlineMsg msg={msg} />
    </div>
  );
}
