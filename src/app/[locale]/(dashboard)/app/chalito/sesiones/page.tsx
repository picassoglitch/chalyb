import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { SessionsList } from '@/components/tools/chalito/Sessions';

export default async function SessionsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <SessionsList />
    </LiveGate>
  );
}
