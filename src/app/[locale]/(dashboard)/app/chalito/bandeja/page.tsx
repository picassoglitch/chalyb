import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { Inbox } from '@/components/tools/chalito/Approvals';

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate>
      <Inbox />
    </LiveGate>
  );
}
