import { setRequestLocale } from 'next-intl/server';
import { Download } from '@/components/tools/chalito/Download';
import { chalitoMetadata } from '@/lib/chalito/meta';

export const generateMetadata = chalitoMetadata('download');

export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Download />;
}
