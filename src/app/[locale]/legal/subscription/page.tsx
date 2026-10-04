import type { Metadata } from 'next';
import { LegalDocPage, legalDocMetadata } from '@/components/legal/legal-doc-page';

// The current version of Law's document. /suscripcion and /uso-aceptable
// redirect here (vercel.json); the landing footer links this path.
type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return legalDocMetadata('suscripcion', locale);
}

export const dynamic = 'force-dynamic';

export default async function SubscriptionPage({ params }: Params) {
  const { locale } = await params;
  return <LegalDocPage doc="suscripcion" locale={locale} />;
}
