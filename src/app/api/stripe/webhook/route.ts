// POST /api/stripe/webhook — Stripe's events, signature-checked with STRIPE_WEBHOOK_SECRET.
// No secret = no entry (500, Stripe retries); a bad signature is 400 and changes nothing.

import { NextResponse } from 'next/server';
import { getStripe, stripeWebhookSecret } from '@/lib/payments/stripe';
import { handleStripeEvent } from '@/lib/payments/stripe-webhook';
import { stripeCredentials } from '@/lib/payments/stripe-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = stripeWebhookSecret();
  if (!secret || !stripeCredentials(process.env).secretKey) {
    console.error(
      '[stripe/webhook] STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY missing — asking Stripe to retry',
    );
    return NextResponse.json({ error: 'stripe not configured' }, { status: 500 });
  }
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error('[stripe/webhook] signature rejected', (err as Error).message);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    if (result.status !== 200) {
      console.error('[stripe/webhook] asking Stripe to retry', {
        type: event.type,
        id: event.id,
        ...result.body,
      });
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error('[stripe/webhook] processing threw', { type: event.type, id: event.id }, err);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
