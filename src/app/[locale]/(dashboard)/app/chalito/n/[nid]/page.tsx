import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { NotificationRedirect } from '@/components/tools/chalito/NotificationRedirect';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('notification');

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** /(en/)app/chalito/n/{notificationId}: SMS, WhatsApp and push links land here. */
export default async function NotificationPage({
  params,
}: {
  params: Promise<{ locale: string; nid: string }>;
}) {
  const { locale, nid } = await params;
  setRequestLocale(locale);
  if (!ID.test(nid)) notFound();
  return <NotificationRedirect nid={nid} />;
}
