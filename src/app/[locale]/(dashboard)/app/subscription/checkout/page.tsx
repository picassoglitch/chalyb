import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';

// /app/subscription/checkout — the legacy monthly card form. Retired: plans are
// sold only through /app/prueba and /app/billing, which record the billing
// consent, check the chargeback / region blocks and store the plan key. This
// path skipped all of that, so it now always sends the visitor to billing
// (the server actions behind the old form refuse too: sales_closed).
export default async function SubscriptionCheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return redirect({ href: '/app/billing', locale });
}
