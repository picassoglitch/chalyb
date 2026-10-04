// /app/subscription — stays (FIX-3 §A.1): Mercado Pago's back_url, the
// "Método de pago" target and the fallback when the trial flow is off. It
// syncs ?status on the way back, then shows the one Mi plan view: Gratis
// here, every paid state on /app/billing.

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { syncSubscription } from '@/lib/payments/subscription-sync';
import { loadBilling } from '@/lib/billing/subscription-store';
import { isAdminRole } from '@/lib/billing/tiers';
import { MiPlanView } from '@/components/app/billing/mi-plan-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myplan');
  return { title: t('title') };
}

export default async function SubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: returnStatus } = await searchParams;
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/subscription', locale });

  // Back from the Mercado Pago-hosted authorisation (?status=success on the
  // preapproval's back_url): refresh the pending preapproval now instead of
  // waiting for the webhook, so the plan shows active on this very render.
  if (returnStatus) {
    const supabase = await createClient();
    const { data: pendingRow } = await supabase
      .from('subscriptions')
      .select('mp_preapproval_id')
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingRow?.mp_preapproval_id) {
      try {
        await syncSubscription(pendingRow.mp_preapproval_id as string);
      } catch (err) {
        // The webhook finishes the job; the page just shows "pending" meanwhile.
        console.error('[mp/subscription] sync on return failed', err);
      }
    }
  }

  const billing = await loadBilling(session.user.id).catch(() => null);
  const paid = billing && billing.primary.state !== 'free';
  if (paid || isAdminRole(session.role)) {
    const qs = returnStatus ? `?status=${encodeURIComponent(returnStatus)}` : '';
    return redirect({ href: `/app/billing${qs}`, locale });
  }
  return (
    <MiPlanView locale={locale} session={session} openCancel={false} returnStatus={returnStatus} />
  );
}
