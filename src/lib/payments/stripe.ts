// Stripe client and the catalog/customer lookups every Stripe path shares. Server only.
// Env names and pure rules live in stripe-config.ts; amounts come from config/pricing.ts.

import 'server-only';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/app-url';
import { CURRENCY, planPrice, type PlanKey } from '@/config/pricing';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import {
  missingStripeConfig,
  paymentsProvider,
  stripeConfigProblems,
  stripeCredentials,
  stripeLookupKey,
  stripeProductId,
  STRIPE_SECRET_KEY_VAR,
  type PaymentsProvider,
} from './stripe-config';

export type { Stripe };

let cached: { key: string; client: Stripe } | null = null;
let override: Stripe | null = null;

/** Tests point the real SDK at stripe-mock through this. */
export function setStripeClientForTests(client: Stripe | null): void {
  override = client;
  cached = null;
  priceCache.clear();
}

export function getStripe(): Stripe {
  if (override) return override;
  const key = stripeCredentials(process.env).secretKey;
  if (!key) throw new Error(`${STRIPE_SECRET_KEY_VAR} missing — Stripe checkout disabled.`);
  if (cached?.key === key) return cached.client;
  // 8s keeps a slow Stripe inside the function's budget; the SDK retries idempotent calls.
  const client = new Stripe(key, { timeout: 8000, maxNetworkRetries: 2 });
  cached = { key, client };
  return client;
}

export function getPaymentsProvider(): PaymentsProvider {
  return paymentsProvider(process.env);
}

export function usingStripe(): boolean {
  return getPaymentsProvider() === 'stripe';
}

export function stripePublishableKey(): string | undefined {
  return stripeCredentials(process.env).publishableKey;
}

export function stripeWebhookSecret(): string | undefined {
  return stripeCredentials(process.env).webhookSecret;
}

export function missingStripeVars(): string[] {
  return missingStripeConfig(process.env);
}

export function stripeWarnings(): string[] {
  return stripeConfigProblems(process.env);
}

export function isStripeReady(): boolean {
  return missingStripeVars().length === 0 && stripeWarnings().length === 0;
}

/** One Stripe Customer per user, created once (stripe_customers, unique per user). */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string | null;
  name?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const { data: found, error } = await admin
    .from('stripe_customers')
    .select('customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`stripe_customers read failed: ${error.message}`);
  if (found?.customer_id) return found.customer_id as string;
  // Same key for a racing second request: Stripe answers both with one customer.
  const customer = await getStripe().customers.create(
    {
      ...(user.email ? { email: user.email } : {}),
      ...(user.name ? { name: user.name } : {}),
      metadata: { user_id: user.id },
    },
    { idempotencyKey: `chalyb-customer-${user.id}` },
  );
  const { error: insErr } = await admin
    .from('stripe_customers')
    .upsert(
      { user_id: user.id, customer_id: customer.id },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
  if (insErr) throw new Error(`stripe_customers write failed: ${insErr.message}`);
  return customer.id;
}

const priceCache = new Map<string, string>();

/** The Stripe Price for a plan, looked up by lookup_key and created on first use. */
export async function stripePriceFor(planKey: PlanKey): Promise<{ id: string; cents: number }> {
  const price = planPrice(planKey);
  const key = stripeLookupKey(planKey, price.interval, price.totalCents);
  const hit = priceCache.get(key);
  if (hit) return { id: hit, cents: price.totalCents };
  const stripe = getStripe();
  const listed = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  let id = listed.data.find((p) => p.lookup_key === key)?.id;
  if (!id) {
    const product = await ensureProduct(price.tier);
    const created = await stripe.prices.create(
      {
        product,
        currency: CURRENCY.toLowerCase(),
        unit_amount: price.totalCents,
        recurring: { interval: price.interval },
        // config/pricing.ts amounts are customer totals with IVA inside.
        tax_behavior: 'inclusive',
        lookup_key: key,
        transfer_lookup_key: true,
        nickname: PLAN_NAMES[planKey],
        metadata: { plan_key: planKey },
      },
      { idempotencyKey: `chalyb-price-${key}` },
    );
    id = created.id;
  }
  priceCache.set(key, id);
  return { id, cents: price.totalCents };
}

async function ensureProduct(tier: 'PRO' | 'VIP'): Promise<string> {
  const stripe = getStripe();
  const id = stripeProductId(tier);
  try {
    return (await stripe.products.retrieve(id)).id;
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode !== 404) throw err;
  }
  const created = await stripe.products.create(
    { id, name: tier === 'VIP' ? 'Chalyb VIP' : 'Chalyb Pro' },
    { idempotencyKey: `chalyb-product-${id}` },
  );
  return created.id;
}

/** Stripe's id of a subscription's first-invoice PaymentIntent, from the expanded invoice. */
export function invoicePaymentIntentId(invoice: Stripe.Invoice | string | null): string | null {
  if (!invoice || typeof invoice === 'string') return null;
  for (const p of invoice.payments?.data ?? []) {
    const pi = p.payment?.payment_intent;
    if (pi) return typeof pi === 'string' ? pi : pi.id;
  }
  const secret = invoice.confirmation_secret?.client_secret;
  const m = secret ? /^(pi_[A-Za-z0-9]+)_secret_/.exec(secret) : null;
  return m?.[1] ?? null;
}

/** Where Stripe sends the buyer back if a payment method ever needs a redirect. */
export function stripeReturnUrl(path: string): string {
  return `${appUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Unix seconds → ISO, or null. */
export function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}
