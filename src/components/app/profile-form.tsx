'use client';

// Mi perfil (FIX-3 §C, mockups 73 and 74 §1). Starts from what the server
// read from the account, never from the browser. One "Guardar cambios" saves
// everything; it is off until something changes and blocks a double submit.
// Toasts and errors are plain text.

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Check, Clock, Globe, Mail, Sparkles, TriangleAlert } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import { Avatar } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/switch';
import { Sheet } from '@/components/ui/sheet';
import { saveProfileSettings, type Locale, type ProfileErrorKey } from '@/lib/auth/profile-actions';
import { initialTimezone, TIMEZONES, utcOffsetLabel } from '@/lib/profile/timezones';

/** The old page kept prefs here; migrated once, then removed (§C.5.1). */
const LEGACY_KEY = 'chalyb:settings:prefs';

export interface ProfileValues {
  fullName: string;
  locale: Locale;
  timezone: string | null;
  notifyCritical: boolean;
  notifyDaily: boolean;
  notifyViral: boolean;
  marketing: boolean;
}

export function ProfileForm({
  initial,
  email,
  showNotifications,
  justSaved,
}: {
  initial: ProfileValues;
  email: string;
  showNotifications: boolean;
  justSaved: boolean;
}) {
  const t = useTranslations('profile');
  const tl = useTranslations('language');
  const current = useLocale() === 'en' ? 'en' : 'es';
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState<ProfileValues>(() => ({
    ...initial,
    timezone: initial.timezone ?? 'America/Mexico_City',
  }));
  const [v, setV] = useState<ProfileValues>(saved);
  const [nameError, setNameError] = useState<ProfileErrorKey | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [toast, setToast] = useState(justSaved);
  const [pending, start] = useTransition();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // §C.5.1: a zone the account never saved comes from the browser; the old
  // localStorage blob is dropped (it never overrides the account).
  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* storage blocked: nothing to migrate */
    }
    if (!initial.timezone) {
      const browser = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      const tz = initialTimezone(null, browser);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- first render must match the server
      setV((x) => ({ ...x, timezone: tz }));
    }
  }, [initial.timezone]);

  // ?saved=1 after a language change: show the toast once, then clean the URL.
  useEffect(() => {
    if (!justSaved) return;
    router.replace(pathname);
    const id = window.setTimeout(() => setToast(false), 3200);
    return () => window.clearTimeout(id);
  }, [justSaved, pathname, router]);

  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(saved), [v, saved]);

  // §C.5.9: leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search);
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const zones = useMemo(() => {
    const list: string[] = [...TIMEZONES];
    if (v.timezone && !list.includes(v.timezone)) list.push(v.timezone);
    return list;
  }, [v.timezone]);

  function checkName(name: string): ProfileErrorKey | null {
    const n = name.trim().length;
    return n < 2 ? 'nameShort' : n > 120 ? 'nameLong' : null;
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!dirty || pending) return;
    const ne = checkName(v.fullName);
    setNameError(ne);
    if (ne) return;
    setSaveError(false);
    start(async () => {
      const res = await saveProfileSettings({
        fullName: v.fullName,
        locale: v.locale,
        currentLocale: current,
        timezone: v.timezone ?? 'America/Mexico_City',
        notifyCritical: v.notifyCritical,
        notifyDaily: v.notifyDaily,
        notifyViral: v.notifyViral,
        marketing: v.marketing,
        marketingWas: saved.marketing,
      }).catch(() => ({ ok: false, error: 'saveError' as const }));
      // A language change redirects and never gets here.
      if (!res?.ok) {
        if (res?.error === 'nameShort' || res?.error === 'nameLong') setNameError(res.error);
        else setSaveError(true);
        return;
      }
      const clean = { ...v, fullName: v.fullName.trim() };
      setSaved(clean);
      setV(clean);
      setToast(true);
      window.setTimeout(() => setToast(false), 3200);
      router.refresh();
    });
  }

  const name = (k: ProfileErrorKey) => (k === 'nameLong' ? t('nameTooLong') : t('nameError'));
  const sw = (key: 'notifyCritical' | 'notifyDaily' | 'notifyViral' | 'marketing') => (next: boolean) =>
    setV((x) => ({ ...x, [key]: next }));

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="ch-acct ch-profile">
      <div className="ch-acct__col">
        <section aria-labelledby="pf-data">
          <h2 id="pf-data" className="ch-ghead">
            {t('data')}
          </h2>
          <div className="ch-card ch-profile__card">
            <div className="ch-profile__photo">
              <Avatar name={v.fullName || email} large />
              <div>
                <b>{t('photo')}</b>
                <p className="ch-muted">{t('photoSub')}</p>
              </div>
            </div>
            <div className={`ch-field${nameError ? ' ch-field--bad' : ''}`}>
              <label htmlFor="pf-name">{t('name')}</label>
              <input
                id="pf-name"
                className="ch-input"
                value={v.fullName}
                maxLength={160}
                autoComplete="name"
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'pf-name-err' : undefined}
                onChange={(e) => setV((x) => ({ ...x, fullName: e.target.value }))}
                onBlur={(e) => setNameError(checkName(e.target.value))}
              />
              {nameError && (
                <p id="pf-name-err" role="alert" className="ch-field__err">
                  {name(nameError)}
                </p>
              )}
            </div>
            <div className="ch-field">
              <label htmlFor="pf-email">{t('email')}</label>
              <div className="ch-input ch-input--ro" aria-readonly="true">
                <Mail aria-hidden="true" />
                <input id="pf-email" value={email} readOnly aria-describedby="pf-email-hint" />
              </div>
              <p id="pf-email-hint" className="ch-muted ch-field__hint">
                {t('emailHint')}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="pf-lang">
          <h2 id="pf-lang" className="ch-ghead">
            {t('langTime')}
          </h2>
          <div className="ch-card ch-profile__card">
            <div className="ch-field">
              <label htmlFor="idioma">{t('language')}</label>
              <div className="ch-select-wrap">
                <Globe aria-hidden="true" />
                <select
                  id="idioma"
                  className="ch-input ch-select"
                  value={v.locale}
                  onChange={(e) => setV((x) => ({ ...x, locale: e.target.value === 'en' ? 'en' : 'es' }))}
                >
                  <option value="es" lang="es">
                    {tl('es')}
                  </option>
                  <option value="en" lang="en">
                    {tl('en')}
                  </option>
                </select>
              </div>
            </div>
            <div className="ch-field">
              <label htmlFor="pf-tz">{t('timezone')}</label>
              <div className="ch-select-wrap">
                <Clock aria-hidden="true" />
                <select
                  id="pf-tz"
                  className="ch-input ch-select"
                  value={v.timezone ?? 'America/Mexico_City'}
                  aria-describedby="pf-tz-hint"
                  onChange={(e) => setV((x) => ({ ...x, timezone: e.target.value }))}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {t.has(`tz.${z.replace(/\//g, '_')}`) ? t(`tz.${z.replace(/\//g, '_')}`) : z} (
                      {utcOffsetLabel(z)})
                    </option>
                  ))}
                </select>
              </div>
              <p id="pf-tz-hint" className="ch-muted ch-field__hint">
                {t('tzHint')}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="ch-acct__col">
        <section aria-labelledby="pf-notifs">
          <h2 id="pf-notifs" className="ch-ghead">
            {t('notifs')}
          </h2>
          <div className="ch-group">
            {showNotifications && (
              <>
                <SwitchRow
                  icon={<TriangleAlert />}
                  color="#FF3B30"
                  title={t('n.critical')}
                  sub={t('n.criticalSub')}
                  checked={v.notifyCritical}
                  onChange={sw('notifyCritical')}
                />
                <SwitchRow
                  icon={<Calendar />}
                  color="#5B4BFF"
                  title={t('n.daily')}
                  sub={t('n.dailySub', { hora: t('n.dailyHour') })}
                  checked={v.notifyDaily}
                  onChange={sw('notifyDaily')}
                />
                <SwitchRow
                  icon={<Sparkles />}
                  color="#FF9F0A"
                  title={t('n.viral')}
                  sub={t('n.viralSub')}
                  checked={v.notifyViral}
                  onChange={sw('notifyViral')}
                />
              </>
            )}
            <SwitchRow
              icon={<Mail />}
              color="#30B0C7"
              title={t('n.marketing')}
              sub={t('n.marketingSub')}
              checked={v.marketing}
              onChange={sw('marketing')}
            />
          </div>
        </section>

        <div className="ch-profile__save">
          {saveError ? (
            <div role="alert" className="ch-profile__err">
              <p>{t('saveError')}</p>
              <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => submit()}>
                {t('retry')}
              </button>
            </div>
          ) : (
            <p className="ch-muted ch-profile__note">
              {dirty ? (
                t('note.dirty')
              ) : (
                <>
                  <Check aria-hidden="true" /> {t('note.clean')}
                </>
              )}
            </p>
          )}
          <button
            type="submit"
            className="ch-btn ch-btn--primary ch-btn--xl"
            disabled={!dirty || pending}
            aria-disabled={!dirty || pending}
          >
            {pending ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {toast && (
        <div role="status" className="ch-toast ch-toast--ok">
          <Check aria-hidden="true" /> {t('saved')}
        </div>
      )}

      <Sheet open={!!leaveTo} onClose={() => setLeaveTo(null)} title={t('leave.title')} closeLabel={t('leave.stay')}>
        <div style={{ display: 'grid', gap: 10 }}>
          <button type="button" className="ch-btn ch-btn--primary" onClick={() => setLeaveTo(null)}>
            {t('leave.stay')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--dark"
            onClick={() => {
              const to = leaveTo;
              setSaved(v);
              setLeaveTo(null);
              if (to) window.location.assign(to);
            }}
          >
            {t('leave.go')}
          </button>
        </div>
      </Sheet>
    </form>
  );
}

function SwitchRow({
  icon,
  color,
  title,
  sub,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  sub: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="ch-row ch-row--switch" onClick={() => onChange(!checked)}>
      <span className="ch-row__ic" style={{ background: color }} aria-hidden="true">
        {icon}
      </span>
      <span className="ch-row__tx" style={{ flex: 1, minWidth: 0 }}>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <Switch checked={checked} onChange={onChange} label={title} />
      </span>
    </div>
  );
}
