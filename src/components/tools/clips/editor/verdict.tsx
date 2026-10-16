'use client';

// The AI verdict at the top of the editor: one headline, the estimated
// retention, which app it's ready for, the phrase the AI heard, its ✨
// reasons, a check per app, the automatic trim (with Deshacer) and what the
// AI already fixed. Plus the Growth Score card once the Growth Engine ran.

import { useTranslations } from 'next-intl';
import { Check, CircleCheck, Scissors, Sparkles, Undo2 } from 'lucide-react';
import type { EditorPayload, GrowthFeed } from '@/lib/tools/adapters/clips/editor-types';
import { Markup } from '@/components/ui/markup';
import { scoreBand } from './presets';

const PLATFORMS = ['TikTok', 'Reels', 'Shorts', 'Kick'] as const;

export function Verdict({
  payload,
  target,
  onRevertTrim,
  reverting,
  trimFlash,
  approveButton,
}: {
  payload: EditorPayload;
  target: string;
  onRevertTrim: () => void;
  reverting: boolean;
  trimFlash: 'reverted' | 'noop' | 'error' | null;
  approveButton: React.ReactNode;
}) {
  const t = useTranslations('clipsEditor.verdict');
  const tn = useTranslations('clipsEditor.target.name');
  const pub = payload.publishability;
  const viral = payload.ai_scores?.viral_score ?? pub.score;
  const head =
    pub.status === 'publish_ready' && viral >= 75
      ? { emoji: '🔥', text: t('viral') }
      : pub.status === 'needs_edit'
        ? { emoji: '⚠', text: t('needsEdit') }
        : pub.status === 'reject'
          ? { emoji: '🛑', text: t('reject') }
          : { emoji: '✅', text: t('ready') };
  const blocked = pub.blocking.length > 0;
  const warned = pub.warnings.length > 0;
  const trig = payload.candidate_trigger;
  const trimmed = payload.clip.original_start_s !== null && payload.clip.original_end_s !== null;
  const fix = payload.auto_corrections;
  const gain = fix ? fix.score_after - fix.score_before : 0;

  return (
    <section
      className={`ch-card ch-ce__verdict ch-ce__verdict--${pub.status}`}
      aria-labelledby="ce-verdict"
    >
      <div className="ch-ce__verdict-top">
        <h2 id="ce-verdict" className="ch-ce__verdict-head">
          <span aria-hidden="true">{head.emoji}</span> {head.text}
        </h2>
        <div className="ch-ce__retention" title={t('retentionHint')}>
          <span>{t('retention')}</span>
          <b>{pub.score}%</b>
        </div>
      </div>
      <span className="ch-pill ch-pill--acc ch-ce__target-pill">
        {t('readyFor', { plataforma: tn(target in TARGET_KEYS ? target : 'all') })}
      </span>

      {trig?.phrase ? (
        <div className="ch-ce__trigger" aria-live="polite">
          <span aria-hidden="true">🎯</span>
          <div>
            <p>
              <span className="ch-muted">{t('heard')}</span> <b>“{trig.phrase}”</b>{' '}
              <span
                className="ch-pill ch-pill--gray"
                title={trig.kind === 'retroactive' ? t('backwardHint') : t('forwardHint')}
              >
                {trig.kind === 'retroactive' ? t('backward') : t('forward')}
              </span>
            </p>
            {trig.snippet ? <p className="ch-muted ch-ce__snippet">…{trig.snippet}…</p> : null}
          </div>
        </div>
      ) : null}

      {payload.intel_lines.length > 0 ? (
        <ul className="ch-ce__intel">
          {payload.intel_lines.map((l) => (
            <li key={l}>
              <span aria-hidden="true">✨</span> {l}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="ch-ce__plats" aria-label={t('platformsLabel')}>
        {PLATFORMS.map((p) => (
          <li
            key={p}
            className={`ch-ce__plat${blocked ? ' is-block' : warned ? ' is-warn' : ' is-ok'}`}
          >
            <span aria-hidden="true">{blocked ? '🛑' : warned ? '⚠' : '✅'}</span>
            <span className="ch-sr">
              {blocked
                ? t('platformBlock', { plataforma: p })
                : warned
                  ? t('platformWarn', { plataforma: p })
                  : t('platformOk', { plataforma: p })}
            </span>
            <span aria-hidden="true">{p}</span>
          </li>
        ))}
      </ul>

      {trimmed ? (
        <div className="ch-ce__note ch-ce__note--warn">
          <Scissors aria-hidden="true" />
          <div className="ch-ce__note-tx">
            <b>{t('trimmedTitle')}</b>
            <span className="ch-muted">
              {t('trimmedBody', {
                inicio: (payload.clip.original_start_s ?? 0).toFixed(1),
                fin: (payload.clip.original_end_s ?? 0).toFixed(1),
              })}
            </span>
          </div>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            onClick={onRevertTrim}
            disabled={reverting}
          >
            <Undo2 aria-hidden="true" />
            {reverting ? t('undoing') : t('undo')}
          </button>
        </div>
      ) : null}
      {trimFlash ? (
        <p
          className={`ch-ce__flash ch-ce__flash--${trimFlash === 'error' ? 'bad' : trimFlash === 'noop' ? 'gray' : 'ok'}`}
          role={trimFlash === 'error' ? 'alert' : 'status'}
        >
          {trimFlash === 'reverted'
            ? t('trimReverted')
            : trimFlash === 'noop'
              ? t('trimNoop')
              : t('trimError')}
        </p>
      ) : null}

      {fix && fix.corrections.length > 0 ? (
        <div className="ch-ce__note ch-ce__note--ok">
          <Sparkles aria-hidden="true" />
          <div className="ch-ce__note-tx">
            <b>
              {t('autofixTitle')}
              {gain > 0 ? (
                <span className="ch-ce__gain">{t('autofixGain', { n: gain })}</span>
              ) : null}
            </b>
            <ul>
              {fix.corrections.map((c, i) => (
                <li key={i}>
                  <Check aria-hidden="true" /> {c.label}
                </li>
              ))}
            </ul>
            {fix.ready ? <b className="ch-ce__ok-tx">{t('autofixReady')}</b> : null}
          </div>
        </div>
      ) : null}

      {approveButton}
    </section>
  );
}

const TARGET_KEYS = { tiktok: 1, reels: 1, shorts: 1, kick: 1, all: 1 } as const;

export function GrowthCard({ growth }: { growth: GrowthFeed | null }) {
  const t = useTranslations('clipsEditor.growth');
  if (!growth?.scored) return null;
  const c = growth.card ?? {};
  const overall = c.overall_score ?? growth.overall_score ?? 0;
  const decision = (c.decision ?? growth.decision ?? '').replace(/_/g, ' ');
  const plats = [...(c.platforms ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const k = (n?: number) => {
    const v = n ?? 0;
    return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v);
  };
  return (
    <section className="ch-card ch-ce__growth" aria-labelledby="ce-growth">
      <header>
        <h2 id="ce-growth" className="ch-ce__h3">
          {t('title')}
        </h2>
        <b className={`ch-ce__band ch-ce__band--${scoreBand(overall)}`}>
          {t('outOf', { n: overall })}
        </b>
      </header>
      {decision ? <p className="ch-muted">→ {decision}</p> : null}
      <ul className="ch-ce__growth-plats">
        {plats.map((p) => (
          <li key={p.platform} className={p.verdict === 'skip' ? 'is-skip' : undefined}>
            <b>{p.platform}</b>
            <span className={`ch-ce__band ch-ce__band--${scoreBand(p.score ?? 0)}`}>
              {p.score ?? 0}
            </span>
            <span className="ch-muted">{p.label ?? ''}</span>
            <span className="ch-muted">
              {p.expected_impressions_high
                ? t('impressions', {
                    min: k(p.expected_impressions_low),
                    max: k(p.expected_impressions_high),
                  })
                : ''}
            </span>
          </li>
        ))}
      </ul>
      {(c.recommendations ?? []).length > 0 ? (
        <ul className="ch-ce__recs">
          {(c.recommendations ?? []).map((r, i) => (
            <li key={i}>
              <CircleCheck aria-hidden="true" /> {r.detail || r.action || ''}
            </li>
          ))}
        </ul>
      ) : null}
      {c.summary ? <p className="ch-muted">{c.summary}</p> : null}
    </section>
  );
}

/** "Este clip todavía no está al cien" — before approving a clip the AI
 *  still has notes on. */
export function IssuesSheetBody({
  payload,
  onKeepEditing,
  onForce,
}: {
  payload: EditorPayload;
  onKeepEditing: () => void;
  onForce: () => void;
}) {
  const t = useTranslations('clipsEditor.modal');
  const pub = payload.publishability;
  return (
    <div className="ch-ce__issues">
      <p>
        <Markup text={t('body', { n: pub.score })} />
      </p>
      <ul>
        {pub.blocking.map((b) => (
          <li key={`b-${b}`} className="is-block">
            <span aria-hidden="true">⛔</span> {b}
          </li>
        ))}
        {pub.warnings.map((w) => (
          <li key={`w-${w}`} className="is-warn">
            <span aria-hidden="true">⚠</span> {w}
          </li>
        ))}
      </ul>
      <div className="ch-ce__issues-actions">
        <button type="button" className="ch-btn ch-btn--secondary" onClick={onKeepEditing}>
          {t('keepEditing')}
        </button>
        <button type="button" className="ch-btn ch-btn--primary" onClick={onForce}>
          {t('force')}
        </button>
      </div>
    </div>
  );
}
