import type { Metadata } from 'next';
import { LegalDocPage, legalDocMetadata } from '@/components/legal/legal-doc-page';

// The current version of Law's credit-pack terms. /paquetes redirects here
// (next.config.ts).
type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return legalDocMetadata('paquetes', locale);
}

export const dynamic = 'force-dynamic';

export default async function PacksPage({ params }: Params) {
  const { locale } = await params;
  return <LegalDocPage doc="paquetes" locale={locale} />;
}
