import { setRequestLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { SettingsForm } from '@/components/workspace/settings-form';

export default async function WorkspaceSettingsPage({
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
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    session?.user.email?.split('@')[0] ||
    'Operator';
  const email = session?.user.email ?? 'operator@chalyb.com';

  return (
    <div className="cc-scroll">
      <SettingsForm
        defaultName={fullName}
        defaultEmail={email}
        defaultLocale={locale === 'es' ? 'es' : 'en'}
        justSaved={saved === '1'}
      />
    </div>
  );
}
