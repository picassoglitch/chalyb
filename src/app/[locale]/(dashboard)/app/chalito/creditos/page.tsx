import { setRequestLocale } from 'next-intl/server';
import { Credits } from '@/components/tools/chalito/Credits';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('credits');

export default async function CreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Credits />;
}
