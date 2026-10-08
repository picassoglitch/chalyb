import { setRequestLocale } from 'next-intl/server';
import { EndorseWait } from '@/components/tools/chalito/EndorseWait';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('link');

export default async function LinkPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <EndorseWait />;
}
