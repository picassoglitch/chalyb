'use server';

// Self-serve profile edits from /app/settings/perfil (FIX-3 §C.5).
//
// Deliberately uses the USER-scoped Supabase client, not the service-role one:
// name, language, time zone and the notification switches are exactly the
// columns migrations 0032/0049 leave writable by `authenticated`, so RLS and
// the column GRANTs are the enforcement here rather than a trust-me check in
// this file. If this action is ever made to write something privileged, the
// database rejects it. The one exception is marketing consent, which is not a
// column: it is an append-only event in consent_events.
//
// One Supabase client for the whole action, on purpose. This is a server
// action, the one place the server-side client can actually write cookies (in
// a Server Component the write is swallowed). The old version verified the
// user on one client and wrote on a second, then asked Next to re-render every
// layout under /[locale] inside the same POST. Each of those was a fresh
// cookie read, and the layout re-render put `requireUser()` on the hot path
// of a request whose session cookies were being rewritten underneath it. The
// symptom was a save that bounced the user to /sign-in?next=/app/settings
// (FIX-3 §C.6, covered by e2e/perfil-idioma-sesion.spec.ts). Now: read once,
// write once, and redirect only when the language changed.

import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { profileNotificationPrefs } from '@/lib/config/flags';
import { isKnownTimezone } from '@/lib/profile/timezones';
import { recordConsent, requestContext, UI_VERSION } from '@/lib/billing/consent';

export type Locale = 'en' | 'es';

const LOCALES: Locale[] = ['en', 'es'];
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;

/** Keys under `profile.*`; the form renders them. Never a database message. */
export type ProfileErrorKey = 'nameShort' | 'nameLong' | 'saveError';

export interface SaveProfileResult {
  ok: boolean;
  error?: ProfileErrorKey;
}

export interface ProfileInput {
  fullName: string;
  locale: Locale;
  /** The language the page was rendered in: a change redirects. */
  currentLocale: Locale;
  timezone: string;
  notifyCritical: boolean;
  notifyDaily: boolean;
  notifyViral: boolean;
  marketing: boolean;
  /** What the page showed; a change records a consent event. */
  marketingWas: boolean;
}

export async function saveProfileSettings(input: ProfileInput): Promise<SaveProfileResult> {
  const fullName = (input.fullName ?? '').trim();
  if (fullName.length < MIN_NAME_LENGTH) return { ok: false, error: 'nameShort' };
  if (fullName.length > MAX_NAME_LENGTH) return { ok: false, error: 'nameLong' };
  if (!LOCALES.includes(input.locale)) return { ok: false, error: 'saveError' };
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : '';
  if (!isKnownTimezone(timezone) && !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(timezone))
    return { ok: false, error: 'saveError' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'saveError' };

  const update: Record<string, unknown> = {
    full_name: fullName,
    preferred_locale: input.locale,
    timezone,
  };
  if (profileNotificationPrefs()) {
    update.notify_critical = input.notifyCritical === true;
    update.notify_daily = input.notifyDaily === true;
    update.notify_viral = input.notifyViral === true;
  }
  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) {
    console.error('[profile] save failed', error.message);
    return { ok: false, error: 'saveError' };
  }

  if (input.marketing !== input.marketingWas) {
    const ctx = await requestContext().catch(() => ({ ip: null, userAgent: null }));
    try {
      await recordConsent({
        event_type: input.marketing ? 'marketing_opt_in' : 'marketing_opt_out',
        user_id: user.id,
        account_email: user.email ?? null,
        documents: [],
        client_timezone: timezone,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        locale: input.locale === 'es' ? 'es-MX' : 'en',
        surface: 'profile_settings',
        ui_version: UI_VERSION,
        disclosure_text: null,
        checkbox_text: null,
        checkbox_checked: input.marketing,
        button_label: null,
        plan_id: null,
        amount_mxn: null,
        currency: null,
        tax_included: null,
        billing_interval: null,
        trial_end_utc: null,
        charge_date_utc: null,
        reminder_date_utc: null,
        payment_method: null,
        marketing_opt_in: input.marketing,
      });
    } catch (err) {
      console.error('[profile] marketing consent not stored', err);
      return { ok: false, error: 'saveError' };
    }
  }

  if (input.locale !== input.currentLocale) {
    // next-intl's redirect adds the prefix for the chosen language ('es' is
    // the default and stays unprefixed). `saved=1` shows the toast once in
    // the new language; the page removes it from the URL.
    redirect({
      href: { pathname: '/app/settings/perfil', query: { saved: '1' } },
      locale: input.locale,
    });
  }
  return { ok: true };
}
