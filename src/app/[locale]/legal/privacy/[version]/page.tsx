import type { Metadata } from 'next';
import { LegalDocPage, legalDocMetadata } from '@/components/legal/legal-doc-page';

// Fixed, versioned URL (/legal/privacy/v1-0) that consent events cite.
type Params = { params: Promise<{ locale: string; version: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, version } = await params;
  return legalDocMetadata('privacidad', locale, version);
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: Params) {
  const { locale, version } = await params;
  return <LegalDocPage doc="privacidad" locale={locale} versionSlugParam={version} />;
}
