import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
// The legacy stylesheet (Tailwind + lp-/auth-/legal- classes). Not in the
// root layout any more: the rebuilt public pages don't use it, and it was
// their biggest render-blocking CSS (LANDING-SPEC §7).
import '../globals.css';

// Private routes stay out of search results. robots.txt already disallows
// them; this covers a crawler that reaches one through a link anyway.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The root layout sends public pages only their own namespaces
// (src/i18n/client-messages.ts); the app and the owner panel get them all.
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
