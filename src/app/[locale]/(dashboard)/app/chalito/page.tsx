import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Home } from '@/components/tools/chalito/Home';

export const metadata: Metadata = { title: 'Chalito' };

export default async function ChalitoHome({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Home />;
}
