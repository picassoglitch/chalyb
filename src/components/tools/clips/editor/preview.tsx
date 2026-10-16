'use client';

// The 9:16 live preview: the clip with the overlays the export burns in
// (title, top hook, word-level captions, banner) plus preview-only chrome
// (safe-zone bands, simulated app UI, LIVE badge, reactions rail). Ported
// from the engine's old editor so what you see is what the render makes.

import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Heart, Play, Volume2, VolumeX } from 'lucide-react';
import type { CaptionsFeed, EditorForm, ZoneSpec } from '@/lib/tools/adapters/clips/editor-types';
import { activeLine, CAPTION_SCALE, formatKickUrl, operatorHandle, simPlatform } from './presets';
import './preview.css';

export interface Playback {
  t: number;
  duration: number;
  paused: boolean;
  muted: boolean;
}

function AmbientLikes() {
  // Decorative drift so the preview feels like a live post.
  const [n, setN] = useState(2400);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + Math.floor(Math.random() * 5)), 2200);
    return () => window.clearInterval(id);
  }, []);
  return <span>{n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}</span>;
}

function SimChrome({
  platform,
  handle,
  caption,
}: {
  platform: string;
  handle: string;
  caption: string;
}) {
  const t = useTranslations('clipsEditor.preview.simTabs');
  const tp = useTranslations('clipsEditor.preview');
  if (platform === 'clean') return null;
  const status = (
    <div className="cepv-platform-sim__status">
      <span>10:09</span>
      <div className="cepv-platform-sim__status-icons">
        <span className="cepv-platform-sim__status-bars">●●●○</span>
        <span className="cepv-platform-sim__status-wifi">⌒</span>
        <span className="cepv-platform-sim__status-battery">87</span>
      </div>
    </div>
  );
  const rail = (items: { icon: string; label?: string; avatar?: boolean }[]) => (
    <div className="cepv-platform-sim__rail">
      {items.map((it, i) => (
        <div key={i} className="cepv-platform-sim__rail-item">
          <div
            className={`cepv-platform-sim__rail-icon${it.avatar ? ' cepv-platform-sim__rail-icon--avatar' : ''}`}
          >
            {it.icon}
          </div>
          {it.label ? <div className="cepv-platform-sim__rail-label">{it.label}</div> : null}
        </div>
      ))}
    </div>
  );
  const desc = (
    <div className="cepv-platform-sim__desc">
      <div className="cepv-platform-sim__handle-row">
        <span className="cepv-platform-sim__handle">{handle}</span>
        <span className="cepv-platform-sim__follow">{tp('follow')}</span>
      </div>
      <div className="cepv-platform-sim__caption">{caption}</div>
    </div>
  );
  const nav = (icons: string[]) => (
    <div className="cepv-platform-sim__bottom-nav">
      {icons.map((ic, i) => (
        <span
          key={i}
          className={`cepv-platform-sim__bottom-nav-icon${i === 1 ? ' is-active' : ''}`}
        >
          {ic}
        </span>
      ))}
    </div>
  );
  if (platform === 'tiktok')
    return (
      <>
        {status}
        <div className="cepv-platform-sim__top">
          <div className="cepv-platform-sim__top-left">
            <span className="cepv-platform-sim__top-icon">＋</span>
          </div>
          <div className="cepv-platform-sim__top-tabs" style={{ display: 'inline-flex', gap: 18 }}>
            <span className="cepv-platform-sim__top-tab">{t('following')}</span>
            <span className="cepv-platform-sim__top-tab is-active">{t('forYou')}</span>
          </div>
          <div className="cepv-platform-sim__top-right">
            <span className="cepv-platform-sim__top-icon">⌕</span>
          </div>
        </div>
        {rail([
          { icon: '', avatar: true },
          { icon: '♥', label: '142.3K' },
          { icon: '💬', label: '1,284' },
          { icon: '🔖', label: '3,402' },
          { icon: '↪', label: t('share') },
          { icon: '♪' },
        ])}
        {desc}
        {nav(['⌂', '▶', '＋', '✉', '◉'])}
      </>
    );
  if (platform === 'reels')
    return (
      <>
        {status}
        <div className="cepv-platform-sim__top">
          <div className="cepv-platform-sim__top-left">
            <span className="cepv-platform-sim__top-tab is-active">{t('reels')}</span>
            <span className="cepv-platform-sim__top-tab">{t('friends')}</span>
          </div>
          <div className="cepv-platform-sim__top-right">
            <span className="cepv-platform-sim__top-icon">📷</span>
          </div>
        </div>
        {rail([
          { icon: '', avatar: true },
          { icon: '♥', label: '8' },
          { icon: '💬' },
          { icon: '↪' },
          { icon: '✈' },
          { icon: '⋯' },
        ])}
        {desc}
        {nav(['⌂', '▶', '✈', '⌕', '◉'])}
      </>
    );
  if (platform === 'shorts')
    return (
      <>
        {status}
        <div className="cepv-platform-sim__top">
          <div className="cepv-platform-sim__top-left">
            <span className="cepv-platform-sim__top-icon">▶</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{t('shorts')}</span>
          </div>
          <div className="cepv-platform-sim__top-right">
            <span className="cepv-platform-sim__top-icon">⌕</span>
            <span className="cepv-platform-sim__top-icon">⋯</span>
          </div>
        </div>
        {rail([
          { icon: '', avatar: true },
          { icon: '👍', label: '24K' },
          { icon: '👎' },
          { icon: '💬', label: '512' },
          { icon: '↪', label: t('share') },
          { icon: '⌘', label: t('remix') },
        ])}
        {desc}
        {nav(['⌂', '▶', '＋', '◉', '☰'])}
      </>
    );
  // Kick's clip page: back button + name, no algorithmic rail.
  return (
    <>
      {status}
      <div className="cepv-platform-sim__top">
        <div className="cepv-platform-sim__top-left">
          <span className="cepv-platform-sim__top-icon">←</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{t('clip')}</span>
        </div>
        <div className="cepv-platform-sim__top-right">
          <span className="cepv-platform-sim__top-icon">⤴</span>
        </div>
      </div>
      {desc}
      {nav(['⌂', '▶', '☰', '✉', '◉'])}
    </>
  );
}

export function Preview({
  src,
  form,
  fitMode,
  previewMode,
  faceZone,
  defaultHandle,
  captions,
  zoneSpecs,
  videoRef,
  playback,
  onTogglePlay,
  onToggleMute,
}: {
  /** Signed engine link to the cut (no overlays). */
  src: string | null;
  form: EditorForm;
  fitMode: string;
  previewMode: string;
  faceZone: string | null;
  defaultHandle: string;
  captions: CaptionsFeed | null;
  zoneSpecs: Record<string, ZoneSpec[]>;
  videoRef: RefObject<HTMLVideoElement | null>;
  playback: Playback;
  onTogglePlay: () => void;
  onToggleMute: () => void;
}) {
  const t = useTranslations('clipsEditor.preview');
  const lines = captions?.lines ?? [];
  const lead = Math.max(0, Math.min(500, form.captions_lead_ms || 0)) / 1000;
  const tt = playback.t + lead;
  const lineIdx = form.captions_enabled ? activeLine(lines, tt) : -1;
  const line = lineIdx >= 0 ? lines[lineIdx]! : null;
  const reason = captions?.diagnostics?.reason ?? '';
  const emptyMsg =
    form.captions_enabled && captions && lines.length === 0
      ? reason === 'no_transcript'
        ? t('captionsNoTranscript')
        : reason === 'transcript_empty'
          ? t('captionsEmpty')
          : reason === 'no_word_timestamps'
            ? t('captionsOld')
            : null
      : null;
  const sim = simPlatform(form);
  const zones = useMemo(
    () => zoneSpecs[form.safe_zone_platform || 'tiktok'] ?? zoneSpecs.tiktok ?? [],
    [zoneSpecs, form.safe_zone_platform],
  );
  const position = form.captions_position || 'lower_third';
  const variant = form.banner_variant || 'kick_repost_page';
  const captionPreview = (form.title_text.trim() || form.top_hook_text.trim()).toLowerCase() || '';
  const style = {
    '--pv-highlight': form.captions_highlight_color || '#FFD700',
    '--pv-banner-color': form.banner_color || '#53FC18',
  } as CSSProperties;

  return (
    <div
      className="cepv"
      data-preview-mode={previewMode}
      data-fit-mode={fitMode}
      data-zone-profile={form.target_platform || 'all'}
      data-face-zone={faceZone ?? undefined}
      data-paused={playback.paused ? 'true' : 'false'}
      style={style}
    >
      <video
        ref={videoRef}
        src={src ?? undefined}
        preload="metadata"
        muted
        playsInline
        loop
        controls
        controlsList="nodownload"
        aria-label={t('player')}
      />

      <div className="cepv-zones" aria-hidden="true">
        <div className="cepv-zones__band cepv-zones__band--top-unsafe" />
        <div className="cepv-zones__band cepv-zones__band--top-caution" />
        <div className="cepv-zones__band cepv-zones__band--bottom-caution" />
        <div className="cepv-zones__band cepv-zones__band--bottom-unsafe" />
      </div>

      <div className="cepv-ambient">
        <button
          type="button"
          className={`cepv-ambient__mute${playback.muted ? '' : ' is-unmuted'}`}
          aria-label={playback.muted ? t('sound') : t('mute')}
          title={playback.muted ? t('sound') : t('mute')}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
        >
          {playback.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <div className="cepv-ambient__like" aria-hidden="true">
          <span className="cepv-ambient__heart">♥</span>
          <AmbientLikes />
        </div>
      </div>

      <button
        type="button"
        className={`cepv-play-overlay${playback.paused ? '' : ' is-playing'}`}
        aria-label={playback.paused ? t('play') : t('pause')}
        onClick={onTogglePlay}
      >
        <Play size={56} fill="currentColor" aria-hidden="true" />
      </button>

      <div
        className="cepv-layer"
        aria-hidden="true"
        data-clip-style={form.clip_style}
        data-banner-variant={variant}
      >
        <div className={`cepv-title${form.title_text.trim() ? '' : ' is-empty'}`}>
          {form.title_text.trim()}
        </div>

        {form.top_hook_enabled && form.top_hook_text.trim() ? (
          <div className={`cepv-top-hook cepv-top-hook--${form.top_hook_style || 'white_rounded'}`}>
            {form.top_hook_text.trim()}
          </div>
        ) : null}

        {form.captions_enabled ? (
          <div
            className={`cepv-caption cepv-caption--${position}`}
            data-position={position}
            data-animation={form.captions_animation || 'pop'}
            style={
              {
                '--pv-caption-scale': String(CAPTION_SCALE[form.captions_font_size] ?? 1),
              } as CSSProperties
            }
          >
            {line
              ? line.words.map((w, i) => {
                  const state =
                    tt >= w.ts && tt < w.end_ts
                      ? 'is-active'
                      : w.end_ts <= tt
                        ? 'is-past'
                        : 'is-upcoming';
                  return (
                    <span
                      key={`${lineIdx}-${i}`}
                      className={`cepv-caption__word ${state}`}
                      data-emphasis={w.emphasis || 'normal'}
                    >
                      {w.text}
                    </span>
                  );
                })
              : emptyMsg && <span className="cepv-caption__empty">{emptyMsg}</span>}
          </div>
        ) : null}

        {form.comments_show ? (
          <div className="cepv-rail">
            <div className="cepv-rail__item">
              <div className="cepv-rail__icon">
                <Heart size={14} fill="currentColor" />
              </div>
              <span>{form.comments_fake_likes}</span>
            </div>
          </div>
        ) : null}

        {form.banner_show_safezones ? (
          <div className="cepv-safezones" data-platform={form.safe_zone_platform}>
            {zones.map((z, i) => (
              <div
                key={i}
                className={`cepv-safezones__zone cepv-safezones__zone--${z.kind}`}
                style={{
                  left: `${z.x * 100}%`,
                  top: `${z.y * 100}%`,
                  width: `${z.w * 100}%`,
                  height: `${z.h * 100}%`,
                }}
                title={z.reason}
              >
                {z.kind.replace('_', ' ')}
              </div>
            ))}
          </div>
        ) : null}

        <div className="cepv-platform-sim" data-platform={sim}>
          <SimChrome
            platform={sim}
            handle={operatorHandle(form.banner_url)}
            caption={captionPreview ? `${captionPreview} 🔥` : t('captionFallback')}
          />
        </div>

        <div
          className={`cepv-banner cepv-banner--${variant}${form.banner_enabled ? '' : ' is-hidden'}`}
          data-variant={variant}
          data-platform={form.banner_platform}
        >
          <span className="cepv-banner__platform">
            {(form.banner_platform || 'kick').toUpperCase()}
          </span>
          <span className="cepv-banner__url">
            {formatKickUrl(form.banner_url || defaultHandle.replace('@', ''))}
          </span>
          {form.banner_live_badge ? (
            <span className="cepv-banner__live-pill">{t('liveNow')}</span>
          ) : null}
        </div>

        {form.banner_show_context ? (
          <>
            <div className="cepv-live">
              <span className="cepv-live__dot" />
              <span>{t('live')}</span>
              <span className="cepv-live__count">1247</span>
            </div>
            <div className="cepv-chat">
              {(t.raw('chat') as { name: string; msg: string }[]).map((c) => (
                <div key={c.name} className="cepv-chat__row">
                  <span className="cepv-chat__name">{c.name}</span>
                  <span className="cepv-chat__msg">{c.msg}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
