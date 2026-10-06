import { setRequestLocale } from 'next-intl/server';
import { Download } from '@/components/tools/chalito/Download';

export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Download />;
}
