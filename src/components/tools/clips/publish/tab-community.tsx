'use client';

// Comunidad: connect Discord / Telegram and announce every publish there,
// with the brand name/avatar and an optional weekly summary.

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Plus, Save } from 'lucide-react';
import { publishApi, usePublishErrorText } from './api';
import { InlineMsg, PlatformTile, type Msg } from './common';
import type { TabProps } from './publish-center';

interface Settings {
  enabled?: boolean;
  discord_account_id?: string | null;
  telegram_account_id?: string | null;
  brand_name?: string | null;
  brand_avatar_url?: string | null;
  weekly_digest?: boolean;
}

export function CommunityTab({ ov, connect }: TabProps) {
  const t = useTranslations('clipsPublish.community');
  const errText = usePublishErrorText();
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [channels, setChannels] = useState<{ platform: string; account_id: string }[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [digest, setDigest] = useState(false);
  const [discord, setDiscord] = useState('');
  const [telegram, setTelegram] = useState('');
  const [brand, setBrand] = useState('');
  const [avatar, setAvatar] = useState('');
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    void publishApi<{ settings: Settings; channels: { platform: string; account_id: string }[] }>(
      'community/settings.json',
    ).then((r) => {
      if (!r.ok) {
        setLoadErr(errText(r.error));
        return;
      }
      const s = r.data.settings ?? {};
      setChannels(r.data.channels ?? []);
      setEnabled(!!s.enabled);
      setDigest(!!s.weekly_digest);
      setDiscord(s.discord_account_id ?? '');
      setTelegram(s.telegram_account_id ?? '');
      setBrand(s.brand_name ?? '');
      setAvatar(s.brand_avatar_url ?? '');
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when accounts change
  }, [ov.community_connected.join(',')]);

  const opts = (platform: string) => channels.filter((c) => c.platform === platform);

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-comm-h">
      <header>
        <h2 id="pub-comm-h">{t('title')}</h2>
        <span className="ch-pub__push ch-pub-hint">{t('tagline')}</span>
      </header>
      <div className="ch-pub-chips">
        {ov.community_platforms.map((p) =>
          ov.community_connected.includes(p.id) ? (
            <span key={p.id} className="ch-pub-acct ch-pub-acct--on" style={{ paddingRight: 14 }}>
              <PlatformTile id={p.id} />
              {p.label}
              <Check aria-hidden="true" style={{ width: 16, height: 16 }} />
            </span>
          ) : (
            <button key={p.id} type="button" className="ch-pub-acct" onClick={() => connect(p.id)}>
              <PlatformTile id={p.id} />
              <Plus aria-hidden="true" style={{ width: 16, height: 16 }} />
              {t('connect', { plataforma: p.label })}
            </button>
          ),
        )}
      </div>
      {loadErr ? (
        <p className="ch-pub-err">{loadErr}</p>
      ) : !loaded ? (
        <p className="ch-pub-hint">{t('loading')}</p>
      ) : (
        <>
          <label className="ch-pub-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>{t('enable')}</span>
          </label>
          <div className="ch-pub-fields">
            <label className="ch-pub-field">
              <span>{t('discord')}</span>
              <select
                className="ch-select"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
              >
                <option value="">—</option>
                {opts('discord').map((c) => (
                  <option key={c.account_id} value={c.account_id}>
                    {c.account_id.slice(-8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ch-pub-field">
              <span>{t('telegram')}</span>
              <select
                className="ch-select"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
              >
                <option value="">—</option>
                {opts('telegram').map((c) => (
                  <option key={c.account_id} value={c.account_id}>
                    {c.account_id.slice(-8)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ch-pub-fields">
            <label className="ch-pub-field">
              <span>{t('brand')}</span>
              <input
                className="ch-input"
                value={brand}
                maxLength={80}
                placeholder={t('brandPlaceholder')}
                onChange={(e) => setBrand(e.target.value)}
              />
            </label>
            <label className="ch-pub-field">
              <span>{t('avatar')}</span>
              <input
                className="ch-input"
                value={avatar}
                type="url"
                placeholder="https://…/avatar.png"
                onChange={(e) => setAvatar(e.target.value)}
              />
            </label>
          </div>
          <label className="ch-pub-check">
            <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} />
            <span>{t('digest')}</span>
          </label>
          <div className="ch-pub-row">
            <button
              type="button"
              className="ch-btn ch-btn--primary ch-btn--compact"
              onClick={async () => {
                setMsg({ kind: 'info', text: t('saving') });
                const r = await publishApi('community/settings', {
                  body: {
                    enabled,
                    weekly_digest: digest,
                    discord_account_id: discord || null,
                    telegram_account_id: telegram || null,
                    brand_name: brand || null,
                    brand_avatar_url: avatar || null,
                  },
                });
                setMsg(
                  r.ok ? { kind: 'ok', text: t('saved') } : { kind: 'bad', text: errText(r.error) },
                );
              }}
            >
              <Save aria-hidden="true" />
              {t('save')}
            </button>
            <InlineMsg msg={msg} />
          </div>
        </>
      )}
    </section>
  );
}
