import type { Metadata } from 'next';
import { LegalDocPage, legalDocMetadata } from '@/components/legal/legal-doc-page';

// Fixed, versioned URL (/quien-vende/v1-0) of Law's "Quién vende".
type Params = { params: Promise<{ locale: string; version: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, version } = await params;
  return legalDocMetadata('quien_vende', locale, version);
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: Params) {
  const { locale, version } = await params;
  return <LegalDocPage doc="quien_vende" locale={locale} versionSlugParam={version} />;
}
