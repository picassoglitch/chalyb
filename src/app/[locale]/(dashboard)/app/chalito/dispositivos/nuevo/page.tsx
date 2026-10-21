import { setRequestLocale } from 'next-intl/server';
import { AddDevice } from '@/components/tools/chalito/AddDevice';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('addDevice');

export default async function AddDevicePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <AddDevice />
    </LiveGate>
  );
}
