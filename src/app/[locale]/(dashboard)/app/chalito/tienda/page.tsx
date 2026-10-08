import { setRequestLocale } from 'next-intl/server';
import { Store } from '@/components/tools/chalito/Store';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('store');

export default async function StorePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Store />;
}
