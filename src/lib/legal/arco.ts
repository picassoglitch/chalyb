// "Mis datos (derechos ARCO)" (Aviso de privacidad §5; old P6-8), the pure
// part: validating a request and its legal deadlines.
//
// Aviso §5.3: we answer within 20 days of receiving the complete request
// (extendable once by the same period when justified) and, if it proceeds,
// carry it out within 15 days of the answer. The Aviso says "días"; we count
// calendar days, the stricter reading, so a deadline is never missed.

import { escapeHtml } from '@/lib/email/escape';
import { wrap } from '@/lib/email/templates';

export const ARCO_RIGHTS = [
  'access',
  'rectification',
  'cancellation',
  'opposition',
  'automated',
] as const;
export type ArcoRight = (typeof ARCO_RIGHTS)[number];

export const ARCO_RESPOND_DAYS = 20;
export const ARCO_EFFECT_DAYS = 15;
const DAY = 86_400_000;

export interface ArcoInput {
  right: string;
  description: string;
  dataLocation?: string;
  correctValue?: string;
}

export type ArcoError = 'right' | 'description' | 'correctValue' | 'tooLong';

/** First problem with a request, or null. Identity comes from the signed-in
 *  account (Aviso §5.2.1–2: sent "desde el correo de tu cuenta"). */
export function arcoError(i: ArcoInput): ArcoError | null {
  if (!(ARCO_RIGHTS as readonly string[]).includes(i.right)) return 'right';
  const d = i.description.trim();
  if (!d) return 'description';
  if (i.right === 'rectification' && !(i.correctValue ?? '').trim()) return 'correctValue';
  if (
    d.length > 4000 ||
    (i.dataLocation ?? '').length > 2000 ||
    (i.correctValue ?? '').length > 2000
  )
    return 'tooLong';
  return null;
}

export function arcoRespondBy(receivedAt: Date, extended = false): Date {
  return new Date(receivedAt.getTime() + ARCO_RESPOND_DAYS * (extended ? 2 : 1) * DAY);
}

export function arcoEffectiveBy(respondedAt: Date): Date {
  return new Date(respondedAt.getTime() + ARCO_EFFECT_DAYS * DAY);
}

/** Open requests whose answer is due within `withinDays` (admin attention). */
export function arcoDueSoon(
  rows: { respond_by: string; responded_at: string | null }[],
  now: Date,
  withinDays = 5,
): number {
  const limit = now.getTime() + withinDays * DAY;
  return rows.filter((r) => !r.responded_at && Date.parse(r.respond_by) <= limit).length;
}

/** At most this many ARCO requests per account per day (shared durable
 *  limiter, check_contact_rate_limit). */
export const ARCO_DAILY_LIMIT = 5;

export type ArcoOutcome = 'granted' | 'partially_granted' | 'denied' | 'incomplete';

/** The answer's email (Aviso §5.3), in Spanish: outcome and, when it
 *  proceeds, the date it will be carried out by. */
export function arcoAnswerEmail(v: {
  folio: string;
  right: string;
  outcome: ArcoOutcome;
  effectiveBy: string | null;
}) {
  const what: Record<ArcoOutcome, string> = {
    granted: 'Procede.',
    partially_granted: 'Procede en parte.',
    denied: 'No procede.',
    incomplete: 'Nos falta información para atenderla.',
  };
  const lines = [
    `Respondimos tu solicitud sobre tus datos (derecho: ${v.right}, folio ${v.folio}).`,
    `Resultado: ${what[v.outcome]}`,
    v.effectiveBy ? `La haremos efectiva a más tardar el ${v.effectiveBy}.` : '',
    v.outcome === 'incomplete'
      ? 'Responde a este correo con lo que falta y la retomamos.'
      : 'Si no estás de acuerdo, responde a este correo. También puedes acudir a la autoridad de protección de datos (Aviso de privacidad §5.6).',
  ].filter(Boolean);
  return {
    subject: `Respuesta a tu solicitud ARCO (folio ${v.folio})`,
    text: lines.join('\n'),
    html: wrap({
      title: 'Respuesta a tu solicitud ARCO',
      preview: what[v.outcome],
      body: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(''),
    }),
  };
}
