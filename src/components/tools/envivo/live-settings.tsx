'use client';

// Ajustes de En vivo (TOOLS-SPEC §6.3, mockup 59). Changes save on their own
// ("Guardando…" / "Guardado"). The stream key is not part of these settings:
// it's fetched only by StreamKey on "Mostrar".

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Check, Laptop, Lock, Scissors, Video } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Switch } from '@/components/ui/switch';
import { AdvancedOptions } from '@/components/tools/advanced-options';
import type {
  LiveDevice,
  LivePlatform,
  LiveQuality,
  LiveSettings,
} from '@/lib/tools/adapters/tools';
import { ConnectAccountSheet } from './connect-account-sheet';
import { StreamKey } from './stream-key';

export const PLATFORM_NAMES: Record<LivePlatform, string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  kick: 'Kick',
  facebook: 'Facebook',
};

const QUALITIES: LiveQuality[] = ['auto', 'high', 'saver'];

/** Operating-system names are product names, the same in both languages. */
const OS_NAMES: Record<LiveDevice['os'], string> = {
  windows: 'Windows',
  mac: 'Mac',
  linux: 'Linux',
};

export function LiveSettingsForm({
  initial,
  devices: initialDevices,
  supportsConnect,
  advanced,
  autosave,
}: {
  initial: LiveSettings;
  devices: LiveDevice[];
  supportsConnect: boolean;
  advanced: { title: string; sub: string };
  autosave: { idle: string; saving: string; saved: string };
}) {
  const t = useTranslations('liveTool.settings');
  const [s, setS] = useState(initial);
  const [devices, setDevices] = useState(initialDevices);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [connecting, setConnecting] = useState<LivePlatform | null>(null);

  async function save(patch: Record<string, unknown>) {
    setState('saving');
    try {
      const res = await fetch('/api/tools/chalybobs/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { ok: boolean; data?: LiveSettings };
      if (!json.ok || !json.data) throw new Error('save');
      setS(json.data);
      setState('saved');
    } catch {
      setState('error');
    }
  }

  async function connect(p: LivePlatform): Promise<boolean> {
    try {
      const res = await fetch(`/api/tools/chalybobs/destinations/${p}`, { method: 'POST' });
      const json = (await res.json()) as { ok: boolean; data?: LiveSettings };
      if (!json.ok || !json.data) return false;
      setS(json.data);
      return true;
    } catch {
      return false;
    }
  }

  async function disconnect(id: string) {
    try {
      const res = await fetch(`/api/tools/chalybobs/devices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { ok: boolean; data?: LiveDevice[] };
      if (json.ok && json.data) setDevices(json.data);
    } catch {}
  }

  const keyPlatforms = s.destinations.filter((d) => d.connected);

  return (
    <div className="ch-ev-set">
      <div className="ch-ev-set__cols">
        <div className="ch-ev-set__col">
          <section aria-labelledby="where-t">
            <h2 id="where-t" className="ch-label ch-ev-set__h">
              {t('where')}
            </h2>
            <div className="ch-group">
              {s.destinations.map((d) => (
                <div key={d.platform} className="ch-row">
                  <span className={`ch-ev-plat ch-ev-plat--${d.platform}`} aria-hidden="true">
                    {PLATFORM_NAMES[d.platform][0]}
                  </span>
                  <span className="ch-row__tx">
                    <b>{PLATFORM_NAMES[d.platform]}</b>
                    {d.connected && d.handle && (
                      <small>{t('connected', { usuario: d.handle })}</small>
                    )}
                  </span>
                  {d.connected ? (
                    <Switch
                      checked={d.enabled}
                      label={t('streamThere', { plataforma: PLATFORM_NAMES[d.platform] })}
                      onChange={(v) => void save({ enabled: { [d.platform]: v } })}
                    />
                  ) : (
                    supportsConnect && (
                      <button
                        type="button"
                        className="ch-lnk ch-ev-set__connect"
                        onClick={() => setConnecting(d.platform)}
                      >
                        {t('connect')}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
            <p className="ch-muted ch-ev-set__note">{t('whereNote')}</p>
          </section>

          <section aria-labelledby="device-t">
            <h2 id="device-t" className="ch-label ch-ev-set__h">
              {t('device')}
            </h2>
            <div className="ch-group">
              {devices.length === 0 ? (
                <div className="ch-row">
                  <span className="ch-row__tx">{t('noDevice')}</span>
                  <Link href={'/app/en-vivo/conectar' as Route} className="ch-lnk">
                    {t('noDeviceCta')}
                  </Link>
                </div>
              ) : (
                devices.map((d) => (
                  <div key={d.id} className="ch-row">
                    <span className="ch-row__ic ch-ev-set__dev" aria-hidden="true">
                      <Laptop />
                    </span>
                    <span className="ch-row__tx">
                      <b>{d.name}</b>
                      <small>
                        {t(d.obsReady ? 'deviceReady' : 'deviceNotReady', {
                          sistema: OS_NAMES[d.os],
                        })}
                      </small>
                    </span>
                    <span className="ch-ev-set__devr">
                      {d.online ? (
                        <span className="ch-ev-set__ok">
                          <Check aria-hidden="true" />
                          {t('deviceOn')}
                        </span>
                      ) : (
                        <span className="ch-muted">{t('deviceOff')}</span>
                      )}
                      <button
                        type="button"
                        className="ch-lnk ch-ev-set__connect"
                        onClick={() => void disconnect(d.id)}
                      >
                        {t('disconnect')}
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
            {devices.length > 0 && (
              <Link href={'/app/en-vivo/conectar' as Route} className="ch-lnk ch-ev-set__note">
                {t('addDevice')}
              </Link>
            )}
          </section>
        </div>

        <div className="ch-ev-set__col">
          <fieldset className="ch-ev-q">
            <legend className="ch-label ch-ev-set__h">{t('quality')}</legend>
            {QUALITIES.map((q) => (
              <label
                key={q}
                className={`ch-ev-q__opt${s.quality === q ? ' ch-ev-q__opt--on' : ''}`}
              >
                <input
                  type="radio"
                  name="quality"
                  value={q}
                  checked={s.quality === q}
                  onChange={() => void save({ quality: q })}
                />
                <span className="ch-ev-q__tx">
                  <b>
                    {t(q)}
                    {q === 'auto' && (
                      <span className="ch-pill ch-pill--acc">{t('recommended')}</span>
                    )}
                  </b>
                  <small className="ch-muted">{t(`${q}Body`)}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <section aria-labelledby="after-t">
            <h2 id="after-t" className="ch-label ch-ev-set__h">
              {t('after')}
            </h2>
            <div className="ch-group">
              <div className="ch-row">
                <span className="ch-row__ic ch-ev-set__acc" aria-hidden="true">
                  <Scissors />
                </span>
                <span className="ch-row__tx">
                  <b>{t('clipsAfter')}</b>
                  <small>{t('clipsAfterBody')}</small>
                </span>
                <Switch
                  checked={s.clipsAfter}
                  label={t('clipsAfter')}
                  onChange={(v) => void save({ clipsAfter: v })}
                />
              </div>
              <div className="ch-row">
                <span className="ch-row__ic ch-ev-set__acc" aria-hidden="true">
                  <Video />
                </span>
                <span className="ch-row__tx">
                  <b>{t('saveRecording')}</b>
                  <small>{t('saveRecordingBody')}</small>
                </span>
                <Switch
                  checked={s.saveRecording}
                  label={t('saveRecording')}
                  onChange={(v) => void save({ saveRecording: v })}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <AdvancedOptions
        storageKey="envivo.settings"
        title={advanced.title}
        sub={advanced.sub}
        summary={t('advSummary')}
      >
        <div className="ch-ev-adv">
          <label className="ch-field">
            <span>{t('bitrate')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={500}
              max={20000}
              step={100}
              className="ch-input"
              defaultValue={s.advanced.bitrateKbps}
              onBlur={(e) =>
                void save({ advanced: { ...s.advanced, bitrateKbps: Number(e.target.value) } })
              }
            />
          </label>
          <label className="ch-field">
            <span>{t('resolution')}</span>
            <select
              className="ch-input"
              value={s.advanced.resolution}
              onChange={(e) =>
                void save({ advanced: { ...s.advanced, resolution: e.target.value } })
              }
            >
              {['1080p60', '1080p30', '720p60', '720p30'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-field">
            <span>{t('server')}</span>
            <select
              className="ch-input"
              value={s.advanced.server}
              onChange={(e) => void save({ advanced: { ...s.advanced, server: e.target.value } })}
            >
              <option value="auto">{t('serverAuto')}</option>
            </select>
          </label>
          {keyPlatforms.map((d) => (
            <StreamKey
              key={d.platform}
              platform={d.platform}
              platformName={PLATFORM_NAMES[d.platform]}
            />
          ))}
          <div>
            <b>{t('shortcuts')}</b>
            <p className="ch-muted">{t('shortcutsBody')}</p>
          </div>
          <div>
            <b>{t('manual')}</b>
            <p className="ch-muted">{t('manualBody')}</p>
          </div>
        </div>
      </AdvancedOptions>

      <p className="ch-muted ch-ev-set__lock">
        <Lock aria-hidden="true" />
        {t('keyNote')}
      </p>
      <p className="ch-muted ch-ev-set__save" role="status">
        {state === 'saving'
          ? autosave.saving
          : state === 'saved'
            ? autosave.saved
            : state === 'error'
              ? t('saveError')
              : autosave.idle}
      </p>

      <ConnectAccountSheet
        open={connecting !== null}
        platformName={connecting ? PLATFORM_NAMES[connecting] : ''}
        onClose={() => setConnecting(null)}
        onConnect={() => (connecting ? connect(connecting) : Promise.resolve(false))}
      />
    </div>
  );
}
