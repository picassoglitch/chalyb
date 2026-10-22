import { setRequestLocale } from 'next-intl/server';
import { OAuthConsent } from '@/components/tools/chalito/OAuthConsent';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('consent', {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
});

/** /app/chalito/oauth/consent?request=<id>: the MCP authorization server parks requests here (M10). */
export default async function ConsentPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <OAuthConsent />;
}
