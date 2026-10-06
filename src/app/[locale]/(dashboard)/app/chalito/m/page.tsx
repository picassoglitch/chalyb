import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { Mesas } from '@/components/tools/chalito/Mesas';

export default async function MesasPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <Mesas />
    </LiveGate>
  );
}
