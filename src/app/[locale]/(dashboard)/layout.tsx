import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

// Private routes stay out of search results. robots.txt already disallows
// them; this covers a crawler that reaches one through a link anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The root layout sends public pages only their own namespaces
// (src/i18n/client-messages.ts); the app and the owner panel get them all.
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
