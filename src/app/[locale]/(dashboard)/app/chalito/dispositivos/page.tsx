import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { Devices } from '@/components/tools/chalito/Devices';

export default async function DevicesPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <Devices />
    </LiveGate>
  );
}
