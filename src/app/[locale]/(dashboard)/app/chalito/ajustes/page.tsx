import { setRequestLocale } from 'next-intl/server';
import { Settings } from '@/components/tools/chalito/Settings';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('settings');

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Settings />;
}
