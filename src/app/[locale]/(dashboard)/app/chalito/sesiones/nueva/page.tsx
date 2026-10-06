import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { NewSession } from '@/components/tools/chalito/NewSession';

export default async function NewSessionPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <NewSession />
    </LiveGate>
  );
}
