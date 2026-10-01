// The billing block's words (aceptacion-ux §3.2–3.3, BUILD-SPEC §6.5–6.6),
// built from messages/*.json and the pricing config. Pure over an injected
// translator, so the server renders the SAME text it stores as evidence
// (disclosure_text, checkbox_text) and the page shows.
//
// Bold runs are marked <b>…</b> (and the terms link <terms>…</terms>) in the
// messages: the page renders them with t.rich; evidence keeps the plain text
// (stripMarkup).

import { planPrice, type PlanKey } from '@/config/pricing';
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
    fecha_fin_prueba: date(input.dates.trialEndsAt),
    fecha_cobro: date(input.dates.chargeAt),
    fecha_recordatorio: date(input.dates.reminderAt),
    periodicidad: t(year ? 'vars.periodicidad.year' : 'vars.periodicidad.month'),
    renovacion: t(year ? 'vars.renovacion.year' : 'vars.renovacion.month', { monto }),
    renovacion_corta: t(year ? 'vars.renovacionCorta.year' : 'vars.renovacionCorta.month'),
    cada_periodo: t(year ? 'vars.cadaPeriodo.year' : 'vars.cadaPeriodo.month'),
    tarjeta: input.cardLast4 ? t('vars.tarjeta.last4', { ultimos4: input.cardLast4 }) : t('vars.tarjeta.none'),
  };
}

/** The four disclosure paragraphs, with <b> markup, in order. */
export function disclosureParagraphs(t: Translate, input: DisclosureInput): string[] {
  const v = trialVars(t, input);
  return [
    t('disclosure.today', v),
    t('disclosure.charge', v),
    t('disclosure.reminder', v),
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
