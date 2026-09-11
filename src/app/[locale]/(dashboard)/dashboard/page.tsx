import { setRequestLocale } from 'next-intl/server';
import { OperatorSurface, Toolbar } from '@/components/dashboard/operator-rows';

export default async function OperationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Toolbar />
      <div className="cc-scroll">
        <OperatorSurface />
      </div>
    </>
  );
}
