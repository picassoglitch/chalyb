// "Mis datos (derechos ARCO)" (Aviso de privacidad §5; old P6-8), the pure
// part: validating a request and its legal deadlines.
//
// Aviso §5.3: we answer within 20 days of receiving the complete request
// (extendable once by the same period when justified) and, if it proceeds,
// carry it out within 15 days of the answer. The Aviso says "días"; we count
// calendar days, the stricter reading, so a deadline is never missed.

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
