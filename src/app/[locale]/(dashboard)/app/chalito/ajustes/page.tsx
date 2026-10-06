import { setRequestLocale } from 'next-intl/server';
import { Settings } from '@/components/tools/chalito/Settings';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Settings />;
}
