import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { Room } from '@/components/tools/chalito/Room';

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** /app/chalito/r/{roomId}: a room (deep links from invites and notifications land here). */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!ID.test(id)) notFound();
  return (
    <LiveGate>
      <Room roomId={id} />
    </LiveGate>
  );
}
