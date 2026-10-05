// The consent evidence of a credit-pack purchase (Términos de los Paquetes
// §9.2): written BEFORE Mercado Pago is asked for anything, so no pack is
// ever charged without it. Same log, chain and fields as the plan checkout
// (start-subscription.ts): document versions and hashes, the texts shown,
// the box, the button, the amount, IVA, the time, IP and device.

import 'server-only';
import { getTranslations } from 'next-intl/server';
import { recordConsent, requestContext, UI_VERSION } from '@/lib/billing/consent';
import { sha256, type ConsentEventRecord } from '@/lib/billing/consent-core';
import { evidenceText, stripMarkup } from '@/lib/billing/billing-copy';
import { formatMXN } from '@/lib/billing/format';
import { legalDocument, legalDocuments } from '@/lib/legal/documents';
import { currentVersion } from '@/lib/legal/registry';
import type { PackPricing } from '@/config/pack-pricing';
import { CURRENCY } from '@/config/pricing';
import { packConsentSentence, type Translate } from './pack-checkout-core';
import { PACK_CONSENT_EVENT } from './pack-prices';
import type { TokenPackDef } from './pricing';

/** The pack checkout's words, rendered as the page renders them. */
export async function packCheckoutTranslator(locale: string): Promise<Translate> {
  const tp = await getTranslations({ locale, namespace: 'packCheckout' });
  return (key, values) =>
    tp.markup(
      key as never,
      {
        ...(values ?? {}),
        b: (c: string) => `<b>${c}</b>`,
        terms: (c: string) => `<terms>${c}</terms>`,
      } as never,
    );
}

/** The disclosure above the checkbox (with markup). */
export function packDisclosure(t: Translate, input: { cents: number; tokens: number; locale: string }) {
  return t('disclosure', {
    monto: formatMXN(input.cents),
    n: input.tokens.toLocaleString(input.locale === 'es' ? 'es-MX' : 'en-US'),
  });
}

export async function recordPackConsent(input: {
  userId: string;
  email: string | null;
  pack: TokenPackDef;
  cents: number;
  pricing: PackPricing;
  termsText: string;
  locale: string;
  clientTimezone: string | null;
  mode: 'card' | 'hosted';
}): Promise<ConsentEventRecord> {
  const locale = input.locale === 'en' ? 'en' : 'es';
  const t = await packCheckoutTranslator(locale);
  const vars = { cents: input.cents, tokens: input.pack.tokens, locale };
  const ctx = await requestContext();
  return recordConsent({
    event_type: PACK_CONSENT_EVENT,
    user_id: input.userId,
    account_email: input.email,
    // The Paquetes text exactly as shown (its prices bound): for the default
    // prices this is the hash `pnpm legal:hash` recorded.
    documents: [
      { ...legalDocument('paquetes'), sha256: sha256(input.termsText) },
      ...legalDocuments('terminos', 'privacidad'),
    ],
    client_timezone: input.clientTimezone,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    locale: locale === 'es' ? 'es-MX' : 'en',
    surface: input.mode === 'card' ? 'web_pack_checkout' : 'web_pack_checkout_hosted',
    ui_version: UI_VERSION,
    disclosure_text: evidenceText([packDisclosure(t, vars)]),
    checkbox_text: stripMarkup(packConsentSentence(t, vars)),
    checkbox_checked: true,
    button_label: stripMarkup(t(input.mode === 'card' ? 'cta' : 'hostedCta', { monto: formatMXN(input.cents) })),
    plan_id: input.pack.id,
    amount_mxn: input.cents / 100,
    currency: CURRENCY,
    tax_included: true,
    billing_interval: null,
    trial_end_utc: null,
    charge_date_utc: new Date().toISOString(),
    reminder_date_utc: null,
    payment_method: { processor: 'mercadopago', mode: input.mode },
    marketing_opt_in: false,
    details: {
      credits: input.pack.tokens,
      terms_version: currentVersion('paquetes'),
      iva_mode: input.pricing.ivaMode,
      iva_rate_percent: input.pricing.ivaMode === 'add' ? input.pricing.ivaRatePercent : null,
      price_as_set_cents: input.pricing.prices[input.pack.id],
      recurring: false,
    },
  });
}
