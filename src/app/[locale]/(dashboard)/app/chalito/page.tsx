import { setRequestLocale } from 'next-intl/server';
import { Home } from '@/components/tools/chalito/Home';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('home');

export default async function ChalitoHome({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Home />;
}
