import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { CoordHome } from '@/components/tools/chalito/Coordinator';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('team');

// Coordinator mode (ADR 0025 §6): one goal, several agents on the owner's computers.
export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <CoordHome />
    </LiveGate>
  );
}
