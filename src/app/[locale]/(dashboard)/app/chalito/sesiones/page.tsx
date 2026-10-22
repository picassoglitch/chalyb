import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { SessionsList } from '@/components/tools/chalito/Sessions';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('sessions');

export default async function SessionsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <SessionsList />
    </LiveGate>
  );
}
