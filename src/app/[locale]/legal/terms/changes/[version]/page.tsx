import {
  LegalChangesPage,
  legalChangesMetadata,
  type Params,
} from '@/components/legal/legal-changes-page';

export const generateMetadata = legalChangesMetadata;
export const dynamic = 'force-dynamic';

export default async function Page({ params }: Params) {
  return <LegalChangesPage doc="terminos" params={params} />;
}
