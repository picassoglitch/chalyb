import { setRequestLocale } from 'next-intl/server';
import { Connectors } from '@/components/tools/chalito/Connectors';

export default async function ConnectorsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Connectors />;
}
