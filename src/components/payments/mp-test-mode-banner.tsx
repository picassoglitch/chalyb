import { getTranslations } from 'next-intl/server';
import { getMpEnv } from '@/lib/payments/mercadopago';

/** Visible only when this deployment resolved MP_ENV=test. Production
 *  (Vercel Production, default prod) renders nothing — no layout change. */
export async function MpTestModeBanner() {
  if (getMpEnv() !== 'test') return null;
  const t = await getTranslations('checkout.pay');
  return (
    <p role="status" className="ch-disc">
      {t('testMode')}
    </p>
  );
}
