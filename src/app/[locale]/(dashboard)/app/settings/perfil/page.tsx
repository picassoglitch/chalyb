// /app/settings/perfil — Mi perfil (FIX-3 §C, mockups 73, 74 §1). Painted on
// the server with what the account holds; the form never reads values from
// the browser. Marketing consent is the latest marketing_opt_in/_opt_out
// event (consent_events is append-only), falling back to the sign-up choice.

import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { profileNotificationPrefs } from '@/lib/config/flags';
import { ProfileForm } from '@/components/app/profile-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return { title: t('title') };
}

export default async function MiPerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { saved } = await searchParams;
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/settings/perfil', locale });
  const t = await getTranslations('profile');
  const tm = await getTranslations('myplan');

  const supabase = await createClient();
  const [{ data: profile }, { data: consent }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, preferred_locale, timezone, notify_critical, notify_daily, notify_viral')
      .eq('id', session.user.id)
      .maybeSingle(),
    createAdminClient()
      .from('consent_events')
      .select('event_type, marketing_opt_in')
      .eq('user_id', session.user.id)
      .in('event_type', ['marketing_opt_in', 'marketing_opt_out', 'signup_terms_accepted'])
      .order('timestamp_utc', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const meta = session.user.user_metadata ?? {};
  const fullName =
    (profile?.full_name as string | null) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    '';
  // The select shows the language the app is in: the saved value can still
  // be the factory default for accounts that never chose (D-F3-10).
  const current = locale === 'en' ? 'en' : 'es';
  const marketing =
    consent?.event_type === 'marketing_opt_in'
      ? true
      : consent?.event_type === 'marketing_opt_out'
        ? false
        : consent?.marketing_opt_in === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <header>
        <Link href={'/app/settings' as Route} className="ch-muted" style={{ fontSize: 17 }}>
          {tm('crumb')} ›
        </Link>
        <h1 className="ch-h1">{t('title')}</h1>
      </header>
      <ProfileForm
        initial={{
          fullName,
          locale: current,
          timezone: (profile?.timezone as string | null) ?? null,
          notifyCritical: (profile?.notify_critical as boolean | null) ?? true,
          notifyDaily: (profile?.notify_daily as boolean | null) ?? true,
          notifyViral: (profile?.notify_viral as boolean | null) ?? false,
          marketing,
        }}
        email={session.user.email ?? ''}
        showNotifications={profileNotificationPrefs()}
        justSaved={saved === '1'}
      />
    </div>
  );
}
