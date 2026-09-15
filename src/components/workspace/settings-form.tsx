'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/lib/workspace/store';
import { saveProfileSettings } from '@/lib/auth/profile-actions';

interface Props {
  defaultName: string;
  defaultEmail: string;
  defaultLocale: 'en' | 'es';
  /** True when the page was reached by the redirect that follows a successful
   *  save (`?saved=1`), so the form can confirm it once. */
  justSaved?: boolean;
}

interface Prefs {
  notifyCritical: boolean;
  notifyDaily: boolean;
  notifyMarketing: boolean;
  twoFA: boolean;
  locale: 'en' | 'es';
  timezone: string;
}

const DEFAULT_PREFS: Omit<Prefs, 'locale'> = {
  notifyCritical: true,
  notifyDaily: true,
  notifyMarketing: false,
  twoFA: true,
  timezone: 'America/Mexico_City',
};

const STORAGE_KEY = 'chalyb:settings:prefs';

export function SettingsForm({
  defaultName,
  defaultEmail,
  defaultLocale,
  justSaved = false,
}: Props) {
  const t = useTranslations('workspace.settings');
  const showToast = useWorkspace((s) => s.showToast);

  const [name, setName] = useState(defaultName);
  const [saving, startSaving] = useTransition();
  const [prefs, setPrefs] = useState<Prefs>({ ...DEFAULT_PREFS, locale: defaultLocale });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate saved prefs from localStorage on mount (no SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs((p) => ({ ...p, ...parsed, locale: parsed.locale ?? p.locale }));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  // The save action redirects here (in the newly chosen language) instead of
  // returning to the form, so the confirmation is shown on arrival. The URL
  // parameter is dropped again so a reload does not repeat the toast.
  useEffect(() => {
    if (!justSaved) return;
    showToast(t.markup('saved', { name: defaultName, b: (c) => `<b>${c}</b>` }));
    window.history.replaceState(null, '', window.location.pathname);
  }, [justSaved, defaultName, showToast, t]);

  function persist(next: Prefs) {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function toggle<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    persist(next);
  }

  // Name and language are real columns on `profiles` and are saved server-side.
  // The write goes through the user-scoped client, so the column GRANTs from
  // migration 0032 are what allow it — an edit to this action that reached for
  // `tier` or `role` would be refused by the database.
  //
  // On success the action redirects to the settings page in the chosen
  // language (so /en/app/settings for English) and never resolves here; the
  // toast for that case fires from the `justSaved` effect above. Only the
  // failure path returns a result.
  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    startSaving(async () => {
      const res = await saveProfileSettings({ fullName: name, locale: prefs.locale });
      if (!res.ok) {
        showToast(
          t.markup('saveError', {
            error: res.error ?? t('saveErrorFallback'),
            b: (c) => `<b>${c}</b>`,
          }),
        );
      }
    });
  }

  if (!hydrated) {
    return <div style={{ padding: 20, color: 'var(--cc-txt-4)' }}>{t('loading')}</div>;
  }

  return (
    <>
      <div className="cc-mod-section">
        <div className="cc-mod-sl">{t('account')}</div>
        <form className="cc-mod-form" onSubmit={saveProfile}>
          <div className="cc-mod-field">
            <label htmlFor="set-name">{t('name')}</label>
            <input
              id="set-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="cc-mod-field">
            <label htmlFor="set-email">{t('email')}</label>
            <input id="set-email" type="email" value={defaultEmail} disabled />
          </div>
          <button
            type="submit"
            style={{
              alignSelf: 'flex-start',
              background: 'var(--cc-green)',
              color: '#070809',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            disabled={saving}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </form>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">{t('preferences')}</div>
        <p style={{ fontSize: 12, color: 'var(--cc-txt-4)', margin: '0 0 10px' }}>
          {t('preferencesNote')}
        </p>
        <div className="cc-mod-form">
          <div className="cc-mod-field">
            <label htmlFor="set-locale">{t('language')}</label>
            <select
              id="set-locale"
              value={prefs.locale}
              onChange={(e) => toggle('locale', e.target.value as 'en' | 'es')}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="cc-mod-field">
            <label htmlFor="set-tz">{t('timezone')}</label>
            <select
              id="set-tz"
              value={prefs.timezone}
              onChange={(e) => toggle('timezone', e.target.value)}
            >
              <option value="America/Mexico_City">America/Mexico_City</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/Madrid">Europe/Madrid</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">{t('notifications')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">{t('notifyCritical')}</span>
              <span className="s">{t('notifyCriticalSub')}</span>
            </div>
            <button
              type="button"
              aria-label="Toggle notify critical"
              className={`cc-mod-switch${prefs.notifyCritical ? ' on' : ''}`}
              onClick={() => toggle('notifyCritical', !prefs.notifyCritical)}
            />
          </div>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">{t('notifyDaily')}</span>
              <span className="s">{t('notifyDailySub')}</span>
            </div>
            <button
              type="button"
              aria-label="Toggle notify daily"
              className={`cc-mod-switch${prefs.notifyDaily ? ' on' : ''}`}
              onClick={() => toggle('notifyDaily', !prefs.notifyDaily)}
            />
          </div>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">{t('notifyMarketing')}</span>
              <span className="s">{t('notifyMarketingSub')}</span>
            </div>
            <button
              type="button"
              aria-label="Toggle notify marketing"
              className={`cc-mod-switch${prefs.notifyMarketing ? ' on' : ''}`}
              onClick={() => toggle('notifyMarketing', !prefs.notifyMarketing)}
            />
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">{t('security')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">{t('twoFA')}</span>
              <span className="s">{t('twoFASub')}</span>
            </div>
            <button
              type="button"
              aria-label="Toggle 2FA"
              className={`cc-mod-switch${prefs.twoFA ? ' on' : ''}`}
              onClick={() => toggle('twoFA', !prefs.twoFA)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
