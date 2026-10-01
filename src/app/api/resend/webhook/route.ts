// POST /api/resend/webhook — delivery status for the notices we send
// (rebuild P2-6.3). Verified (Svix); 401 otherwise.
//
//   email.delivered → email_dispatches delivered; a mandatory pre-charge
//                     notice marks the subscription's reminder delivered
//   email.bounced   → bounced + `notice_bounced` evidence + admin attention;
//                     the billing cron then holds the charge

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';
import { recordConsent, UI_VERSION } from '@/lib/billing/consent';
import { MANDATORY_NOTICE_KINDS, verifyResendSignature } from '@/lib/email/resend-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const ok = verifyResendSignature({
    secret: process.env.RESEND_WEBHOOK_SECRET,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signatureHeader: req.headers.get('svix-signature'),
    body,
  });
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const event = JSON.parse(body) as {
    type?: string;
    created_at?: string;
    data?: { email_id?: string };
  };
  const messageId = event.data?.email_id;
  if (!messageId || (event.type !== 'email.delivered' && event.type !== 'email.bounced')) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const admin = createAdminClient();
  const { data: dispatch } = await admin
    .from('email_dispatches')
    .select('id, user_id, kind, period_key, delivery_status')
    .eq('provider_message_id', messageId)
    .maybeSingle();
  if (!dispatch) return NextResponse.json({ ok: true, unknown: true });

  const at = event.created_at ?? new Date().toISOString();
  if (event.type === 'email.delivered') {
    await admin
      .from('email_dispatches')
      .update({ delivery_status: 'delivered', delivered_at: at })
      .eq('id', dispatch.id as string);
    if (MANDATORY_NOTICE_KINDS.has(dispatch.kind as string)) {
      await admin
        .from('subscriptions')
        .update({ reminder_delivered_at: at })
        .eq('user_id', dispatch.user_id as string)
        .in('status', ['authorized', 'paused'])
        .is('reminder_delivered_at', null);
    }
    return NextResponse.json({ ok: true });
  }

  // email.bounced
  if (dispatch.delivery_status === 'bounced')
    return NextResponse.json({ ok: true, duplicate: true });
  await admin
    .from('email_dispatches')
    .update({ delivery_status: 'bounced', bounced_at: at })
    .eq('id', dispatch.id as string);
  await recordConsent({
    event_type: 'notice_bounced',
    user_id: dispatch.user_id as string,
    account_email: null,
    documents: [],
    client_timezone: null,
    ip_address: null,
    user_agent: null,
    locale: 'es-MX',
    surface: 'email',
    ui_version: UI_VERSION,
    disclosure_text: null,
    checkbox_text: null,
    checkbox_checked: null,
    button_label: null,
    plan_id: null,
    amount_mxn: null,
    currency: null,
    tax_included: null,
    billing_interval: null,
    trial_end_utc: null,
    charge_date_utc: null,
    reminder_date_utc: null,
    payment_method: null,
    marketing_opt_in: false,
    details: {
      kind: dispatch.kind,
      period_key: dispatch.period_key,
      provider_message_id: messageId,
    },
  }).catch((err) => console.error('[resend/webhook] evidence not stored', err));
  if (MANDATORY_NOTICE_KINDS.has(dispatch.kind as string)) {
    await notify({
      severity: 'warning',
      title: 'Aviso previo al cobro rebotó — el cobro queda detenido',
      body: `usuario ${dispatch.user_id as string} · ${dispatch.kind as string} ${dispatch.period_key as string}`,
      href: '/dashboard/billing',
      source: 'resend.webhook',
    });
  }
  return NextResponse.json({ ok: true });
}
