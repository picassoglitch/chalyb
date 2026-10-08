import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ApprovalDeepLink } from '@/components/tools/chalito/Approvals';
import { LiveGate } from '@/components/tools/chalito/LiveGate';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('approval');

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** /(en/)app/chalito/a/{approvalId}: the deep link push, WhatsApp and calls point at. */
export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!ID.test(id)) notFound();
  return (
    <LiveGate>
      <ApprovalDeepLink aid={id} />
    </LiveGate>
  );
}
