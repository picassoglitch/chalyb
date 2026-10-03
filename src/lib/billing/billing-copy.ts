// The billing block's words (aceptacion-ux §3.2–3.3, BUILD-SPEC §6.5–6.6),
// built from messages/*.json and the pricing config. Pure over an injected
// translator, so the server renders the SAME text it stores as evidence
// (disclosure_text, checkbox_text) and the page shows.
//
// Bold runs are marked <b>…</b> (and the terms link <terms>…</terms>) in the
// messages: the page renders them with t.rich; evidence keeps the plain text
// (stripMarkup).

import { PRICING, planPrice, type PlanKey } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from './format';
import type { TrialDates } from './trial-dates';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function stripMarkup(text: string): string {
  return text.replace(/<\/?(b|terms)>/g, '');
}

export interface DisclosureInput {
  planKey: PlanKey;
  dates: TrialDates;
  cardLast4: string | null;
  locale: string;
}

/** Variables shared by every trial text. */
export function trialVars(t: Translate, input: DisclosureInput) {
  const price = planPrice(input.planKey);
  const monto = formatMXN(price.totalCents);
  const year = price.interval === 'year';
  const date = (d: Date) => formatFechaLarga(d, input.locale);
  return {
    monto,
    dias: PRICING.trial.days,
    fecha_fin_prueba: date(input.dates.trialEndsAt),
    fecha_cobro: date(input.dates.chargeAt),
    fecha_recordatorio: date(input.dates.reminderAt),
    plan: price.tier === 'VIP' ? 'VIP' : 'Pro',
    periodicidad: t(year ? 'vars.periodicidad.year' : 'vars.periodicidad.month', {
      plan: price.tier === 'VIP' ? 'VIP' : 'Pro',
    }),
    renovacion: t(year ? 'vars.renovacion.year' : 'vars.renovacion.month', { monto }),
    renovacion_corta: t(year ? 'vars.renovacionCorta.year' : 'vars.renovacionCorta.month'),
    cada_periodo: t(year ? 'vars.cadaPeriodo.year' : 'vars.cadaPeriodo.month'),
    tarjeta: input.cardLast4
      ? t('vars.tarjeta.last4', { ultimos4: input.cardLast4 })
      : t('vars.tarjeta.none'),
  };
}

/** The charge block (aceptacion-ux §3.2), one paragraph per line of Law's
 *  template, with <b> markup, in order. */
export function disclosureParagraphs(t: Translate, input: DisclosureInput): string[] {
  const v = trialVars(t, input);
  return [
    t('disclosure.today', v),
    t('disclosure.ends', v),
    t('disclosure.charge', v),
    t('disclosure.notice', v),
    t('disclosure.cancel', v),
  ];
}

/** The exact consent checkbox sentence (with <b> markup). */
export function consentSentence(t: Translate, input: DisclosureInput): string {
  return t('pay.consent', trialVars(t, input));
}

/** Plain text stored as evidence: exactly what the user saw, variables in. */
export function evidenceText(paragraphs: string[]): string {
  return paragraphs.map(stripMarkup).join('\n');
}

/** Paid checkouts (no trial). Annual plans: Law Q4's charge block and
 *  checkbox, verbatim, for VIP anual; the same wording for Pro anual bought
 *  without a trial (TODO(owner): Law to confirm). Monthly: the existing
 *  "Acepto que Chalyb cobre automáticamente … hoy …" sentence. */
export interface PaidInput {
  planKey: PlanKey;
  /** The first renewal: one period after today. */
  renewalAt: Date;
  cardLast4: string | null;
  locale: string;
}

export function paidVars(t: Translate, input: PaidInput) {
  const price = planPrice(input.planKey);
  const year = price.interval === 'year';
  return {
    monto: formatMXN(price.totalCents),
    plan: price.tier === 'VIP' ? 'VIP' : 'Pro',
    fecha_renovacion: formatFechaLarga(input.renewalAt, input.locale),
    renovacion_corta: t(year ? 'vars.renovacionCorta.year' : 'vars.renovacionCorta.month'),
    cada_periodo: t(year ? 'vars.cadaPeriodo.year' : 'vars.cadaPeriodo.month'),
    tarjeta: input.cardLast4
      ? t('vars.tarjeta.last4', { ultimos4: input.cardLast4 })
      : t('vars.tarjeta.none'),
  };
}

/** The charge block shown next to the paid button (with <b> markup). */
export function paidParagraphs(t: Translate, input: PaidInput): string[] {
  const v = paidVars(t, input);
  return planPrice(input.planKey).interval === 'year'
    ? [t('paid.chargeYear', v)]
    : [t('paid.chargeMonth', v)];
}

/** The paid checkbox sentence (with <b>/<terms> markup). */
export function paidConsentSentence(t: Translate, input: PaidInput): string {
  const v = paidVars(t, input);
  return planPrice(input.planKey).interval === 'year'
    ? t('paid.consentYear', v)
    : t('paid.consentMonth', v);
}
